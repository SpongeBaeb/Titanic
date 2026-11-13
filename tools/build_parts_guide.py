#!/usr/bin/env python3
"""부품 시트 요청용 안내 그림: 한 사람을 걷기 인형으로 만들 때 필요한 부품의 배치와 모양.
흰 배경 위에 회색 실루엣으로 부품을 늘어놓고, 관절(돌아가는 점) 자리를 빨간 점으로 표시한다.
출력 (이미지_참고/q6):
  parts_guide.png          첨부용 (글자 없음, 2048x1024)
  parts_guide_labeled.png  설명용 (부품 이름)
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '이미지_참고', 'q6')
W, H = 2048, 1024
GREY = (120, 120, 128)
DARK = (70, 70, 78)
RED = (220, 40, 40)


def font(sz):
    for f in ('C:/Windows/Fonts/malgunbd.ttf', 'C:/Windows/Fonts/malgun.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def dot(d, x, y, labeled):
    if labeled:
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=RED)


def draw(labeled):
    im = Image.new('RGB', (W, H), (255, 255, 255))
    d = ImageDraw.Draw(im)
    f = font(26)
    # 1) 몸통+머리+모자+외투 (팔 없이, 다리 없이, 외투 밑단은 무릎 아래까지), 옆모습 오른쪽을 본다
    cx, top = 260, 80
    d.ellipse([cx - 52, top + 40, cx + 52, top + 150], fill=GREY)                     # 머리
    d.ellipse([cx - 80, top + 52, cx + 90, top + 76], fill=DARK)                      # 모자 챙
    d.pieslice([cx - 58, top - 10, cx + 62, top + 110], 180, 360, fill=DARK)          # 모자
    d.polygon([(cx - 70, top + 170), (cx + 64, top + 170), (cx + 92, top + 560), (cx + 100, top + 760), (cx - 96, top + 760), (cx - 84, top + 560)], fill=GREY)
    d.rectangle([cx - 20, top + 140, cx + 22, top + 180], fill=GREY)                  # 목
    dot(d, cx - 4, top + 196, labeled)   # 어깨
    dot(d, cx, top + 480, labeled)       # 엉덩이
    if labeled:
        d.text((cx - 150, top + 790), '1 몸통·머리·모자·외투\n(팔과 다리 없이, 팔 자리도 외투로)', fill=(60, 60, 60), font=f)
    # 2) 위팔, 3) 아래팔+손 (곧게 내린 모양, 관절 자리는 둥글게)
    x = 560
    d.rounded_rectangle([x, 120, x + 70, 420], radius=34, fill=GREY); dot(d, x + 35, 150, labeled); dot(d, x + 35, 392, labeled)
    d.rounded_rectangle([x + 140, 120, x + 200, 380], radius=30, fill=GREY)
    d.ellipse([x + 132, 360, x + 210, 450], fill=GREY); dot(d, x + 170, 150, labeled)
    if labeled:
        d.text((x - 20, 470), '2 위팔', fill=(60, 60, 60), font=f); d.text((x + 120, 470), '3 아래팔+손', fill=(60, 60, 60), font=f)
    # 4) 허벅지(바지), 5) 정강이(바지 아랫단 포함), 6) 구두 (옆모습)
    x = 940
    d.rounded_rectangle([x, 120, x + 92, 470], radius=44, fill=GREY); dot(d, x + 46, 160, labeled); dot(d, x + 46, 432, labeled)
    d.rounded_rectangle([x + 170, 120, x + 250, 470], radius=38, fill=GREY); dot(d, x + 210, 158, labeled); dot(d, x + 210, 440, labeled)
    d.polygon([(x + 330, 380), (x + 380, 380), (x + 392, 420), (x + 470, 438), (x + 476, 470), (x + 318, 470)], fill=DARK)
    dot(d, x + 360, 400, labeled)
    if labeled:
        d.text((x - 10, 500), '4 허벅지', fill=(60, 60, 60), font=f); d.text((x + 160, 500), '5 정강이', fill=(60, 60, 60), font=f)
        d.text((x + 330, 500), '6 구두', fill=(60, 60, 60), font=f)
    # 7) 외투 아래자락만 따로 (선택: 걸을 때 흔들리는 부분)
    x = 1560
    d.polygon([(x, 120), (x + 160, 120), (x + 200, 440), (x - 40, 440)], fill=GREY); dot(d, x + 80, 130, labeled)
    if labeled:
        d.text((x - 40, 470), '7 외투 아랫자락\n(엉덩이~무릎 아래)', fill=(60, 60, 60), font=f)
        d.text((40, 960), '빨간 점 = 관절(돌아가는 점). 모든 부품은 곧게 편 모양, 오른쪽을 보는 옆모습, 흰 배경, 부품끼리 떨어뜨려 그린다', fill=(90, 90, 90), font=font(24))
    return im


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    draw(False).save(os.path.join(OUT, 'parts_guide.png'))
    draw(True).save(os.path.join(OUT, 'parts_guide_labeled.png'))
    print('ok')
