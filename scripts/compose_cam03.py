"""Regenere as variantes do palco ou, com --salao, as 19 que incluem o salão. Requer Pillow."""

import argparse
from itertools import combinations
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STATES = ROOT / "public/images/cameras/CAM03/states"
STAGE = ROOT / "outros/arte/cameras/CAM03"
CHARACTERS = ("original", "yandere", "gotica")


def load_layers(prefix, size):
    layers = {}
    for character in CHARACTERS:
        path = STAGE / f"{prefix}-{character}.png"
        with Image.open(path) as layer:
            if layer.mode != "RGBA" or layer.size != size:
                raise ValueError(f"{path.name} deve ser RGBA e ter o tamanho da imagem do trio.")
            layers[character] = layer.copy()
    return layers


def main(salao, output):
    output.mkdir(parents=True, exist_ok=True)
    with Image.open(STATES / "todas.webp") as source:
        trio = source.convert("RGBA")

    removals = load_layers("sem", trio.size)
    floor_layers = load_layers("salao", trio.size) if salao else {}

    # Cada camada cobre só a personagem ausente e o seu reflexo.
    for count in ((0, 1, 2) if salao else (1, 2)):
        for group in combinations(CHARACTERS, count):
            frame = trio.copy()
            offstage = [character for character in CHARACTERS if character not in group]
            for character in offstage:
                frame.alpha_composite(removals[character])
            stage_key = "-".join(group)
            if not salao:
                frame.convert("RGB").save(output / f"{stage_key}.webp", lossless=True)
                continue

            for size in range(1, len(offstage) + 1):
                for floor_group in combinations(offstage, size):
                    composite = frame.copy()
                    for character in floor_group:
                        composite.alpha_composite(floor_layers[character])
                    floor_key = "-".join(floor_group)
                    name = f"palco-{stage_key or 'vazio'}--salao-{floor_key}.webp"
                    composite.convert("RGB").save(output / name, lossless=True, method=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--salao", action="store_true", help="Exporta as cenas com personagens fora do palco")
    parser.add_argument("output", type=Path, help="Pasta para os quadros de referência exportados")
    args = parser.parse_args()
    main(args.salao, args.output)
