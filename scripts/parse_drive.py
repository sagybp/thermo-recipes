import zipfile, re, json, sys
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
z=zipfile.ZipFile(sys.argv[1])
rels={r.get('Id'):r.get('Target') for r in ET.fromstring(z.read('word/_rels/document.xml.rels'))}
body=ET.fromstring(z.read('word/document.xml')).find(W+'body')
out=[]
for p in body.iter(W+'p'):
    text=''.join(t.text or '' for t in p.iter(W+'t'))
    links=[rels.get(h.get(R+'id')) for h in p.iter(W+'hyperlink')]
    for it in p.iter(W+'instrText'):
        m = re.search(r'HYPERLINK\s+"([^"]+)"', it.text or '')
        if m: links.append(m.group(1))
    out.append({'text':text.strip(),'links':[l for l in links if l]})
json.dump(out,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False,indent=1)
for o in out:
    if o['text'] or o['links']: print(len(o['links']), o['text'][:60], o['links'][:1])
