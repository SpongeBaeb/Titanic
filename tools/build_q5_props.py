#!/usr/bin/env python3
"""Q5 선택지 물건 만들기: 흰 배경 그림을 투명하게 오리고, 탁자 위에 샴페인을 올린다.
입력: tools/work/src/table.png (빈 탁자), champagne_only.webp (양동이와 잔), chair_atlas.webp (별자리 도감이 놓인 의자)
출력: frontend/public/q5/obj_champagne.webp (탁자 + 샴페인), obj_atlas.webp (의자 + 도감)
실행: python tools/build_q5_props.py
"""
import os
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'work', 'src')
OUT = os.path.join(ROOT, 'frontend', 'public', 'q5')


def cut_white(path):
    """바깥쪽에서 이어진 흰 배경만 지워서 투명 배경 RGBA 로 만든다 (안쪽의 밝은 부분은 남는다)"""
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im.shape[2] == 4:
        a0 = im[..., 3:4] / 255.0
        im = (im[..., :3] * a0 + 255 * (1 - a0)).astype(np.uint8)
    minc = im.min(axis=2)
    bg = (minc >= 236).astype(np.uint8)
    n, lab = cv2.connectedComponents(bg, connectivity=4)
    border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    # 바깥과 이어진 흰색, 그리고 의자 다리 사이처럼 안쪽에 갇힌 큰 흰 덩어리(배경)를 지운다. 작은 하이라이트는 남긴다
    areas = np.bincount(lab.ravel())
    big = [l for l in range(1, n) if areas[l] > 700]
    outside = np.isin(lab, [l for l in border if l != 0] + big).astype(np.float32)
    a = 1.0 - outside
    a = cv2.erode(a, np.ones((3, 3), np.uint8))          # 가장자리의 흰 테두리를 한 칸 먹는다
    a = cv2.GaussianBlur(a, (0, 0), 0.9)
    af = np.clip(a, 0, 1)[..., None]
    rgb = np.clip((im.astype(np.float32) - 255 * (1 - af)) / np.maximum(af, 0.25), 0, 255)
    out = np.dstack([rgb, af * 255]).astype(np.uint8)
    ys, xs = np.where(out[..., 3] > 8)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def save(img, name, budget_kb=190):
    q = 90
    while True:
        ok, buf = cv2.imencode('.webp', img, [cv2.IMWRITE_WEBP_QUALITY, q])
        if len(buf) <= budget_kb * 1024 or q <= 50:
            break
        q -= 5
    open(os.path.join(OUT, name), 'wb').write(buf.tobytes())
    print(name, img.shape[1], 'x', img.shape[0], len(buf) // 1024, 'KB')


def over(base, top, x, y):
    """base 위의 (x,y) 위치(왼쪽 위)에 top 을 올린다. base 는 필요하면 넓어진다."""
    H, W = base.shape[:2]
    h, w = top.shape[:2]
    pad_t = max(0, -y); pad_l = max(0, -x); pad_b = max(0, y + h - H); pad_r = max(0, x + w - W)
    if pad_t or pad_l or pad_b or pad_r:
        base = cv2.copyMakeBorder(base, pad_t, pad_b, pad_l, pad_r, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0))
        x += pad_l; y += pad_t
    roi = base[y:y + h, x:x + w].astype(np.float32)
    ta = top[..., 3:4] / 255.0
    ba = roi[..., 3:4] / 255.0
    oa = ta + ba * (1 - ta)
    rgb = (top[..., :3] * ta + roi[..., :3] * ba * (1 - ta)) / np.maximum(oa, 1e-4)
    base[y:y + h, x:x + w] = np.dstack([rgb, oa * 255]).astype(np.uint8)
    return base


def main():
    table = cut_white(os.path.join(SRC, 'table.png'))
    h, w = table.shape[:2]
    print('탁자', w, h)
    ch = cv2.imread(os.path.join(SRC, 'champagne_only.webp'), cv2.IMREAD_UNCHANGED)
    # 양동이 지름이 윗판 너비의 약 20% 가 되도록 줄이고, 윗판 가운데보다 약간 왼쪽에 올린다
    sc = (w * 0.42) / (ch.shape[1] * 0.66)
    ch = cv2.resize(ch, (int(ch.shape[1] * sc), int(ch.shape[0] * sc)), interpolation=cv2.INTER_AREA)
    # 윗판은 y 가 위에서 약 8%~28% 사이에 있다 (타원의 가운데 약 18%)
    top_c = int(h * 0.10)
    # 양동이 바닥이 윗판 타원 가운데에 오도록: 샴페인 그림의 바닥 근처(키의 94%)를 맞춘다
    x = int(w * 0.5 - ch.shape[1] * 0.52)
    y = int(top_c - ch.shape[0] * 0.94)
    base = over(table.copy(), ch, x, y)
    save(base, 'obj_champagne.webp')
    print('탁자 윗판 기준 샴페인 위치', x, y)
    chair = cut_white(os.path.join(SRC, 'chair_atlas.webp'))
    save(chair, 'obj_atlas.webp')


if __name__ == '__main__':
    main()
