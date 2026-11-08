"""Exporta as combinações do escritório em WebP sem perdas. Requer Pillow."""

import argparse
from itertools import combinations
from pathlib import Path

from PIL import Image


OFFICE = Path(__file__).resolve().parents[1] / "public/images/office"
# Mesma ordem de sobreposição de OFFICE.characters em game-data.js.
CHARACTERS = ("original", "maid", "gotica", "yandere", "platinada")


def load(path):
    with Image.open(path) as image:
        return image.convert("RGBA")


def export(output):
    layers = {
        location: {
            character: load(OFFICE / "characters" / location / f"{character}.webp")
            for character in CHARACTERS
        }
        for location in ("room", "doorway")
    }
    count = 0
    for gate, source in (("open", "open-dark"), ("closed", "closed")):
        base = load(OFFICE / "states" / f"{source}.webp")
        folder = output / gate
        folder.mkdir(parents=True, exist_ok=True)
        for size in range(4):
            for room in combinations(CHARACTERS, size):
                room_key = "-".join(room) or "vazia"
                for doorway in (None, *CHARACTERS):
                    if doorway in room:
                        continue
                    frame = base.copy()
                    if doorway:
                        frame.alpha_composite(layers["doorway"][doorway])
                    for character in room:
                        frame.alpha_composite(layers["room"][character])
                    filename = f"sala-{room_key}--porta-{doorway or 'vazia'}.webp"
                    frame.convert("RGB").save(folder / filename, lossless=True, method=2)
                    count += 1
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Pasta de destino das imagens")
    args = parser.parse_args()
    print(f"{export(args.output)} imagens exportadas para {args.output}")
