import re, json, collections
msgs = json.load(open('source/chat_messages.json', encoding='utf-8'))
URL = re.compile(r'https?://[^\s<>"\']+')
RID = re.compile(r'(?:/recipes?/)(?:recipe/)?(?:[a-zA-Z]{2}(?:-[A-Za-z]{2,4})?/)?(r\d+)')
POS = ['מעולה','מדהים','מדהימה','אהבנו','אהבתי','טעים','טעימה','נהדר','נהדרת','מושלם','מושלמת','הצלחה','הצליח','יצא לי','יצא מעולה','ממליץ','ממליצה','מומלץ','קלאסיק','כובש','שווה','חלום','יאמי','חד פעמי']
recipes = {}
for i, m in enumerate(msgs):
    for u in URL.findall(m['text']):
        if 'cookidoo' not in u: continue
        u = u.rstrip('.,)')
        r = RID.search(u)
        if not r: continue
        rid = r.group(1)
        e = recipes.setdefault(rid, {'id': rid, 'urls': [], 'shares': 0, 'senders': set(), 'dates': [], 'pos': 0, 'share_titles': [], 'hints': []})
        e['urls'].append(u); e['shares'] += 1; e['senders'].add(m['sender']); e['dates'].append(m['date'])
        t = re.search(r'Cookidoo®:\s*(.+)', m['text'])
        if t: e['share_titles'].append(t.group(1).strip())
        # context: same message text without url + following 6 msgs within the same chat flow
        own = URL.sub('', m['text']).strip()
        if own and 'Check out this delicious' not in own: e['hints'].append(own[:160])
        for j in range(i - 1, min(len(msgs), i + 7)):
            if j != i and any(p in msgs[j]['text'] for p in POS): e['pos'] += 1
out = []
for e in recipes.values():
    e['senders'] = len(e['senders']); e['urls'] = list(dict.fromkeys(e['urls']))
    e['share_titles'] = list(dict.fromkeys(e['share_titles']))
    e['hints'] = e['hints'][:3]
    out.append(e)
json.dump(out, open('data/chat_links.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), 'recipes;', sum(1 for e in out if e['share_titles']), 'with share title;', sum(1 for e in out if e['hints']), 'with typed hint')
print(collections.Counter(e['shares'] for e in out).most_common(6))
print(collections.Counter(re.search(r'//([^/]+)', e['urls'][0]).group(1) for e in out).most_common(8))
