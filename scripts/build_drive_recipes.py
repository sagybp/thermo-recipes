import json, re
d = json.load(open('source/drive_paragraphs.json', encoding='utf-8'))
CATS = {'תוספות','מאפים','עיקריות','מתוקים','סלטים','מתכוני בסיס','מרקים'}
recipes, cat = [], None
for o in d:
    t = o['text'].strip().rstrip(':').strip()
    if t == 'מתכונים ללא קישור':
        break
    if t == 'קישורים':
        continue
    if t in CATS and not o['links']:
        cat = t; continue
    if not t or not cat:
        continue
    links = list(dict.fromkeys(o['links']))
    m = re.split(r'\s*:\s+|\s+-\s+|:(?=\s)', o['text'].strip(), maxsplit=1)
    name = m[0].strip(); note = m[1].strip() if len(m) > 1 else ''
    recipes.append({'name': name, 'category': cat, 'url': links[0] if links else None,
                    'extra_urls': links[1:], 'note': note, 'source': 'drive'})
json.dump(recipes, open('data/drive_recipes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(recipes), 'recipes;', sum(1 for r in recipes if not r['url']), 'without link')
for r in recipes:
    if r['extra_urls'] or not r['url']: print(r['name'], r['extra_urls'], r['url'])
