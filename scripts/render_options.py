import re, os, subprocess, pathlib
src = open('design-options.html', encoding='utf-8').read()
head = src[:src.index('<style>')] + '<style>'
css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
opts = re.findall(r'<div class="opt">(.*?)</div></div></div>\n', src, re.S)
assert len(opts) == 5, len(opts)
names = ['מחברת מטבח', 'פופ בולט', 'תפריט ביסטרו', 'מגזין אוכל', 'לוח המכשיר']
os.makedirs('poll', exist_ok=True)
edge = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
for n, body in enumerate(opts, 1):
    phone = re.search(r'(<div class="phone.*)', body, re.S).group(1) + '</div></div></div>'
    page = f'''{head}{css}
body{{background:#ece7dc;padding:0;display:flex;flex-direction:column;align-items:center;width:100vw;height:760px}}
.badge{{display:flex;align-items:center;gap:10px;margin:18px 0 16px;font:800 24px Heebo;color:#222}}
.badge b{{background:#222;color:#fff;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:22px}}
</style></head><body><div class="badge"><b>{n}</b>אפשרות {n} · {names[n-1]}</div>{phone}</body></html>'''
    html = pathlib.Path('poll') / f'option-{n}.html'
    html.write_text(page, encoding='utf-8')
    png = pathlib.Path('poll') / f'option-{n}.png'
    subprocess.run([edge, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                    '--window-size=600,760', '--virtual-time-budget=8000', f'--screenshot={png.resolve()}', html.resolve().as_uri()],
                   check=True, capture_output=True)
    from PIL import Image
    im = Image.open(png); w, h = im.size; left = (w - 840) // 2
    im.crop((left, 0, left + 840, 1520)).save(png)
    print(png, png.stat().st_size)


