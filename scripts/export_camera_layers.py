"""Exporta recortes WebP com alpha e suas coordenadas. Requer Pillow e NumPy."""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
CAMERAS = Path("public/images/cameras")
# Ordem de pintura conferida contra os frames antigos com múltiplas personagens.
ORDERS = {
    "CAM01": ("platinada", "original", "yandere", "gotica"),
    "CAM02": ("original", "yandere", "gotica", "platinada"),
    "CAM04": ("original", "yandere", "gotica", "platinada"),
    "CAM07": ("original", "yandere", "gotica", "platinada"),
    "CAM08": ("original", "gotica", "yandere", "platinada"),
    "CAM09": ("maid", "maid-saindo"),
    "CAM10": ("gotica", "maid", "original", "yandere"),
    "CAM11": ("maid", "gotica", "original", "yandere"),
    "CAM12": ("original", "yandere", "gotica"),
}
MAID_FILES = {"maid": "01-maid-sentada", "maid-saindo": "02-maid-saindo"}
# Silhuetas desenhadas sobre as referências de 836 × 470. Os vãos entre
# braços e pernas deixam passar o fundo vazio.
MAID_OUTLINES = {
    "maid": [
        (603, 180), (613, 179), (621, 187), (635, 181), (644, 165), (658, 154),
        (665, 151), (662, 142), (663, 123), (666, 111), (670, 99), (674, 83),
        (683, 72), (701, 70), (713, 78), (719, 89), (717, 111), (716, 119),
        (722, 121), (723, 136), (719, 150), (715, 158), (725, 174), (730, 191),
        (726, 196), (733, 203), (738, 214), (734, 225), (726, 236), (717, 237),
        (712, 231), (713, 216), (704, 208), (700, 197), (695, 198), (698, 206),
        (691, 208), (678, 208), (676, 199), (665, 203), (651, 198), (653, 191),
        (642, 197), (621, 200), (618, 212), (608, 213), (601, 206), (599, 189),
    ],
    "maid-saindo": [
        (340, 178), (354, 174), (367, 173), (378, 177), (412, 169), (419, 150),
        (410, 139), (401, 139), (402, 122), (393, 120), (390, 113), (395, 101),
        (396, 91), (408, 84), (420, 80), (432, 81), (442, 89), (449, 89),
        (456, 99), (468, 116), (487, 126), (500, 142), (527, 159), (530, 168),
        (549, 174), (557, 183), (565, 197), (564, 208), (551, 222), (535, 232),
        (527, 254), (519, 269), (531, 283), (540, 307), (543, 326), (550, 340),
        (556, 349), (555, 361), (545, 370), (526, 375), (512, 369), (513, 359),
        (528, 347), (531, 338), (523, 321), (512, 300), (502, 287), (495, 275),
        (496, 251), (484, 254), (480, 271), (461, 272), (451, 277), (450, 287),
        (456, 301), (454, 310), (424, 313), (416, 308), (420, 300), (439, 291),
        (441, 277), (440, 244), (444, 226), (452, 217), (459, 198), (469, 181),
        (455, 176), (443, 171), (428, 180), (399, 185), (374, 189), (358, 189),
        (344, 188), (337, 184),
    ],
}
# Sombras locais na parede/porta e junto aos pés. O fator limita a
# contribuição da iluminação distinta do quadro de referência.
MAID_SHADOWS = {
    "maid": [(601, 194, 739, 239), (654, 83, 732, 185)],
    "maid-saindo": [(340, 111, 417, 204), (412, 270, 479, 317), (476, 299, 556, 378)],
}
# Fora dessas linhas ficam reflexos, penumbras ou detalhes de cenário
# alterados pela arte original. Mantém sua contribuição no quadro com
# alpha menor e conserva o RGB composto sobre a base da câmera.
SCENE_EDGES = {
    ("CAM01", "gotica"): (None, 499),
    ("CAM02", "gotica"): ([(955, 284), (964, 298), (975, 317), (983, 345), (985, 361)], None),
    ("CAM02", "yandere"): (None, 624),
    ("CAM04", "gotica"): (None, 497),
    ("CAM04", "platinada"): (None, 280),
    ("CAM07", "gotica"): (None, 881),
    ("CAM07", "yandere"): (None, 365),
    ("CAM08", "original"): (None, 441),
    ("CAM08", "yandere"): (None, 805),
    ("CAM11", "gotica"): (None, 826),
    ("CAM12", "gotica"): (None, 829),
}


def read_rgb(path):
    live = ROOT / path
    with Image.open(live if live.exists() else ROOT / "reserva" / path) as image:
        return np.asarray(image.convert("RGB"), dtype=np.float32)


def maid_masks(size, key):
    width, height = size
    def point(x, y):
        return round(x * width / 836), round(y * height / 470)

    outline = Image.new("L", size)
    ImageDraw.Draw(outline).polygon([point(x, y) for x, y in MAID_OUTLINES[key]], fill=255)
    shadows = Image.new("L", size)
    for x1, y1, x2, y2 in MAID_SHADOWS[key]:
        ImageDraw.Draw(shadows).ellipse((*point(x1, y1), *point(x2, y2)), fill=140)
    return tuple(np.asarray(mask.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255
                 for mask, radius in ((outline, 2), (shadows, 8)))


def opaque_interior(strength):
    silhouette = Image.fromarray((strength >= 7).astype(np.uint8) * 255)
    # Fecha lacunas pequenas causadas por cores parecidas com as do fundo.
    # A erosão preserva as bordas finas e os vãos entre membros.
    interior = silhouette.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(15))
    return np.asarray(interior.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32) / 255


