#!/usr/bin/env python3
"""주판을 튕기는 오리 사무장 3컷: 기존 포즈(purser_*.webp)와 같은 캔버스(655x1114), 같은 키, 같은 발 위치로 맞춘다.
입력: tools/work/src/a.png, b.png, c.png (투명 배경, 848x1264)  → 출력: frontend/public/spend/purser_calc_0~2.webp
세 컷은 같은 변환을 쓴다(컷 사이에서 몸이 흔들리지 않게). 변환은 첫 컷 기준으로 잰다.
"""
import os
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'work', 'src')
OUT = os.path.join(ROOT, 'frontend', 'public', 'spend')
W, H = 655, 1114
REF = cv2.imread(os.path.join(OUT, 'purser_idle.webp'), cv2.IMREAD_UNCHANGED)


def body(im):
    """키(위아래 끝)와 발 부근(아래 15%)의 가로 중심"""
    ys, xs = np.where(im[..., 3] > 20)
    top, bot = ys.min(), ys.max()
    sel = im[int(bot - (bot - top) * 0.12):bot + 1, :, 3] > 20
    cx = np.where(sel)[1].mean()
    return top, bot, cx


rt, rb, rcx = body(REF)
names = ['a', 'b', 'c']
ims = [cv2.imread(os.path.join(SRC, n + '.png'), cv2.IMREAD_UNCHANGED) for n in names]
t0, b0, c0 = body(ims[0])
s = (rb - rt) / (b0 - t0)
print('배율', round(s, 4), '기준 키', rb - rt)
for k, im in enumerate(ims):
    r = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    dx = int(round(rcx - c0 * s)); dy = int(round(rt - t0 * s))
    canvas = np.zeros((H, W, 4), np.uint8)
    x0, y0 = max(0, dx), max(0, dy)
    sx0, sy0 = x0 - dx, y0 - dy
    w = min(W - x0, r.shape[1] - sx0); h = min(H - y0, r.shape[0] - sy0)
    canvas[y0:y0 + h, x0:x0 + w] = r[sy0:sy0 + h, sx0:sx0 + w]
    canvas[canvas[..., 3] == 0, :3] = 0
    q = 90
    while True:
        ok, buf = cv2.imencode('.webp', canvas, [cv2.IMWRITE_WEBP_QUALITY, q])
        if len(buf) <= 190 * 1024 or q <= 55:
            break
        q -= 5
    open(os.path.join(OUT, f'purser_calc_{k}.webp'), 'wb').write(buf.tobytes())
    print(k, len(buf) // 1024, 'KB', 'dx', dx, 'dy', dy)
