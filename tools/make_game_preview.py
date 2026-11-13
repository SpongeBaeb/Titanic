#!/usr/bin/env python3
"""새 걷기 모델(gait_model)을 실제 Q6 밤 갑판 배경 위에 게임 크기로 걸려 보는 움직이는 그림.
캐릭터 그림 대신 외투+중절모 / 실크해트 / 긴 치마+챙모자 실루엣을 같은 관절 움직임에 입힌다(B안 '부품 인형'의 느낌).
깊이에 따른 키는 RumorView 의 personH(y) = 0.49*y - 170 과 같다.
출력: tools/work/q6walk_check/game_preview.gif
"""
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import gait_model as G  # noqa: E402

N = 26                       # 한 주기(두 걸음) 프레임 수
CANVAS = (360, 540)          # 한 사람을 그리는 판 (모델 키 470 이 들어간다)
BASE = 520                   # 판 안의 바닥선
DARK = (14, 14, 18, 255)
FAR = (30, 30, 36, 255)
RIM = (205, 140, 70, 255)    # 왼쪽에서 오는 등불 빛


def P(q, ox, oy):
    return (q[0] + ox, q[1] + oy)


def limb(d, a, b, w, col):
    d.line([a, b], fill=col, width=int(w))
    r = w / 2
    for q in (a, b):
        d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=col)


def draw_person(d, pose, kind, ox, oy, near, far, t):
    S = lambda q: P(q, ox, oy)  # noqa: E731
    hip, sh, head = S(pose['hip']), S(pose['sh']), S(pose['head'])

    def leg(L, col):
        knee, ankle, heel, toe = (S(q) for q in L)
        limb(d, hip, knee, 36, col); limb(d, knee, ankle, 28, col)
        d.polygon([P(ankle, -12, -6), P(ankle, 9, -9), toe, P(toe, -2, 5), P(heel, 0, 5), heel], fill=col)

    def arm(A, col):
        el, wr, hd = (S(q) for q in A)
        limb(d, sh, el, 26, col); limb(d, el, wr, 22, col); limb(d, wr, hd, 18, col)

    arm(pose['r_arm'], far)
    leg(pose['right'], far)
    leg(pose['left'], near)
    rk, lk = S(pose['right'][0]), S(pose['left'][0])
    ra, la = S(pose['right'][1]), S(pose['left'][1])
    if kind == 'skirt':
        hem = max(ra[1], la[1]) - 16
        fa, ba = max(ra[0], la[0]), min(ra[0], la[0])
        sway = math.sin((t - 0.12) * math.pi * 2) * 8
        pts = [P(hip, -24, -64), P(hip, 26, -64), P(hip, 34, 6), (max(hip[0] + 44, max(rk[0], lk[0]) + 24), (rk[1] + lk[1]) / 2),
               (fa + 36 + sway, hem), ((fa + ba) / 2 + sway / 2, hem + 8), (ba - 32 + sway * 1.3, hem),
               (min(hip[0] - 46, min(rk[0], lk[0]) - 24), (rk[1] + lk[1]) / 2), P(hip, -38, 8)]
        d.polygon(pts, fill=near)
    else:
        # 무릎 아래까지 오는 외투: 앞자락은 앞 무릎을, 뒷자락은 조금 늦게 따라온다
        hem_y = (rk[1] + lk[1]) / 2 + 26
        fk, bk = max(rk[0], lk[0]), min(rk[0], lk[0])
        sway = math.sin((t - 0.1) * math.pi * 2) * 5
        pts = [P(sh, -26, 10), P(sh, 24, 10), P(hip, 28, 0), (fk + 16, hem_y - 6), (fk + 10 + sway, hem_y),
               ((fk + bk) / 2, hem_y + 4), (bk - 20 + sway, hem_y), (bk - 14, hem_y - 10), P(hip, -32, 0)]
        d.polygon(pts, fill=near)
    # 몸통·목·머리
    d.polygon([P(hip, -22, 4), P(hip, 24, 4), P(sh, 24, 10), P(sh, -20, 10)], fill=near)
    limb(d, sh, S(pose['neck']), 22, near)
    r = G.HEAD_R
    d.ellipse([head[0] - r, head[1] - r * 1.08, head[0] + r, head[1] + r * 1.08], fill=near)
    # 모자
    hx, hy = head[0] + 2, head[1] - r * 0.55
    if kind == 'bowler':
        d.ellipse([hx - r * 1.35, hy - 6, hx + r * 1.45, hy + 8], fill=near)
        d.pieslice([hx - r * 0.95, hy - r * 1.35, hx + r * 1.05, hy + r * 0.6], 180, 360, fill=near)
    elif kind == 'tophat':
        d.ellipse([hx - r * 1.35, hy - 6, hx + r * 1.45, hy + 8], fill=near)
        d.rectangle([hx - r * 0.85, hy - r * 2.0, hx + r * 0.95, hy + 2], fill=near)
    else:
        d.ellipse([hx - r * 1.9, hy - 8, hx + r * 2.0, hy + 10], fill=near)
        d.pieslice([hx - r * 0.95, hy - r * 1.1, hx + r * 1.05, hy + r * 0.6], 180, 360, fill=near)
    arm(pose['l_arm'], near)


