"""Run python tests/test_office_images.py (Pillow); no image edits."""
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
OFFICE = ROOT / 'public/images/office'
original = Image.open(OFFICE / 'office-original.png').convert('RGB')
views = {name: Image.open(OFFICE / f'states/office-{name}.webp').convert('RGB')
         for name in ['open-dark', 'open-lit', 'closed']}
assert original.size == (2172, 724)
# Test every pixel outside the central aperture's bounding rectangle.
regions = [(0, 0, 2172, 198), (0, 548, 2172, 724),
           (0, 198, 865, 548), (1308, 198, 2172, 548)]
for name, image in views.items():
    assert image.size == original.size, name
    for region in regions:
        assert ImageChops.difference(original.crop(region), image.crop(region)).getbbox() is None, (name, region)
    # Foreground radio/antenna crossing the passage stays on top of all views.
    for point in [(1299, 485), (1295, 535), (748, 573)]:
        assert image.getpixel(point) == original.getpixel(point), (name, point)

corridor = (890, 210, 1280, 530)
mean = lambda image, box: sum(ImageStat.Stat(image.crop(box)).mean) / 3
assert mean(views['open-dark'], corridor) < 3
assert mean(views['open-lit'], (1030, 390, 1140, 460)) > 10 * mean(views['open-dark'], (1030, 390, 1140, 460))
# The flashlight reveals the center while leaving the outer recess dark.
assert mean(views['open-lit'], (890, 210, 920, 250)) < 4
assert mean(views['closed'], corridor) > 10 * mean(views['open-dark'], corridor)
print('PASS: 3 office panoramas, lossless unchanged exterior/foreground, near-black corridor, round beam center and closed gate.')
