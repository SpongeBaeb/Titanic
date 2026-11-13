#!/usr/bin/env python3
"""그림으로 그린 걷기 프레임의 가까운 쪽 팔을 어깨 기준으로 돌려 팔 흔들림을 만든다.
입력: tools/work/gent_ai/a_{0..3}.png (정렬된 투명 배경 4장, 팔이 모두 앞으로 약 37도)
방식: 소매+손을 오려 어깨를 축으로 돌리고, 팔이 있던 자리는 외투 앞면으로 메운다. 다리는 1~4번을 5~8번에도 그대로 쓴다
      (두 다리 모양이 같아 어느 쪽이 앞인지 구분되지 않는다). 8칸 주기: 팔 각도 a(t) = 11 + 20cos(2πt/8)
출력: tools/work/gent_ai/swing/f_{0..7}.png (흰 바탕), 팔 각도 0도(수직) 기준 앞쪽이 +
"""
import math, os, sys
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
D = os.path.join(ROOT, 'tools', 'work', 'gent_ai'); OUT = os.path.join(D, sys.argv[3] if len(sys.argv) > 3 else 'swing'); os.makedirs(OUT, exist_ok=True)
Z = lambda p: (120 + p[0] / 4, 120 + p[1] / 4)   # 확대 그림(×4, 시작 120,120) 좌표 → 프레임 좌표
ARM = [Z(p) for p in [(250, 262), (330, 300), (440, 440), (500, 540), (600, 680), (635, 700), (720, 760), (715, 810), (660, 830), (620, 780), (580, 765),
                      (480, 720), (380, 640), (300, 520), (240, 400), (215, 300)]]
PIVOT = Z((270, 320))
FRONT = [Z(p) for p in [(492, 240), (500, 460), (506, 600), (512, 700), (522, 800), (522, 900), (0, 900), (0, 240)]]  # 몸 앞쪽 경계의 왼쪽 = 몸 안
BASE_ANGLE = 37.0
MID, AMP = (float(sys.argv[1]), float(sys.argv[2])) if len(sys.argv) > 2 else (11.0, 20.0)   # 팔 각도 평균과 진폭(도)
ANGLES = [MID + AMP * math.cos(2 * math.pi * t / 8) for t in range(8)]


def poly_mask(pts, size, blur=0):
    m = Image.new('L', size, 0); ImageDraw.Draw(m).polygon(pts, fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur)) if blur else m


def swing(src, angle, shift=(0, 0)):
    W, H = src.size
    sh = lambda pts: [(x + shift[0], y + shift[1]) for x, y in pts]
    arm_m = poly_mask(sh(ARM), (W, H), 1.2)
    body_m = poly_mask(sh(FRONT), (W, H))
    rgba = np.asarray(src).copy()
    # 팔이 있던 자리(조금 넓혀서)를 외투로 메운다: 몸 안쪽만 불투명, 바깥은 투명
    hole = np.asarray(poly_mask(sh(ARM), (W, H)).filter(ImageFilter.MaxFilter(5))) > 0
    near = np.asarray(Image.fromarray(hole.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(21))) > 0
    mask = (hole | (near & (rgba[..., 3] < 235))).astype(np.uint8) * 255   # 투명한 곳의 흰 색이 번지지 않게 같이 메운다
    rgb = cv2.inpaint(np.ascontiguousarray(rgba[..., :3]), mask, 7, cv2.INPAINT_TELEA)
    a = rgba[..., 3].copy()
    inside = np.asarray(body_m) > 0
    a[hole] = np.where(inside[hole], 255, 0)
    plate = np.dstack([np.where((mask > 0)[..., None], rgb, rgba[..., :3]), a])
    base = Image.fromarray(plate.astype(np.uint8), 'RGBA')
    # 팔 오리기 → 돌리기
    arm = src.copy(); arm.putalpha(Image.fromarray((np.asarray(arm_m).astype(float) / 255 * np.asarray(src)[..., 3]).astype(np.uint8)))
    px, py = PIVOT[0] + shift[0], PIVOT[1] + shift[1]
    rot = arm.rotate(-(angle - BASE_ANGLE) * -1, center=(px, py), resample=Image.BICUBIC)  # 반시계(+)가 팔을 뒤로 보낸다
    base.alpha_composite(rot)
    return base


def main():
    srcs = [Image.open(os.path.join(D, f'a_{i}.png')).convert('RGBA') for i in range(4)]
    A = [np.asarray(s).astype(int) for s in srcs]
    shifts = []
    for i in range(4):
        best = None
        for dx in range(-6, 7):
            for dy in range(-6, 7):
                g = np.roll(np.roll(A[i], dx, 1), dy, 0)
                e = np.abs(A[0][130:300, 160:330, :3] - g[130:300, 160:330, :3]).sum(2).mean()
                best = best if best and best[0] <= e else (e, dx, dy)
        shifts.append((-best[1], -best[2]))
    for t in range(8):
        i = t % 4
        im = swing(srcs[i], ANGLES[t], shifts[i])
        w = Image.new('RGB', im.size, 'white'); w.paste(im, (0, 0), im); w.save(os.path.join(OUT, f'f_{t}.png'))
        im.save(os.path.join(OUT, f'f_{t}_alpha.png'))  # RGBA 원본 (투명 배경)
    print('ok', [round(a) for a in ANGLES], shifts)


if __name__ == '__main__':
    main()
