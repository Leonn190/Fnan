"""Exporta e compara as composições complexas. Requer Pillow e NumPy."""

import argparse
import json
from itertools import combinations, product
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from export_camera_layers import CAMERAS, ROOT, opaque_interior, read_rgb
from compose_cam03 import load_layers
from export_closet_states import CLOSET, CLOSET_SOURCES, DOORWAY_SOURCES, closed_gate, doorway_art, room_art
from export_office_states import CHARACTERS as CLOSET_CAST, load


CAST = ("original", "yandere", "gotica", "platinada", "maid")
SIMPLE_GATES = ("open-open", "open-closed", "closed-open", "closed-closed")
SILHOUETTES = json.loads(Path(__file__).with_name("complex_silhouettes.json").read_text(encoding="utf-8"))
# Contorno de palco em coordenadas normalizadas na máscara de remoção.
# Fora dele fica apenas a contribuição fotométrica da cortina e do reflexo.
STAGE_OUTLINES = {
    "original": [(29,42),(40,23),(55,18),(67,20),(79,33),(84,63),(82,86),(91,111),(99,155),
                 (99,177),(90,179),(82,158),(76,154),(76,185),(72,211),(69,242),(73,266),
                 (67,277),(56,278),(51,269),(45,277),(35,274),(34,261),(39,236),(36,202),
                 (28,174),(26,156),(19,172),(12,179),(5,173),(10,145),(17,126),(19,91),(24,73)],
    "yandere": [(18,45),(24,28),(39,22),(52,25),(69,24),(80,30),(83,45),(89,69),(83,86),
                 (91,114),(98,142),(99,171),(88,172),(78,155),(76,176),(72,205),(72,247),
                 (77,269),(66,279),(52,277),(47,273),(37,276),(29,269),(34,245),(33,213),
                 (27,184),(27,158),(20,164),(14,180),(4,177),(8,151),(13,125),(17,102),(15,83)],
    "gotica": [(20,49),(24,35),(39,25),(61,24),(73,33),(79,50),(77,76),(83,102),(89,126),
               (96,157),(93,181),(84,179),(76,159),(73,190),(69,216),(70,243),(75,268),
               (70,278),(57,280),(51,273),(42,280),(30,276),(28,264),(33,243),(31,209),
               (26,184),(25,161),(18,168),(12,179),(5,176),(7,151),(14,130),(16,103),(19,81)],
}
# Limita a opacidade das regiões de móvel/assoalho sem retirar a sua
# contribuição. Pontos no recorte original, normalizados por largura/altura.
VIP1_SUBJECTS = {
    "original": [(10,8),(34,0),(48,15),(49,25),(68,28),(84,33),(90,39),
                 (85,46),(74,45),(78,61),(91,76),(98,95),(86,100),(70,93),
                 (59,76),(53,69),(43,67),(34,60),(26,72),(13,69),(17,50),(5,36)],
    "yandere": [(34,27),(43,20),(49,26),(53,32),(63,29),(70,33),(72,48),
                (62,59),(57,70),(59,81),(49,87),(36,85),(26,77),(22,65),
                (25,53),(29,40)],
}


def contour_mask(size, bounds, vertices, height_scale):
    x, y, right, bottom = bounds
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).polygon([
        (x + px * (right - x) / 100, y + py * (bottom - y) / height_scale)
        for px, py in vertices
    ], fill=255)
    return np.asarray(mask.filter(ImageFilter.GaussianBlur(1.4)), dtype=np.float32) / 255


def split_silhouette(layer, artwork, background, antialias):
    """Separa variações do cenário, preservando a arte sobre o fundo registrado."""
    if not artwork:
        return layer, Image.new("RGBA", layer.size)
    bounds = layer.getbbox()
    x, y, right, bottom = bounds
    # As pranchas de desenho têm dois pixels de margem, como os WebPs.
    left, top = max(0, x - 2), max(0, y - 2)
    right, bottom = min(layer.width, right + 2), min(layer.height, bottom + 2)
    size = (right - left, bottom - top)
    mask = Image.new("L", (size[0] * 4, size[1] * 4), 255 if "outline" not in artwork else 0)
    draw = ImageDraw.Draw(mask)

    def polygon(points, fill):
        draw.polygon([(px * mask.width / 100, py * mask.height / 100) for px, py in points], fill=fill)

    if "outline" in artwork:
        polygon(artwork["outline"], 255)
    for hole in artwork.get("holes", []):
        polygon(hole, 0)
    coverage = np.asarray(mask.resize(size, Image.Resampling.BOX)).copy()
    if artwork.get("occluded_rows"):
        # Na porta lateral a primeira ripa opaca atravessa o retrato.
        # Os pixels quase pretos dessa faixa vieram do fundo, não da pose.
        for start, stop in artwork["occluded_rows"]:
            coverage[max(0, start - top):max(0, stop - top)] = 0
    box = (left, top, right, bottom)
    patch = layer.crop(box)
    original = np.asarray(patch)
    actor = original.copy()
    support = original.copy()
    actor[coverage < 128] = 0
    support[coverage >= 128] = 0

    # Subpixel da linha separa a silhueta de uma região de luz ou móvel.
    # Aceita a divisão de alpha somente onde a composição de ambos fica
    # idêntica, para evitar costuras de arredondamento no WebP.
    edge = (coverage > 0) & (coverage < 255) & (original[..., 3] > 0)
    weight = original[..., 3].astype(np.float32)
    foreground_alpha = np.rint(weight * coverage / 255)
    support_alpha = np.rint((weight - foreground_alpha) * 255 / np.maximum(255 - foreground_alpha, 1))
    foreground_try, support_try = original.copy(), original.copy()
    foreground_try[..., 3] = foreground_alpha
    support_try[..., 3] = support_alpha
    backdrop = background.crop(box)
    reference = Image.alpha_composite(backdrop, patch)
    trial = Image.alpha_composite(Image.alpha_composite(backdrop, Image.fromarray(support_try)),
                                  Image.fromarray(foreground_try))
    exact = edge & np.all(np.asarray(reference) == np.asarray(trial), axis=2) if antialias else np.zeros_like(edge)
    actor[exact], support[exact] = foreground_try[exact], support_try[exact]

    result = []
    for pixels in (actor, support):
        pixels[pixels[..., 3] == 0] = 0
        image = Image.new("RGBA", layer.size)
        image.paste(Image.fromarray(pixels), (left, top))
        result.append(image)
    return result


