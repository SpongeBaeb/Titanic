#!/usr/bin/env python3
"""Q5 망원경 접안렌즈: 가운데 초록 원을 투명하게 뚫는다.
입력: tools/work/src/scope_ring.webp (1024x1024, 가운데가 순수 초록 원)
출력: frontend/public/q5/scope_ring.webp (구멍이 투명한 RGBA)
구멍 지름은 그림 너비의 비율로 `HOLE` 에 출력한다 (ScopeView.tsx 의 HOLE_FRAC 과 같아야 한다).
"""
import os
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'work', 'src', 'scope_ring.webp')
OUT = os.path.join(ROOT, 'frontend', 'public', 'q5', 'scope_ring.webp')

im = cv2.imread(SRC)
b, g, r = [im[..., i].astype(np.int32) for i in range(3)]
green = ((g > 150) & (g - r > 70) & (g - b > 70)).astype(np.uint8)
n, lab, stats, cent = cv2.connectedComponentsWithStats(green)
big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
hole = (lab == big).astype(np.uint8)
ys, xs = np.where(hole > 0)
cx, cy = xs.mean(), ys.mean()
rad = np.sqrt(hole.sum() / np.pi)
print('구멍 중심', round(cx, 1), round(cy, 1), '반지름', round(rad, 1), '비율(지름/너비)', round(2 * rad / im.shape[1], 4))
# 구멍을 한 칸 넓혀 초록 가장자리를 없애고, 가장자리는 부드럽게
hole = cv2.dilate(hole, np.ones((5, 5), np.uint8))
a = 1.0 - cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 1.2)
rgba = np.dstack([im, (a * 255).astype(np.uint8)])
rgba[a < 0.01, :3] = 0
q = 88
while True:
    ok, buf = cv2.imencode('.webp', rgba, [cv2.IMWRITE_WEBP_QUALITY, q])
    if len(buf) <= 195 * 1024 or q <= 50:
        break
    q -= 4
open(OUT, 'wb').write(buf.tobytes())
print('저장', len(buf) // 1024, 'KB')
