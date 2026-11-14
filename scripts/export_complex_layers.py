"""Exporta e compara as composições complexas. Requer Pillow, NumPy e OpenCV."""

import argparse
import json
from itertools import combinations, product
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from complex_matte import artwork_mask, pose_matte

from export_camera_layers import CAMERAS, ROOT, opaque_interior, read_rgb
from compose_cam03 import load_layers
from export_closet_states import CLOSET, CLOSET_SOURCES, DOORWAY_SOURCES, closed_gate, doorway_art, room_art
from export_office_states import CHARACTERS as CLOSET_CAST, load


CAST = ("original", "yandere", "gotica", "platinada", "maid")
SIMPLE_GATES = ("open-open", "open-closed", "closed-open", "closed-closed")
SILHOUETTES = json.loads(Path(__file__).with_name("complex_silhouettes.json").read_text(encoding="utf-8"))
def register_pose(layers, key, footprint, source, base, scene, folder, previous=(), guide=None, fixed=False):
    x, y, right, bottom = footprint.getbbox()
    box = (max(0, x - 2), max(0, y - 2), min(source.width, right + 2), min(source.height, bottom + 2))
    artwork = SILHOUETTES[scene][key]
    initial = np.asarray(footprint.crop(box).getchannel("A")).copy()
    for start, end in artwork.get("occluded_rows", []):
        initial[max(0, start - box[1]):max(0, end - box[1])] = 0
    if fixed:
        # Preserva os sprites nativos RGBA e as máscaras originais da sala
        # do armário. Só limpa os recortes de fundo marcados nas pranchas.
        actor = np.asarray(source.crop(box)).copy()
        coverage = artwork_mask(actor.shape[1::-1], artwork)
        actor[..., 3] = np.rint(actor[..., 3] * (coverage.astype(np.float32) / 255))
        actor = Image.fromarray(actor)
    else:
        actor = pose_matte(source.crop(box), base.crop(box), initial, artwork,
                          guide.crop(box) if guide is not None else None)

    # Complementos são definidos na arte (cadeira, borda da mesa ou reflexo
    # de contato). A área restante do quadro ocupado é descartada.
    support = np.zeros((*initial.shape, 4), np.uint8)
    patches = SILHOUETTES["environment"].get(scene, {}).get(key, [])
    for patch in patches:
        coverage = artwork_mask(initial.shape[::-1], {"outline": patch})
        measured = np.asarray(footprint.crop(box))
        support[..., :3] = measured[..., :3]
        support[..., 3] = np.maximum(support[..., 3], np.rint(measured[..., 3] * (coverage.astype(np.float32) / 255)))
    if patches:
        # O primeiro plano já determina a cor sob a silhueta.
        support[..., 3][np.asarray(actor.getchannel("A")) > 220] = 0
    support[support[..., 3] == 0] = 0

    for name, crop in ((key + "+ambiente", Image.fromarray(support)), (key, actor)):
        if crop.getbbox():
            image = Image.new("RGBA", source.size)
            image.paste(crop, box[:2])
            layers[name] = save_layer(image, folder / f"{name}.webp",
                                      [entry["layers"][name] for entry in previous if name in entry["layers"]])


def layer_applies(key, selected):
    return all(part == "ambiente" or part in selected for part in key.split("+"))


