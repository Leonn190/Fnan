"""Compõe os estados do corredor a partir da folha de sprites da Nathzinha. Requer Pillow."""

import argparse
import json
from itertools import combinations
from math import hypot
from pathlib import Path
from posixpath import relpath
from tempfile import NamedTemporaryFile
from time import sleep

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from export_office_states import OFFICE, load


CHARACTERS = ("original", "platinada", "yandere", "gotica", "maid")
BASE = OFFICE / "states/open-lit.webp"
OUTPUT = OFFICE / "states/corridor"

# Limites horizontais dos cinco recortes e pontos internos de suas silhuetas.
SPRITE_BOUNDARIES = (0, 539, 934, 1275, 1630, 2172)
SPRITE_SEEDS = (321, 696, 1100, 1450, 1810)

# Centro horizontal, linha dos pés e altura em pixels no panorama 2172 × 724.
SLOTS = {
    "back_left": (997, 440, 142),
    "back_center": (1096, 426, 133),
    "back_right": (1172, 448, 151),
    "front_left": (1035, 522, 251),
    "front_right": (1156, 532, 276),
}
LAYOUTS = (
    (),
    ("back_center",),
    ("back_left", "back_right"),
    ("back_left", "back_center", "back_right"),
    ("back_left", "back_right", "front_left", "front_right"),
    tuple(SLOTS),
)
ATLAS_BOX = (956, 234, 1220, 498)

# Mesmo centro e raio do feixe no estado aberto iluminado.
BEAM_CENTER = (1088, 366)
BEAM_RADIUS = 132
# Reduz o preenchimento de estúdio dos recortes, sobretudo nos meios-tons.
SHADOW_TONES = tuple(round(255 * (value / 255) ** 1.28) for value in range(256))


def load_sprites(path):
    with Image.open(path) as image:
        if image.size != (2172, 724) or image.mode != "RGBA":
            raise ValueError("A folha de sprites deve ser o PNG RGBA de 2172 × 724.")
        sheet = image.copy()

    sprites = {}
    for i, character in enumerate(CHARACTERS):
        left, right = SPRITE_BOUNDARIES[i:i + 2]
        sprite = sheet.crop((left, 0, right, sheet.height))
        alpha = sprite.getchannel("A")
        # Conserva o alfa do contorno e retira os resíduos soltos da folha.
        solid = alpha.point(lambda value: 255 if value >= 16 else 0)
        seed = (SPRITE_SEEDS[i] - left, 300)
        if not solid.getpixel(seed):
            raise ValueError(f"Não foi encontrada a silhueta de {character} no recorte esperado.")
        ImageDraw.floodfill(solid, seed, 128)
        matte = solid.point(lambda value: 255 if value == 128 else 0)
        sprite.putalpha(ImageChops.multiply(alpha, matte))
        sprites[character] = sprite.crop(matte.getbbox())
    return sprites


def smoothstep(t):
    t = min(1, max(0, t))
    return t * t * (3 - 2 * t)


def beam_distance(x, y):
    return hypot(x - BEAM_CENTER[0], y - BEAM_CENTER[1])


def beam_fade(distance):
    return smoothstep((BEAM_RADIUS - distance) / 46)


def light_sprite(sprite, slot):
    center, feet, height = SLOTS[slot]
    width = round(sprite.width * height / sprite.height)
    layer = sprite.resize((width, height), Image.Resampling.LANCZOS)
    left, top = center - width // 2, feet - height
    intensity = .35 if slot.startswith("front_") else .30
    for y in range(height):
        leg_light = 1 - .60 * smoothstep((y / height - .49) / .51)
        for x in range(width):
            r, g, b, alpha = layer.getpixel((x, y))
            if not alpha:
                continue
            distance = beam_distance(left + x, top + y)
            weight = smoothstep((BEAM_RADIUS - 6 - distance) / 94)
            shade = (.025 + intensity * weight) * leg_light
            layer.putpixel((x, y), (
                round(SHADOW_TONES[r] * shade),
                round(SHADOW_TONES[g] * shade * .91),
                round(SHADOW_TONES[b] * shade * .93),
                round(alpha * beam_fade(distance)),
            ))
    return layer, (left, top)


