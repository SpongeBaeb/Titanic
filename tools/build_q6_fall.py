#!/usr/bin/env python3
"""Q6 쓰러진 사람 4장: 흰 배경 시트를 잘라 투명 PNG처럼 만들고, 모두 머리가 왼쪽이 되게 맞춘다.
입력: tools/work/src/fall_sheet.webp   출력: frontend/public/q6/fall_0~3.webp
"""
import os
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'work', 'src', 'fall_sheet.webp')
OUT = os.path.join(ROOT, 'frontend', 'public', 'q6')
# 각 사람의 머리가 어느 쪽에 있는지 (시트를 보고 정함). 오른쪽이면 좌우를 뒤집어 머리가 왼쪽이 되게 한다
HEAD_RIGHT = {0: False, 1: True, 2: False, 3: True}


def main():
    im = cv2.imread(SRC)
    minc = im.min(axis=2).astype(np.float32)
    a = np.clip((246 - minc) / 34.0, 0, 1)
    af = a[..., None]
    rgb = np.where(af > 0.02, (im.astype(np.float32) - 255 * (1 - af)) / np.maximum(af, 0.02), 0)
    rgb = np.clip(rgb, 0, 255)
    rgba = np.dstack([rgb, a * 255]).astype(np.uint8)
    cols = (a > 0.5).sum(axis=0) > 3
    # 빈 열이 이어지는 곳을 경계로 나눈다
    spans = []
    start = None
    gap = 0
    for x, on in enumerate(cols):
        if on:
            if start is None:
                start = x
            gap = 0
            end = x
        elif start is not None:
            gap += 1
            if gap > 6:
                spans.append((start, end)); start = None
    if start is not None:
        spans.append((start, end))
    spans = [s for s in spans if s[1] - s[0] > 80]
    print('조각', spans)
    assert len(spans) == 4, '네 명으로 나뉘지 않았습니다'
    for k, (x0, x1) in enumerate(spans):
        part = rgba[:, max(0, x0 - 4):x1 + 5]
        ys = np.where(part[..., 3] > 20)[0]
        part = part[ys.min():ys.max() + 1]
        if HEAD_RIGHT[k]:
            part = part[:, ::-1]
        # 가로 640 이하로
        sc = min(1.0, 640 / part.shape[1])
        if sc < 1:
            part = cv2.resize(part, (int(part.shape[1] * sc), int(part.shape[0] * sc)), interpolation=cv2.INTER_AREA)
        q = 90
        while True:
            ok, buf = cv2.imencode('.webp', part, [cv2.IMWRITE_WEBP_QUALITY, q])
            if len(buf) <= 120 * 1024 or q <= 55:
                break
            q -= 5
        open(os.path.join(OUT, f'fall_{k}.webp'), 'wb').write(buf.tobytes())
        print(k, part.shape[1], 'x', part.shape[0], len(buf) // 1024, 'KB')


if __name__ == '__main__':
    main()
