"""Run python tests/test_office_images.py (Pillow); no image edits."""
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

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

with Image.open(OFFICE / 'states/corridor-atlas.webp') as atlas:
    assert atlas.mode == 'RGBA'
    assert atlas.size == (1320, 1320)
    alpha = atlas.getchannel('A')
    for character in range(5):
        bounds = []
        for slot in range(5):
            x, y = 264 * character, 264 * slot
            tile = alpha.crop((x, y, x + 264, y + 264))
            bounds.append(tile.getbbox())
        assert all(bounds)
        assert max(bounds[i][3] for i in range(3)) < min(bounds[i][3] for i in range(3, 5))

print('PASS: five corridor characters have distinct front and back slots in the published atlas.')

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

for character in ('yandere', 'platinada'):
    with Image.open(OFFICE / f'closet/layers/{character}.webp') as layer:
        assert layer.size == (1671, 941)
        assert layer.mode == 'RGBA'
        assert layer.getchannel('A').getbbox()
print('PASS: the closet has overlay art for a fourth and fifth invader.')
