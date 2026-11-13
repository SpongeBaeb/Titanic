#!/usr/bin/env python3
"""전신 오리가 신호를 피하는 포즈 8컷.
입력: tools/work/src/dd_{limbo,split,lunge_l,lunge_r,cap,cossack,prone_a,prone_b}.png (투명 배경)
     dd_up.png (모자만 오려서 dd_cap 의 공중에 띄운다)
출력: frontend/public/spend/dodge_{...}.webp

게임 안에서 신호는 그림 위에서 25% 높이(21~29%)를 지나간다. 포즈 전체가 그 아래로 내려와 있어야 맞지 않는다.
춤 컷과 키가 같도록 잘라 내는 높이(Y0~Y1)와 배율은 build_dodge_duck.py 와 같게 두고, 포즈가 옆으로 넓어서 폭만 넓혔다.
"""
import os
import cv2
import numpy as np
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'work', 'src')
OUT = os.path.join(ROOT, 'frontend', 'public', 'spend')
W, H = 848, 1264
FEET = 1170
X0, X1, Y0, Y1 = 0, 835, 120, 1190  # 가로 가운데가 춤 컷(100~735)과 같다
SCALE = 0.75
POSES = {'limbo': 1, 'split': 1, 'lunge_l': 1, 'lunge_r': 1, 'cap': 1, 'cossack': 0.9, 'prone_a': 1, 'prone_b': 1}  # 값: 발끝 기준 배율
CAP_Y = (172, 292)  # 공중의 모자가 놓이는 높이(원본 캔버스)
CAP_X = 428
SIGNAL_TOP, SIGNAL_BOTTOM = 0.21, 0.29


def largest(mask):
    lab, n = ndi.label(mask)
    if n == 0:
        return mask
    return lab == 1 + int(np.argmax(ndi.sum(mask, lab, range(1, n + 1))))


def cut_cap():
    """머리에서 모자만 오린다: 노란 머리를 뺀 맨 위 덩어리"""
    im = cv2.imread(os.path.join(SRC, 'dd_up.png'), cv2.IMREAD_UNCHANGED)
    b, g, r, a = [im[..., i].astype(int) for i in range(4)]
    head = (r > 150) & (g > 120) & (b < 130)
    m = (a > 20) & ~ndi.binary_dilation(head, iterations=3)
    m[int(H * 0.26):] = False
    m = largest(m)
    ys, xs = np.where(m)
    cap = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
    cap[~m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]] = 0
    return cap


def paste(canvas, piece, x, y):
    h, w = piece.shape[:2]
    roi = canvas[y:y + h, x:x + w]
    al = piece[..., 3:4].astype(float) / 255
    roi[..., :3] = (piece[..., :3] * al + roi[..., :3] * (1 - al)).astype(np.uint8)
    roi[..., 3] = np.maximum(roi[..., 3], piece[..., 3])


for key, zoom in POSES.items():
    im = cv2.imread(os.path.join(SRC, f'dd_{key}.png'), cv2.IMREAD_UNCHANGED)
    if im.shape[1] != W:  # 한 장은 캔버스가 더 크게 왔다
        im = cv2.resize(im, (W, round(im.shape[0] * W / im.shape[1])), interpolation=cv2.INTER_AREA)
    mask = largest(im[..., 3] > 20)  # 떠 있는 찌꺼기를 지운다
    mask = ndi.binary_dilation(mask, iterations=2)
    im[~mask] = 0
    ys, xs = np.where(im[..., 3] > 20)
    if zoom != 1:
        cx = (xs.min() + xs.max()) / 2
        M = np.float32([[zoom, 0, cx * (1 - zoom)], [0, zoom, ys.max() * (1 - zoom)]])
        im = cv2.warpAffine(im, M, (im.shape[1], im.shape[0]), flags=cv2.INTER_AREA)
        ys, xs = np.where(im[..., 3] > 20)
    canvas = np.zeros((H, W, 4), np.uint8)
    shift = FEET - int(ys.max())
    src = im[max(0, -shift):min(im.shape[0], H - shift)]
    canvas[max(0, shift):max(0, shift) + src.shape[0]] = src
    if key == 'cap':
        cap = cut_cap()
        f = (CAP_Y[1] - CAP_Y[0]) / cap.shape[0]
        cap = cv2.resize(cap, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
        paste(canvas, cap, CAP_X - cap.shape[1] // 2, CAP_Y[0])
    crop = cv2.resize(canvas[Y0:Y1, X0:X1], None, fx=SCALE, fy=SCALE, interpolation=cv2.INTER_AREA)
    crop[crop[..., 3] == 0, :3] = 0
    ok, buf = cv2.imencode('.webp', crop, [cv2.IMWRITE_WEBP_QUALITY, 88])
    open(os.path.join(OUT, f'dodge_{key}.webp'), 'wb').write(buf.tobytes())
    h = crop.shape[0]
    band = crop[int(h * SIGNAL_TOP):int(h * SIGNAL_BOTTOM), :, 3]
    print(key, crop.shape[1], 'x', h, len(buf) // 1024, 'KB', '신호 높이에 걸린 픽셀', int((band > 20).sum()))