def isolated_sheet(scene, output):
    layers = scene["layers"]
    width, height = 290, 330
    sheet = Image.new("RGB", (width * 4, height * len(layers)), "#313136")
    draw = ImageDraw.Draw(sheet)
    for row, (key, (url, *_)) in enumerate(layers.items()):
        image = open_rgba(url)
        image.thumbnail((width - 14, height - 27))
        # A primeira vista sinaliza a transparência com um xadrez.
        checker = Image.new("RGBA", image.size, "#929292")
        tiles = ImageDraw.Draw(checker)
        for y in range(0, image.height, 12):
            for x in range(0, image.width, 12):
                if (x // 12 + y // 12) % 2:
                    tiles.rectangle((x, y, x + 11, y + 11), fill="#c9c9c9")
        for column, background in enumerate((checker, *(Image.new("RGBA", image.size, color)
                for color in ("#000000", "#ffffff", "#3a9388")))):
            background.alpha_composite(image)
            sheet.paste(background, (column * width + 5, row * height + 23))
        draw.text((5, row * height + 4), key, fill="white")
    sheet.save(output, quality=94)


def save_layer(image, target, shared=()):
    x, y, right, bottom = image.getbbox()
    x, y = max(x - 2, 0), max(y - 2, 0)
    right, bottom = min(right + 2, image.width), min(bottom + 2, image.height)
    crop = image.crop((x, y, right, bottom))
    box = [x, y, crop.width, crop.height]
    for url, *other in shared:
        if other == box:
            with Image.open(ROOT / url) as candidate:
                alpha = np.asarray(crop.getchannel("A")) != 0
                if (np.array_equal(np.asarray(candidate.getchannel("A")) != 0, alpha)
                        and np.array_equal(np.asarray(candidate)[alpha], np.asarray(crop)[alpha])):
                    return [url, *box]
    target = ROOT / target
    target.parent.mkdir(parents=True, exist_ok=True)
    crop.save(target, lossless=True, method=5)
    return ["./" + target.relative_to(ROOT).as_posix(), *box]


def extract(base, source, covered):
    # O interior é opaco mesmo onde a cor da roupa coincide com o fundo.
    # A borda e as sombras usam alpha parcial com compensação da cor da base.
    delta = source - base
    strength = np.max(np.abs(delta), axis=2)
    interior = opaque_interior(strength)
    minimum = np.max(np.abs(delta) / np.maximum(np.where(delta > 0, 255 - base, base), 1), axis=2)
    alpha = np.maximum(interior, np.minimum(strength / 42, 1))
    alpha = np.maximum(minimum, alpha)
    alpha[covered] = strength[covered] > 0
    covered |= strength > 0
    alpha = np.ceil(alpha * 255)
    rgb = base + delta * 255 / np.maximum(alpha[..., None], 1)
    rgba = np.rint(np.dstack((rgb, alpha))).clip(0, 255).astype(np.uint8)
    rgba[alpha == 0, :3] = 0
    return Image.fromarray(rgba)


def open_rgba(path):
    live = ROOT / path
    with Image.open(live if live.exists() else ROOT / "reserva" / path) as image:
        return image.convert("RGBA")


def camera_scene(camera, gate="", shared=()):
    folder = CAMERAS / camera
    states = folder / "states" / gate
    base_path = states / "vazia.webp" if gate and gate != "closed-closed" else folder / "base.webp"
    order = ("yandere", "original", "gotica", "maid") if gate else CAST
    base = read_rgb(base_path)
    height, width, _ = base.shape
    covered = np.zeros((height, width), dtype=bool)
    layers = {}
    backdrop = open_rgba(base_path)
    guide = load(ROOT / "outros/arte/cameras" / camera / "occupied.png")
    for key in order:
        frame = open_rgba(states / f"{key}.webp")
        layer = extract(base, np.asarray(frame.convert("RGB"), dtype=np.float32), covered)
        register_pose(layers, key, layer, frame, backdrop, camera, folder / "layers" / gate, shared, guide)
    return {"size": [width, height], "layers": layers}


def compare(base, scene, references, output=None, empty=None, columns=1):
    decoded = {key: (open_rgba(url), (x, y)) for key, (url, x, y, _, _) in scene["layers"].items()}
    report = {}
    rows = (len(references) + columns - 1) // columns
    sheet = Image.new("RGB", (900 * columns, 132 * rows), "#28252d") if output else None
    for index, (key, path, selected) in enumerate(references):
        frame = (empty if not selected and empty is not None else base).copy()
        for id, (layer, position) in decoded.items():
            if layer_applies(id, selected):
                frame.alpha_composite(layer, position)
        reference = path.copy() if isinstance(path, Image.Image) else open_rgba(path)
        difference = np.abs(np.asarray(frame, dtype=np.int16) - np.asarray(reference, dtype=np.int16))[:, :, :3]
        peak = np.max(difference, axis=2)
        error_box = Image.fromarray((peak > 12).astype(np.uint8)).getbbox()
        report[key] = {"mean": round(float(peak.mean()), 5), "above12": round(float((peak > 12).mean()), 7),
                       "bounds": error_box}
        if sheet:
            left, top = index % columns * 900, index // columns * 132
            ImageDraw.Draw(sheet).text((left + 4, top + 2), key, fill="white")
            diff = Image.fromarray(np.minimum(peak * 7, 255).astype(np.uint8))
            for column, image in enumerate((reference, frame, diff)):
                image.thumbnail((298, 112))
                sheet.paste(image, (left + 300 * column, top + 18))
    if sheet:
        sheet.save(output, quality=92)
    return report


def camera_references(camera, gate, cast):
    folder = CAMERAS / camera
    states = folder / "states" / gate
    base = states / "vazia.webp" if gate and gate != "closed-closed" else folder / "base.webp"
    return [("vazia", base, ())] + [
        (key, states / f"{key}.webp", group)
        for count in range(1, len(cast) + 1)
        for group in combinations(cast, count)
        for key in ["todas" if count == len(cast) else "-".join(group)]
    ]


def verify_camera(camera, report, count):
    assert len(report) == count
    # Mantém os limites históricos como diagnóstico de fidelidade. O recorte
    # corrigido pode divergir intencionalmente nas bordas e fora da silhueta.
    limit = 0.00031 if camera == "CAM06" else 0
    outliers = [key for key, metrics in report.items()
                if metrics["mean"] > limit or metrics["above12"] > 0.00001]
    print(f"{camera}: {len(outliers)}/{count} acima dos limites históricos ({limit}, 0.00001)")
    assert report["vazia"]["bounds"] is None


def write_catalog(camera, entry):
    path = ROOT / "src/data/complex-layers.js"
    current = json.loads(path.read_text(encoding="utf-8").split(" = ", 1)[1].strip().removesuffix(";")) if path.exists() else {}
    current[camera] = entry
    path.write_text("// Gerado por scripts/export_complex_layers.py.\n"
                    "window.NathGame.complexLayers = " + json.dumps(current, indent=2) + ";\n", encoding="utf-8")


def run(camera, output):
    scene = camera_scene(camera)
    references = camera_references(camera, "", CAST)
    base = open_rgba(references[0][1])
    report = compare(base, scene, references, output / f"{camera}.jpg" if output else None)
    print(camera, len(report), sorted(report.items(), key=lambda entry: entry[1]["mean"], reverse=True)[:5])
    if output:
        (output / f"{camera}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        isolated_sheet(scene, output / f"{camera}-isolado.jpg")
    verify_camera(camera, report, 32)
    write_catalog(camera, scene)


def vip_scene(output):
    catalog = {}
    for gate in SIMPLE_GATES:
        scene = camera_scene("CAM05", gate, catalog.values())
        references = camera_references("CAM05", gate, (*CAST[:3], "maid"))
        base = open_rgba(references[0][1])
        for group in (("original", "yandere"), ("yandere", "maid")):
            frame = base.copy()
            for id, (url, x, y, _, _) in scene["layers"].items():
                if layer_applies(id, group):
                    frame.alpha_composite(open_rgba(url), (x, y))
            key = "+".join(group)
            source = open_rgba(next(path for _, path, ids in references if ids == group))
            # A edição das duas poses juntas desenha de outra forma as
            # bordas de encontro da cadeira e das personagens.
            # Limita a correção ao encontro identificado na versão anterior.
            # O resto da diferença é o novo contorno das poses.
            old_masks = {"original+yandere": (821, 530, 860, 754),
                         "yandere+maid": (1194, 419, 1214, 453)}
            box = old_masks[key]
            cropped = source.crop(box)
            delta = np.asarray(cropped) != np.asarray(frame.crop(box))
            cropped.putalpha(Image.fromarray(np.any(delta, axis=2).astype(np.uint8) * 255))
            source = Image.new("RGBA", base.size)
            source.paste(cropped, box[:2])
            scene["layers"][key] = save_layer(
                source, CAMERAS / "CAM05/layers" / gate / f"{key}.webp",
                [previous["layers"][key] for previous in catalog.values()])
        report = compare(base, scene, references,
                         output / f"CAM05-{gate}.jpg" if output else None)
        verify_camera("CAM05", report, 16)
        print("CAM05", gate, len(report), sorted(report.items(), key=lambda entry: entry[1]["mean"], reverse=True)[:3])
        if output:
            (output / f"CAM05-{gate}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        catalog[gate] = scene
    write_catalog("CAM05", catalog)
    if output:
        isolated_sheet(catalog["open-open"], output / "CAM05-isolado.jpg")


def stage_scene(output):
    folder = CAMERAS / "CAM03"
    states = folder / "states"
    cast = CAST[:3]
    trio = open_rgba(states / "todas.webp")
    removals = load_layers("sem", trio.size)
    floor = load_layers("salao", trio.size)
    empty_stage = trio.copy()
    for layer in removals.values():
        empty_stage.alpha_composite(layer)
    base_path = folder / "layers/palco-vazio.webp"
    (ROOT / base_path).parent.mkdir(parents=True, exist_ok=True)
    empty_stage.convert("RGB").save(ROOT / base_path, lossless=True, method=5)
    base = np.asarray(empty_stage.convert("RGB"), dtype=np.float32)
    covered = np.zeros(base.shape[:2], dtype=bool)
    layers = {}
    for id in cast:
        present = trio.copy()
        for absent in cast:
            if absent != id:
                present.alpha_composite(removals[absent])
        layer = extract(base, np.asarray(present.convert("RGB"), dtype=np.float32), covered)
        key = f"palco-{id}"
        register_pose(layers, key, layer, present, empty_stage, "CAM03", folder / "layers", guide=trio)
    for id, layer in floor.items():
        key = f"salao-{id}"
        register_pose(layers, key, layer, layer, empty_stage, "CAM03", folder / "layers", fixed=True)
    scene = {"size": list(trio.size), "base": f"./{base_path.as_posix()}", "layers": layers}
    refs = []
    for assignment in product(range(3), repeat=3):
        stage = [id for id, position in zip(cast, assignment) if position == 1]
        hall = [id for id, position in zip(cast, assignment) if position == 2]
        if not stage and not hall:
            refs.append(("vazia", folder / "base.webp", ()))
            continue
        key = (f"palco-{'-'.join(stage) or 'vazio'}--salao-{'-'.join(hall)}" if hall
               else "todas" if len(stage) == 3 else "-".join(stage))
        refs.append((key, states / f"{key}.webp", [*(f"palco-{id}" for id in stage), *(f"salao-{id}" for id in hall)]))
    report = compare(empty_stage, scene, refs, output / "CAM03.jpg" if output else None,
                     empty=open_rgba(folder / "base.webp"))
    verify_camera("CAM03", report, 27)
    print("CAM03", len(report), sorted(report.items(), key=lambda entry: entry[1]["mean"], reverse=True)[:5])
    if output:
        (output / "CAM03.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        isolated_sheet(scene, output / "CAM03-isolado.jpg")
    write_catalog("CAM03", scene)


def closet_scene(output):
    folder = CLOSET.relative_to(ROOT)
    base = load(CLOSET_SOURCES / "door-slats.png")
    sources = {f"porta-{id}": image for id, image in doorway_art(base).items()}
    sources.update({f"sala-{id}": image for id, image in room_art(base).items()})
    original_layers = sources.copy()
    # O vão lateral antecede as ocupantes da sala. Retira as ripas
    # idênticas à base e mantém as mudanças locais de luz dentro do vão.
    base_rgb = np.asarray(base.convert("RGB"), dtype=np.float32)
    for key, image in list(sources.items()):
        if not key.startswith("porta-"):
            continue
        covered = np.zeros(base_rgb.shape[:2], dtype=bool)
        patched = Image.alpha_composite(base, image)
        layer = extract(base_rgb, np.asarray(patched.convert("RGB"), dtype=np.float32), covered)
        pixels = np.asarray(layer).copy()
        pixels[np.all(np.asarray(patched) == np.asarray(base), axis=2)] = 0
        sources[key] = Image.fromarray(pixels)
    layers = {}
    for key, image in sources.items():
        source = Image.alpha_composite(base, original_layers[key]) if key.startswith("porta-") else image
        register_pose(layers, key, image, source, base, "closet", folder / "layers", fixed=key.startswith("sala-"))
    scene = {"size": list(base.size), "layers": layers, "bases": {}}
    for gate, background in (("open", base), ("closed", closed_gate(base))):
        base_path = folder / "layers" / f"base-{gate}.webp"
        background.convert("RGB").save(ROOT / base_path, lossless=True, method=5)
        scene["bases"][gate] = "./" + base_path.as_posix()
        states = folder / "states" / gate
        refs = []
        for count in range(6):
            for room in combinations(CLOSET_CAST, count):
                for doorway in (None, *DOORWAY_SOURCES):
                    if doorway in room:
                        continue
                    name = f"sala-{'-'.join(room) or 'vazia'}--porta-{doorway or 'vazia'}"
                    selected = [f"sala-{id}" for id in room]
                    if doorway:
                        selected.insert(0, f"porta-{doorway}")
                    path = states / f"{name}.webp"
                    if count > 3:
                        # Comportamento anterior: quadro das primeiras três
                        # ocupantes e pinturas extras sobrepostas separadamente.
                        ref = open_rgba(states / f"sala-{'-'.join(room[:3])}--porta-{doorway or 'vazia'}.webp")
                        for id in room[3:]:
                            ref.alpha_composite(open_rgba(folder / "layers" / f"{id}.webp"))
                        path = ref
                    refs.append((name, path, selected))
        report = compare(background, scene, refs, output / f"armario-{gate}.jpg" if output else None,
                         empty=open_rgba(states / "sala-vazia--porta-vazia.webp"), columns=3)
        assert len(report) == 96
        assert report["sala-vazia--porta-vazia"]["bounds"] is None
        for key, metrics in report.items():
            # A referência de jogo é WebP com perdas (qualidade 91). Os
            # recortes vêm das fontes sem essa compressão.
            if metrics["mean"] >= 2 or metrics["above12"] >= 0.014:
                print("Referência acima dos limites históricos do armário:", gate, key, metrics)
        print("armário", gate, len(report), sorted(report.items(), key=lambda entry: entry[1]["mean"], reverse=True)[:3])
        if output:
            (output / f"armario-{gate}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_catalog("closet", scene)
    if output:
        isolated_sheet(scene, output / "armario-isolado.jpg")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scene", choices=["CAM06", "CAM03", "CAM05", "closet"])
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if args.report:
        args.report.mkdir(parents=True, exist_ok=True)
    if args.scene == "CAM03":
        stage_scene(args.report)
    elif args.scene == "CAM05":
        vip_scene(args.report)
    elif args.scene == "closet":
        closet_scene(args.report)
    else:
        run(args.scene, args.report)