def register_pose(layers, key, layer, artwork, base, folder, previous=()):
    # No armário alguns recortes servem a dois fundos e podem cruzar outro
    # retrato. Uma única contribuição por pixel conserva a ordem anterior.
    actor, support = split_silhouette(layer, artwork, base, antialias="closet" not in folder.parts)
    for name, image in ((key + '+ambiente', support), (key, actor)):
        if image.getbbox():
            layers[name] = save_layer(image, folder / f"{name}.webp",
                                      [scene["layers"][name] for scene in previous if name in scene["layers"]])


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


def extract(base, source, covered, silhouette=None):
    # O interior é opaco mesmo onde a cor da roupa coincide com o fundo.
    # A borda e as sombras usam alpha parcial com compensação da cor da base.
    delta = source - base
    strength = np.max(np.abs(delta), axis=2)
    interior = opaque_interior(strength)
    minimum = np.max(np.abs(delta) / np.maximum(np.where(delta > 0, 255 - base, base), 1), axis=2)
    alpha = np.maximum(interior, np.minimum(strength / 42, 1))
    if silhouette is not None:
        alpha *= 0.22 + 0.78 * silhouette
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
    for key in order:
        source = read_rgb(states / f"{key}.webp")
        silhouette = None
        if gate and key in VIP1_SUBJECTS:
            bounds = Image.fromarray(np.any(source != base, axis=2).astype(np.uint8)).getbbox()
            silhouette = contour_mask((width, height), bounds, VIP1_SUBJECTS[key], 100)
        layer = extract(base, source, covered, silhouette)
        register_pose(layers, key, layer, SILHOUETTES[camera][key],
                      Image.fromarray(base.astype(np.uint8)).convert("RGBA"), folder / "layers" / gate, shared)
    return {"size": [width, height], "layers": layers}


def compare(base, scene, references, output=None, empty=None, columns=1, original_layers=None):
    decoded = {key: (open_rgba(url), (x, y)) for key, (url, x, y, _, _) in scene["layers"].items()}
    report = {}
    rows = (len(references) + columns - 1) // columns
    sheet = Image.new("RGB", (900 * columns, 132 * rows), "#28252d") if output else None
    for index, (key, path, selected) in enumerate(references):
        frame = (empty if not selected and empty is not None else base).copy()
        for id, (layer, position) in decoded.items():
            if layer_applies(id, selected):
                frame.alpha_composite(layer, position)
        if original_layers and selected:
            # Teste independente do WebP arquivado: a geometria deve bater
            # com a composição anterior ainda antes da compressão.
            expected = base.copy()
            for id, layer in original_layers.items():
                if id in selected:
                    expected.alpha_composite(layer)
            assert frame.tobytes() == expected.tobytes(), key
        reference = path.copy() if isinstance(path, Image.Image) else open_rgba(path)
        difference = np.abs(np.asarray(frame, dtype=np.int16) - np.asarray(reference, dtype=np.int16))[:, :, :3]
        peak = np.max(difference, axis=2)
        report[key] = {"mean": round(float(peak.mean()), 5), "above12": round(float((peak > 12).mean()), 7)}
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
    for key, metrics in report.items():
        limit = 0.00031 if camera == "CAM06" else 0
        assert metrics["mean"] <= limit and metrics["above12"] <= 0.00001, (camera, key, metrics)


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
    verify_camera(camera, report, 32)
    print(camera, len(report), sorted(report.items(), key=lambda entry: entry[1]["mean"], reverse=True)[:5])
    if output:
        (output / f"{camera}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        isolated_sheet(scene, output / f"{camera}-isolado.jpg")
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
            alpha = Image.fromarray(np.any(np.asarray(source) != np.asarray(frame), axis=2).astype(np.uint8) * 255)
            source.putalpha(alpha)
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
        silhouette = contour_mask(trio.size, removals[id].getbbox(), STAGE_OUTLINES[id], 320)
        layer = extract(base, np.asarray(present.convert("RGB"), dtype=np.float32), covered, silhouette)
        key = f"palco-{id}"
        register_pose(layers, key, layer, SILHOUETTES["CAM03"][key], empty_stage, folder / "layers")
    for id, layer in floor.items():
        key = f"salao-{id}"
        register_pose(layers, key, layer, SILHOUETTES["CAM03"][key], empty_stage, folder / "layers")
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
        register_pose(layers, key, image, SILHOUETTES["closet"][key], base, folder / "layers")
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
                         empty=open_rgba(states / "sala-vazia--porta-vazia.webp"), columns=3,
                         original_layers=original_layers)
        assert len(report) == 96
        for key, metrics in report.items():
            # A referência de jogo é WebP com perdas (qualidade 91). Os
            # recortes vêm das fontes sem essa compressão.
            assert metrics["mean"] < 2 and metrics["above12"] < 0.014, (gate, key, metrics)
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
