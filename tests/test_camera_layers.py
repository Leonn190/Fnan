"""Compara a composição das câmeras com as versões guardadas em reserva."""

import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CAMERAS = ROOT / "public/images/cameras"
RESERVE = ROOT / "reserva/public/images/cameras"
catalog_js = (ROOT / "src/data/camera-layers.js").read_text(encoding="utf-8")
catalog = json.loads(catalog_js.split(" = ", 1)[1].strip().removesuffix(";"))
assert set(catalog) == {"CAM01", "CAM02", "CAM04", "CAM07", "CAM08", "CAM09", "CAM10", "CAM11", "CAM12"}
poses = {"01-maid-sentada": "maid", "02-maid-saindo": "maid-saindo"}
pose_regions = {
    "maid": (1230, 135, 1450, 441),
    "maid-saindo": (790, 231, 1115, 694),
}
# Pontos em coordenadas da arte original, longe da penumbra. Conferem
# rosto, vestido, mãos e botas independentemente do alpha exportado.
pose_details = {
    "maid": [(1380, 203), (1376, 312), (1323, 386), (1216, 402), (1450, 440)],
    "maid-saindo": [(855, 248), (1036, 399), (725, 360), (875, 602), (1068, 719)],
}


def max_channel_error(left, right):
    return np.max(np.abs(np.asarray(left, dtype=np.int16) - np.asarray(right, dtype=np.int16)), axis=2)


checked = 0
for camera, catalog_entry in catalog.items():
    folder = CAMERAS / camera
    gated = camera in {"CAM04", "CAM12"}
    scenes = catalog_entry if gated else {"": catalog_entry}
    for gate, scene in scenes.items():
        public_states = folder / "states" / gate
        old_states = RESERVE / camera / "states" / gate
        base_path = public_states / "vazia.webp" if gate == "open" else folder / "base.webp"
        with Image.open(base_path) as image:
            base = image.convert("RGBA")
        assert base.size == tuple(scene["size"])
        keep = {"todas.webp"} if camera != "CAM09" else set()
        if gate == "open":
            keep.add("vazia.webp")
        assert {path.name for path in public_states.glob("*.webp")} == keep
        layers = {}
        for key, (source, x, y, width, height) in scene["layers"].items():
            with Image.open(ROOT / source) as image:
                assert image.mode == "RGBA" and image.size == (width, height), source
                alpha = np.asarray(image.getchannel("A"))
                assert np.any(alpha == 0) and np.any(alpha == 255), source
                assert np.any((alpha > 0) & (alpha < 255)), source
                assert 0 <= x < x + width <= base.width and 0 <= y < y + height <= base.height, source
                layers[key] = (image.copy(), (x, y))
        variants = list(old_states.glob("*.webp"))
        assert len(variants) == (2 if camera == "CAM09" else 2 ** len(layers) - 2)
        for original in variants:
            keys = [poses[original.stem]] if camera == "CAM09" else original.stem.split("-")
            assert set(keys) <= layers.keys(), original
            frame = base.copy()
            for key, (image, position) in layers.items():
                if key in keys:
                    frame.alpha_composite(image, position)
            with Image.open(original) as image:
                reference = image.convert("RGBA")
            if camera == "CAM09":
                # As referências têm outro piso e outra luz. Mede a pose no
                # interior opaco e testa detalhes em coordenadas independentes.
                key = keys[0]
                image, position = layers[key]
                mask = Image.new("L", base.size)
                mask.paste(image.getchannel("A"), position)
                region = pose_regions[key]
                diff = max_channel_error(frame.crop(region), reference.crop(region))
                solid = np.asarray(mask.crop(region)) == 255
                assert solid.sum() > 28000, original
                assert diff[solid].mean() < 1.0, (original, diff[solid].mean())
                for x, y in pose_details[key]:
                    detail = (x - 3, y - 3, x + 4, y + 4)
                    assert max_channel_error(frame.crop(detail), reference.crop(detail)).mean() < 4.0, (key, detail)
                assert np.count_nonzero(np.asarray(mask)) < base.width * base.height * .12
                left_wall = (0, 0, 600, base.height)
                assert frame.crop(left_wall).tobytes() == base.crop(left_wall).tobytes()
            else:
                diff = max_channel_error(frame, reference)
                assert (diff > 12).mean() < 0.0001, original
                assert diff.mean() < 0.006, original
            checked += 1

assert checked == 126
print(f"PASS: {checked} variantes arquivadas comparadas com a composição e os recortes WebP.")
