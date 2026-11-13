#!/usr/bin/env python3
"""단순한 형상(외투+중산모 실루엣)의 중년 신사 걷기. 움직임 확인용.
출력: tools/work/gent_simple/frame_{0..5}.png (6칸), smooth_{000..}.png (24칸, 부드러운 비교용), sheet.png
"""
import os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import build_walk_ref_v3 as R
import gait_model as G
OUT = os.path.join(os.path.dirname(HERE), 'tools', 'work', sys.argv[2] if len(sys.argv) > 2 else 'gent_simple'); os.makedirs(OUT, exist_ok=True)
R.NEAR, R.FAR, R.LINE = (44, 42, 48), (84, 82, 92), (255, 255, 255)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 6
def cells(n):
    out = []
    for p, pose, x, hy in G.timed_cycle(n)[0]:
        im = Image.new('RGB', (R.CW, R.CH), 'white')
        R.draw(ImageDraw.Draw(im), pose, 'coat', R.CW // 2 - 20, R.BASE + hy, p, outline=False)
        out.append(im)
    return out
for i, im in enumerate(cells(N)): im.save(os.path.join(OUT, f'frame_{i}.png'))
for i, im in enumerate(cells(24)): im.save(os.path.join(OUT, f'smooth_{i:03d}.png'))
fr = [Image.open(os.path.join(OUT, f'frame_{i}.png')) for i in range(N)]
s = Image.new('RGB', (R.CW * N, R.CH), 'white')
for i, f in enumerate(fr): s.paste(f, (i * R.CW, 0))
s.resize((R.CW * N // 2, R.CH // 2)).save(os.path.join(OUT, 'sheet.png'))