def sprite_frames(kind):
    tr, stride = G.timed_cycle(N)
    out = []
    for i, (p, pose, x, hy) in enumerate(tr):
        floor = -hy
        oy = BASE - floor
        ox = CANVAS[0] // 2 - 20
        # 등불 빛 테두리: 같은 사람을 밝은 색으로 왼쪽으로 조금 밀어 그리고, 그 위에 어두운 사람
        rim = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        draw_person(ImageDraw.Draw(rim), pose, kind, ox - 4, oy, RIM, RIM, p)
        body = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        draw_person(ImageDraw.Draw(body), pose, kind, ox, oy, DARK, FAR, p)
        im = Image.alpha_composite(rim.filter(ImageFilter.GaussianBlur(1.2)), body)
        out.append(im)
    return out, stride


def main():
    random.seed(7)
    bg_full = Image.open(os.path.join(ROOT, 'frontend', 'public', 'bg', 'rumor_q6.webp')).convert('RGB')
    crop = (260, 300, 1660, 820)                 # 갑판 부분
    bg = bg_full.crop(crop)
    view_w = 960
    sc = view_w / bg.width
    bg = bg.resize((view_w, round(bg.height * sc)), Image.LANCZOS)
    kinds = {k: sprite_frames(k) for k in ('bowler', 'tophat', 'skirt')}
    stride_h = kinds['bowler'][1] / G.H       # 두 걸음 / 키
    # 걷는 사람들: (종류, 세계 y, 시작 x, 방향, 속도[키/초])
    walkers = []
    walkers.append(('bowler', 760, crop[0] + 120, 1, 0.52))
    walkers.append(('skirt', 700, crop[0] + 560, -1, 0.5))
    for _ in range(7):
        y = random.uniform(540, 790)
        walkers.append((random.choice(['bowler', 'tophat', 'skirt', 'bowler', 'skirt']), y,
                        random.uniform(crop[0] - 100, crop[2] + 100), random.choice([-1, 1]), random.uniform(0.45, 0.6)))
    fps = 15
    frames = []
    for f in range(fps * 6):
        t = f / fps
        im = bg.copy()
        for kind, y, x0, dr, spd in sorted(walkers, key=lambda w: w[1]):
            hpx = max(36, 0.49 * y - 170)          # RumorView personH
            dist = spd * hpx * t
            span = crop[2] - crop[0] + 300
            x = (x0 - crop[0] + dr * dist) % span + crop[0] - 150
            idx = int(dist / (stride_h * hpx) * N) % N
            spr = kinds[kind][0][idx]
            if dr < 0:
                spr = spr.transpose(Image.FLIP_LEFT_RIGHT)
            k = hpx / G.H * sc
            s = spr.resize((max(1, round(spr.width * k)), max(1, round(spr.height * k))), Image.LANCZOS)
            sx = (x - crop[0]) * sc - s.width / 2
            sy = (y - crop[1]) * sc - BASE * k
            im.paste(s, (round(sx), round(sy)), s)
        frames.append(im.convert('P', palette=Image.ADAPTIVE, colors=96))
    # 가까이 본 것(2배): 앞쪽 왼쪽 부분
    zoom = [fr.convert('RGB').crop((40, 120, 520, 357)).resize((960, 474), Image.LANCZOS).convert('P', palette=Image.ADAPTIVE, colors=96) for fr in frames]
    zp = os.path.join(ROOT, 'tools', 'work', 'q6walk_check', 'game_preview_zoom.gif')
    zoom[0].save(zp, save_all=True, append_images=zoom[1:], duration=int(1000 / fps), loop=0, optimize=True)
    print('saved', zp, os.path.getsize(zp) // 1024, 'KB')
    out = os.path.join(ROOT, 'tools', 'work', 'q6walk_check', 'game_preview.gif')
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=int(1000 / fps), loop=0, optimize=True)
    print('saved', out, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    main()
