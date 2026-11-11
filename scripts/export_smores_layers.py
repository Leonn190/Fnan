"""Extract Smores from the supplied office frames as transparent WebP layers."""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "public" / "images"
OFFICE = IMAGES / "office"
BASE = Image.open(OFFICE / "master.png").convert("RGB")
OUTPUT = OFFICE / "characters"


def extract(source, name, outline, low, high, solid_below=None, core=()):
    frame = Image.open(IMAGES / source).convert("RGB").resize(BASE.size, Image.Resampling.LANCZOS)
    red, green, blue = ImageChops.difference(frame, BASE).split()
    difference = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    difference = difference.point(lambda value: round(255 * max(0, min(1, (value - low) / (high - low)))))

    mask = Image.new("L", BASE.size)
    ImageDraw.Draw(mask).polygon(outline, fill=255)
    if solid_below is not None:
        # The foreground desk and rug also changed in the source. Use the silhouette
        # around the legs and tail here, where a color difference alone is ambiguous.
        blend = Image.new("L", BASE.size)
        draw = ImageDraw.Draw(blend)
        for y in range(solid_below, BASE.height):
            draw.line((0, y, BASE.width, y), fill=min(255, round((y - solid_below) * 255 / 16)))
        difference = ImageChops.lighter(difference, blend)
    if core:
        # Dark pixels inside the silhouette (eyes, mouth and seams) are opaque.
        interior = Image.new("L", BASE.size)
        ImageDraw.Draw(interior).polygon(core, fill=255)
        difference = ImageChops.lighter(difference, interior.filter(ImageFilter.GaussianBlur(2)))

    frame.putalpha(ImageChops.multiply(difference, mask.filter(ImageFilter.GaussianBlur(1.1))))
    frame.save(OUTPUT / f"smores-{name}.webp", lossless=True, method=6)


if __name__ == "__main__":
    extract("Smores na Ventilação do Escritório.png", "vent",
            [(1498, 80), (1610, 80), (1611, 168), (1498, 168)], low=8, high=31)
    extract("Smores no Escritório Neon Rosa.png", "room", [
        (946, 357), (956, 328), (978, 294), (999, 289), (1033, 311),
        (1071, 300), (1102, 277), (1130, 303), (1145, 365), (1180, 461),
        (1210, 477), (1237, 505), (1240, 546), (1228, 587), (1224, 609),
        (1212, 628), (1193, 639), (1157, 644), (1127, 654), (1019, 654),
        (999, 643), (980, 634), (970, 620), (972, 581), (982, 547),
        (981, 498), (956, 469), (946, 430), (944, 390),
    ], low=12, high=45, solid_below=526, core=[
        (961, 381), (975, 341), (988, 313), (1015, 332), (1058, 335),
        (1104, 301), (1121, 331), (1126, 365), (1145, 401), (1148, 435),
        (1128, 466), (1142, 493), (1170, 495), (1200, 515), (1214, 548),
        (1001, 553), (1005, 490), (976, 455), (968, 425),
    ])
