"""Original print artwork for the wardrobe (run with system Python + Pillow, before a wardrobe build).

  python characters/tools/make_prints.py

Writes to characters/textures/:
  awd_kit_ghana_home.png / awd_kit_ghana_away.png  Football shirt artwork, mapped once around the body
      (awd_wardrobe.jersey_uv): u from the wearer's right side seam (front 0.25, back 0.75), v from the
      hem (bottom) to the neck (top). Drawn at 2 px per mm on a 1000 x 600 mm sheet, then squeezed square.
      Inspired by the Black Stars' 2026 shirts (Ananse cobweb lines in the flag colours; a sunny-yellow
      away shirt with tonal Adinkra-style marks and green side panels). No federation crest, maker logo or
      sponsor: only the national black star, the name GHANA and a number.
  awd_kente_mask.png / awd_ankara_mask.png  Colourway masks, not colours: red = the garment's chosen
      colour, green and blue = two accent colours, the remainder = a ground (dark for kente, cream for
      ankara). The game mixes the palette per player (client/src/v2/scene/awd-runtime.js).
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parents[1] / 'textures'
MM = 2                       # pixels per millimetre on the working sheet
W, H = 1000 * MM, 600 * MM   # torso circumference x hem-to-neck height
RED, GOLD, GREEN, BLUE, BLACK = (200, 16, 46), (242, 182, 50), (14, 122, 78), (31, 79, 184), (18, 18, 20)
FONT_DIR = Path('C:/Windows/Fonts')


def font(names, size):
    for name in names:
        if (FONT_DIR / name).exists():
            return ImageFont.truetype(str(FONT_DIR / name), size)
    return ImageFont.load_default()


def x_at(u):
    return u * W


def y_at(v):
    return (1 - v) * H


def star(draw, cx, cy, r, fill, outline=None, width=0):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        rad = r if k % 2 == 0 else r * 0.40
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    draw.polygon(pts, fill=fill, outline=outline, width=width)


def weave(img, strength=10, seed=3):
    """Fine knit texture: tiny alternating rows a shade lighter and darker than the cloth."""
    rnd = random.Random(seed)
    px = img.load()
    for y in range(0, img.height, 3):
        for x in range(0, img.width, 2):
            d = strength if (x // 2 + y // 3) % 2 else -strength // 2
            d += rnd.randint(-2, 2)
            r, g, b = px[x, y]
            px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))
    return img


def kente_strip(draw, x0, x1, y0, y1, colours, block=24 * MM):
    """A narrow kente strip: alternating warp stripes and weft blocks."""
    y, k = y0, 0
    while y < y1:
        if k % 2 == 0:
            stripes = [colours[0], BLACK, colours[1], BLACK, colours[0]]
            w = (x1 - x0) / len(stripes)
            for i, c in enumerate(stripes):
                draw.rectangle([x0 + i * w, y, x0 + (i + 1) * w, min(y1, y + block)], fill=c)
        else:
            bands = [colours[2], colours[1], colours[2]]
            h = block / len(bands)
            for i, c in enumerate(bands):
                draw.rectangle([x0, y + i * h, x1, min(y1, y + (i + 1) * h)], fill=c)
        y += block
        k += 1


def back_print(draw, number_fill, outline, name_fill):
    big = font(['ariblk.ttf', 'impact.ttf', 'arialbd.ttf'], 230 * MM)
    name = font(['ariblk.ttf', 'arialbd.ttf'], 62 * MM)
    cx = x_at(0.75)
    draw.text((cx, y_at(0.86)), 'GHANA', font=name, fill=name_fill, anchor='mm')
    draw.text((cx, y_at(0.50)), '10', font=big, fill=number_fill, anchor='mm', stroke_width=5 * MM, stroke_fill=outline)


def chest_marks(draw, star_fill):
    star(draw, x_at(0.315), y_at(0.80), 42 * MM, star_fill)
    # Small flag tag on the right chest (the wearer's right is towards the side seam at u = 0).
    fx, fy = x_at(0.185), y_at(0.80)
    for i, c in enumerate((RED, GOLD, GREEN)):
        draw.rectangle([fx - 30 * MM, fy - 30 * MM + i * 20 * MM, fx + 30 * MM, fy - 10 * MM + i * 20 * MM], fill=c)
    star(draw, fx, fy, 9 * MM, BLACK)


def ananse_web(img, cx, cy, spokes=13, rings=7, reach=470 * MM, clip=(0.045, 0.455)):
    """Cobweb threads in the flag colours fanning over the front from the right shoulder,
    kept to the front panel so the back stays clean for the name and number."""
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    colours = [RED, GOLD, GREEN, BLUE]
    angles = [math.pi * (0.04 + 0.62 * k / (spokes - 1)) for k in range(spokes)]   # fan down and across
    for k, a in enumerate(angles):
        draw.line([(cx, cy), (cx + reach * 1.3 * math.cos(a), cy + reach * 1.3 * math.sin(a))], fill=colours[k % 4] + (255,), width=3 * MM)
    for r in range(1, rings + 1):
        rad = reach * (r / rings) ** 1.1
        for k, (a0, a1) in enumerate(zip(angles, angles[1:])):
            pts = []
            for t in range(9):   # each thread sags a little towards the hub between spokes
                a = a0 + (a1 - a0) * t / 8
                sag = 1 - 0.07 * math.sin(math.pi * t / 8)
                pts.append((cx + rad * sag * math.cos(a), cy + rad * sag * math.sin(a)))
            draw.line(pts, fill=colours[(r + k) % 4] + (255,), width=int(2.5 * MM), joint='curve')
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rectangle([x_at(clip[0]), 0, x_at(clip[1]), H], fill=255)
    layer.putalpha(Image.composite(layer.getchannel('A'), mask, mask))
    img.paste(layer, (0, 0), layer)


def adinkra(draw, cx, cy, s, fill, kind):
    """Simplified Adinkra-style marks (spiral, ram's horns, star)."""
    w = max(2, int(s / 9))
    if kind == 0:
        for k in range(3):
            r = s * (0.45 - 0.13 * k)
            draw.arc([cx - r, cy - r, cx + r, cy + r], 30 + 40 * k, 330 - 20 * k, fill=fill, width=w)
    elif kind == 1:
        for side in (-1, 1):
            box = [cx + side * s * 0.25 - s * 0.3, cy - s * 0.3, cx + side * s * 0.25 + s * 0.3, cy + s * 0.3]
            draw.arc(box, -90 if side > 0 else 90, 90 if side > 0 else 270, fill=fill, width=w)
        draw.line([(cx, cy - s * 0.4), (cx, cy + s * 0.4)], fill=fill, width=w)
    else:
        star(draw, cx, cy, s * 0.42, None, outline=fill, width=w)


def kit_home():
    img = weave(Image.new('RGB', (W, H), (246, 246, 243)), 7)
    ananse_web(img, x_at(0.07), y_at(1.0))
    d = ImageDraw.Draw(img)
    for u0 in (-0.02, 0.48, 0.98):   # kente side panels centred on both side seams
        kente_strip(d, x_at(u0), x_at(u0 + 0.04), 0, H, (GOLD, GREEN, RED))
    d.rectangle([0, H - 14 * MM, W, H - 9 * MM], fill=RED)
    d.rectangle([0, H - 9 * MM, W, H - 4 * MM], fill=GOLD)
    d.rectangle([0, H - 4 * MM, W, H], fill=GREEN)
    chest_marks(d, BLACK)
    back_print(d, BLACK, GOLD, BLACK)
    return img


def kit_away():
    img = Image.new('RGB', (W, H), (244, 186, 34))
    d = ImageDraw.Draw(img)
    step = 70 * MM
    for j, y in enumerate(range(0, H + step, step)):
        for i, x in enumerate(range(0, W + step, step)):
            adinkra(d, x + (step / 2 if j % 2 else 0), y, 44 * MM, (226, 160, 18), (i + j) % 3)
    img = weave(img, 8)
    d = ImageDraw.Draw(img)
    for u0, u1 in ((0.0, 0.04), (0.46, 0.54), (0.96, 1.0)):   # dark green side panels
        d.rectangle([x_at(u0), 0, x_at(u1), H], fill=(11, 90, 53))
    for u in (0.04, 0.46, 0.54, 0.96):
        d.line([(x_at(u), 0), (x_at(u), H)], fill=RED, width=4 * MM)
    d.rectangle([0, H - 10 * MM, W, H], fill=(11, 90, 53))
    chest_marks(d, BLACK)
    back_print(d, (11, 90, 53), RED, (11, 90, 53))
    return img


def kente_mask(size=512, seed=11):
    """One 22 x 22 cm repeat: two strips, each alternating warp stripes and weft blocks with motifs.
    Channels: R primary, G accent A, B accent B; leftover = dark ground."""
    P, A, B, K = (255, 0, 0), (0, 255, 0), (0, 0, 255), (0, 0, 0)
    img = Image.new('RGB', (size, size), K)
    d = ImageDraw.Draw(img)
    strip, h = size // 2, size // 8
    for s in range(2):
        x0, offset = s * strip, (size // 8) * s
        for k in range(8):
            y0 = (k * h + offset) % size

            def rect(xa, ya, xb, yb, c):
                for dy in (0, -size):
                    d.rectangle([x0 + xa, y0 + ya + dy, x0 + xb, y0 + yb + dy], fill=c)
            if k % 2 == 0:   # warp-faced section: lengthwise stripes
                pattern = [P, P, K, A, K, P, P, B, P, P, K, A, K, P, P]
                w = strip / len(pattern)
                for i, c in enumerate(pattern):
                    rect(i * w, 0, (i + 1) * w - 1, h - 1, c)
            else:            # weft-faced block with a stepped diamond motif
                accent = A if (k // 2 + s) % 2 else B
                rect(0, 0, strip - 1, h - 1, accent)
                for i in range(4):
                    m = 6 + i * 9
                    rect(m, h * 0.18 + i * 3, strip - 1 - m, h * 0.82 - i * 3, [P, K, P, B if accent == A else A][i])
                rect(0, 0, strip - 1, 3, K)
                rect(0, h - 4, strip - 1, h - 1, K)
        d.line([(x0, 0), (x0, size)], fill=K, width=2)   # the seam between sewn strips
    # Thread texture: every channel dims a little thread by thread (read as shading by the game).
    rnd = random.Random(seed)
    px = img.load()
    for y in range(size):
        for x in range(size):
            f = 0.86 + 0.14 * ((x + y) % 3 != 0) - rnd.random() * 0.05
            r, g, b = px[x, y]
            px[x, y] = (int(r * f), int(g * f), int(b * f))
    return img


def ankara_mask(size=512, seed=21):
    """Wax-print style repeat: large primary motifs with accent rings and dots on a cream ground."""
    P, A, B, K = (255, 0, 0), (0, 255, 0), (0, 0, 255), (0, 0, 0)
    img = Image.new('RGB', (size, size), K)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    cell = size // 4
    for j in range(5):
        for i in range(5):
            cx, cy = i * cell + (cell // 2 if j % 2 else 0), j * cell
            for dx in (0, -size, size):
                for dy in (0, -size, size):
                    x, y = cx + dx, cy + dy
                    d.ellipse([x - 52, y - 52, x + 52, y + 52], fill=P)
                    d.ellipse([x - 36, y - 36, x + 36, y + 36], fill=A)
                    for k in range(8):
                        a = k * math.pi / 4
                        ex, ey = x + 44 * math.cos(a), y + 44 * math.sin(a)
                        d.ellipse([ex - 6, ey - 6, ex + 6, ey + 6], fill=B)
                    d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=P)
                    d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=K)
    for _ in range(140):
        x, y = rnd.randrange(size), rnd.randrange(size)
        if img.getpixel((x, y)) == K:
            d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=B)
    return img.filter(ImageFilter.SMOOTH)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, make in (('awd_kit_ghana_home', kit_home), ('awd_kit_ghana_away', kit_away)):
        img = make()
        # Plain swatch the sleeves are mapped to (awd_wardrobe.jersey_uv): the cloth colour alone.
        img.paste(img.getpixel((int(x_at(0.62)), int(y_at(0.12)))), (int(x_at(0.60)), int(y_at(0.16)), int(x_at(0.64)), int(y_at(0.08))))
        img.resize((1024, 1024), Image.LANCZOS).save(OUT / f'{name}.png')
    kente_mask().save(OUT / 'awd_kente_mask.png')
    ankara_mask().save(OUT / 'awd_ankara_mask.png')
    print('prints written to', OUT)


if __name__ == '__main__':
    main()
