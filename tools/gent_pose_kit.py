#!/usr/bin/env python3
"""신사 자세 도구: 관절 각도(FK)와 닿는 점(IK)으로 자세를 정해 외투+중산모 실루엣을 그린다. 옆모습, 오른쪽을 본다.
걷기 모델(gait_model)이 못 하는 넘어짐·앉음·누움·일어남용. 몸 치수는 gait_model 과 같다.

각도 규칙(화면 좌표, y 아래): '아래쪽 = 0도, 앞(오른쪽) = +, 뒤(왼쪽) = -'.
  lean : 몸통이 세로에서 앞으로 기운 각도 (90 = 엎드림, -90 = 누움)
  head : 머리 기울기 (몸통과 같은 규칙)
  다리 : ('fk', 허벅지각, 무릎굽힘, 발목)  또는 ('ik', 발목 x(엉덩이 기준), 발목 높이(바닥 위), 무릎이 앞(+1)/뒤(-1))
  팔   : ('fk', 어깨각, 팔꿈치굽힘)       또는 ('ik', 손목 x(어깨 기준), 손목 높이(바닥 위), 팔꿈치가 앞(+1)/뒤(-1))
  hh   : 엉덩이 높이(바닥 위). IK 가 바닥을 알려면 필요
near = 왼쪽 팔다리(가까운 쪽, 앞 겹), far = 오른쪽 팔다리(먼 쪽, 뒤 겹)
"""
import math
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gait_model as G  # noqa: E402

TH, SH, TOR, NK, HR, UA, FA, HD = G.THIGH, G.SHIN, G.TORSO, G.NECK, G.HEAD_R, G.UPPER_ARM, G.FOREARM, G.HAND
S, C = math.sin, math.cos
rad = math.radians

COLORS = {
    'black': {k: (0, 0, 0) for k in ('hat', 'face', 'coat', 'narm', 'farm', 'nleg', 'fleg', 'nshoe', 'fshoe')},
    'tone': dict(hat=(44, 42, 48), face=(44, 42, 48), coat=(44, 42, 48), narm=(44, 42, 48), nleg=(44, 42, 48), nshoe=(44, 42, 48),
                 farm=(110, 108, 120), fleg=(110, 108, 120), fshoe=(110, 108, 120)),
    'game': dict(hat=(14, 14, 18), face=(14, 14, 18), coat=(16, 16, 22), narm=(16, 16, 22), nleg=(14, 14, 18), nshoe=(10, 10, 14),
                 farm=(52, 54, 68), fleg=(46, 48, 62), fshoe=(40, 42, 54)),
    'parts': dict(hat=(120, 60, 160), face=(240, 190, 150), coat=(50, 90, 200), narm=(230, 60, 60), farm=(240, 150, 150),
                  nleg=(40, 170, 90), fleg=(150, 215, 160), nshoe=(230, 190, 30), fshoe=(245, 225, 140)),
}


def ang(v):  # 벡터 → '아래 0, 앞 +' 각도(도)
    return math.degrees(math.atan2(v[0], v[1]))


