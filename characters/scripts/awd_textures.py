"""Accra We Dey character pipeline: original procedural textures.

Every texture here is generated from code, so the artwork is original to the
project and carries no third-party licence. Images are small (128-512 px) so a
full character stays inside the mobile texture budget.
"""
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(globals().get('AWD_ROOT') or Path(__file__).resolve().parents[2])
TEX_DIR = ROOT / 'characters' / 'textures'


def save_image(name, rgba, alpha=False):
    """Store a float RGBA array (h, w, 4) as a PNG next to the sources."""
    TEX_DIR.mkdir(parents=True, exist_ok=True)
    h, w, _ = rgba.shape
    image = bpy.data.images.get(name)
    if image and (image.size[0] != w or image.size[1] != h):
        bpy.data.images.remove(image)
        image = None
    image = image or bpy.data.images.new(name, w, h, alpha=alpha)
    # Row 0 is the bottom of the image, matching Blender UV v = 0.
    image.pixels.foreach_set(np.ascontiguousarray(rgba, dtype=np.float32).ravel())
    image.filepath_raw = str(TEX_DIR / f'{name}.png')
    image.file_format = 'PNG'
    image.save()
    return image


def _grid(size):
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    return (x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1


def iris_texture(size=256, seed=7):
    """Front-projected eyeball map: sclera, brown iris with fibres, limbal ring, pupil."""
    x, y = _grid(size)
    r = np.hypot(x, y)
    angle = np.arctan2(y, x)
    rng = np.random.default_rng(seed)
    fibres = np.zeros_like(r)
    for k, amp in [(23, 0.10), (41, 0.07), (67, 0.05)]:
        fibres += amp * np.sin(angle * k + rng.random() * 6 + r * rng.random() * 9)
    iris_r, pupil_r = 0.50, 0.17
    t = np.clip((r - pupil_r) / (iris_r - pupil_r), 0, 1)[..., None]
    iris = np.array([0.30, 0.17, 0.08]) * (1 - t) + np.array([0.16, 0.085, 0.04]) * t
    iris *= (1 + fibres)[..., None]
    iris *= (1 - 0.55 * np.clip((r - (iris_r - 0.06)) / 0.06, 0, 1))[..., None]  # limbal ring
    sclera = np.array([0.90, 0.87, 0.83]) * np.ones_like(iris)
    vein = np.clip((r - 0.75) / 0.25, 0, 1) * (0.5 + 0.5 * np.sin(angle * 31)) * 0.12
    sclera[..., 1] -= vein
    sclera[..., 2] -= vein
    edge = np.clip((r - iris_r) / 0.025, 0, 1)[..., None]
    color = iris * (1 - edge) + sclera * edge
    pupil = np.clip((pupil_r + 0.012 - r) / 0.024, 0, 1)[..., None]
    color = color * (1 - pupil) + np.array([0.012, 0.010, 0.010]) * pupil
    rgba = np.concatenate([np.clip(color, 0, 1), np.ones_like(r)[..., None]], axis=-1)
    return save_image('awd_eye_iris', rgba)


def fabric_texture(kind, size=256, seed=31):
    """Tileable near-white weave; the material colour factor supplies the garment colour."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    if kind == 'denim':   # 2/1 twill: diagonal ridges, slubby warp, faded highlights
        twill = 0.5 + 0.5 * np.sin((x + y) * 2 * np.pi / 6)
        slub = np.repeat(rng.random((1, size)), size, axis=0) * 0.25
        value = 0.70 + 0.18 * twill + slub * 0.6 + rng.random((size, size)) * 0.06
    else:                 # jersey knit: fine vertical columns of loops
        loops = 0.5 + 0.5 * np.sin(x * 2 * np.pi / 4) * np.sin(y * 2 * np.pi / 6)
        value = 0.86 + 0.10 * loops + rng.random((size, size)) * 0.04
    value = np.clip(value, 0, 1)
    rgba = np.stack([value, value, value * (0.98 if kind == 'denim' else 1), np.ones_like(value)], axis=-1)
    return save_image(f'awd_fabric_{kind}', rgba)


def brow_alpha(name='awd_brow_alpha', size=(256, 64), seed=5):
    """Tapered brow silhouette filled with directional hair strokes.

    u runs from the inner brow (0) to the tail (1); v from below (0) to above (1).
    Inner hairs grow upward, the body and tail hairs lie along the brow."""
    w, h = size
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    u, v = (xx + 0.5) / w, (yy + 0.5) / h
    centre = 0.50 + 0.08 * np.sin(np.pi * np.clip(u * 1.05, 0, 1)) - 0.06 * u
    half = 0.10 + 0.22 * (1 - u) ** 0.7
    shape = np.clip((half - np.abs(v - centre)) / 0.05, 0, 1) * np.clip((u - 0.01) / 0.06, 0, 1) * np.clip((0.98 - u) / 0.08, 0, 1)
    strokes = np.zeros((h, w))
    for _ in range(900):
        su = rng.random()
        sv = 0.50 + 0.08 * np.sin(np.pi * su) - 0.06 * su + (rng.random() - 0.5) * 2 * (0.10 + 0.22 * (1 - su) ** 0.7)
        angle = np.radians(75 - 70 * min(1, su * 2.2)) + rng.normal(0, 0.12)
        dx, dy = np.cos(angle) * w, np.sin(angle) * h
        norm = np.hypot(dx, dy)
        dx, dy = dx / norm, dy / norm
        px, py = xx - su * w, yy - sv * h
        along = px * dx + py * dy
        length = 9 + 7 * rng.random()
        across = np.abs(-px * dy + py * dx)
        t = np.clip(along / length, 0, 1)
        strokes = np.maximum(strokes, ((along > 0) & (along < length) & (across < 1.1 * (1 - t) + 0.35)) * (1 - 0.4 * t))
    alpha = np.clip(shape * (0.35 + 0.9 * strokes), 0, 1)
    rgba = np.ones((h, w, 4))
    rgba[..., 3] = alpha
    return save_image(name, rgba, alpha=True)


def strand_alpha(name, size=(256, 64), strands=140, seed=3, lean=1.0, thickness=1.6, density_falloff=True):
    """Alpha mask of short tapered hair strokes (u runs along the brow or lash line)."""
    w, h = size
    rng = np.random.default_rng(seed)
    alpha = np.zeros((h, w))
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    for _ in range(strands):
        u = rng.random()
        density = 1 - 0.7 * u if density_falloff else 1.0
        if rng.random() > density:
            continue
        x0, y0 = u * w, h * (0.2 + 0.55 * rng.random())
        length = h * (0.35 + 0.35 * rng.random())
        dx, dy = lean * (0.6 + 0.8 * u), 1.0
        norm = np.hypot(dx, dy)
        dx, dy = dx / norm, dy / norm
        px, py = xx - x0, yy - y0
        along = px * dx + py * dy
        across = np.abs(-px * dy + py * dx)
        t = np.clip(along / length, 0, 1)
        stroke = (along > 0) & (along < length) & (across < thickness * (1 - t) + 0.3)
        alpha = np.maximum(alpha, stroke * (1 - 0.5 * t))
    blur = alpha + sum(np.roll(alpha, s, axis=(0, 1)) * 0.35 for s in [(0, 1), (0, -1), (1, 0), (-1, 0)])
    rgba = np.ones((h, w, 4))
    rgba[..., 3] = np.clip(blur / 1.6, 0, 1)
    return save_image(name, rgba, alpha=True)
