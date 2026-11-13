#!/usr/bin/env python3
"""단순 실루엣 걷기 레퍼런스를 부위별 색으로 칠한다 (build_walk_ref_v3 의 coat 그림과 같은 모양·같은 자세).
출력: tools/work/gent_parts/frame_{0..7}.png, parts_sheet_8_labeled.png (번호+범례), parts_sheet_8_row.png (글자 없음), legend.png
"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gait_model as G
import build_walk_ref_v3 as R

OUT = os.path.join(os.path.dirname(HERE), 'tools', 'work', 'gent_parts'); os.makedirs(OUT, exist_ok=True)
PARTS = [  # (이름, 색)
    ('모자', (120, 60, 160)), ('머리·목(얼굴)', (240, 190, 150)), ('외투 몸통', (50, 90, 200)),
    ('가까운 팔 (몸 앞)', (230, 60, 60)), ('먼 팔 (몸 뒤)', (240, 150, 150)),
    ('가까운 다리 (바지)', (40, 170, 90)), ('먼 다리 (바지)', (150, 215, 160)),
    ('가까운 구두', (230, 190, 30)), ('먼 구두', (245, 225, 140)),
]
C = dict(PARTS)
col = {'hat': C['모자'], 'face': C['머리·목(얼굴)'], 'coat': C['외투 몸통'], 'narm': C['가까운 팔 (몸 앞)'], 'farm': C['먼 팔 (몸 뒤)'],
       'nleg': C['가까운 다리 (바지)'], 'fleg': C['먼 다리 (바지)'], 'nshoe': C['가까운 구두'], 'fshoe': C['먼 구두']}


def limb(d, a, b, w, c):
    d.line([a, b], fill=c, width=int(w)); r = w / 2
    for q in (a, b): d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=c)


def draw(d, pose, ox, oy, t):
    S = lambda q: (q[0] + ox, q[1] + oy)
    hip, sh, head, neck = S(pose['hip']), S(pose['sh']), S(pose['head']), S(pose['neck'])

    def leg(L, cl, cs):
        knee, ankle, heel, toe = (S(q) for q in L)
        limb(d, hip, knee, 36, cl); limb(d, knee, ankle, 28, cl)
        d.polygon([(ankle[0] - 12, ankle[1] - 8), (ankle[0] + 10, ankle[1] - 10), toe, (toe[0] - 2, toe[1] + 5), (heel[0], heel[1] + 5), heel], fill=cs)

    def arm(A, c):
        el, wr, hd = (S(q) for q in A)
        limb(d, sh, el, 26, c); limb(d, el, wr, 22, c); limb(d, wr, hd, 18, c)

    arm(pose['r_arm'], col['farm']); leg(pose['right'], col['fleg'], col['fshoe']); leg(pose['left'], col['nleg'], col['nshoe'])
    rk, lk = S(pose['right'][0]), S(pose['left'][0])
    hem_y = (rk[1] + lk[1]) / 2 + 26
    fk, bk = max(rk[0], lk[0]), min(rk[0], lk[0])
    sway = math.sin((t - 0.1) * math.pi * 2) * 5
    pts = [(sh[0] - 26, sh[1] + 10), (sh[0] + 24, sh[1] + 10), (hip[0] + 28, hip[1]), (fk + 16, hem_y - 6), (fk + 10 + sway, hem_y),
           ((fk + bk) / 2, hem_y + 4), (bk - 20 + sway, hem_y), (bk - 14, hem_y - 10), (hip[0] - 32, hip[1])]
    d.polygon(pts, fill=col['coat'])
    d.polygon([(hip[0] - 22, hip[1] + 4), (hip[0] + 24, hip[1] + 4), (sh[0] + 24, sh[1] + 10), (sh[0] - 20, sh[1] + 10)], fill=col['coat'])
    limb(d, sh, neck, 22, col['face'])
    r = G.HEAD_R
    d.ellipse([head[0] - r, head[1] - r * 1.08, head[0] + r, head[1] + r * 1.08], fill=col['face'])
    d.polygon([(head[0] + r - 4, head[1] - 6), (head[0] + r + 9, head[1] + 4), (head[0] + r - 4, head[1] + 10)], fill=col['face'])
    hx, hy = head[0] + 2, head[1] - r * 0.55
    d.ellipse([hx - r * 1.35, hy - 6, hx + r * 1.45, hy + 8], fill=col['hat'])
    d.pieslice([hx - r * 0.95, hy - r * 1.35, hx + r * 1.05, hy + r * 0.6], 180, 360, fill=col['hat'])
    arm(pose['l_arm'], col['narm'])


def font(sz):
    return ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', sz)


def legend(w=520):
    h = 56 + 46 * len(PARTS)
    im = Image.new('RGB', (w, h), 'white'); d = ImageDraw.Draw(im); d.text((16, 10), '부위별 색', fill=(60, 60, 60), font=font(30))
    for i, (n, c) in enumerate(PARTS):
        y = 58 + i * 46; d.rectangle([16, y, 66, y + 34], fill=c, outline=(120, 120, 120)); d.text((80, y + 2), n, fill=(40, 40, 40), font=font(26))
    return im


def main():
    N = 8; tr, _ = G.timed_cycle(N); fr = []
    for i, (p, pose, x, hy) in enumerate(tr):
        im = Image.new('RGB', (R.CW, R.CH), 'white'); draw(ImageDraw.Draw(im), pose, R.CW // 2 - 20, R.BASE + hy, p)
        im.save(os.path.join(OUT, f'frame_{i}.png')); fr.append(im)
    CW, CH = R.CW, R.CH; lg = legend(); lg.save(os.path.join(OUT, 'legend.png'))
    g = Image.new('RGB', (CW * 4 + lg.width, max(CH * 2, lg.height)), 'white'); d = ImageDraw.Draw(g)
    for i, im in enumerate(fr):
        x, y = (i % 4) * CW, (i // 4) * CH; g.paste(im, (x, y)); d.text((x + 16, y + 12), str(i + 1), fill=(200, 50, 40), font=font(30))
    g.paste(lg, (CW * 4, 0)); g.save(os.path.join(OUT, 'parts_sheet_8_labeled.png'))
    r = Image.new('RGB', (CW * 8, CH), 'white')
    for i, im in enumerate(fr): r.paste(im, (i * CW, 0))
    r.save(os.path.join(OUT, 'parts_sheet_8_row.png'))


if __name__ == '__main__':
    main()
