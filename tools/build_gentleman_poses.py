#!/usr/bin/env python3
"""신사 넘어짐·버티기·일어나기 레퍼런스 (옆모습, 오른쪽을 봄). 자세 도구: gent_pose_kit.py
출력 tools/work/gent_fall/: 동작별 가로 줄 {black,tone,parts}, 전체 확인 시트, 칸별 PNG
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gent_pose_kit as K
M = K.make
OUT = os.path.join(HERE, 'work', 'gent_fall'); os.makedirs(OUT, exist_ok=True)

STAND = M(lean=3, head=3, hh=250, near=('fk', -3, 3, 0), far=('fk', 3, 3, 0), narm=('fk', 8, 25), farm=('fk', -3, 25))
PRONE = M(lean=88, head=70, hh=40, near=('fk', -88, 4, -90), far=('fk', -86, 6, -90), narm=('fk', 100, -15), farm=('fk', 70, 30))
SUPINE = M(lean=-86, head=-80, hh=40, near=('fk', 88, 4, 0), far=('fk', 86, 6, 0), narm=('fk', 85, 8), farm=('fk', -100, -10))
ALL4 = M(lean=72, head=30, hh=132, near=('fk', -6, 95, -10), far=('fk', -14, 88, -10), narm=('ik', 20, 30, -1), farm=('ik', 12, 30, -1))
SQUAT = M(lean=38, head=18, hh=170, near=('ik', 60, 18, 1), far=('ik', 28, 18, 1), narm=('on', 'near', -8, -16), farm=('on', 'far', -8, -16))

SEQ = [  # (동작 이름, [(칸 이름, 자세, lift)])
    ('F 앞으로 넘어짐', [
        ('F1 걸림', M(lean=14, head=8, near=('fk', -25, 12, -5), far=('fk', 12, 12, 0), narm=('fk', 60, 35), farm=('fk', 35, 30)), 0),
        ('F2 쏠림', M(lean=45, head=35, near=('fk', -45, 70, -15), far=('fk', -12, 8, -10), narm=('fk', 115, 10), farm=('fk', 105, 15)), 0),
        ('F3 손 짚음', M(lean=74, head=55, hh=132, near=('fk', -6, 95, -10), far=('fk', -14, 88, -10), narm=('ik', 20, 30, -1), farm=('ik', 12, 30, -1)), 0),
        ('F4 엎드림', PRONE, 0)]),
    ('B 뒤로 미끄러져 넘어짐', [
        ('B1 미끄러짐', M(lean=-10, head=-8, near=('fk', 55, 0, 10), far=('fk', -5, 15, 0), narm=('fk', 125, -15), farm=('fk', 105, 10)), 0),
        ('B2 허공', M(lean=-35, head=-28, near=('fk', 70, 15, 5), far=('fk', 50, 25, 5), narm=('fk', 150, 5), farm=('fk', 130, 15)), 45),
        ('B3 엉덩방아', M(lean=-15, head=-8, near=('fk', 85, 10, 5), far=('fk', 80, 12, 5), narm=('fk', -60, 10), farm=('fk', 75, 5)), 0),
        ('B4 드러누움', SUPINE, 0)]),
    ('K 버티기(배 기울어짐)', [
        ('K1 웅크려 버팀', M(lean=30, head=20, near=('fk', 40, 80, 0), far=('fk', -20, 55, 0), narm=('fk', 75, 10), farm=('fk', -45, 10)), 0),
        ('K2 휘청', M(lean=20, head=10, near=('fk', 55, 50, 0), far=('fk', 0, 10, 0), narm=('fk', 95, 25), farm=('fk', -60, 30)), 0)]),
    ('U 엎드린 데서 일어남', [
        ('U1 엎드림', PRONE, 0),
        ('U2 팔 짚고 상체 듦', M(lean=52, head=38, hh=35, near=('fk', -86, 4, -90), far=('fk', -84, 6, -90), narm=('ik', 15, 25, -1), farm=('ik', 5, 25, -1)), 0),
        ('U3 네발', ALL4, 0),
        ('U4 한 무릎 세움', M(lean=25, head=8, hh=125, near=('ik', 95, 18, 1), far=('fk', -10, 95, -10), narm=('on', 'near', -8, -16), farm=('fk', 10, 20)), 0),
        ('U5 웅크려 일어섬', SQUAT, 0),
        ('U6 섬', STAND, 0)]),
    ('V 누운 데서 일어남', [
        ('V1 누움', SUPINE, 0),
        ('V2 상체 일으킴', M(lean=-40, head=-30, hh=30, near=('fk', 88, 3, 0), far=('fk', 85, 3, 0), narm=('ik', -60, 20, -1), farm=('fk', 70, 20)), 0),
        ('V3 무릎 세워 앉음', M(lean=-5, head=0, hh=78, near=('fk', 115, 95, 0), far=('fk', 112, 92, 0), narm=('fk', 100, 20), farm=('fk', 95, 25)), 0),
        ('V4 웅크림', SQUAT, 0),
        ('V5 섬', STAND, 0)]),
]


def font(sz):
    return ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', sz)


def main(kinds=('tone',)):
    for kind in kinds:
        W, H = K.CW, K.CH
        rows = []
        for name, frames in SEQ:
            row = Image.new('RGB', (W * len(frames), H), 'white'); lab = row.copy(); d = ImageDraw.Draw(lab)
            for i, (lb, P, lift) in enumerate(frames):
                im = K.render(P, kind, lift)
                row.paste(im, (i * W, 0)); lab.paste(im, (i * W, 0)); d.text((i * W + 16, 10), lb, fill=(200, 50, 40), font=font(30))
                d.line([(i * W, 0), (i * W, H)], fill=(225, 225, 225), width=2)
            key = name.split()[0]
            os.makedirs(os.path.join(OUT, kind), exist_ok=True)
            row.save(os.path.join(OUT, f'{key}_{kind}_row.png')); lab.save(os.path.join(OUT, f'{key}_{kind}_labeled.png'))
            rows.append(lab)
        print('ok', kind)


if __name__ == '__main__':
    main(tuple(sys.argv[1:]) or ('tone',))
