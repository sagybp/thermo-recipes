import json
rows = [{k: r.get(k) for k in ('id', 'name_he', 'title_en', 'category', 'url', 'note')} for r in json.load(open('data/recipes.json', encoding='utf-8'))]
html = open('scripts/editor_template.html', encoding='utf-8').read().replace('/*DATA*/[]', json.dumps(rows, ensure_ascii=False))
open('editor.html', 'w', encoding='utf-8').write(html)
print(len(rows), 'recipes ->', 'editor.html')
