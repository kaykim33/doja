# 도자의 숲(아티팩트 원본) → doja 사이트 빌드: python3 tools_build.py <soyoho/index.html> <dbsnap 폴더>
import sys, re, json, glob, os
src, snap = sys.argv[1], sys.argv[2]
s = open(src).read()
s = re.sub(r'<script type="application/json" id="seed">.*?</script>\n?', '', s, flags=re.S)   # 사본은 필요 없음 (실제 DB가 있음)
s = s.replace("'로그인하고 참여 권한(편집·참여)이 있는 사람만 남아요. 링크로 보기만 하는 사람과 로그인 안 한 사람은 기록되지 않아요.'", "'이 사이트에 들어온 모든 사람을 브라우저 기준으로 세요. 이름은 공방에서 정한 닉네임으로 보여요.'")
head = ('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<title>도자의 숲 · 초SOYOHO</title><meta name="description" content="흙멍하러 오세요. 물레 돌리고, 굽 깎고, 불멍 물멍 하는 온라인 도자기 공방."><meta property="og:title" content="모여봐요 도자의 숲"><meta property="og:description" content="초SOYOHO 온라인 흙멍 공방">'
        '<style>:root{color-scheme:light;box-sizing:border-box}*,*::before,*::after{box-sizing:inherit}html,body{margin:0;padding:0;height:100%}</style>'
        '<script src="/shim.js"></script></head><body>')
open('public/index.html', 'w').write(head + s + '\n</body></html>\n')
docs = {}
J = lambda p: json.load(open(p))
for coll in ['board', 'vend', 'weather', 'gallery', 'tiles']:
    for f in glob.glob(f'{snap}/{coll}/*.json'):
        d = {k: v for k, v in J(f).items() if k not in ('version',)}
        docs[f'{coll}/{os.path.basename(f)[:-5]}'] = d
os.makedirs('lib', exist_ok=True)
json.dump({'docs': docs}, open('lib/seed.json', 'w'), ensure_ascii=False)
print('index', os.path.getsize('public/index.html'), 'seed docs', len(docs))