def ground_shadow(sprite, slot):
    center, feet, height = SLOTS[slot]
    alpha = sprite.getchannel("A")
    shoe_left, _, shoe_right, _ = alpha.crop((0, round(alpha.height * .89), *alpha.size)).getbbox()
    scale = height / alpha.height
    left_edge = center + round((shoe_left - alpha.width / 2) * scale)
    right_edge = center + round((shoe_right - alpha.width / 2) * scale)
    left, top = left_edge - 18, feet - 38
    size = (right_edge - left_edge + 36, 55)

    # A penumbra se projeta para o fundo e é mais densa junto à sola.
    broad = Image.new("L", size)
    ImageDraw.Draw(broad).ellipse((14, 11, right_edge - left + 4, 41), fill=105)
    contact = Image.new("L", size)
    ImageDraw.Draw(contact).ellipse((19, 33, right_edge - left - 1, 42), fill=143)
    mask = ImageChops.lighter(broad.filter(ImageFilter.GaussianBlur(6)),
                              contact.filter(ImageFilter.GaussianBlur(2)))
    for y in range(mask.height):
        for x in range(mask.width):
            fade = beam_fade(beam_distance(left + x, top + y))
            mask.putpixel((x, y), round(mask.getpixel((x, y)) * fade))

    layer = Image.new("RGBA", size, (1, 0, 1))
    layer.putalpha(mask)
    return layer, (left, top)


def save_frame(frame, path):
    rgb = frame.convert("RGB")
    try:
        with Image.open(path) as previous:
            if previous.size == rgb.size and ImageChops.difference(previous.convert("RGB"), rgb).getbbox() is None:
                return
    except OSError:
        pass

    pending = None
    try:
        with NamedTemporaryFile(dir=path.parent, suffix=".tmp", delete=False) as file:
            pending = Path(file.name)
            rgb.save(file, format="WEBP", lossless=True, method=2)
        # A sincronização da pasta pode bloquear a substituição por instantes.
        for delay in (.2, .5, 1, 2):
            try:
                pending.replace(path)
                break
            except PermissionError:
                sleep(delay)
        else:
            pending.replace(path)
    finally:
        if pending is not None:
            pending.unlink(missing_ok=True)


def export(sheet, output):
    base = load(BASE)
    sprites = load_sprites(sheet)
    layers = {(character, slot): light_sprite(sprite, slot)
              for character, sprite in sprites.items() for slot in SLOTS}
    shadows = {(character, slot): ground_shadow(sprite, slot)
               for character, sprite in sprites.items() for slot in SLOTS}
    doors = {character: load(OFFICE / "characters/doorway" / f"{character}.webp")
             for character in CHARACTERS}
    states = []
    output.mkdir(parents=True, exist_ok=True)
    for size, slots in enumerate(LAYOUTS):
        for corridor in combinations(CHARACTERS, size):
            background = base.copy()
            # Primeiro o piso. Os corpos mais próximos ocluem os de trás.
            for parts in (shadows, layers):
                for character, slot in zip(corridor, slots):
                    layer, position = parts[character, slot]
                    background.alpha_composite(layer, position)

            key = "-".join(corridor) or "vazio"
            for leftdoor in (None, *CHARACTERS):
                if leftdoor in corridor or (leftdoor is None and not corridor):
                    continue
                frame = background
                filename = f"corridor__{key}.webp"
                if leftdoor:
                    frame = background.copy()
                    frame.alpha_composite(doors[leftdoor])
                    filename = f"leftdoor__{leftdoor}__{filename}"
                save_frame(frame, output / filename)
                states.append({"file": filename, "leftdoor": leftdoor, "corridor": corridor})

    manifest = {
        "base": relpath(BASE.as_posix(), output.resolve().as_posix()),
        "characters": CHARACTERS,
        "layouts": LAYOUTS,
        "states": states,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return len(states)

def export_atlas(sheet, path):
    sprites = load_sprites(sheet)
    left, top, right, bottom = ATLAS_BOX
    width, height = right - left, bottom - top
    base_size = load(BASE).size
    atlas = Image.new("RGBA", (width * len(CHARACTERS), height * len(SLOTS)))
    for row, slot in enumerate(SLOTS):
        for column, character in enumerate(CHARACTERS):
            tile = Image.new("RGBA", base_size)
            for layer, point in (ground_shadow(sprites[character], slot), light_sprite(sprites[character], slot)):
                tile.alpha_composite(layer, point)
            atlas.paste(tile.crop(ATLAS_BOX), (column * width, row * height))
    atlas.save(path, "WEBP", lossless=True, method=6)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sprites", type=Path, help="Folha PNG com as cinco Nathzinhas em ordem canônica")
    parser.add_argument("--output", type=Path, default=OUTPUT, help="Pasta de destino das imagens e do manifesto")
    parser.add_argument("--atlas", type=Path, help="Exporta as camadas reutilizáveis do corredor em um único WebP")
    args = parser.parse_args()
    if args.atlas:
        export_atlas(args.sprites, args.atlas)
    else:
        print(f"{export(args.sprites, args.output)} imagens exportadas para {args.output}")
