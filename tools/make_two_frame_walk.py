#!/usr/bin/env python3
"""두 프레임(팔다리가 엇갈린 한 쌍)을 번갈아 보여 주고, 초기 구현의 위아래 흔들림(|sin|, 키의 1.2%)을 얹는다.
사용: python -I tools/make_two_frame_walk.py <프레임A.png> <프레임B.png> <출력.gif> [--steps_per_s 1.8] [--amp 1.0] [--n 12]
"""
import math, sys
from PIL import Image, ImageChops
a = sys.argv[1:]; A, B, out = a[0], a[1], a[2]
sps = float(a[a.index('--steps_per_s') + 1]) if '--steps_per_s' in a else 1.8
amp = float(a[a.index('--amp') + 1]) if '--amp' in a else 1.0
n = int(a[a.index('--n') + 1]) if '--n' in a else 12   # 한 걸음(=프레임 하나 보이는 동안)을 n 칸으로
ims = [Image.open(p).convert('RGB') for p in (A, B)]
box = None
for im in ims:
    b = ImageChops.difference(im, Image.new('RGB', im.size, 'white')).convert('L').point(lambda v: 255 if v > 24 else 0).getbbox()
    box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
h = box[3] - box[1]; pad = 16
box = (max(0, box[0] - pad), max(0, box[1] - pad), min(ims[0].width, box[2] + pad), min(ims[0].height, box[3] + pad + round(h * 0.03)))
cr = [im.crop(box) for im in ims]; W, H = cr[0].size
frames = []
for step in range(2):
    for k in range(n):
        ph = math.pi * k / n
        bob = math.sin(ph) * h * 0.012 * amp
        cv = Image.new('RGB', (W, H), 'white'); cv.paste(cr[step], (0, round(-bob)))
        frames.append(cv)
frames[0].save(out, save_all=True, append_images=frames[1:], duration=max(20, int(1000 / sps / n)), loop=0)
print(out, len(frames), 'frames', int(1000 / sps / n), 'ms')
