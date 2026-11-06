#!/usr/bin/env python3
"""나이 미세 조정 피스톤: 초록 배경을 지워 머리(버튼) 4컷과 반복되는 기둥 한 토막을 만든다.
입력: tools/work/src/age_piston_head_sheet.webp (2행 4열: 위 평상시, 아래 눌림 / 열 0,1 = −, 열 2,3 = +)
      tools/work/src/age_piston_rod.webp (세로로 긴 기둥)
출력: frontend/public/ui/age_piston_{minus,plus}_{up,down}.webp, age_piston_rod_tile.webp
"""
import os
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'work', 'src')
OUT = os.path.join(ROOT, 'frontend', 'public', 'ui')


def key_green(bgr):
    b, g, r = [bgr[..., i].astype(np.float32) for i in range(3)]
    # 초록이 얼마나 두드러지는가 (0 = 물체, 1 = 순수 초록 배경)
    dom = np.clip((g - np.maximum(r, b) - 25) / 95.0, 0, 1)
    a = 1.0 - dom
    a = cv2.GaussianBlur(a, (0, 0), 0.7)
    # 가장자리의 초록 번짐 제거: 초록 채널을 다른 채널 수준으로 낮춘다
    out = bgr.astype(np.float32)
    spill = np.clip(g - np.maximum(r, b), 0, None) * (dom > 0.0)
    out[..., 1] = np.where(a < 0.98, g - spill * 0.9, g)
    rgba = np.dstack([np.clip(out, 0, 255), np.clip(a, 0, 1) * 255]).astype(np.uint8)
    rgba[a < 0.02, :3] = 0
    return rgba


def save(img, name, budget=140):
    q = 90
    while True:
        ok, buf = cv2.imencode('.webp', img, [cv2.IMWRITE_WEBP_QUALITY, q])
        if len(buf) <= budget * 1024 or q <= 55:
            break
        q -= 5
    open(os.path.join(OUT, name), 'wb').write(buf.tobytes())
    print(name, img.shape[1], 'x', img.shape[0], len(buf) // 1024, 'KB')


sheet = cv2.imread(os.path.join(SRC, 'age_piston_head_sheet.webp'))
cols = [(14, 349), (378, 713), (742, 1077), (1106, 1441)]
rows = [(13, 359), (374, 719)]
W = 336; H = 347
S = 240.0 / W  # 화면에서 쓰는 크기에 맞춰 줄인다
for kind, ci in (('minus', 0), ('plus', 2)):
    for state, ri in (('up', 0), ('down', 1)):
        x0 = cols[ci][0]; y0 = rows[ri][0]
        cell = sheet[y0:y0 + H, x0:x0 + W]
        rgba = key_green(cell)
        rgba = cv2.resize(rgba, (240, int(round(H * S))), interpolation=cv2.INTER_AREA)
        save(rgba, f'age_piston_{kind}_{state}.webp')

rod = cv2.imread(os.path.join(SRC, 'age_piston_rod.webp'))
# 기둥 가운데 부분만 (오른쪽 아래의 AI 표시 제거), 놋쇠 고리 한가운데에서 다음 고리 한가운데까지가 한 주기
seg = rod[505:992, 140:352]
rgba = key_green(seg)
rgba = cv2.resize(rgba, (106, int(round(seg.shape[0] * 106 / seg.shape[1]))), interpolation=cv2.INTER_AREA)
save(rgba, 'age_piston_rod_tile.webp')
