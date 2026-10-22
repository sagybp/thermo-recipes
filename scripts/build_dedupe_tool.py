import json, re, difflib, itertools
meta = json.load(open('data/cookidoo_meta.json', encoding='utf-8'))
chat = {e['id']: e for e in json.load(open('data/chat_links.json', encoding='utf-8'))}
drive = json.load(open('data/drive_recipes.json', encoding='utf-8'))
RID = re.compile(r'/(r\d+)')
in_drive = {RID.search(r['url']).group(1) for r in drive if r['url'] and RID.search(r['url'])}
ids = list(chat.keys())
norm = lambda t: re.sub(r'[^a-z0-9 ]', '', re.sub(r'\s*\(.*?\)', '', t.lower())).strip()
img = lambda i: (meta[i].get('image') or '').split('/')[-1]
parent = {i: i for i in ids}
def find(x):
    while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
    return x
def union(a, b): parent[find(a)] = find(b)
for a, b in itertools.combinations(ids, 2):
    ta, tb = norm(meta[a]['title']), norm(meta[b]['title'])
    if (img(a) and img(a) == img(b)) or ta == tb or (len(ta) > 6 and difflib.SequenceMatcher(None, ta, tb).ratio() >= 0.88):
        union(a, b)
groups = {}
for i in ids: groups.setdefault(find(i), []).append(i)
dups = [g for g in groups.values() if len(g) > 1]
def item(i):
    e = chat[i]
    return {'id': i, 'title': meta[i]['title'], 'image': meta[i].get('image'), 'url': meta[i]['ok_url'],
            'shares': e['shares'], 'pos': e['pos'], 'drive': i in in_drive}
data = [[item(i) for i in sorted(g, key=lambda i: (-(i in in_drive), -chat[i]['shares'] - chat[i]['pos']))] for g in dups]
data.sort(key=lambda g: g[0]['title'].lower())
json.dump(data, open('data/dedupe_groups.json', 'w', encoding='utf-8'), ensure_ascii=False)
print(len(dups), 'groups;', sum(len(g) for g in dups), 'recipes involved;', len(ids) - sum(len(g) - 1 for g in dups), 'if one kept per group')
html = open('scripts/dedupe_template.html', encoding='utf-8').read().replace('/*DATA*/[]', json.dumps(data, ensure_ascii=False))
open('dedupe.html', 'w', encoding='utf-8').write(html)
