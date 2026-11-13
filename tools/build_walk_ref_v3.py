#!/usr/bin/env python3
"""걷기 스프라이트 요청용 참고 그림 v3: 인물 모양 실루엣.

막대 마네킹 대신 '그 사람의 모양'(무릎 아래까지 오는 외투+모자 / 긴 치마+챙모자)으로 칸마다 실루엣을 그린다.
이미지 생성기는 막대 자세보다 '채워 넣을 윤곽'을 훨씬 잘 따른다.
자세는 gait_model(정상 보행 관절 곡선, 매끈한 주기 곡선, 바닥에 고정된 발)에서, 한 걸음 주기를 걸은 거리 기준으로 고르게 8칸.
가까운 쪽(왼쪽) 팔다리는 검정 + 흰 테두리, 먼 쪽 팔다리는 어두운 회보라 (따라 그려도 허옇게 나오지 않게).

출력 (이미지_참고/q6):
  walk_ref3_{coat|skirt}_1-4.png, _5-8.png   첨부용 (가로 한 줄 4칸, 2048x576, 글자 없음)
  walk_ref3_{coat|skirt}_labeled.png         확인용 (8칸, 칸 번호)
  tools/work/q6walk_check/walk_ref3_{coat|skirt}.gif  참고 동작 미리보기
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import gait_model as G  # noqa: E402

OUT = os.path.join(ROOT, '이미지_참고', 'q6')
CHECK = os.path.join(ROOT, 'tools', 'work', 'q6walk_check')
CW, CH, BASE = 512, 576, 548
NEAR = (18, 18, 22)
FAR = (96, 92, 112)
LINE = (255, 255, 255)


def limb(d, a, b, w, col):
    d.line([a, b], fill=col, width=int(w))
    r = w / 2
    for q in (a, b):
        d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=col)


def draw(d, pose, kind, ox, oy, t, outline=True):
    S = lambda q: (q[0] + ox, q[1] + oy)  # noqa: E731
    hip, sh, head, neck = S(pose['hip']), S(pose['sh']), S(pose['head']), S(pose['neck'])

    def leg(L, col, ol=False):
        knee, ankle, heel, toe = (S(q) for q in L)
        if ol:
            limb(d, hip, knee, 42, LINE); limb(d, knee, ankle, 34, LINE)
        limb(d, hip, knee, 36, col); limb(d, knee, ankle, 28, col)
        shoe = [(ankle[0] - 12, ankle[1] - 8), (ankle[0] + 10, ankle[1] - 10), toe, (toe[0] - 2, toe[1] + 5), (heel[0], heel[1] + 5), heel]
        if ol:
            d.polygon([(x, y) for x, y in shoe], outline=LINE, width=4)
        d.polygon(shoe, fill=col)

    def arm(A, col, ol=False):
        el, wr, hd = (S(q) for q in A)
        if ol:
            limb(d, sh, el, 32, LINE); limb(d, el, wr, 28, LINE); limb(d, wr, hd, 24, LINE)
        limb(d, sh, el, 26, col); limb(d, el, wr, 22, col); limb(d, wr, hd, 18, col)

    arm(pose['r_arm'], FAR)
    leg(pose['right'], FAR)
    leg(pose['left'], NEAR, ol=outline)
    rk, lk = S(pose['right'][0]), S(pose['left'][0])
    ra, la = S(pose['right'][1]), S(pose['left'][1])
    if kind == 'skirt':
        hem = max(ra[1], la[1]) - 16
        fa, ba = max(ra[0], la[0]), min(ra[0], la[0])
        sway = math.sin((t - 0.12) * math.pi * 2) * 8
        pts = [(hip[0] - 24, hip[1] - 64), (hip[0] + 26, hip[1] - 64), (hip[0] + 34, hip[1] + 6),
               (max(hip[0] + 44, max(rk[0], lk[0]) + 24), (rk[1] + lk[1]) / 2), (fa + 36 + sway, hem),
               ((fa + ba) / 2 + sway / 2, hem + 8), (ba - 32 + sway * 1.3, hem),
               (min(hip[0] - 46, min(rk[0], lk[0]) - 24), (rk[1] + lk[1]) / 2), (hip[0] - 38, hip[1] + 8)]
    else:
        hem_y = (rk[1] + lk[1]) / 2 + 26
        fk, bk = max(rk[0], lk[0]), min(rk[0], lk[0])
        sway = math.sin((t - 0.1) * math.pi * 2) * 5
        pts = [(sh[0] - 26, sh[1] + 10), (sh[0] + 24, sh[1] + 10), (hip[0] + 28, hip[1]), (fk + 16, hem_y - 6),
               (fk + 10 + sway, hem_y), ((fk + bk) / 2, hem_y + 4), (bk - 20 + sway, hem_y), (bk - 14, hem_y - 10), (hip[0] - 32, hip[1])]
    d.polygon(pts, fill=NEAR)
    d.polygon([(hip[0] - 22, hip[1] + 4), (hip[0] + 24, hip[1] + 4), (sh[0] + 24, sh[1] + 10), (sh[0] - 20, sh[1] + 10)], fill=NEAR)
    limb(d, sh, neck, 22, NEAR)
    r = G.HEAD_R
    d.ellipse([head[0] - r, head[1] - r * 1.08, head[0] + r, head[1] + r * 1.08], fill=NEAR)
    d.polygon([(head[0] + r - 4, head[1] - 6), (head[0] + r + 9, head[1] + 4), (head[0] + r - 4, head[1] + 10)], fill=NEAR)  # 코: 오른쪽을 본다
    hx, hy = head[0] + 2, head[1] - r * 0.55
    if kind == 'skirt':
        d.ellipse([hx - r * 1.9, hy - 8, hx + r * 2.0, hy + 10], fill=NEAR)
        d.pieslice([hx - r * 0.95, hy - r * 1.1, hx + r * 1.05, hy + r * 0.6], 180, 360, fill=NEAR)
    else:
        d.ellipse([hx - r * 1.35, hy - 6, hx + r * 1.45, hy + 8], fill=NEAR)
        d.pieslice([hx - r * 0.95, hy - r * 1.35, hx + r * 1.05, hy + r * 0.6], 180, 360, fill=NEAR)
    arm(pose['l_arm'], NEAR, ol=outline)


def cells(kind, n=8):
    tr, stride = G.timed_cycle(n)
    out = []
    for i, (p, pose, x, hy) in enumerate(tr):
        im = Image.new('RGB', (CW, CH), (255, 255, 255))
        draw(ImageDraw.Draw(im), pose, kind, CW // 2 - 20, BASE + hy, p)
        out.append(im)
    return out


def font(sz):
    for f in ('C:/Windows/Fonts/malgunbd.ttf', 'C:/Windows/Fonts/malgun.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


NAMES = ['1 오른발 착지', '2 내려앉음', '3 지나감', '4 솟음', '5 왼발 착지', '6 내려앉음', '7 지나감', '8 솟음']


def main():
    os.makedirs(OUT, exist_ok=True)
    for kind in ('coat', 'skirt'):
        c = cells(kind)
        for tag, rng in (('1-4', range(0, 4)), ('5-8', range(4, 8))):
            row = Image.new('RGB', (CW * 4, CH), (255, 255, 255))
            for k, i in enumerate(rng):
                row.paste(c[i], (k * CW, 0))
            row.save(os.path.join(OUT, f'walk_ref3_{kind}_{tag}.png'))
        lab = Image.new('RGB', (CW * 4, CH * 2), (255, 255, 255))
        d = ImageDraw.Draw(lab)
        for i in range(8):
            lab.paste(c[i], ((i % 4) * CW, (i // 4) * CH))
            d.text(((i % 4) * CW + 20, (i // 4) * CH + 14), NAMES[i], fill=(200, 50, 40), font=font(28))
        lab.save(os.path.join(OUT, f'walk_ref3_{kind}_labeled.png'))
        # 참고 동작 미리보기: 같은 곡선으로 매끈하게(24fps) / 8칸만
        smooth = cells(kind, 26)
        frames = []
        for k in range(26 * 3):
            a = smooth[k % 26].resize((CW // 2, CH // 2), Image.LANCZOS)
            b = c[int((k % 26) / 26 * 8)].resize((CW // 2, CH // 2), Image.LANCZOS)
            fr = Image.new('RGB', (CW + 12, CH // 2 + 20), (255, 255, 255))
            fr.paste(b, (0, 20)); fr.paste(a, (CW // 2 + 12, 20))
            dd = ImageDraw.Draw(fr)
            dd.text((6, 2), '8 frames (what we request)', fill=(90, 90, 90)); dd.text((CW // 2 + 18, 2), 'smooth (same motion)', fill=(90, 90, 90))
            frames.append(fr)
        frames[0].save(os.path.join(CHECK, f'walk_ref3_{kind}.gif'), save_all=True, append_images=frames[1:], duration=int(1100 / 26), loop=0)
        print('ok', kind)


if __name__ == '__main__':
    main()
