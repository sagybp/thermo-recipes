import re, json, sys, collections
LINE = re.compile(r'^(\d{1,2}/\d{1,2}/\d{4}), (\d{1,2}:\d{2}) - (.*)$')
msgs = []
for raw in open('source/chat_x/WhatsApp Chat with תרמומיקס שיתוף מתכונים.txt', encoding='utf-8'):
    raw = raw.rstrip('\n')
    m = LINE.match(raw)
    if m:
        body = m.group(3)
        sender, _, text = body.partition(': ')
        if not _: sender, text = '', body
        msgs.append({'date': m.group(1), 'time': m.group(2), 'sender': sender, 'text': text})
    elif msgs:
        msgs[-1]['text'] += '\n' + raw
json.dump(msgs, open('source/chat_messages.json', 'w', encoding='utf-8'), ensure_ascii=False)
URL = re.compile(r'https?://[^\s<>"\']+')
ck = [(i, m) for i, m in enumerate(msgs) if 'cookidoo' in m['text']]
print('messages', len(msgs), 'with cookidoo', len(ck))
ids = collections.Counter()
for i, m in ck:
    for u in URL.findall(m['text']):
        r = re.search(r'/recipe[s]?/(?:recipe/)?(?:[a-zA-Z-]+/)?(r\d+)', u)
        if 'cookidoo' in u: ids[r.group(1) if r else u] += 1
print('unique recipe ids', len(ids)); print(ids.most_common(5))
print(msgs[0]['date'], msgs[-1]['date'])
for i, m in ck[:6]:
    print('---'); 
    for j in range(max(0,i-1), min(len(msgs), i+3)):
        print(re.sub(r'\+972[\d \-]+', '<tel>', msgs[j]['sender'])[:12], '|', msgs[j]['text'][:200].replace('\n',' / '))
