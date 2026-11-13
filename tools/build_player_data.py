#!/usr/bin/env python3
"""재생 페이지(tools/work/paint_check/player)용 인물 데이터를 만든다: 게임 시트(webp)와 그림자 시트를 복사하고 인물별 프레임 표(chars.json)를 쓴다.
그려 받은 그림 시트(신사, 숙녀)와 임시 실루엣 시트(어린이, 노인 남녀, 청년 남녀)를 모두 넣는다.
사용: python -I build_player_data.py
"""
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUMOR = os.path.join(ROOT, 'frontend', 'src', 'components', 'question', 'rumor')
WALK = os.path.join(ROOT, 'frontend', 'public', 'q6', 'walk')
OUT = os.path.join(ROOT, 'tools', 'work', 'paint_check', 'player')
SH = os.path.join(OUT, 'sheets')
# (id, 이름, ts 파일, 시트 이름, 그려 받은 그림인가, 게임 배율)
CHARS = [
    ('gent', '신사 (중년 남성)', 'gentPaintSprites.ts', 'gentpaint', True, 1.0),
    ('lady', '숙녀 (중년 여성)', 'ladyPaintSprites.ts', 'ladypaint', True, 1.0),
    ('child', '어린이 (남녀 공용)', 'childPaintSprites.ts', 'childpaint', True, 0.76),
    ('child_girl', '어린 여자아이', 'childGirlPaintSprites.ts', 'childgirlpaint', True, 0.76),
    ('elder_m', '노인 남성', 'oldManPaintSprites.ts', 'oldmanpaint', True, 1.0),
    ('elder_f', '노인 여성', 'oldWomanPaintSprites.ts', 'oldwomanpaint', True, 1.0),
    ('young_m', '청년 남성', 'youngManPaintSprites.ts', 'youngmanpaint', True, 1.0),
    ('young_f', '청년 여성', 'youngWomanPaintSprites.ts', 'youngwomanpaint', True, 1.0),
]


def main():
    os.makedirs(SH, exist_ok=True)
    out = []
    for cid, name, ts_name, sheet, painted, kmul in CHARS:
        t = open(os.path.join(RUMOR, ts_name), encoding='utf-8').read()
        j = json.loads(t[t.index('= {') + 2:t.rindex(';')])
        shutil.copyfile(os.path.join(WALK, sheet + '.webp'), os.path.join(SH, cid + '.webp'))
        d = dict(rects=j['rects'], walk=j['walk'], stand=j['stand'][0], stagger=j['stagger'][0], F2=j['fallF'][1], F4=j['lyingF'],
                 B2=j['fallB'][1], B4=j['lyingB'], U4=j['getupF'][0], dist=j['walkDist'])
        item = dict(id=cid, name=name, painted=painted, kmul=kmul, img=f'sheets/{cid}.webp', data=d)
        shp = os.path.join(WALK, sheet + '_shadow.webp')
        if j.get('shadow') and os.path.exists(shp):
            shutil.copyfile(shp, os.path.join(SH, cid + '_shadow.webp'))
            item['shadowImg'] = f'sheets/{cid}_shadow.webp'
            d['shadow'] = j['shadow']['rects']
            d['shadowFlip'] = j['shadow'].get('rectsFlip')
        out.append(item)
    json.dump(out, open(os.path.join(OUT, 'chars.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('인물', [c['id'] for c in out], '그림자', [c['id'] for c in out if 'shadowImg' in c])


if __name__ == '__main__':
    main()