def ik2(o, t, l1, l2, side):
    """두 마디 IK. 돌려주는 것: (첫 마디 각, 둘째 마디 각) (도, 아래 0 앞 +). side=+1 이면 관절(무릎·팔꿈치)이 앞쪽"""
    dx, dy = t[0] - o[0], t[1] - o[1]
    d = max(abs(l1 - l2) + 1e-3, min(l1 + l2 - 1e-3, math.hypot(dx, dy)))
    base = math.atan2(dx, dy)
    al = math.acos(max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    a1 = base + side * al
    j = (o[0] + l1 * S(a1), o[1] + l1 * C(a1))
    tt = (o[0] + d * S(base), o[1] + d * C(base))  # 닿지 못하면 가능한 데까지만
    a2 = math.atan2(tt[0] - j[0], tt[1] - j[1])
    return math.degrees(a1), math.degrees(a2)


def leg_fk(hip, a, k, ank):
    ar = rad(a)
    knee = (hip[0] + TH * S(ar), hip[1] + TH * C(ar))
    b = ar - rad(k)
    ankle = (knee[0] + SH * S(b), knee[1] + SH * C(b))
    c = b + rad(ank)
    fwd, down = (C(c), -S(c)), (S(c), C(c))
    heel = (ankle[0] - fwd[0] * G.HEEL_BACK + down[0] * G.ANKLE_H, ankle[1] - fwd[1] * G.HEEL_BACK + down[1] * G.ANKLE_H)
    toe = (ankle[0] + fwd[0] * G.TOE_FWD + down[0] * G.ANKLE_H, ankle[1] + fwd[1] * G.TOE_FWD + down[1] * G.ANKLE_H)
    return dict(knee=knee, ankle=ankle, heel=heel, toe=toe, fwd=fwd, down=down)


def arm_fk(sh, a, e):
    ar = rad(a)
    el = (sh[0] + UA * S(ar), sh[1] + UA * C(ar))
    b = ar + rad(e)
    wr = (el[0] + FA * S(b), el[1] + FA * C(b))
    hd = (wr[0] + HD * S(b), wr[1] + HD * C(b))
    return dict(el=el, wr=wr, hd=hd)


def make(lean=0, head=None, hh=TH + SH + 20, near=None, far=None, narm=None, farm=None, ank=0):
    """자세 하나. 좌표는 엉덩이가 (0,0), y 아래. 바닥은 y = hh"""
    head = lean * 0.5 if head is None else head
    l = rad(lean)
    hip = (0.0, 0.0)
    sh = (TOR * S(l), -TOR * C(l))
    neck = (sh[0] + NK * S(l), sh[1] - NK * C(l))
    hr = rad(head)
    hc = (neck[0] + HR * S(hr), neck[1] - HR * C(hr))
    g = hh  # 바닥 y

    def mk_leg(spec):
        spec = spec or ('fk', 0, 0, 0)
        if spec[0] == 'ik':
            _, x, h, side = spec[:4]
            a, bb = ik2(hip, (x, g - h), TH, SH, side)
            return leg_fk(hip, a, a - bb, spec[4] if len(spec) > 4 else 0)
        return leg_fk(hip, spec[1], spec[2], spec[3] if len(spec) > 3 else 0)

    def mk_arm(spec):
        spec = spec or ('fk', 0, 0)
        if spec[0] == 'on':  # ('on', 'near'|'far', dx, dy): 손목을 그 쪽 무릎 위(dx, dy 만큼 비껴)에 얹는다
            kn = (nl if spec[1] == 'near' else fl)['knee']
            t = (kn[0] + spec[2], kn[1] + spec[3])
            a, bb = ik2(sh, t, UA, FA, -1)
            return arm_fk(sh, a, bb - a)
        if spec[0] == 'ik':
            _, x, h, side = spec
            a, bb = ik2(sh, (sh[0] + x, g - h), UA, FA, side)
            return arm_fk(sh, a, bb - a)
        return arm_fk(sh, spec[1], spec[2])

    nl, fl = mk_leg(near), mk_leg(far)
    return dict(hip=hip, sh=sh, neck=neck, hc=hc, head=head, lean=lean, near=nl, far=fl,
                narm=mk_arm(narm), farm=mk_arm(farm), na=near, fa=far)


def hull(pts):
    pts = sorted(set((round(x, 2), round(y, 2)) for x, y in pts))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def limb(d, a, b, w, col):
    d.line([a, b], fill=col, width=int(w))
    r = w / 2
    for q in (a, b):
        d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=col)


STYLE = 'gent'  # 'gent' 신사(외투+중산모) / 'lady' 숙녀(긴 치마+챙 넓은 모자+쪽머리) / 'child' 어린이
OPTS = set()    # 덧붙이기: 'jacket' 짧은 재킷(허벅지 중간까지, 바지가 보인다), 'flatcap' 납작모자(신사), 'updo' 올림머리·모자 없음(숙녀), 'slim' 폭이 좁은 치마(숙녀), 'stoop' 굽은 등(등에 둥근 혹, 팔이 어깨 아래에서 시작), 'beard' 수염, 'shawl' 숄(숙녀), 'bonnet' 보닛(숙녀, 챙 넓은 모자 대신). 자세에 P['cane']=True 이면 지팡이
for _k, _c in COLORS.items():
    _c.setdefault('skirt', (170, 80, 140) if _k == 'parts' else _c['coat'])
    _c.setdefault('beard', (235, 235, 235) if _k == 'parts' else _c['face'])
    _c.setdefault('shawl', (210, 150, 60) if _k == 'parts' else _c['coat'])
    _c.setdefault('cane', (150, 100, 50) if _k == 'parts' else _c['coat'])


