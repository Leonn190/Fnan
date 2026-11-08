"""Check image invariants: run python tests/test_cam05_images.py (Pillow)."""
from pathlib import Path
import hashlib
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
CAMERA = ROOT / 'public/images/cameras/CAM05'
original_path = CAMERA / 'master.png'
original = Image.open(original_path).convert('RGB')
closed = Image.open(CAMERA / 'base.webp').convert('RGB')
left = Image.open(CAMERA / 'states/open-closed/vazia.webp').convert('RGB')
right = Image.open(CAMERA / 'states/closed-open/vazia.webp').convert('RGB')
both = Image.open(CAMERA / 'states/open-open/vazia.webp').convert('RGB')
assert original.size == (1672, 941)
assert all(image.size == original.size for image in [left, right, both])
assert closed.size == original.size
assert ImageChops.difference(closed, original).getbbox() is None

# Closing one side must restore that half to the untouched original.
left_half, right_half = (0, 0, 836, 941), (836, 0, 1672, 941)
for image, expected, crop in [(left, original, right_half), (right, original, left_half),
                               (both, left, left_half), (both, right, right_half)]:
    assert ImageChops.difference(image.crop(crop), expected.crop(crop)).getbbox() is None

# A full comparison detects any regeneration or lighting shift in the room.
# The rectangles encompass only the two shutter openings in the master image.
for y in range(941):
    for x in range(1672):
        outside_doors = not ((188 <= x <= 393 and 132 <= y <= 527)
                            or (1419 <= x < 1672 and 190 <= y < 941))
        if outside_doors:
            assert both.getpixel((x, y)) == original.getpixel((x, y)), (x, y)

# Preserve foreground lamp highlights overlapping the left shutter.
for y in range(388, 520):
    for x in range(210, 260):
        pixel = original.getpixel((x, y))
        if sum(pixel) > 510:
            assert both.getpixel((x, y)) == pixel, (x, y)

# Existing master stays byte-identical to its V8 record.
manifest = (ROOT / 'outros/documentacao/MAPEAMENTO_ORIGINAIS.json').read_text(encoding='utf-8')
assert hashlib.sha256(original_path.read_bytes()).hexdigest() in manifest
print('PASS: original intact, 4 matching resolutions, unchanged room, foreground lamp and closed sides, consistent open states.')
