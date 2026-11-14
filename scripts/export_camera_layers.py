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
# Contornos em um quadro de referência de 627 por 235. Incluem sombras
# de contato e excluem mudanças da arte de origem em outros pontos da sala.
MAID_MASKS = {
    "maid": [
        (437, 92), (461, 78), (480, 66), (493, 39), (510, 28), (536, 28),
        (549, 45), (551, 71), (573, 103), (552, 124), (525, 126), (504, 114),
        (472, 117), (440, 115),
    ],
    "maid-saindo": [
        (248, 85), (287, 73), (287, 61), (305, 41), (325, 34), (350, 43),
        (372, 59), (399, 68), (438, 93), (434, 124), (409, 143), (432, 178),
        (427, 196), (387, 204), (364, 181), (354, 161), (313, 170), (297, 153),
        (311, 128), (304, 109), (256, 106),
    ],
}


def read_rgb(path):
    live = ROOT / path
    with Image.open(live if live.exists() else ROOT / "reserva" / path) as image:
        return np.asarray(image.convert("RGB"), dtype=np.float32)


def maid_mask(size, key):
    width, height = size
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).polygon([
        (round(x * width / 627), round(y * height / 235)) for x, y in MAID_MASKS[key]
    ], fill=255)
    return np.asarray(mask.filter(ImageFilter.GaussianBlur(13)), dtype=np.float32) / 255


def extract_layers(folder, state_folder, base_path, order, shared=None):
    base = read_rgb(base_path)
    height, width, _ = base.shape
    maid_scene = state_folder.parent.name == "CAM09"
    layers = {}
    covered = np.zeros((height, width), dtype=bool)
    for key in order:
        name = MAID_FILES[key] if maid_scene else key
        source = read_rgb(state_folder / f"{name}.webp")
        if source.shape != base.shape:
            raise ValueError(f"{folder}/{key}: dimensões divergentes")

        delta = source - base
        if maid_scene:
            delta *= maid_mask((width, height), key)[..., None]
        changed = np.any(delta, axis=2)
        # Estima o alpha mínimo que permite reproduzir a cor composta.
        # Ele mantém a penumbra translúcida; o interior do recorte é opaco.
        limit = np.maximum(np.where(delta > 0, 255 - base, base), 1)
        minimum = np.max(abs(delta) / limit, axis=2)
        strength = np.max(abs(delta), axis=2)
        if maid_scene:
            # A máscara já delimita os detalhes da sala envolvidos na pose.
            # Reduz a opacidade da parede e do piso nas transições suaves.
            opacity = np.maximum(minimum, np.minimum(strength / 64, 1))
        else:
            core = Image.fromarray((strength >= 5).astype(np.uint8) * 255)
            core = np.asarray(core.filter(ImageFilter.MinFilter(5)), dtype=np.float32) / 255
            opacity = np.maximum(minimum, np.maximum(core, np.minimum(strength / 48, 1)))
            opacity[covered & changed] = 1
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
            opened = extract_layers(folder / "layers/open", states / "open", states / "open/vazia.webp", order)
            closed = extract_layers(folder / "layers/closed", states / "closed", base, order, opened["layers"])
            catalog[camera] = {
                "open": opened,
                "closed": closed,
            }
        else:
            catalog[camera] = extract_layers(folder / "layers", states, base, order)
    # Um registro por pose; as combinações são montadas pelo jogo.
    entries = ",\n".join(f'  "{key}": {json.dumps(value)}' for key, value in catalog.items())
    (ROOT / "src/data/camera-layers.js").write_text(
        "// Gerado por scripts/export_camera_layers.py.\n"
        "window.NathGame.cameraLayers = {\n" + entries + "\n};\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
