#!/usr/bin/env python3
"""그림 한 장을 프로젝트 처음 방식으로 움직여 걷기처럼 보이게 한다 (RumorView 초기 구현과 같은 식).
  위아래: bob = |sin(phase)| * 키 * 0.012   (한 걸음에 한 번 솟는다)
  기울기: sway = sin(phase) * 0.012 라디안  (발 위치를 축으로 좌우로 흔든다)
사용: python -I tools/make_single_image_walk.py <그림.png> [출력이름] [--n 24] [--amp 1.0]   (amp 로 흔들림을 키운다)
출력: tools/work/gent_single/<이름>_{0..n-1}.png, <이름>.gif
"""
import math, os, sys
from PIL import Image
a = sys.argv[1:]; src = a[0]; name = a[1] if len(a) > 1 and not a[1].startswith('--') else 'single'
n = int(a[a.index('--n') + 1]) if '--n' in a else 24; amp = float(a[a.index('--amp') + 1]) if '--amp' in a else 1.0
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools', 'work', 'gent_single'); os.makedirs(OUT, exist_ok=True)
im = Image.open(src).convert('RGBA'); W, H = im.size
bb = im.getbbox(); h = bb[3] - bb[1]
foot = ((bb[0] + bb[2]) / 2, bb[3])
frames = []
for i in range(n):
    ph = 2 * math.pi * i / n * 2      # 한 주기 = 두 걸음
    bob = abs(math.sin(ph)) * h * 0.012 * amp
    sway = math.sin(ph) * 0.012 * amp
    # 발 위치를 축으로 회전(+ 위로 bob)
    r = im.rotate(-math.degrees(sway), center=foot, resample=Image.BICUBIC)
    cv = Image.new('RGBA', (W, H), (255, 255, 255, 0)); cv.paste(r, (0, round(-bob)), r)
    w = Image.new('RGB', (W, H), 'white'); w.paste(cv, (0, 0), cv); w.save(os.path.join(OUT, f'{name}_{i}.png')); frames.append(w)
gif = os.path.join(OUT, name + '.gif')
frames[0].save(gif, save_all=True, append_images=frames[1:], duration=int(1100 / n), loop=0)
print(gif)
