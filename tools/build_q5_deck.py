#!/usr/bin/env python3
"""Q5 갑판 앞쪽 레이어 만들기 (노을 갑판 한 장 방식).

입력: tools/work/src/deck47.webp  (하늘과 바다 자리가 투명한 갑판 그림: 난간, 벤치, 구명정, 갑판실)
출력: frontend/public/bg/deck_q5_fg.webp  (1376x768, 투명 유지)
      frontend/public/bg/deck_q5.webp     (WebGL 이 없을 때 쓰는 한 장짜리 그림: 노을 하늘 + 바다 위에 얹은 것)

좌표계는 게임의 1376x768 기준이다. 수평선(HY)은 갑판선과 난간이 모이는 점이다: 원본(1672x941)에서 y≈568 → 1376x768 에서 y≈463.6.
실행: python tools/build_q5_deck.py
"""
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'work', 'src', 'deck47.webp')
PUB = os.path.join(ROOT, 'frontend', 'public', 'bg')
W, H = 1376, 768
HY = 463.6


def encode(img, budget_kb, q0=90, floor=55):
    q = q0
    while True:
        ok, buf = cv2.imencode('.webp', img, [cv2.IMWRITE_WEBP_QUALITY, q])
        if len(buf) <= budget_kb * 1024 or q <= floor:
            return buf, q
        q -= 3


def main():
    im = cv2.imread(SRC, cv2.IMREAD_UNCHANGED)
    if im is None or im.shape[2] != 4:
        sys.exit('갑판 그림(알파 포함)을 찾을 수 없습니다: ' + SRC)
    fg = cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA)
    fg[fg[..., 3] <= 3, :3] = 0
    buf, q = encode(fg, 195)
    open(os.path.join(PUB, 'deck_q5_fg.webp'), 'wb').write(buf.tobytes())
    print('deck_q5_fg.webp', len(buf) // 1024, 'KB (품질 %d)' % q)

    # WebGL 이 없을 때의 한 장짜리 그림: 노을 하늘과 어두운 바다 위에 얹는다 (BGR)
    bg = np.zeros((H, W, 3), np.float32)
    top = np.array([128, 80, 42], np.float32)
    mid = np.array([158, 132, 126], np.float32)
    hor = np.array([92, 168, 250], np.float32)
    hy = int(HY)
    for y in range(hy):
        t = y / hy
        bg[y] = np.where(t < 0.8, mid * (1 - t / 0.8) + top * (t / 0.8), mid)  # 위에서 아래로
        g = (1 - t) ** 2.2
        bg[y] = bg[y] * (1 - g) + hor * g
    sea_a = np.array([58, 66, 36], np.float32)
    sea_b = np.array([36, 40, 20], np.float32)
    for y in range(hy, H):
        t = (y - hy) / (H - hy)
        bg[y] = sea_a * (1 - t) + sea_b * t
    a = fg[..., 3:4] / 255.0
    full = (fg[..., :3] * a + bg * (1 - a)).astype(np.uint8)
    buf2, q2 = encode(full, 195, 88)
    open(os.path.join(PUB, 'deck_q5.webp'), 'wb').write(buf2.tobytes())
    print('deck_q5.webp', len(buf2) // 1024, 'KB (품질 %d)' % q2)


if __name__ == '__main__':
    main()
