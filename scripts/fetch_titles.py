import json, re, time, urllib.request, html, concurrent.futures as cf
chat = json.load(open('data/chat_links.json', encoding='utf-8'))
drive = json.load(open('data/drive_recipes.json', encoding='utf-8'))
RID = re.compile(r'/(r\d+)')
targets = {}
for e in chat: targets[e['id']] = e['urls'][0]
for r in drive:
    if r['url'] and 'cookidoo' in r['url']:
        targets.setdefault(RID.search(r['url']).group(1), r['url'])
cache = {}
def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (ThermoGroup recipe index)'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
def fetch(rid):
    urls = [f'https://cookidoo.international/recipes/recipe/en/{rid}', targets[rid]]
    for u in urls:
        for _ in range(2):
            try:
                t = get(u)
                title = re.search(r'property="og:title" content="([^"]*)"', t)
                img = re.search(r'property="og:image" content="([^"]*)"', t)
                if title and title.group(1).strip():
                    time.sleep(0.3)
                    return rid, {'title': html.unescape(title.group(1)).strip(), 'image': img.group(1) if img else None, 'ok_url': u}
                break
            except Exception as ex:
                err = str(ex); time.sleep(1.5)
    return rid, {'title': None, 'error': 'unavailable'}
with cf.ThreadPoolExecutor(4) as ex:
    for k, (rid, info) in enumerate(ex.map(fetch, list(targets)), 1):
        cache[rid] = info
        if k % 50 == 0: print(k, len(targets), flush=True)
json.dump(cache, open('data/cookidoo_meta.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('done; missing:', sum(1 for v in cache.values() if not v.get('title')))