def draw(d, P, kind, ox, oy):
    col = COLORS[kind]
    lady = STYLE == 'lady'
    kid = STYLE == 'child'
    T = lambda q: (q[0] + ox, q[1] + oy)  # noqa: E731
    hip, sh, neck, hc = T(P['hip']), T(P['sh']), T(P['neck']), T(P['hc'])
    l = rad(P['lean'])
    aw = (25, 19, 13) if lady else ((22, 17, 14) if kid else (26, 22, 18))       # 팔 굵기 (숙녀: 소매가 어깨에서 손목으로 가늘어진다)
    lw = (24, 20) if lady else ((32, 19) if kid else (36, 28))               # 다리 굵기

    def arm(A, c):
        el, wr, hd = T(A['el']), T(A['wr']), T(A['hd'])
        lowarm = lady or 'stoop' in OPTS
        a0 = (sh[0] - S(l) * 12, sh[1] + C(l) * 12) if lowarm else sh   # 숙녀·굽은 등: 팔은 어깨(목 밑동보다 조금 아래)에서 시작한다
        limb(d, a0, el, aw[0], c); limb(d, el, wr, aw[1], c); limb(d, wr, hd, aw[2], c)
        if lowarm:
            r0 = aw[0] / 2 + 1; d.ellipse([a0[0] - r0, a0[1] - r0, a0[0] + r0, a0[1] + r0], fill=c)

    def leg(L, cl, cs):
        knee, ankle, heel, toe = T(L['knee']), T(L['ankle']), T(L['heel']), T(L['toe'])
        fwd, down = L['fwd'], L['down']
        limb(d, hip, knee, lw[0], cl); limb(d, knee, ankle, lw[1], cl)
        sw = 0.8 if lady else (0.85 if kid else 1.0)
        shoe = [(ankle[0] - fwd[0] * 12 * sw - down[0] * 8, ankle[1] - fwd[1] * 12 * sw - down[1] * 8),
                (ankle[0] + fwd[0] * 10 * sw - down[0] * 10, ankle[1] + fwd[1] * 10 * sw - down[1] * 10), toe,
                (toe[0] - fwd[0] * 2 + down[0] * 5, toe[1] - fwd[1] * 2 + down[1] * 5), (heel[0] + down[0] * 5, heel[1] + down[1] * 5), heel]
        d.polygon(shoe, fill=cs)

    arm(P['farm'], col['farm']); leg(P['far'], col['fleg'], col['fshoe']); leg(P['near'], col['nleg'], col['nshoe'])
    u = (S(l), -C(l)); n = (C(l), S(l))
    q = lambda p, v, w: (p[0] + v[0] * w, p[1] + v[1] * w)  # noqa: E731
    if lady:
        upright = abs(P['lean']) < 40 and all(abs(math.degrees(math.atan2(L['knee'][0], L['knee'][1]))) < 62 for L in (P['near'], P['far']))
        if upright:
            # 서서 걷는 자세: 허리가 잘록한 재킷 + 허리에서 퍼지는 치마. 치맛단은 두 다리의 발목 높이를 따라 오르내려 걸음이 보인다
            wst = q(hip, u, 30)
            d.polygon([q(hip, n, -25), q(hip, n, 24), q(q(sh, u, -10), n, 21), q(q(sh, u, -10), n, -22)], fill=col['coat'])
            hems = []
            for L in (P['near'], P['far']):
                an, kn = T(L['ankle']), T(L['knee'])
                sv = (an[0] - kn[0], an[1] - kn[1]); sm = math.hypot(*sv) or 1
                hems.append((an[0] - sv[0] / sm * 12, an[1] - sv[1] / sm * 12 + 4))
            hems.sort(key=lambda h: h[0])
            (bx, by), (fx, fy) = hems[0], hems[1]
            if 'stoop' in OPTS:
                mx = (bx + fx) / 2   # 굽은 노인의 치마: 폭이 일정한 종 모양(발 사이 가운데 기준), 치맛단 높이만 두 발을 따라 오르내린다
                bk = (mx - 50, by - 6); fr = (mx + 50, fy - 6)
            elif 'slim' in OPTS:
                bk = (bx - 30, by - 6); fr = (fx + 32, fy - 6)
            else:
                bk = (bx - 40, by - 6); fr = (fx + 40, fy - 6)
            sag = 9
            hem = [(bk[0] + (fr[0] - bk[0]) * t / 6, bk[1] + (fr[1] - bk[1]) * t / 6 + sag * 4 * (t / 6) * (1 - t / 6)) for t in range(0, 7)]
            hipw = 28
            poly = [q(wst, n, -20), q(q(hip, u, 4), n, -hipw - 8)] + hem + [q(q(hip, u, 4), n, hipw), q(wst, n, 19)]
            for L in (P['near'], P['far']):  # 무릎이 굽어도 치마 밖으로 나오지 않게 무릎 높이의 폭을 포함한다
                kk = T(L['knee'])
                poly += [(kk[0] + 30, kk[1])] if 'stoop' in OPTS else [(kk[0] - 34, kk[1]), (kk[0] + 34, kk[1])]  # 노인: 앞쪽만(뒤는 곧게 늘어진다)
            d.polygon(hull(poly), fill=col['skirt'])
            d.polygon([q(hip, n, -22), q(hip, n, 22), q(wst, n, 20), q(wst, n, -21)], fill=col['coat'])  # 재킷 밑단(허리선까지)
        else:
            # 눕거나 앉은 자세: 엉덩이에서 무릎, 정강이 80% 지점까지 다리를 따라 덮는다(볼록 껍질)
            d.polygon([q(hip, n, -24), q(hip, n, 22), q(q(sh, u, -10), n, 21), q(q(sh, u, -10), n, -22)], fill=col['coat'])
            pts = [q(hip, n, -26), q(hip, n, 26)]
            for L in (P['near'], P['far']):
                kn, an = L['knee'], L['ankle']
                tv = (kn[0] - P['hip'][0], kn[1] - P['hip'][1]); tm = math.hypot(*tv) or 1; tp = (-tv[1] / tm, tv[0] / tm)
                hm = (kn[0] + (an[0] - kn[0]) * 0.8, kn[1] + (an[1] - kn[1]) * 0.8)
                sv = (an[0] - kn[0], an[1] - kn[1]); sm = math.hypot(*sv) or 1; sp = (-sv[1] / sm, sv[0] / sm)
                kk = T(kn); hh = T(hm)
                pts += [q(kk, tp, 36), q(kk, tp, -36), q(hh, sp, 47), q(hh, sp, -47)]
            d.polygon(hull(pts), fill=col['skirt'])
    elif kid:
        # 어린이(성별 무관): 엉덩이까지 오는 짧은 재킷. 바지는 무릎까지(굵은 허벅지) + 가는 양말과 부츠
        h14 = q(hip, u, -14)
        d.polygon([q(h14, n, -27), q(h14, n, 25), q(q(sh, u, -10), n, 22), q(q(sh, u, -10), n, -24)], fill=col['coat'])
    else:
        # 외투: 몸통 + 두 허벅지를 따라 내려오는 치마(볼록 껍질)
        d.polygon([q(hip, n, -32), q(hip, n, 28), q(q(sh, u, -10), n, 24), q(q(sh, u, -10), n, -26)], fill=col['coat'])
        dirs = []
        for L in (P['near'], P['far']):
            v = (L['knee'][0] - P['hip'][0], L['knee'][1] - P['hip'][1]); m = math.hypot(*v); dirs.append((v[0] / m, v[1] / m))
        if 'stoop' in OPTS:
            # 굽은 노인의 외투: 자락이 허벅지 방향이 아니라 중력대로 아래로 늘어진다(앞으로 나온 무릎을 따라 삐죽 튀지 않는다)
            dirs = [((d0[0] * 0.3) / (math.hypot(d0[0] * 0.3, d0[1] * 0.3 + 0.7) or 1), (d0[1] * 0.3 + 0.7) / (math.hypot(d0[0] * 0.3, d0[1] * 0.3 + 0.7) or 1)) for d0 in dirs]
        av = (dirs[0][0] + dirs[1][0], dirs[0][1] + dirs[1][1]); m = math.hypot(*av) or 1
        av = (av[0] / m, av[1] / m); pav = (-av[1], av[0])
        L_ = 88 if 'jacket' in OPTS else 142
        hw = 28 if 'jacket' in OPTS else 34
        pts = [q(hip, pav, 30), q(hip, pav, -30), q(hip, n, -32), q(hip, n, 28)]
        for dv in dirs:
            hem = q(hip, dv, L_); pv = (-dv[1], dv[0])
            pts += [q(hem, pv, hw), q(hem, pv, -hw)]
        d.polygon(hull(pts), fill=col['coat'])
    if 'stoop' in OPTS:
        # 굽은 등: 어깨뼈 부근이 둥글게 솟는다(몸통 뒤쪽 혹)
        d.polygon([q(q(sh, u, -6), n, -24), q(q(sh, u, -14), n, -38), q(q(sh, u, -42), n, -43), q(q(sh, u, -74), n, -35), q(q(sh, u, -100), n, -27), q(q(sh, u, -40), n, -10)], fill=col['shawl'] if 'shawl' in OPTS else col['coat'])
    if 'shawl' in OPTS:
        # 어깨에서 등으로 늘어지는 숄(삼각형): 뒤쪽 자락이 허리 아래까지 내려온다
        d.polygon([q(sh, n, -27), q(q(sh, u, -12), n, 22), q(q(sh, u, -52), n, 14), q(q(hip, u, 8), n, -33)], fill=col['shawl'])
    limb(d, sh, neck, 18 if lady else (16 if kid else 22), col['face'])
    # 머리·모자(머리 기울기에 따라 돌린다)
    hr = rad(P['head']); up = (S(hr), -C(hr)); fw = (C(hr), S(hr))
    M = lambda x, y: (hc[0] + fw[0] * x + up[0] * y, hc[1] + fw[1] * x + up[1] * y)  # noqa: E731
    d.polygon([M(HR * C(t), HR * 1.08 * S(t)) for t in [math.radians(a) for a in range(0, 360, 12)]], fill=col['face'])
    d.polygon([M(HR - 4, 6), M(HR + 9, -4), M(HR - 4, -10)], fill=col['face'])
    if 'beard' in OPTS:
        d.polygon([M(HR * 0.15, -HR * 0.55), M(HR * 0.98, -HR * 0.2), M(HR * 0.95, -HR * 1.25), M(HR * 0.3, -HR * 1.35)], fill=col['beard'])
    bc = (2, HR * 0.55)
    if lady:
        # 쪽머리(뒤통수), 챙 넓은 모자 + 낮은 갓 + 깃털
        d.polygon([M(-HR * 1.0 + 9 * C(t), HR * 0.05 + 9.5 * S(t)) for t in [math.radians(a) for a in range(0, 360, 20)]], fill=col['hat'])
        d.polygon([M(-HR * 0.9 + HR * 0.6 * C(t), -HR * 0.1 + HR * 0.55 * S(t)) for t in [math.radians(a) for a in range(0, 360, 20)]], fill=col['hat'])
        if 'updo' in OPTS:
            # 깁슨 스타일 올림머리: 머리 윗부분을 덮고 정수리 뒤쪽에 큰 쪽(둥근 뭉치), 모자는 쓰지 않는다
            d.polygon([M(-0.06 * HR + 1.1 * HR * C(t), 0.12 * HR + 1.12 * HR * S(t)) for t in [math.radians(a) for a in range(12, 196, 8)]], fill=col['hat'])
            d.polygon([M(-0.45 * HR + 0.78 * HR * C(t), 1.0 * HR + 0.62 * HR * S(t)) for t in [math.radians(a) for a in range(0, 360, 15)]], fill=col['hat'])
        elif 'bonnet' in OPTS:
            # 보닛: 머리를 감싸는 낮은 모자(뒤에 쪽머리), 앞챙은 작게
            d.polygon([M(-0.25 * HR + 1.2 * HR * C(t), 0.1 * HR + 1.12 * HR * S(t)) for t in [math.radians(a) for a in range(0, 200, 8)]], fill=col['hat'])
            d.polygon([M(HR * 0.8, HR * 0.6), M(HR * 1.3, HR * 0.15), M(HR * 1.15, -HR * 0.1), M(HR * 0.6, HR * 0.3)], fill=col['hat'])
        else:
            d.polygon([M(bc[0] - 4 + 2.0 * HR * C(t), bc[1] + 8 * S(t)) for t in [math.radians(a) for a in range(0, 360, 12)]], fill=col['hat'])
            d.polygon([M(bc[0] - 2 + HR * 0.8 * C(t), bc[1] + HR * 0.8 * S(t)) for t in [math.radians(a) for a in range(0, 181, 10)]], fill=col['hat'])
            d.polygon([M(-4, bc[1] + HR * 0.7), M(-HR * 0.9, bc[1] + HR * 1.55), M(-HR * 1.7, bc[1] + HR * 1.2), M(-HR * 0.7, bc[1] + HR * 0.55)], fill=col['hat'])
    elif kid:
        # 어린이(성별 무관): 모자 없이 짧은 머리(윗머리와 뒤통수만 살짝 덮는다)
        d.polygon([M(-0.06 * HR + 1.1 * HR * C(t), 0.12 * HR + 1.12 * HR * S(t)) for t in [math.radians(a) for a in range(12, 196, 8)]], fill=col['hat'])
    elif 'flatcap' in OPTS:
        # 납작모자: 낮고 넓은 갓과 앞으로 나온 짧은 챙
        d.polygon([M(0.1 * HR + 1.22 * HR * C(t), HR * 0.42 + HR * 0.6 * S(t)) for t in [math.radians(a) for a in range(0, 181, 10)]], fill=col['hat'])
        d.polygon([M(HR * 0.7, HR * 0.5), M(HR * 1.7, HR * 0.38), M(HR * 1.65, HR * 0.24), M(HR * 0.6, HR * 0.36)], fill=col['hat'])
        d.polygon([M(-HR * 1.12, HR * 0.44), M(HR * 1.25, HR * 0.48), M(HR * 1.25, HR * 0.34), M(-HR * 1.12, HR * 0.32)], fill=col['hat'])
    else:
        d.polygon([M(bc[0] + 1.4 * HR * C(t), bc[1] + 7 * S(t)) for t in [math.radians(a) for a in range(0, 360, 15)]], fill=col['hat'])
        d.polygon([M(bc[0] + HR * 0.98 * C(t), bc[1] + HR * 1.0 * S(t) + 0) for t in [math.radians(a) for a in range(0, 181, 10)]], fill=col['hat'])
    if P.get('cane'):
        hd = T(P['narm']['hd'])
        gy = max(max(T(L['heel'])[1], T(L['toe'])[1]) for L in (P['near'], P['far'])) + 5
        cn = P['cane'] if isinstance(P['cane'], dict) else {}
        if 'tip' in cn:
            tip = T(cn['tip'])   # 지팡이 끝의 좌표(엉덩이 기준). 길이는 자세 쪽에서 고정해 넘겨준다
        else:
            tip = (hd[0] + cn.get('off', (gy - hd[1]) * 0.12), gy - cn.get('lift', 0))   # off: 지팡이 끝의 앞(+)뒤(-) 위치, lift: 바닥에서 든 높이
        limb(d, hd, tip, 7, col['cane'])
        d.ellipse([hd[0] - 6, hd[1] - 10, hd[0] + 8, hd[1] + 2], fill=col['cane'])
    arm(P['narm'], col['narm'])


CW, CH, BASE = 720, 576, 548


def render(P, kind, lift=0, dx=0, size=(CW, CH)):
    """한 칸 그림(흰 바탕). 바닥에 닿는 가장 낮은 점이 BASE 에 오도록 놓는다(공중이면 lift 만큼 띄운다). 엉덩이 x 는 칸 가운데 + dx"""
    big = Image.new('RGBA', (1600, 1600), (0, 0, 0, 0))
    draw(ImageDraw.Draw(big), P, kind, 800, 800)
    bb = big.getbbox()
    cell = Image.new('RGB', size, 'white')
    y = BASE - lift - (bb[3] - 800)
    tmp = Image.new('RGBA', size, (0, 0, 0, 0))
    tmp.paste(big, (size[0] // 2 + dx - 800, int(y) - 800), big)
    cell.paste(tmp, (0, 0), tmp)
    return cell
