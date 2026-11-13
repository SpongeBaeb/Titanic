#!/usr/bin/env python3
"""ControlNet(OpenPose)용 뼈대 그림: 걷기 모델(gait_model)의 8칸 자세를 OpenPose 18점 형식(표준 색)으로 그린다.
옆모습(오른쪽을 봄)이라 먼 쪽(오른쪽) 어깨·엉덩이는 살짝 뒤(오른쪽으로 몇 px)로 비켜 그려 겹치지 않게 한다.
출력: tools/work/sd/pose_{0..7}.png (512x768, 검은 바탕), pose_sheet.png (확인용)
"""
import math
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import gait_model as G  # noqa: E402

OUT = os.path.join(ROOT, 'tools', 'work', 'sd')
W, H = 512, 768
BASE = 740
SC = 1.32
# OpenPose(ControlNet) 표준 색과 연결
COLORS = [[255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0], [85, 255, 0], [0, 255, 0], [0, 255, 85], [0, 255, 170],
          [0, 255, 255], [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255], [255, 0, 170], [255, 0, 85]]
LIMBS = [[2, 3], [2, 6], [3, 4], [4, 5], [6, 7], [7, 8], [2, 9], [9, 10], [10, 11], [2, 12], [12, 13], [13, 14], [2, 1], [1, 15], [15, 17], [1, 16], [16, 18], [3, 17], [6, 18]]


def keypoints(pose, hy):
    ox, oy = W * 0.46, BASE + hy * SC
    S = lambda q, dx=0.0: (ox + (q[0] + dx) * SC, oy + q[1] * SC)  # noqa: E731
    head = pose['head']; r = G.HEAD_R
    far = 7.0  # 먼 쪽을 살짝 뒤로
    k = [None] * 18
    k[0] = S((head[0] + r * 0.95, head[1] + 4))                 # 코
    k[1] = S(pose['neck'])                                      # 목
    k[2] = S(pose['sh'], far)                                   # 오른 어깨(먼 쪽)
    k[3] = S(pose['r_arm'][0], far); k[4] = S(pose['r_arm'][1], far)
    k[5] = S(pose['sh'], -far * 0.4)                            # 왼 어깨(가까운 쪽)
    k[6] = S(pose['l_arm'][0]); k[7] = S(pose['l_arm'][1])
    k[8] = S(pose['hip'], far)                                  # 오른 엉덩이
    k[9] = S(pose['right'][0], far); k[10] = S(pose['right'][1], far)
    k[11] = S(pose['hip'], -far * 0.4)                          # 왼 엉덩이
    k[12] = S(pose['left'][0]); k[13] = S(pose['left'][1])
    k[14] = None                                                # 오른 눈: 옆모습이라 안 보인다
    k[15] = S((head[0] + r * 0.55, head[1] - 6))                # 왼 눈
    k[16] = None
    k[17] = S((head[0] - r * 0.15, head[1] - 2))                # 왼 귀
    return k


def draw(k):
    im = Image.new('RGB', (W, H), (0, 0, 0))
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for i, (a, b) in enumerate(LIMBS):
        p, q = k[a - 1], k[b - 1]
        if p is None or q is None:
            continue
        # OpenPose 처럼 길쭉한 타원으로
        mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        L = math.dist(p, q) / 2
        ang = math.atan2(q[1] - p[1], q[0] - p[0])
        pts = []
        for t in range(0, 360, 15):
            u = math.radians(t)
            x, y = L * math.cos(u), 4 * math.sin(u)
            pts.append((mx + x * math.cos(ang) - y * math.sin(ang), my + x * math.sin(ang) + y * math.cos(ang)))
        d.polygon(pts, fill=tuple(int(c * 0.6) for c in COLORS[i % 18]) + (255,))
    im.paste(ov, (0, 0), ov)
    d2 = ImageDraw.Draw(im)
    for i, p in enumerate(k):
        if p is not None:
            d2.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=tuple(COLORS[i]))
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    tr, stride = G.timed_cycle(8)
    sheet = Image.new('RGB', (W * 4, H * 2))
    for i, (p, pose, x, hy) in enumerate(tr):
        im = draw(keypoints(pose, hy))
        im.save(os.path.join(OUT, f'pose_{i}.png'))
        sheet.paste(im, ((i % 4) * W, (i // 4) * H))
    sheet.resize((W * 2, H)).save(os.path.join(OUT, 'pose_sheet.png'))
    print('ok')


if __name__ == '__main__':
    main()
