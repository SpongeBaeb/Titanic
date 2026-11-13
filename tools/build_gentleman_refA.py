#!/usr/bin/env python3
"""A안(신사 걸음, 어두운 환경용 실루엣) 레퍼런스 4프레임: 착지-내려앉음-지나감-솟음 (반주기, 반복 재생).
출력 tools/work/gent_refA/: {black,tone,parts}/frame_{0..3}.png,
  refA_{black,tone,parts}_row.png (가로 4칸 2048x576 글자 없음), refA_{black,tone,parts}_labeled.png (번호 확인용)
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gait_model as G
import build_walk_ref_v3 as R
import build_gentleman_parts as P

G.BOB = 0.008
PROF = dict(hip=1.2, knee=1.1, arm=1.7, elbow=1.7, lean=-3)
OUT = os.path.join(HERE, 'work', 'gent_refA'); os.makedirs(OUT, exist_ok=True)
NAMES = ['1 착지', '2 내려앉음', '3 지나감', '4 솟음']
CW, CH = R.CW, R.CH


def cells(kind):
    out = []
    for p, pose, x, hy in G.timed_cycle(8, profile=PROF)[0][:4]:
        im = Image.new('RGB', (CW, CH), 'white'); d = ImageDraw.Draw(im)
        if kind == 'parts':
            P.draw(d, pose, CW // 2 - 20, R.BASE + hy, p)
        else:
            R.NEAR, R.FAR, R.LINE = ((0, 0, 0),) * 3 if kind == 'black' else ((44, 42, 48), (110, 108, 120), (255, 255, 255))
            R.draw(d, pose, 'coat', CW // 2 - 20, R.BASE + hy, p, outline=False)
        out.append(im)
    return out


if __name__ == '__main__':
    f = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 30)
    for kind in ('black', 'tone', 'parts'):
        os.makedirs(os.path.join(OUT, kind), exist_ok=True)
        c = cells(kind)
        row = Image.new('RGB', (CW * 4, CH), 'white'); lab = Image.new('RGB', (CW * 4, CH), 'white'); d = ImageDraw.Draw(lab)
        for i, im in enumerate(c):
            im.save(os.path.join(OUT, kind, f'frame_{i}.png')); row.paste(im, (i * CW, 0)); lab.paste(im, (i * CW, 0))
            d.text((i * CW + 16, 12), NAMES[i], fill=(200, 50, 40), font=f)
        row.save(os.path.join(OUT, f'refA_{kind}_row.png')); lab.resize((CW * 2, CH // 2)).save(os.path.join(OUT, f'refA_{kind}_labeled.png'))
        print('ok', kind)
    P.legend().save(os.path.join(OUT, 'legend.png'))
