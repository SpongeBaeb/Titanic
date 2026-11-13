#!/usr/bin/env python3
"""노인 걸음 레퍼런스 (남성, 여성): 4프레임(착지, 내려앉음, 지나감, 솟음) 반복.
남성: 중산모, 짧은 흰 수염, 외투, 굽은 등, 지팡이. 여성: 보닛과 쪽머리, 숄, 긴 치마, 굽은 등, 숄을 여민 손.
걸음: 보폭이 아주 작고 발을 끌듯 낮게 옮기며, 상체와 머리가 앞으로 숙여지고, 몸의 오르내림이 거의 없고, 팔 흔들림이 작다.
출력 tools/work/elder_ref/{male,female}/: walk_{tone,parts,black}_row.png (2880x576, 글자 없음), walk_*_labeled.png, walk_black.gif
사용: python -I build_elder_ref.py [male|female|both]
"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gait_model as G
import gent_pose_kit as K
import build_q6_gentref as GR

NAMES = ['1 착지', '2 내려앉음', '3 지나감', '4 솟음']
W, H = K.CW, K.CH
G.BOB = 0.004

CFG = {
    'male': dict(style='gent', opts={'beard', 'stoop'}, cane=True, prof=dict(hip=0.7, knee=0.85, arm=0.5, elbow=1.0, lean=0), stoop=(8, 16), legs=(5, 0.8, 12, 0.5),
                 # 가까운 팔은 지팡이를 짚어 거의 고정, 먼 팔만 작게 흔든다
                 arms=[((20, 36), (-9, 12)), ((12, 40), (-4, 14)), ((2, 44), (1, 16)), ((15, 38), (-4, 14))],
                 # 지팡이(길이 고정): 앞에 짚음 -> 몸이 지나가며 곧게 -> 몸 뒤로 밀림(바닥에 박힌 채) -> 들려서 휘둘러지는 중간(몸 아래를 지나 앞으로). 땅에 닿은 끝의 세계 위치 30 -> 약 100 -> 150 으로 고르게 이어진다 (기울기 도(앞 +), 든 높이 px). 한 칸에 끝이 뒤로 밀리는 거리 = 지팡이길이 x sin(8도) = 약 30px
                 cane_seq=[(8.0, 0), (0.0, 0), (-8.0, 0), (5.0, 16)]),
    'female': dict(style='lady', opts={'bonnet', 'shawl', 'stoop'}, cane=False, prof=dict(hip=0.6, knee=0.8, arm=1.0, elbow=0.5, lean=0), stoop=(5, 11), legs=(4, 0.75, 12, 0.45), scratch=dict(legs=(0, 1.0, 6, 0.8)), cycle=True,
                   # 두 팔을 한 칸에 14도씩 고르게(28, 14, 0, -14, 다음 반 걸음은 좌우가 바뀌어 -28부터) 흔든다. 칸마다 변화량이 같아야 팔딱거려 보이지 않는다.(실루엣에서 둘 다 보이도록). 가까운 팔: 앞 -> 몸 옆 -> 뒤, 먼 팔: 뒤 -> 몸 옆 -> 앞. 4칸에서 1칸으로 이어질 때 좌우가 바뀐다
                   arms=[((28, 8), (-28, 2)), ((14, 5), (-14, 2)), ((0, 3), (0, 3)), ((-14, 2), (14, 5))]),
}


def font(sz):
    return ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', sz)


def stoop(P, lean, head_extra):
    """등과 목이 굽은 자세: 몸통을 lean 도 앞으로 기울이고 머리는 그보다 더 숙인다"""
    l = math.radians(lean)
    P['lean'] = lean
    P['sh'] = (K.TOR * math.sin(l), -K.TOR * math.cos(l))
    nl = math.radians(lean + head_extra * 0.6)
    P['neck'] = (P['sh'][0] + K.NK * math.sin(nl), P['sh'][1] - K.NK * math.cos(nl))
    h = math.radians(lean + head_extra)
    P['head'] = lean + head_extra
    P['hc'] = (P['neck'][0] + K.HR * math.sin(h), P['neck'][1] - K.HR * math.cos(h))
    return P


def soften_legs(P, abase, ascale, kbase, kscale):
    """노인의 하체: 걸음 곡선의 각도를 줄이고(보폭 작게, 발을 낮게 끈다) 무릎과 엉덩이를 늘 살짝 굽힌다.
    허벅지각 a' = abase + ascale*a, 무릎굽힘 k' = kbase + kscale*k, 발목은 정강이에 대한 원래 각도를 유지한다"""
    for key in ('near', 'far'):
        L = P[key]
        kn, an = L['knee'], L['ankle']
        a = math.degrees(math.atan2(kn[0], kn[1]))
        b = math.degrees(math.atan2(an[0] - kn[0], an[1] - kn[1]))
        k = a - b
        c = math.degrees(math.atan2(-L['fwd'][1], L['fwd'][0]))
        P[key] = K.leg_fk((0.0, 0.0), abase + ascale * a, kbase + kscale * k, c - b)
    return P


# 노인 남성 다리(직접 설계): 한 칸에 몸이 나아가는 거리 30px(한 걸음 = 4칸 = 120px)와 지팡이에 맞춰,
# 딛은 발은 한 칸에 정확히 30px 뒤로 물러나고(미끄러지지 않는다) 뗀 발은 낮게 끌며 앞으로 나온다. 무릎은 늘 굽혀 있고, 엉덩이는 6px 오르내린다.
# 4칸 반복에서 왼발·오른발이 바뀌므로 4번 칸의 앞발(+45, 들림)은 1번 칸의 앞발(+60), 뒤발(-30)은 1번 칸의 뒤발(-60)로 이어진다.
HIP_H = [238, 243, 246, 243]  # 엉덩이 높이(바닥 위). 다리 길이(허벅지+정강이)가 231px 이므로 딛은 다리의 무릎이 15~20도 굽는 높이다
LEG_MALE = {
    # 먼 다리: 1번 칸에 앞에 착지(발끝 들림) -> 딛은 채 물러남 -> 4번 칸에 뒤꿈치가 들리기 시작
    'far': dict(x=[60, 30, 0, -30], lift=[0, 0, 0, 0], c=[16, 0, 0, -8]),
    # 가까운 다리: 1번 칸에 뒤에서 밀고 -> 떼어 끌며 -> 몸 밑을 지나(발끝 살짝 들림) -> 앞으로 나와 착지 준비
    'near': dict(x=[-60, -35, 5, 45], lift=[0, 22, 32, 14], c=[-22, -5, 5, 18]),
}


# 노인 여성 다리: 남성과 같은 방식(딛은 발은 칸마다 같은 거리만 물러난다)이고 걸음은 13% 더 작다(한 칸 26px, 한 걸음 104px)
LEG_FEMALE = {
    'far': dict(x=[62, 31, 0, -31], lift=[0, 0, 0, 0], c=[16, 0, 0, -8]),
    'near': dict(x=[-62, -36, 4, 47], lift=[0, 20, 30, 14], c=[-22, -5, 5, 18]),
}
LEGS = {'male': LEG_MALE, 'female': LEG_FEMALE}


def hand_leg(spec, i, hh=None):
    """발목 목표(엉덩이 기준 x, 높이)와 발 각도를 정하면 IK 로 허벅지·무릎을 구한다"""
    target = (spec['x'][i], (HIP_H[i] if hh is None else hh) - (G.ANKLE_H + spec['lift'][i]))
    a1, a2 = K.ik2((0.0, 0.0), target, K.TH, K.SH, 1)
    return K.leg_fk((0.0, 0.0), a1, a1 - a2, spec['c'][i] - a2)


CANE_L = 215.0   # 지팡이 길이(설계 px, 키 470 의 0.46배): 모든 칸에서 같다
CANE_HX = 62.0   # 손의 앞쪽 위치(엉덩이 기준)


def cane_arm(P, theta_deg, lift):
    """지팡이를 고정 길이로 짚는 팔: 끝이 바닥(또는 lift 만큼 위)에 닿고 기울기가 theta 가 되도록 손 위치를 정하고, 팔을 IK 로 맞춘다"""
    g = max(max(L['heel'][1], L['toe'][1]) for L in (P['near'], P['far'])) + 5   # 바닥 높이(엉덩이 기준 y)
    th = math.radians(theta_deg)
    hand = (CANE_HX, g - lift - CANE_L * math.cos(th))
    sh = P['sh']
    a1, _ = K.ik2(sh, hand, K.UA, K.FA + K.HD, -1)
    el = (sh[0] + K.UA * math.sin(math.radians(a1)), sh[1] + K.UA * math.cos(math.radians(a1)))
    v = (hand[0] - el[0], hand[1] - el[1]); m = math.hypot(*v) or 1
    wr = (el[0] + v[0] / m * K.FA, el[1] + v[1] / m * K.FA)
    P['narm'] = dict(el=el, wr=wr, hd=hand)
    P['cane'] = {'tip': (hand[0] + CANE_L * math.sin(th), hand[1] + CANE_L * math.cos(th))}
    return P


# 표준 4키 걷기(접촉 - 지나감 - 반대편 접촉 - 지나감)를 노인 여성 비율로 직접 만든다.
# 접촉: 앞발 뒤꿈치 착지(발끝 듦), 뒷발은 발끝으로 밀며 뒤꿈치 듦. 지나감: 딛은 발은 몸 밑에 평평히, 반대 발은 무릎을 굽혀 들고 지나감.
# 팔은 다리와 반대로 크게 흔들되 팔꿈치를 굽힌다(앞으로 가는 팔은 많이, 뒤로 가는 팔은 조금). 칸 사이 변화가 사인 곡선처럼 고르다(-A, 0, +A, 0).
CYC_S = 44.0          # 접촉 때 발 사이 반 보폭(px). 노인이라 작게
CYC_LEGS = dict(
    near=dict(x=[CYC_S, 4, -CYC_S, 14], lift=[0, 0, 0, 26], c=[16, 0, -22, -10]),
    far=dict(x=[-CYC_S, 14, CYC_S, 4], lift=[0, 26, 0, 0], c=[-22, -10, 16, 0]),
)
CYC_ARMS = dict(near=[(-20, 12), (-2, 18), (20, 36), (2, 18)], far=[(20, 36), (2, 18), (-20, 12), (-2, 18)])


def walk_poses_cycle(who):
    c = CFG[who]
    tr, stride = G.timed_cycle(8, profile=c['prof'])
    out = []
    for i, (p, pose, _, _) in enumerate(tr[:4]):
        P = stoop(GR.from_gait(pose), *c['stoop'])
        P['near'], P['far'] = hand_leg(CYC_LEGS['near'], i, 243), hand_leg(CYC_LEGS['far'], i, 243)
        P['narm'] = K.arm_fk(P['sh'], *CYC_ARMS['near'][i])
        P['farm'] = K.arm_fk(P['sh'], *CYC_ARMS['far'][i])
        out.append(P)
    return out, stride


def walk_poses(who):
    c = CFG[who]
    if c.get('cycle'):
        return walk_poses_cycle(who)
    tr, stride = G.timed_cycle(8, profile=c['prof'])
    out = []
    for i, (p, pose, _, _) in enumerate(tr[:4]):
        P = stoop(GR.from_gait(pose), *c['stoop'])
        if c.get('scratch'):
            # 처음부터 다시: 걸음 곡선(gait_model)의 다리와 팔을 그대로 쓰고 진폭만 줄인다(손으로 지정한 칸별 값이 없어 칸 사이 변화가 곡선처럼 고르다)
            soften_legs(P, *c['scratch']['legs'])
            out.append(P)
            continue
        P['near'], P['far'] = hand_leg(LEGS[who]['near'], i), hand_leg(LEGS[who]['far'], i)
        (na, ne), (fa, fe) = c['arms'][i]
        P['narm'], P['farm'] = K.arm_fk(P['sh'], na, ne), K.arm_fk(P['sh'], fa, fe)
        if c['cane']:
            th, lift = c['cane_seq'][i]
            cane_arm(P, th, lift)
        out.append(P)
    return out, stride


def elder_stand(who):
    """노인이 멈춰 선 자세: 발을 모으고(무릎은 살짝 굽힘), 굽은 등과 숙인 머리는 그대로. 남성은 지팡이를 곧게 짚고, 여성은 손을 배 앞에 모은다"""
    c = CFG[who]
    tr, _ = G.timed_cycle(8, profile=c['prof'])
    P = stoop(GR.from_gait(tr[1][1]), *c['stoop'])
    P['far'] = hand_leg(dict(x=[9], lift=[0], c=[0]), 0, 243)
    P['near'] = hand_leg(dict(x=[-9], lift=[0], c=[0]), 0, 243)
    if who == 'male':
        P['farm'] = K.arm_fk(P['sh'], -4, 14)
        cane_arm(P, 0.0, 0)
    else:
        P['narm'], P['farm'] = K.arm_fk(P['sh'], 8, 50), K.arm_fk(P['sh'], -4, 16)
    return P


def build(who):
    c = CFG[who]
    K.STYLE, K.OPTS = c['style'], set(c['opts'])
    out_dir = os.path.join(HERE, 'work', 'elder_ref', who); os.makedirs(out_dir, exist_ok=True)
    poses, stride = walk_poses(who)
    for kind in ('tone', 'parts', 'black'):
        row = Image.new('RGB', (W * 4, H), 'white'); lab = row.copy(); d = ImageDraw.Draw(lab)
        for i, P in enumerate(poses):
            im = K.render(P, kind)
            row.paste(im, (i * W, 0)); lab.paste(im, (i * W, 0)); d.text((i * W + 16, 10), NAMES[i], fill=(200, 50, 40), font=font(30))
        row.save(os.path.join(out_dir, f'walk_{kind}_row.png')); lab.resize((W * 2, H // 2)).save(os.path.join(out_dir, f'walk_{kind}_labeled.png'))
    fr = [K.render(P, 'black').crop((100, 0, 620, H)).resize((260, 288), Image.LANCZOS) for P in poses]
    fr[0].save(os.path.join(out_dir, 'walk_black.gif'), save_all=True, append_images=fr[1:], duration=170, loop=0)
    print(who, 'ok stride', round(stride, 1))


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'both'
    for w in (('male', 'female') if which == 'both' else (which,)):
        build(w)
