import re, subprocess, pathlib
src = open('design-options.html', encoding='utf-8').read()
head = src[:src.index('<style>')] + '<style>'
css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
opts = re.findall(r'<div class="opt">(.*?)</div></div></div>\n', src, re.S)
names = ['מחברת מטבח', 'פופ בולט', 'תפריט ביסטרו', 'מגזין אוכל', 'לוח המכשיר']
cells = []
for n, body in enumerate(opts, 1):
    phone = re.search(r'(<div class="phone.*)', body, re.S).group(1) + '</div></div>'
    cells.append(f'<div class="cell"><div class="badge"><b>{n}</b>{names[n-1]}</div>{phone}</div>')
title = '''<div class="cell title"><div class="big">איזה עיצוב<br>נבחר לאתר<br>המתכונים<br>שלנו?</div><div class="small">הצביעו בסקר למטה 👇<br>(1 עד 5)</div></div>'''
cells.insert(0, title)
page = f'''{head}{css}
body{{background:#ece7dc;padding:0;width:1260px}}
.grid{{display:grid;grid-template-columns:repeat(3,420px);width:1260px}}
.cell{{display:flex;flex-direction:column;align-items:center;height:770px}}
.badge{{display:flex;align-items:center;gap:10px;margin:18px 0 16px;font:800 26px Heebo;color:#222}}
.badge b{{background:#222;color:#fff;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:24px}}
.title{{justify-content:center;text-align:center;padding:0 20px}}
.title .big{{font:900 58px/1.1 Heebo;color:#222}}
.title .small{{font:600 26px/1.5 Heebo;margin-top:26px;color:#444}}
</style></head><body><div class="grid">{''.join(cells)}</div></body></html>'''
html = pathlib.Path('poll/all-options.html'); html.write_text(page, encoding='utf-8')
png = pathlib.Path('poll/all-options.png')
subprocess.run([r'C:\Program Files\Google\Chrome\Application\chrome.exe', '--headless=new', '--disable-gpu', '--hide-scrollbars',
                '--force-device-scale-factor=2', '--window-size=1260,1540', '--virtual-time-budget=8000',
                f'--screenshot={png.resolve()}', html.resolve().as_uri()], check=True, capture_output=True)
from PIL import Image
im = Image.open(png); print(im.size)
im.crop((0, 0, 2520, 3080)).save(png)
print(png.stat().st_size)
