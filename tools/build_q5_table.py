#!/usr/bin/env python3
"""Q5 샴페인 탁자: 둥근 앤티크 탁자를 그려 샴페인 양동이를 그 위에 올린다.
입력: frontend/public/q5/obj_champagne_only.webp (원본 샴페인 그림, 없으면 obj_champagne.webp 를 복사해 둔다)
출력: frontend/public/q5/obj_champagne.webp (탁자 + 샴페인, 투명 배경)
실행: python tools/build_q5_table.py
"""
import os, shutil
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q5 = os.path.join(ROOT, 'frontend', 'public', 'q5')
ONLY = os.path.join(Q5, 'obj_champagne_only.webp')
OUT = os.path.join(Q5, 'obj_champagne.webp')
if not os.path.exists(ONLY):
    shutil.copy(OUT, ONLY)

S = 3  # 슈퍼샘플
CW, CH = 349, 420  # 샴페인 그림
W, H = 560, 860
top_y = CH - 40  # 탁자 윗면 중심이 놓이는 높이 (샴페인 바닥이 이 근처)


def grad_ellipse(img, box, c1, c2):
    x0, y0, x1, y1 = [v * S for v in box]
    h = int(y1 - y0)
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    g = Image.new('RGBA', img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(g)
    for i in range(h):
        t = i / max(1, h - 1)
        col = tuple(int(c1[k] * (1 - t) + c2[k] * t) for k in range(3)) + (255,)
        gd.line([(x0, y0 + i), (x1, y0 + i)], fill=col)
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse([x0, y0, x1, y1], fill=255)
    layer.paste(g, (0, 0), m)
    img.alpha_composite(layer)


def main():
    img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = W / 2
    # 그림자
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([(cx - 210) * S, (H - 70) * S, (cx + 210) * S, (H - 20) * S], fill=(0, 0, 0, 120))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14 * S)))
    # 세 발 (곡선 다리)
    for dx, w in ((-1, 1), (1, 1), (0, 0.7)):
        pts = []
        for k in range(21):
            t = k / 20
            x = cx + dx * (30 + 150 * t ** 1.5)
            y = (top_y + 300) + 330 * t
            pts.append((x * S, y * S))
        d.line(pts, fill=(52, 34, 20, 255), width=int(24 * S * (1 - .35 * 0) * w))
        d.line(pts, fill=(124, 86, 40, 255), width=int(7 * S * w))
        fx, fy = pts[-1]
        d.ellipse([fx - 16 * S, fy - 10 * S, fx + 16 * S, fy + 10 * S], fill=(150, 112, 52, 255))
    # 기둥
    for i in range(8):
        pass
    d.rectangle([(cx - 17) * S, (top_y + 40) * S, (cx + 17) * S, (top_y + 330) * S], fill=(58, 38, 22, 255))
    d.rectangle([(cx - 17) * S, (top_y + 40) * S, (cx - 8) * S, (top_y + 330) * S], fill=(98, 66, 38, 255))
    d.rectangle([(cx + 9) * S, (top_y + 40) * S, (cx + 17) * S, (top_y + 330) * S], fill=(30, 20, 12, 255))
    # 놋쇠 고리
    for yy, rw in ((top_y + 120, 26), (top_y + 230, 30), (top_y + 320, 24)):
        grad_ellipse(img, (cx - rw, yy - 9, cx + rw, yy + 9), (214, 172, 84), (110, 76, 28))
    # 윗판: 두께(옆면) + 윗면 + 놋쇠 테두리
    rx, ry = 250, 62
    grad_ellipse(img, (cx - rx, top_y - ry + 26, cx + rx, top_y + ry + 26), (70, 44, 24), (24, 14, 8))
    grad_ellipse(img, (cx - rx, top_y - ry, cx + rx, top_y + ry), (190, 128, 70), (120, 74, 38))
    grad_ellipse(img, (cx - rx + 14, top_y - ry + 8, cx + rx - 14, top_y + ry - 8), (150, 98, 54), (98, 60, 30))
    # 나뭇결
    rng = np.random.default_rng(7)
    grain = Image.new('RGBA', img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grain)
    for _ in range(46):
        y = top_y + rng.uniform(-ry + 14, ry - 14)
        half = rx * np.sqrt(max(0.0, 1 - ((y - top_y) / ry) ** 2)) - 18
        x0 = cx - half * rng.uniform(.5, 1); x1 = cx + half * rng.uniform(.5, 1)
        gd.line([(x0 * S, y * S), (x1 * S, (y + rng.uniform(-3, 3)) * S)], fill=(60, 34, 16, int(rng.uniform(25, 70))), width=int(S * rng.uniform(1, 2.4)))
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse([(cx - rx + 14) * S, (top_y - ry + 8) * S, (cx + rx - 14) * S, (top_y + ry - 8) * S], fill=255)
    img.alpha_composite(Image.composite(grain, Image.new('RGBA', img.size, (0, 0, 0, 0)), m))
    # 놋쇠 윗테두리 하이라이트
    d = ImageDraw.Draw(img)
    d.arc([(cx - rx) * S, (top_y - ry) * S, (cx + rx) * S, (top_y + ry) * S], 190, 350, fill=(236, 200, 120, 255), width=int(4 * S))
    d.arc([(cx - rx) * S, (top_y - ry) * S, (cx + rx) * S, (top_y + ry) * S], 10, 170, fill=(110, 76, 30, 255), width=int(4 * S))
    img = img.resize((W, H), Image.LANCZOS)
    # 양동이 바닥 그림자 + 샴페인 올리기
    ch = Image.open(ONLY).convert('RGBA')
    bsh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(bsh).ellipse([cx - 210, top_y - 20, cx + 150, top_y + 36], fill=(0, 0, 0, 130))
    img.alpha_composite(bsh.filter(ImageFilter.GaussianBlur(7)))
    img.alpha_composite(ch, (int(cx - CW / 2 - 20), top_y - CH + 20))
    # 투명 여백 잘라내기
    arr = np.array(img)
    ys, xs = np.where(arr[..., 3] > 8)
    img = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    print('size', img.size)
    q = 90
    while True:
        img.save(OUT, 'WEBP', quality=q)
        if os.path.getsize(OUT) <= 190 * 1024 or q <= 50:
            break
        q -= 5
    print('saved', os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
