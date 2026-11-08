"""Run python tests/test_office_images.py (Pillow); no image edits."""
import json
from itertools import combinations
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

ROOT = Path(__file__).resolve().parents[1]
OFFICE = ROOT / 'public/images/office'
original = Image.open(OFFICE / 'master.png').convert('RGB')
views = {name: Image.open(OFFICE / f'states/{name}.webp').convert('RGB')
         for name in ['open-dark', 'open-lit', 'closed']}
assert original.size == (2172, 724)
# Test every pixel outside the central aperture's bounding rectangle.
regions = [(0, 0, 2172, 197), (0, 547, 2172, 724),
           (0, 197, 864, 547), (1310, 197, 2172, 547)]
for name, image in views.items():
    assert image.size == original.size, name
    for region in regions:
        assert ImageChops.difference(original.crop(region), image.crop(region)).getbbox() is None, (name, region)
    # The left monitor, the radio antenna and right mug stay in the foreground.
    for point in [(655, 479), (872, 502), (888, 544), (1308, 545)]:
        assert image.getpixel(point) == original.getpixel(point), (name, point)

assert ImageChops.difference(views['open-dark'], original).getbbox() is None
with Image.open(ROOT / 'outros/arte/office/open-lit.png') as lit_source:
    previous_lit = lit_source.convert('RGB')
assert previous_lit.size == original.size
assert not (OFFICE / 'office.webp').exists()
corridor = (890, 210, 1280, 530)
mean = lambda image, box: sum(ImageStat.Stat(image.crop(box)).mean) / 3
assert mean(views['open-dark'], corridor) < 3
assert mean(views['open-lit'], (1030, 390, 1140, 460)) > 10 * mean(views['open-dark'], (1030, 390, 1140, 460))
assert mean(views['open-lit'], corridor) < 0.5 * mean(previous_lit, corridor)
# The flashlight reveals the center while leaving the outer recess dark.
assert mean(views['open-lit'], (890, 210, 920, 250)) < 4
assert mean(views['closed'], corridor) > 10 * mean(views['open-dark'], corridor)

for character in ('original', 'maid', 'gotica', 'yandere', 'platinada'):
    expected = views['open-lit'].convert('RGBA')
    with Image.open(OFFICE / f'characters/doorway/{character}.webp') as layer:
        expected.alpha_composite(layer.convert('RGBA'))
    with Image.open(OFFICE / f'states/open-lit/sala-vazia--porta-{character}.webp') as frame:
        assert ImageChops.difference(frame.convert('RGB'), expected.convert('RGB')).getbbox() is None, character

print('PASS: office foreground, subdued corridor light and all five lit doorway variants.')

folder = OFFICE / 'states/corridor'
manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
characters = ('original', 'platinada', 'yandere', 'gotica', 'maid')
assert manifest['characters'] == list(characters)
assert (folder / manifest['base']).resolve() == OFFICE / 'states/open-lit.webp'

expected = {}
for size in range(len(characters) + 1):
    for group in combinations(characters, size):
        key = f"corridor__{'-'.join(group) or 'vazio'}.webp"
        if group:
            expected[key] = (None, group)
        for door in characters:
            if door not in group:
                expected[f'leftdoor__{door}__{key}'] = (door, group)
assert len(manifest['states']) == len(expected) == 111
assert {state['file']: (state['leftdoor'], tuple(state['corridor']))
        for state in manifest['states']} == expected
assert {path.name for path in folder.glob('*.webp')} == set(expected)

outside_beam = Image.new('L', original.size, 255)
ImageDraw.Draw(outside_beam).ellipse((955, 233, 1221, 499), fill=0)
outside_beam = Image.merge('RGB', (outside_beam,) * 3)
doorway = {}
for character in characters:
    with Image.open(OFFICE / f'characters/doorway/{character}.webp') as layer:
        doorway[character] = layer.convert('RGBA')

corridor_views = {(): views['open-lit']}
for name, (door, group) in expected.items():
    if door:
        continue
    with Image.open(folder / name) as frame:
        assert frame.size == original.size, name
        occupied = frame.convert('RGB')
    diff = ImageChops.difference(occupied, views['open-lit'])
    assert diff.getbbox(), name
    assert ImageChops.multiply(diff, outside_beam).getbbox() is None, name
    corridor_views[group] = occupied

for name, (door, group) in expected.items():
    if not door:
        continue
    composed = corridor_views[group].convert('RGBA')
    composed.alpha_composite(doorway[door])
    with Image.open(folder / name) as frame:
        assert frame.size == original.size, name
        assert ImageChops.difference(frame.convert('RGB'), composed.convert('RGB')).getbbox() is None, name

print('PASS: 31 corridor states and 80 left-door states, with exact pixels outside the allowed areas.')

# Compare the visible portraits to the reference art, allowing for WebP compression.
closet_states = OFFICE / 'closet/states'
door_sources = {
    'original': 'Boneca animatrônica sob persianas neon.png',
    'yandere': 'yandere porta do escritorio.png',
    'gotica': 'Nathzinha Gótica no Escritório.png',
    'platinada': 'Animatrônica Gatinha no Portal Neon.png',
}
door_box = (555, 312, 693, 410)
portraits = {}
for character, source in door_sources.items():
    with Image.open(OFFICE.parent / source) as image:
        portraits[f'sala-vazia--porta-{character}.webp'] = (door_box, image.convert('RGB').crop(door_box))

with Image.open(OFFICE.parent / 'Cinco Nathzinhas no Escritório Neon.png') as image:
    master = image.convert('RGB')
for character, (x, y) in {
    'original': (525, 320), 'yandere': (707, 326), 'maid': (847, 326),
    'gotica': (1030, 322), 'platinada': (1195, 330),
}.items():
    box = (x - 22, y - 20, x + 22, y + 20)
    portraits[f'sala-{character}--porta-vazia.webp'] = (box, master.crop(box))

for gate in ('open', 'closed'):
    for name, (box, portrait) in portraits.items():
        with Image.open(closet_states / gate / name) as frame:
            difference = ImageChops.difference(frame.convert('RGB').crop(box), portrait)
        assert max(ImageStat.Stat(difference).mean) < 8, (gate, name)

print('PASS: all closet room and doorway portraits match their character references for both gate states.')
