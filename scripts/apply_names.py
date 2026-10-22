import json
CAT = {'B': 'מתכוני בסיס', 'S': 'תוספות', 'P': 'מאפים ולחמים', 'M': 'עיקריות', 'D': 'מתוקים', 'L': 'סלטים', 'O': 'מרקים', 'K': 'משקאות'}
DRIVE_CAT = {'מאפים': 'מאפים ולחמים'}
names = {}
for line in open('data/he_names.txt', encoding='utf-8'):
    line = line.strip()
    if line:
        rid, code, he = line.split('|', 2)
        names['r' + rid] = (CAT[code], he)
recipes = json.load(open('data/merged.json', encoding='utf-8'))
missing = []
for r in recipes:
    if not r['name_he']:
        if r['id'] in names:
            r['category'], r['name_he'] = names[r['id']]
        else:
            missing.append(r['id'])
    else:
        r['category'] = DRIVE_CAT.get(r['category'], r['category'])
if missing:
    print('MISSING', missing)
recipes = [r for r in recipes if r['name_he']]
json.dump(recipes, open('data/recipes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
import collections
print(len(recipes), collections.Counter(r['category'] for r in recipes))
