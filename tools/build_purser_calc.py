#!/usr/bin/env python3
"""주판을 튕기는 오리 사무장 3컷과 그 사이를 잇는 중간 컷 4장 (광류로 만든 모핑).: 기존 포즈(purser_*.webp)와 같은 캔버스(655x1114), 같은 키, 같은 발 위치로 맞춘다.
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


# ── 중간 컷: 컷과 컷 사이의 손가락, 입의 움직임을 광류로 이어 부드럽게 만든다 ──
def canvas_of(k):
    return cv2.imread(os.path.join(OUT, f'purser_calc_{k}.webp'), cv2.IMREAD_UNCHANGED)


def morph(A, B, t):
    ga = cv2.cvtColor((A[..., :3].astype(np.float32) * (A[..., 3:4] / 255.0) + 128 * (1 - A[..., 3:4] / 255.0)).astype(np.uint8), cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor((B[..., :3].astype(np.float32) * (B[..., 3:4] / 255.0) + 128 * (1 - B[..., 3:4] / 255.0)).astype(np.uint8), cv2.COLOR_BGR2GRAY)
    flow = cv2.calcOpticalFlowFarneback(ga, gb, None, 0.5, 5, 31, 5, 7, 1.5, 0)  # A 의 점이 B 에서 어디로 가는가
    h, w = ga.shape
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    # 미리 곱한 알파로 섞어야 가장자리가 번지지 않는다
    def pm(im):
        f = im.astype(np.float32); a = f[..., 3:4] / 255.0
        return np.dstack([f[..., :3] * a, f[..., 3:4]])
    pa, pb = pm(A), pm(B)
    wa = cv2.remap(pa, gx - flow[..., 0] * t, gy - flow[..., 1] * t, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    wb = cv2.remap(pb, gx + flow[..., 0] * (1 - t), gy + flow[..., 1] * (1 - t), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    o = (1 - t) * wa + t * wb
    a = np.clip(o[..., 3:4], 0, 255)
    rgb = np.where(a > 1, o[..., :3] / np.maximum(a / 255.0, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)


def save(img, name):
    img = img.copy(); img[img[..., 3] == 0, :3] = 0
    q = 90
    while True:
        ok, buf = cv2.imencode('.webp', img, [cv2.IMWRITE_WEBP_QUALITY, q])
        if len(buf) <= 190 * 1024 or q <= 55:
            break
        q -= 5
    open(os.path.join(OUT, name), 'wb').write(buf.tobytes())
    print(name, len(buf) // 1024, 'KB')


c0, c1, c2 = canvas_of(0), canvas_of(1), canvas_of(2)
for (A, B, tag) in ((c0, c1, '01'), (c1, c2, '12')):
    save(morph(A, B, 1 / 3), f'purser_calc_{tag}_a.webp')
    save(morph(A, B, 2 / 3), f'purser_calc_{tag}_b.webp')
