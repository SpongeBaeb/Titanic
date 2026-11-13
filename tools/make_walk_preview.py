#!/usr/bin/env python3
"""걷기 그림 확인용 움직이는 그림(GIF) 만들기: 게임과 같은 규칙(그림 속 보폭만큼 걸어야 다음 프레임)으로 걷는다.
사용: python -I tools/make_walk_preview.py bowler
출력: tools/work/q6walk_check/walk_preview_{이름}.gif (게임 속도, 왼쪽 실제 밝기 / 오른쪽 밝게)
      tools/work/q6walk_check/walk_frames_{이름}.gif  (제자리에서 프레임 하나씩)
"""
import io
import json
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name = sys.argv[1] if len(sys.argv) > 1 else 'bowler'
t = io.open(os.path.join(ROOT, 'frontend', 'src', 'components', 'question', 'rumor', 'walkSprites.ts'), encoding='utf-8').read()
j = json.loads(t[t.index('= {') + 2:t.rindex(';')])[name]
atlas = Image.open(os.path.join(ROOT, 'frontend', 'public', 'q6', 'walk', f'{name}.webp')).convert('RGBA')
R, W, D = j['rects'], j['walk'], j.get('walkDist') or [0.11] * len(j['walk'])
n = len(W)
k = 0.55
H = 369 * k
frames = []
for i in W:
    x, y, w, h, ax = R[i]
    frames.append((atlas.crop((x, y, x + w, y + h)).resize((round(w * k), round(h * k)), Image.LANCZOS), ax * k))


def bright(im):
    rgb = ImageEnhance.Brightness(im.convert('RGB')).enhance(2.6)
    rgb.putalpha(im.split()[3])
    return rgb


CW, CH = 520, 260


def deck():
    im = Image.new('RGB', (CW, CH), (14, 18, 30))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 170, CW, CH], fill=(40, 28, 20))
    for r in range(10):
        d.line([0, 176 + r * 9, CW, 176 + r * 9], fill=(52, 38, 27))
    return im


def panel(f, ax, X, label):
    p = Image.new('RGB', (CW * 2 + 10, CH + 26), (8, 10, 16))
    for side, br in ((0, False), (1, True)):
        b = deck()
        im = bright(f) if br else f
        b.paste(im, (int(X - ax), int(244 - f.size[1])), im)
        p.paste(b, (side * (CW + 10), 26))
    ImageDraw.Draw(p).text((8, 6), label, fill=(230, 220, 200))
    return p


out = []
fps = 20
dt = 1 / fps
speed = 0.5  # 키/초
pos = 40.0
gait = 0.0
for _ in range(fps * 6):
    i0 = int(gait) % n
    f, ax = frames[i0]
    out.append(panel(f, ax, int(pos % (CW + 120)) - 60, f'actual | brightened    frame {i0 + 1}/{n}'))
    v = speed * H
    pos += v * dt
    dd = v * dt / H
    for _g in range(16):
        if dd <= 0:
            break
        i = int(gait) % n
        fr = gait - int(gait)
        need = (1 - fr) * D[i]
        if dd >= need:
            dd -= need
            gait = int(gait) + 1
        else:
            gait += dd / D[i]
            dd = 0
od = os.path.join(ROOT, 'tools', 'work', 'q6walk_check')
out[0].save(os.path.join(od, f'walk_preview_{name}.gif'), save_all=True, append_images=out[1:], duration=int(1000 / fps), loop=0, optimize=True)
slow = [panel(f, ax, CW // 2, f'frame {i + 1}/{n} (in place)') for i, (f, ax) in enumerate(frames)]
slow[0].save(os.path.join(od, f'walk_frames_{name}.gif'), save_all=True, append_images=slow[1:], duration=350, loop=0)
print('ok')
