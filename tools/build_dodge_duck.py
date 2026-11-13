#!/usr/bin/env python3
"""신호를 피하는 사무장 동료 오리 3컷: 흔들기 A, 흔들기 B, 숙임.
입력: tools/work/src/dd_{a,b,down,c,lowl,lowr,pumpr,pumpl,up,land}.png (투명 배경, 848x1264)
출력: frontend/public/spend/dodge_wiggle_a.webp, dodge_wiggle_b.webp, dodge_duck.webp
세 컷은 같은 캔버스 안에서 같은 크기로 그려져 있으므로 배율은 그대로 두고, 발끝(맨 아래)만 같은 높이로 맞춘다.
그런 다음 세 컷의 합집합 영역으로 잘라 빈 여백을 줄이고, 화면에서 쓰는 크기(약 300px, 2배 해상도)로 줄인다.
"""
import os
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'work', 'src')
OUT = os.path.join(ROOT, 'frontend', 'public', 'spend')
NAMES = [('a', 'dodge_wiggle_a'), ('b', 'dodge_wiggle_b'), ('down', 'dodge_duck'),
         ('c', 'dance_c'), ('lowl', 'dance_low_l'), ('lowr', 'dance_low_r'), ('pumpr', 'dance_pump_r'), ('pumpl', 'dance_pump_l'), ('up', 'dance_hands_up'), ('land', 'dance_land')]
AIRBORNE = {'up'}           # 폴짝 뛴 컷은 발이 바닥에서 떨어져 있어야 하므로 발끝을 바닥에 맞추지 않고, 다른 서 있는 컷과 같은 만큼만 옮긴다
GROUND_SHIFT = 13           # 서 있는 컷들이 평균적으로 옮겨지는 양
FEET = 1170                 # 맞출 발끝 높이(원본 캔버스 기준)
X0, X1, Y0, Y1 = 100, 735, 120, 1190   # 세 컷을 모두 담는 영역
SCALE = 0.75

for key, out in NAMES:
    im = cv2.imread(os.path.join(SRC, f'dd_{key}.png'), cv2.IMREAD_UNCHANGED)
    ys = np.where(im[..., 3] > 20)[0]
    shift = GROUND_SHIFT if key in AIRBORNE else FEET - int(ys.max())
    H, W = im.shape[:2]
    canvas = np.zeros_like(im)
    y_from, y_to = max(0, -shift), min(H, H - shift)
    canvas[y_from + shift:y_to + shift] = im[y_from:y_to]
    crop = canvas[Y0:Y1, X0:X1]
    crop = cv2.resize(crop, None, fx=SCALE, fy=SCALE, interpolation=cv2.INTER_AREA)
    crop[crop[..., 3] == 0, :3] = 0
    q = 90
    while True:
        ok, buf = cv2.imencode('.webp', crop, [cv2.IMWRITE_WEBP_QUALITY, q])
        if len(buf) <= 190 * 1024 or q <= 55:
            break
        q -= 5
    open(os.path.join(OUT, out + '.webp'), 'wb').write(buf.tobytes())
    print(out, crop.shape[1], 'x', crop.shape[0], len(buf) // 1024, 'KB', '발끝 이동', shift)
