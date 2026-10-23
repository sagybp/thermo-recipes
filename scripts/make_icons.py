import math
from PIL import Image, ImageDraw
S = 512
PAPER, LINE, INK, RED, MARGIN = '#f6ecc8', '#9cc3d4', '#2a2a45', '#c0392b', '#e0776e'
SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">
<rect width="{S}" height="{S}" fill="{PAPER}"/>
{''.join(f'<line x1="0" x2="{S}" y1="{112 + 64 * i}" y2="{112 + 64 * i}" stroke="{LINE}" stroke-width="4"/>' for i in range(6))}
<line x1="404" x2="404" y1="0" y2="{S}" stroke="{MARGIN}" stroke-width="6"/>
<rect x="136" y="232" width="240" height="170" rx="36" fill="{INK}"/>
<rect x="120" y="204" width="272" height="34" rx="17" fill="{INK}"/>
<rect x="236" y="176" width="40" height="32" rx="14" fill="{INK}"/>
<rect x="96" y="268" width="48" height="26" rx="13" fill="{INK}"/>
<rect x="368" y="268" width="48" height="26" rx="13" fill="{INK}"/>
<path d="M214 152c-18-14 18-30 0-48M298 152c-18-14 18-30 0-48" fill="none" stroke="{RED}" stroke-width="14" stroke-linecap="round"/>
</svg>"""
open('public/icon.svg', 'w', encoding='utf-8').write(SVG)

def png(size):
    k = 4  # supersample for smooth edges
    im = Image.new('RGB', (S * k, S * k), PAPER)
    d = ImageDraw.Draw(im)
    for i in range(6):
        y = (112 + 64 * i) * k
        d.line([(0, y), (S * k, y)], fill=LINE, width=4 * k)
    d.line([(404 * k, 0), (404 * k, S * k)], fill=MARGIN, width=6 * k)
    rr = lambda x, y, w, h, r: d.rounded_rectangle([x * k, y * k, (x + w) * k, (y + h) * k], r * k, fill=INK)
    rr(136, 232, 240, 170, 36); rr(120, 204, 272, 34, 17); rr(236, 176, 40, 32, 14); rr(96, 268, 48, 26, 13); rr(368, 268, 48, 26, 13)
    for x0 in (214, 298):  # steam: two small S curves
        pts = [((x0 - 13 * math.sin(t * 2 * math.pi)) * k, (152 - 48 * t) * k) for t in [i / 30 for i in range(31)]]
        d.line(pts, fill=RED, width=14 * k, joint='curve')
        for p in (pts[0], pts[-1]):
            d.ellipse([p[0] - 7 * k, p[1] - 7 * k, p[0] + 7 * k, p[1] + 7 * k], fill=RED)
    return im.resize((size, size), Image.LANCZOS)

for s in (192, 512):
    png(s).save(f'public/icon-{s}.png')
print('icons done')

