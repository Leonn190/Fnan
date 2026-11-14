"""Segmentação local das poses a partir dos quadros originais."""

import cv2
import numpy as np
from PIL import Image, ImageDraw


def artwork_mask(size, artwork):
    mask = Image.new("L", (size[0] * 4, size[1] * 4), 0 if "outline" in artwork else 255)
    draw = ImageDraw.Draw(mask)

    def polygon(points, fill):
        draw.polygon([(x * mask.width / 100, y * mask.height / 100) for x, y in points], fill=fill)

    if "outline" in artwork:
        polygon(artwork["outline"], 255)
    for hole in artwork.get("holes", []):
        polygon(hole, 0)
    return np.asarray(mask.resize(size, Image.Resampling.BOX))


def pose_matte(source, base, initial, artwork, guide=None):
    """Corrige o contorno num corredor estreito, preservando os interiores."""
    rgb = np.asarray(source.convert("RGB"))
    background = np.asarray(base.convert("RGB"), dtype=np.float32)
    height, width = initial.shape
    path = artwork_mask((width, height), artwork) >= 128
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    inside = cv2.erode(path.astype(np.uint8), kernel) != 0
    outside = cv2.dilate(path.astype(np.uint8), kernel) == 0
    outside |= initial == 0
    inside &= ~outside
    labels = np.where(path, cv2.GC_PR_FGD, cv2.GC_PR_BGD).astype(np.uint8)
    labels[inside] = cv2.GC_FGD
    labels[outside] = cv2.GC_BGD
    guide_rgb = np.asarray(guide.convert("RGB")) if guide is not None else rgb
    # A cor é guiada pelo PNG registrado. O quadro individual mantém as
    # cores locais onde o PNG de grupo contém outra personagem por cima.
    sample = np.where(np.max(np.abs(guide_rgb.astype(np.int16) - rgb), axis=2)[..., None] < 12,
                      guide_rgb, rgb)
    cv2.setRNGSeed(319)
    cv2.grabCut(np.ascontiguousarray(sample), labels, None, None, None, 3, cv2.GC_INIT_WITH_MASK)
    subject = (labels & 1).astype(np.uint8)
    # Conserva apenas componentes que tocam a marcação interna. As frestas
    # podem dividir uma mesma personagem em mais de um componente legítimo.
    _, components = cv2.connectedComponents(subject, connectivity=8)
    keep = np.unique(components[inside])
    subject = np.isin(components, keep[keep != 0]).astype(np.uint8)

    inner_distance = cv2.distanceTransform(subject, cv2.DIST_L2, 5)
    outer_distance = cv2.distanceTransform(1 - subject, cv2.DIST_L2, 5)
    boundary = np.clip((inner_distance - outer_distance + 1.7) / 3.4, 0, 1)
    boundary[outside] = 0
    original = rgb.astype(np.float32)
    contrast = np.max(np.abs(original - background), axis=2)
    matte = np.where(inner_distance > 1.5, 1, boundary * np.clip(contrast / 15, 0, 1))
    # Recupera a cor do primeiro plano apenas na penumbra, com limite de
    # correção para preservar as cores da roupa e dos fios.
    foreground = original + np.clip((original - background) * (1 - matte[..., None])
                                    / np.maximum(matte[..., None], .28), -25, 25)
    pixels = np.rint(np.dstack((foreground, 255 * matte))).clip(0, 255).astype(np.uint8)
    pixels[pixels[..., 3] == 0] = 0
    return Image.fromarray(pixels)
