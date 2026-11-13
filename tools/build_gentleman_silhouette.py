#!/usr/bin/env python3
"""어두운 환경(검은 실루엣만 보임)용 걷기: 한 걸음 반주기 4프레임(착지-내려앉음-지나감-솟음).
검은 단색에서는 좌우를 바꾼 프레임의 윤곽이 같으므로, 반주기 4장을 두 배 속도로 돌리면 한 주기가 된다.
보폭·팔 흔들림·무릎·몸 기울기를 키워 윤곽만으로 걷는 것으로 읽히게 한다.
사용: python -I build_gentleman_silhouette.py [outdir]  → tools/work/<outdir>/ black_{base,bold}_{0..3}.png, sheet_*.png
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import build_walk_ref_v3 as R
import gait_model as G
OUT = os.path.join(HERE, 'work', sys.argv[1] if len(sys.argv) > 1 else 'gent_sil'); os.makedirs(OUT, exist_ok=True)
BLACK = (0, 0, 0)
PROFILES = {
    'base': None,
    'bold': dict(hip=1.35, knee=1.25, arm=2.2, elbow=1.3, lean=4),
}
NAMES = ['1 착지', '2 내려앉음', '3 지나감', '4 솟음']


def cells(n, prof, color=BLACK):
    R.NEAR = R.FAR = R.LINE = color
    out = []
    for p, pose, x, hy in G.timed_cycle(n, profile=prof)[0]:
        im = Image.new('RGB', (R.CW, R.CH), 'white')
        R.draw(ImageDraw.Draw(im), pose, 'coat', R.CW // 2 - 20, R.BASE + hy, p, outline=False)
        out.append(im)
    return out


def font(sz):
    return ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', sz)


if __name__ == '__main__':
    for name, prof in PROFILES.items():
        c8 = cells(8, prof)
        half = c8[:4]
        for i, im in enumerate(half): im.save(os.path.join(OUT, f'black_{name}_{i}.png'))
        s = Image.new('RGB', (R.CW * 4, R.CH), 'white'); d = ImageDraw.Draw(s)
        for i, im in enumerate(half):
            s.paste(im, (i * R.CW, 0)); d.text((i * R.CW + 16, 10), NAMES[i], fill=(200, 50, 40), font=font(30))
        s.resize((R.CW * 2, R.CH // 2)).save(os.path.join(OUT, f'sheet_{name}.png'))
        print('ok', name)
