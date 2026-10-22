import json, re
meta = json.load(open('data/cookidoo_meta.json', encoding='utf-8'))
chat = {e['id']: e for e in json.load(open('data/chat_links.json', encoding='utf-8'))}
drive = json.load(open('data/drive_recipes.json', encoding='utf-8'))
remove = set(json.load(open('data/dedupe_decisions.json', encoding='utf-8'))['remove'])
RID = re.compile(r'/(r\d+)')
out, seen = [], set()
for r in drive:
    rid = RID.search(r['url']).group(1) if r['url'] and 'cookidoo' in r['url'] else None
    e = chat.get(rid) if rid else None
    out.append({'id': rid or 'x' + str(len(out)), 'name_he': r['name'], 'category': r['category'], 'note': r['note'], 'url': r['url'],
                'title_en': meta[rid]['title'] if rid else None, 'in_drive': True, 'in_chat': bool(e),
                'shares': e['shares'] if e else 0, 'pos': e['pos'] if e else 0, 'image': meta[rid].get('image') if rid else None})
    if rid: seen.add(rid)
for rid, e in chat.items():
    if rid in seen or rid in remove: continue
    out.append({'id': rid, 'name_he': None, 'category': None, 'note': '', 'url': 'https://cookidoo.international/recipes/recipe/en/' + rid,
                'title_en': meta[rid]['title'], 'in_drive': False, 'in_chat': True, 'shares': e['shares'], 'pos': e['pos'], 'image': meta[rid].get('image')})
json.dump(out, open('data/merged.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
need = [o for o in out if not o['name_he']]
print(len(out), 'total;', len(need), 'need Hebrew+category;', sum(1 for o in out if o['in_drive'] and o['in_chat']), 'in both')
json.dump([{'id': o['id'], 'en': o['title_en']} for o in need], open('data/to_translate.json', 'w', encoding='utf-8'), ensure_ascii=False)