def extract_layers(folder, state_folder, base_path, order, camera, shared=None):
    base = read_rgb(base_path)
    height, width, _ = base.shape
    maid_scene = camera == "CAM09"
    layers = {}
    covered = np.zeros((height, width), dtype=bool)
    for key in order:
        name = MAID_FILES[key] if maid_scene else key
        source = read_rgb(state_folder / f"{name}.webp")
        if source.shape != base.shape:
            raise ValueError(f"{folder}/{key}: dimensões divergentes")

        delta = source - base
        if maid_scene:
            silhouette, shadow = maid_masks((width, height), key)
            darkening = np.minimum(np.max(delta, axis=2), 0)
            delta = delta * silhouette[..., None] + (
                darkening * shadow * (1 - silhouette)
            )[..., None]
        elif camera != "CAM01":
            # Descarta diferenças quase invisíveis longe dos contornos e dos reflexos.
            strength = np.max(abs(delta), axis=2)
            support = Image.fromarray((strength >= 3).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
            delta[np.asarray(support) == 0] = 0
        changed = np.any(delta, axis=2)
        # Estima o alpha mínimo que permite reproduzir a cor composta.
        # Ele mantém a penumbra translúcida; o interior do recorte é opaco.
        limit = np.maximum(np.where(delta > 0, 255 - base, base), 1)
        minimum = np.max(abs(delta) / limit, axis=2)
        strength = np.max(abs(delta), axis=2)
        if maid_scene:
            opacity = np.maximum(minimum, silhouette)
        else:
            core = opaque_interior(strength)
            rim = np.minimum(strength / 32, 1)
            opacity = np.maximum(minimum, np.maximum(core, rim))
            edge, floor = SCENE_EDGES.get((camera, key), (None, None))
            if floor is not None:
                fade = np.clip((np.arange(height) - floor) / 16, 0, 1)[:, None]
                opacity = np.maximum(minimum, opacity * (1 - 0.75 * fade))
            if edge:
                xs, ys = np.asarray(edge).T
                at_row = np.interp(np.arange(height), ys, xs, right=width)
                fade = np.clip((np.arange(width) - at_row[:, None]) / 9, 0, 1)
                opacity = np.maximum(minimum, opacity * (1 - 0.72 * fade))
            # Mantém a regra de sobreposição da arte original, inclusive nas
            # lacunas que deixam aparecer um recorte de trás.
            opacity[covered] = changed[covered]
            covered |= changed
        opacity = np.ceil(opacity * 255) / 255
        rgb = base + delta / np.maximum(opacity[..., None], 1 / 255)

        rgba = np.dstack((np.clip(rgb, 0, 255), opacity * 255)).round().astype(np.uint8)
        rgba[rgba[..., 3] == 0, :3] = 0
        image = Image.fromarray(rgba)
        x, y, right, bottom = image.getbbox(alpha_only=True)
        # Preserva pixels transparentes ao redor do recorte durante a interpolação.
        x, y = max(0, x - 2), max(0, y - 2)
        right, bottom = min(width, right + 2), min(height, bottom + 2)
        crop = image.crop((x, y, right, bottom))
        box = [x, y, right - x, bottom - y]
        if shared:
            shared_url, *shared_box = shared[key]
            if box == shared_box:
                with Image.open(ROOT / shared_url) as candidate:
                    if candidate.tobytes() == crop.tobytes():
                        layers[key] = shared[key]
                        continue
        output = ROOT / folder / f"{key}.webp"
        output.parent.mkdir(parents=True, exist_ok=True)
        crop.save(output, lossless=True, exact=True, method=6)
        layers[key] = [f"./{output.relative_to(ROOT).as_posix()}", *box]
    return {"size": [width, height], "layers": layers}


def main():
    catalog = {}
    for camera, order in ORDERS.items():
        folder = CAMERAS / camera
        states = folder / "states"
        base = folder / "base.webp"
        if camera in ("CAM04", "CAM12"):
            opened = extract_layers(folder / "layers/open", states / "open", states / "open/vazia.webp", order, camera)
            closed = extract_layers(folder / "layers/closed", states / "closed", base, order, camera, opened["layers"])
            catalog[camera] = {
                "open": opened,
                "closed": closed,
            }
        else:
            catalog[camera] = extract_layers(folder / "layers", states, base, order, camera)
    # Um registro por pose; as combinações são montadas pelo jogo.
    entries = ",\n".join(f'  "{key}": {json.dumps(value)}' for key, value in catalog.items())
    (ROOT / "src/data/camera-layers.js").write_text(
        "// Gerado por scripts/export_camera_layers.py.\n"
        "window.NathGame.cameraLayers = {\n" + entries + "\n};\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
