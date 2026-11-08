"""Regenere as seis variantes parciais com python scripts/compose_cam03.py (Pillow)."""

from itertools import combinations
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STATES = ROOT / "public/images/cameras/CAM03/states"
STAGE = ROOT / "outros/arte/cameras/CAM03"
CHARACTERS = ("original", "yandere", "gotica")


def main():
    with Image.open(STATES / "todas.webp") as source:
        trio = source.convert("RGBA")

    removals = {}
    for character in CHARACTERS:
        path = STAGE / f"sem-{character}.png"
        with Image.open(path) as patch:
            if patch.mode != "RGBA" or patch.size != trio.size:
                raise ValueError(f"{path.name} deve ser RGBA e ter o tamanho da imagem do trio.")
            removals[character] = patch.copy()

    # Cada camada cobre só a personagem ausente e o seu reflexo.
    for count in (1, 2):
        for group in combinations(CHARACTERS, count):
            frame = trio.copy()
            for character in CHARACTERS:
                if character not in group:
                    frame.alpha_composite(removals[character])
            name = "-".join(group)
            frame.convert("RGB").save(STATES / f"{name}.webp", lossless=True)


if __name__ == "__main__":
    main()
