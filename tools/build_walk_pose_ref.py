#!/usr/bin/env python3
"""걷기 동작 참고 그림(포즈 시트): 이미지 생성기에 '이 자세대로 그려 달라'고 첨부하는 마네킹 그림.

한 걸음 주기(오른발 착지 → 다음 오른발 착지)를 8칸으로 나눈 고전적인 걷기 순환:
  1 오른발 착지(contact)  2 내려앉음(down)  3 지나감(passing)  4 솟음(up)
  5 왼발 착지             6 내려앉음        7 지나감            8 솟음
관절 각도는 보행 연구에서 흔히 쓰는 엉덩이·무릎·발목 각도 곡선을 단순화한 값이다.
가까운 쪽(왼쪽) 팔다리는 검정, 먼 쪽(오른쪽) 팔다리는 회색으로 그려 어느 다리가 앞인지 헷갈리지 않게 한다.
발바닥이 바닥선에 닿도록 몸 전체를 올리고 내리므로, 걸을 때 몸이 오르내리는 높이 차이도 그대로 들어간다.

출력 (이미지_참고/q6):
  walk_pose_ref.png           첨부용 (글자 없음, 흰 배경, 4칸 x 2줄, 2048x1152)
  walk_pose_ref_labeled.png   설명용 (칸 번호와 이름, 바닥선)
  walk_pose_ref_skirt.png     긴 치마 인물용 (치마 자락이 앞 다리를 따라 흔들린다)
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '이미지_참고', 'q6')

CW, CH = 512, 576           # 칸 크기
COLS, ROWS = 4, 2
BASE = 548                  # 바닥선 (칸 안 y)
# 몸 치수 (키 약 470px, 머리 크기는 키의 1/7.5)
HEAD_R = 30
NECK = 14
TORSO = 150
THIGH = 118
SHIN = 112
FOOT = 44
UPPER_ARM = 88
FOREARM = 80
HAND = 20

NEAR = (20, 20, 24)          # 가까운 쪽(왼쪽) 팔다리, 몸통
FAR = (150, 150, 158)        # 먼 쪽(오른쪽) 팔다리 (설명용 그림)
FAR_DARK = (96, 92, 112)     # 첨부용: 생성기가 색을 따라 그려도 허옇게 나오지 않도록 어두운 색
NAMES = ['오른발 착지', '내려앉음', '지나감', '솟음', '왼발 착지', '내려앉음', '지나감', '솟음']


def interp(table, p):
    p %= 1.0
    for (p0, v0), (p1, v1) in zip(table, table[1:]):
        if p0 <= p <= p1:
            t = (p - p0) / (p1 - p0)
            t = t * t * (3 - 2 * t)
            return v0 + (v1 - v0) * t
    return table[-1][1]


# 다리 하나의 주기 (p=0 이 그 다리의 뒤꿈치 착지). 엉덩이: 앞으로 굽힘 +, 무릎: 굽힘 +, 발목: 발등 쪽으로 +
HIP = [(0, 24), (0.12, 20), (0.3, 6), (0.5, -12), (0.62, -6), (0.75, 16), (0.88, 27), (1, 24)]
KNEE = [(0, 3), (0.12, 16), (0.32, 6), (0.5, 8), (0.62, 38), (0.72, 58), (0.85, 28), (0.95, 3), (1, 3)]
ANKLE = [(0, 0), (0.1, -6), (0.42, 10), (0.6, -16), (0.7, -6), (0.85, 0), (1, 0)]


def leg(hip, p):
    a = math.radians(interp(HIP, p))
    kf = math.radians(interp(KNEE, p))
    dor = math.radians(interp(ANKLE, p))
    knee = (hip[0] + THIGH * math.sin(a), hip[1] + THIGH * math.cos(a))
    b = a - kf
    ankle = (knee[0] + SHIN * math.sin(b), knee[1] + SHIN * math.cos(b))
    c = b + dor
    fx, fy = math.cos(c), -math.sin(c)
    heel = (ankle[0] - fx * 12 + math.sin(b) * 10, ankle[1] - fy * 12 + math.cos(b) * 10)
    toe = (ankle[0] + fx * FOOT + math.sin(b) * 10, ankle[1] + fy * FOOT + math.cos(b) * 10)
    return knee, ankle, heel, toe


def arm(shoulder, swing_deg, elbow_deg):
    a = math.radians(swing_deg)
    elbow = (shoulder[0] + UPPER_ARM * math.sin(a), shoulder[1] + UPPER_ARM * math.cos(a))
    b = a + math.radians(elbow_deg)
    wrist = (elbow[0] + FOREARM * math.sin(b), elbow[1] + FOREARM * math.cos(b))
    hand = (wrist[0] + HAND * math.sin(b), wrist[1] + HAND * math.cos(b))
    return elbow, wrist, hand


def pose(p):
    """p: 오른발 착지 기준 주기 위치. 몸의 각 점(엉덩이 높이 0 기준)을 돌려준다"""
    hip = (0.0, 0.0)
    lean = math.radians(4)
    sh = (hip[0] + TORSO * math.sin(lean), hip[1] - TORSO * math.cos(lean))
    neck = (sh[0] + NECK * math.sin(lean), sh[1] - NECK * math.cos(lean))
    head = (neck[0] + 4, neck[1] - HEAD_R)
    right = leg(hip, p)
    left = leg(hip, p + 0.5)
    # 팔은 반대쪽 다리와 함께 흔들린다 (왼다리가 앞이면 오른팔이 앞)
    # 팔 흔들림: 실제 걸음처럼 어깨에서 뒤로 약 25도, 앞으로 약 35도. 앞으로 갈 때 팔꿈치가 더 굽는다
    r_sw = 1.5 * interp(HIP, p + 0.5) - 6
    l_sw = 1.5 * interp(HIP, p) - 6
    r_arm = arm(sh, r_sw, 8 + max(0, r_sw) * 0.75)
    l_arm = arm(sh, l_sw, 8 + max(0, l_sw) * 0.75)
    return dict(hip=hip, sh=sh, neck=neck, head=head, right=right, left=left, r_arm=r_arm, l_arm=l_arm)


def shift(pt, dx, dy):
    return (pt[0] + dx, pt[1] + dy)


def draw_line(d, a, b, w, col):
    d.line([a, b], fill=col, width=w)
    r = w / 2
    for q in (a, b):
        d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=col)


def draw_figure(d, P, ox, skirt=False, t=0.0):
    # 바닥에 닿게: 가장 낮은 발끝·뒤꿈치가 바닥선
    lows = [P['right'][2][1], P['right'][3][1], P['left'][2][1], P['left'][3][1]]
    dy = BASE - max(lows)
    S = lambda q: shift(q, ox, dy)  # noqa: E731
    hip, sh, neck, head = S(P['hip']), S(P['sh']), S(P['neck']), S(P['head'])

    def leg_draw(L, col):
        knee, ankle, heel, toe = (S(q) for q in L)
        draw_line(d, hip, knee, 34, col)
        draw_line(d, knee, ankle, 26, col)
        d.polygon([shift(ankle, -10, -6), shift(ankle, 8, -8), toe, shift(toe, -2, 6), shift(heel, 0, 6), heel], fill=col)

    def arm_draw(A, col, outline=False):
        elbow, wrist, hand = (S(q) for q in A)
        if outline:
            draw_line(d, sh, elbow, 28, (255, 255, 255)); draw_line(d, elbow, wrist, 24, (255, 255, 255)); draw_line(d, wrist, hand, 20, (255, 255, 255))
        draw_line(d, sh, elbow, 22, col)
        draw_line(d, elbow, wrist, 18, col)
        draw_line(d, wrist, hand, 14, col)

    # 먼 쪽(오른쪽) 팔다리 → 몸통 → 가까운 쪽(왼쪽)
    arm_draw(P['r_arm'], FAR)
    leg_draw(P['right'], FAR)
    if skirt:
        leg_draw(P['left'], NEAR)
        draw_skirt(d, P, S, t)
    # 몸통: 엉덩이에서 어깨로 좁아지는 사다리꼴
    # 몸통은 가늘게 (넓으면 팔이 몸통에 가려 움직임이 안 보인다)
    d.polygon([shift(hip, -18, 6), shift(hip, 20, 6), shift(sh, 20, 8), shift(sh, -16, 8)], fill=NEAR)
    draw_line(d, sh, neck, 20, NEAR)
    d.ellipse([head[0] - HEAD_R, head[1] - HEAD_R * 1.1, head[0] + HEAD_R, head[1] + HEAD_R * 1.1], fill=NEAR)
    # 코 방향 표시 (오른쪽을 본다)
    d.polygon([shift(head, HEAD_R - 4, -6), shift(head, HEAD_R + 9, 4), shift(head, HEAD_R - 4, 10)], fill=NEAR)
    if not skirt:
        leg_draw(P['left'], NEAR)
    arm_draw(P['l_arm'], NEAR, outline=True)
    return dy


def bez(p0, p1, p2, n=10):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (k / n for k in range(n + 1))]


def draw_skirt(d, P, S, t):
    """발목까지 오는 긴 치마(1912년): 허리에서 엉덩이를 지나 부드럽게 퍼진다.
    앞자락은 앞으로 나간 무릎에 밀려 나가고, 뒷자락은 조금 늦게 따라와 끌린다. 두 다리는 치마 속에 그려 두어 밑단 아래로 구두 끝만 번갈아 보인다"""
    hip = S(P['hip'])
    rk, ra = S(P['right'][0]), S(P['right'][1])
    lk, la = S(P['left'][0]), S(P['left'][1])
    fk = max(rk[0], lk[0]); bk = min(rk[0], lk[0])
    fa = max(ra[0], la[0]); ba = min(ra[0], la[0])
    hem = max(ra[1], la[1]) - 14
    sway = math.sin((t - 0.12) * math.pi * 2) * 7   # 밑단은 다리보다 조금 늦게 흔들린다
    waist_f = (hip[0] + 24, hip[1] - 62)
    waist_b = (hip[0] - 22, hip[1] - 62)
    hip_f = (hip[0] + 30, hip[1] + 4)
    hip_b = (hip[0] - 36, hip[1] + 6)
    knee_y = (rk[1] + lk[1]) / 2
    front = bez(hip_f, (max(hip[0] + 40, fk + 22), knee_y), (fa + 34 + sway, hem))
    back = bez((ba - 30 + sway * 1.3, hem), (min(hip[0] - 44, bk - 24), knee_y), hip_b)
    # 밑단: 앞에서 뒤로 살짝 물결진다
    hem_pts = [(fa + 34 + sway + (ba - 30 - fa - 34) * u, hem + 6 * math.sin(u * math.pi) + 3 * math.sin(u * math.pi * 3 + t * 6.28)) for u in (k / 12 for k in range(13))]
    pts = [waist_b, waist_f] + front + hem_pts[1:-1] + back
    d.polygon(pts, fill=(58, 56, 64))
    # 주름: 허리에서 밑단으로 몇 줄
    for u in (0.3, 0.55, 0.78):
        top = (waist_b[0] + (waist_f[0] - waist_b[0]) * u, waist_f[1] + 30)
        bot = (hem_pts[0][0] + (hem_pts[-1][0] - hem_pts[0][0]) * (1 - u), hem - 6)
        d.line([top, bot], fill=(80, 78, 88), width=3)


def font(size):
    for f in ('C:/Windows/Fonts/malgunbd.ttf', 'C:/Windows/Fonts/malgun.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def sheet(path, labeled=False, skirt=False, cells=range(8), cols=COLS):
    global FAR
    keep = FAR
    if not labeled:
        FAR = FAR_DARK
    cells = list(cells)
    rows = (len(cells) + cols - 1) // cols
    im = Image.new('RGB', (CW * cols, CH * rows), (255, 255, 255))
    d = ImageDraw.Draw(im)
    f1, f2 = font(30), font(20)
    for n, i in enumerate(cells):
        cx = (n % cols) * CW + CW // 2 - 10
        cy = (n // cols) * CH
        P = pose(i / 8)
        # 칸마다 바닥선(cy) 기준으로 그린다
        sub = Image.new('RGB', (CW, CH), (255, 255, 255))
        sd = ImageDraw.Draw(sub)
        draw_figure(sd, P, CW // 2 - 10, skirt=skirt, t=i / 8)
        if labeled:
            sd.line([(30, BASE + 2), (CW - 30, BASE + 2)], fill=(200, 200, 200), width=2)
            sd.text((24, 16), f'{i + 1}', fill=(180, 60, 40), font=f1)
            sd.text((64, 22), NAMES[i], fill=(90, 90, 90), font=f2)
        im.paste(sub, ((n % cols) * CW, cy))
        _ = cx
    FAR = keep
    if labeled:
        d.text((24, CH * rows - 34), '검정 = 가까운 쪽(왼쪽) 팔다리 · 회색 = 먼 쪽(오른쪽) 팔다리 · 오른쪽을 보고 걷는다', fill=(110, 110, 110), font=f2)
    im.save(path)
    print('saved', path)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    sheet(os.path.join(OUT, 'walk_pose_ref.png'))
    sheet(os.path.join(OUT, 'walk_pose_ref_labeled.png'), labeled=True)
    sheet(os.path.join(OUT, 'walk_pose_ref_skirt.png'), skirt=True)
    sheet(os.path.join(OUT, 'walk_pose_ref_skirt_labeled.png'), labeled=True, skirt=True)
    # 생성기가 8칸을 한 번에 따라 그리지 못해(둘째 줄을 첫 줄의 복사로 그림) 반씩 나눠 요청한다: 1~4칸, 5~8칸 (가로 한 줄, 2048x576)
    for tag, cells in (('1-4', range(0, 4)), ('5-8', range(4, 8))):
        sheet(os.path.join(OUT, f'walk_pose_ref_{tag}.png'), cells=cells)
        sheet(os.path.join(OUT, f'walk_pose_ref_skirt_{tag}.png'), skirt=True, cells=cells)
        sheet(os.path.join(OUT, f'walk_pose_ref_{tag}_labeled.png'), labeled=True, cells=cells)
