#!/usr/bin/env python3
"""어린이 걸음 레퍼런스 (성별 무관, 한 가지 모션을 모두가 쓴다): 4프레임(착지, 내려앉음, 지나감, 솟음) 반복.
옷: 짧은 재킷, 무릎까지 오는 반바지와 긴 양말, 부츠, 챙 짧은 둥근 모자. 체형: 머리가 크고 다리·몸통이 짧다.
걸음: 신사보다 몸이 많이 통통 튀고, 팔을 자유롭게 크게 흔들며, 상체는 곧다. 자세 도구(gent_pose_kit)를 STYLE='child' 로 쓴다.
출력 tools/work/child_ref/: walk_{tone,parts,black}_row.png (2880x576, 글자 없음), walk_*_labeled.png, walk_black.gif
"""
import math, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gait_model as G
import gent_pose_kit as K
import build_gentleman_poses as BP
import build_q6_gentref as GR

H = 470.0
DIMS = dict(THIGH=0.215 * H, SHIN=0.215 * H, TORSO=0.27 * H, NECK=0.03 * H, HEAD_R=0.072 * H,  # 머리 높이가 키의 약 17%(어린이~청소년 평균). 예전 0.098 은 약 22%로 너무 컸다
             UPPER_ARM=0.16 * H, FOREARM=0.125 * H,
            HAND=0.04 * H, ANKLE_H=0.034 * H, HEEL_BACK=0.04 * H, TOE_FWD=0.1 * H)
for k, v in DIMS.items():
    setattr(G, k, v)
K.TH, K.SH, K.TOR, K.NK, K.HR, K.UA, K.FA, K.HD = G.THIGH, G.SHIN, G.TORSO, G.NECK, G.HEAD_R, G.UPPER_ARM, G.FOREARM, G.HAND
K.STYLE = 'child'
G.BOB = 0.02  # 어린이는 통통 튄다
PROF = dict(hip=1.05, knee=1.1, arm=1.6, elbow=1.1, lean=-1)
# 칸마다 팔 모양을 다르게 (윤곽만 보여도 구별되게), 어른보다 자유롭게 크게: (가까운 팔(어깨각, 팔꿈치굽힘), 먼 팔(어깨각, 팔꿈치굽힘))
ARMS = [
    ((40, 22), (-36, 10)),
    ((24, 28), (-20, 14)),
    ((6, 30), (-4, 20)),
    ((-34, 14), (20, 28)),
]
OUT = os.path.join(HERE, 'work', 'child_ref'); os.makedirs(OUT, exist_ok=True)
NAMES = ['1 착지', '2 내려앉음', '3 지나감', '4 솟음']
W, HH = K.CW, K.CH


def walk_poses():
    tr, stride = G.timed_cycle(8, profile=PROF)
    out = []
    for i, (p, pose, _, _) in enumerate(tr[:4]):
        P = GR.from_gait(pose)
        (na, ne), (fa, fe) = ARMS[i]
        P['narm'], P['farm'] = K.arm_fk(P['sh'], na, ne), K.arm_fk(P['sh'], fa, fe)
        out.append(P)
    return out, stride


def main():
    poses, stride = walk_poses()
    for kind in ('tone', 'parts', 'black'):
        row = Image.new('RGB', (W * 4, HH), 'white'); lab = row.copy(); d = ImageDraw.Draw(lab)
        for i, P in enumerate(poses):
            im = K.render(P, kind)
            row.paste(im, (i * W, 0)); lab.paste(im, (i * W, 0)); d.text((i * W + 16, 10), NAMES[i], fill=(200, 50, 40), font=BP.font(30))
        row.save(os.path.join(OUT, f'walk_{kind}_row.png')); lab.resize((W * 2, HH // 2)).save(os.path.join(OUT, f'walk_{kind}_labeled.png'))
    fr = [K.render(P, 'black').crop((120, 0, 600, HH)).resize((240, 288), Image.LANCZOS) for P in poses]
    fr[0].save(os.path.join(OUT, 'walk_black.gif'), save_all=True, append_images=fr[1:], duration=120, loop=0)
    print('ok stride', round(stride, 1))


if __name__ == '__main__':
    main()
