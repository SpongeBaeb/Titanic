#!/usr/bin/env python3
"""권총을 든 오리 사무장 4컷: 품에서 꺼냄(draw) → 겨눔(aim) → 발사(fire) → 연기를 뭄(smoke).
기존 포즈(purser_*.webp)와 같은 캔버스(655x1114), 같은 키, 같은 발 위치로 맞춘다 (tools/build_purser_calc.py 와 같은 방식).
입력: tools/work/src/g_draw.png, g_aim.png, g_fire.png, g_smoke.png (투명 배경, 848x1264)  → 출력: frontend/public/spend/purser_{draw,aim,fire,smoke}.webp
발사 컷에는 발밑에 흰 받침이 붙어 있어서, 발 아래의 흰 부분을 지우고 신발만 남긴다. 변환은 겨눔 컷 기준으로 한 번만 재서 네 컷에 똑같이 쓴다(컷이 바뀌어도 몸이 흔들리지 않게).
"""
import os
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'work', 'src')
OUT = os.path.join(ROOT, 'frontend', 'public', 'spend')
W, H = 655, 1114
REF = cv2.imread(os.path.join(OUT, 'purser_idle.webp'), cv2.IMREAD_UNCHANGED)
NAMES = ['aim', 'draw', 'fire', 'smoke']  # 첫 번째(aim)가 변환 기준


def clean_base(im):
    """발 아래(아래 14%)의 흰 받침을 지우고, 몸에서 떨어진 작은 조각도 버린다"""
    rgb = im[..., :3].astype(int)
    mn, mx = rgb.min(2), rgb.max(2)
    h = im.shape[0]
    mask = (np.arange(h)[:, None] > h * 0.86) & (mn > 150) & ((mx - mn) < 40)
    im[mask, 3] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats((im[..., 3] > 20).astype(np.uint8), 8)
    keep = np.isin(lab, [i for i in range(1, n) if st[i, 4] > 2500])
    im[~keep, 3] = 0
    return im


def body(im):
    ys, xs = np.where(im[..., 3] > 20)
    top, bot = ys.min(), ys.max()
    sel = im[int(bot - (bot - top) * 0.12):bot + 1, :, 3] > 20
    cx = np.where(sel)[1].mean()
    return top, bot, cx


def load(n):
    im = cv2.imread(os.path.join(SRC, f'g_{n}.png'), cv2.IMREAD_UNCHANGED)
    return clean_base(im) if n == 'fire' else im


ims = {n: load(n) for n in NAMES}
rt, rb, rcx = body(REF)
# 변환은 총구 연기/불꽃이 없는 겨눔 컷으로 잰다 (흰 받침을 지운 뒤의 발끝 기준)
t0, b0, c0 = body(ims['aim'])
s = (rb - rt) / (b0 - t0)
dx = int(round(rcx - c0 * s)); dy = int(round(rt - t0 * s))
print('배율', round(s, 4), 'dx', dx, 'dy', dy)
for n, im in ims.items():
    r = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
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
    open(os.path.join(OUT, f'purser_{n}.webp'), 'wb').write(buf.tobytes())
    print(n, len(buf) // 1024, 'KB')
