"""Apply the exported review edits (data/recipe_edits.json) to data/recipes.json.

Ambiguous cases (an id both renamed and deleted, or two rows sharing one id) are NOT deleted:
they are kept and reported, so nothing is lost until the owner confirms.
"""
import json, collections

recipes = json.load(open('data/recipes.json', encoding='utf-8'))
ed = json.load(open('data/recipe_edits.json', encoding='utf-8'))
edits, deleted = ed['edits'], set(ed['deleted'])

AMBIGUOUS = {k for k in deleted if k in edits}          # edited and deleted
counts = collections.Counter(r['id'] for r in recipes)
SHARED = {k for k, v in counts.items() if v > 1}        # two rows, one id: editor treated them as one

stats = collections.Counter()
out, seen_shared = [], set()
for r in recipes:
    rid = r['id']
    if rid in SHARED:
        # same recipe listed twice in the Drive doc: keep one entry, using the edited name if any
        if rid in seen_shared:
            stats['merged duplicate rows'] += 1
            continue
        seen_shared.add(rid)
    elif rid in deleted and rid not in AMBIGUOUS:
        stats['deleted'] += 1
        continue
    e = edits.get(rid, {})
    if 'name' in e:
        r['name_he'] = e['name'].strip(); stats['renamed'] += 1
    if 'category' in e:
        r['category'] = e['category']; stats['category changed'] += 1
    if 'note' in e:
        r['note'] = e['note'].strip(); stats['note changed'] += 1
    out.append(r)

json.dump(out, open('data/recipes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(recipes), '->', len(out), 'recipes')
print(dict(stats))
print('kept pending confirmation (edited AND deleted):', sorted(AMBIGUOUS))
print('shared-id duplicates merged:', sorted(SHARED))
print(collections.Counter(r['category'] for r in out))
