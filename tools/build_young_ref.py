#!/usr/bin/env python3
"""청년(18~29세) 걸음 레퍼런스, 남성·여성: 4프레임(착지, 내려앉음, 지나감, 솟음) 반복.
남성: 납작모자, 허벅지 중간까지 오는 짧은 재킷, 바지. 힘차고 팔을 크게 흔든다.
여성: 올림머리(모자 없음), 블라우스와 재킷, 폭이 좁은 긴 치마. 중년 숙녀보다 걸음이 조금 경쾌하다.
출력 tools/work/young_ref/{male,female}/: walk_{tone,parts,black}_row.png (2880x576, 글자 없음), walk_*_labeled.png, walk_black.gif
사용: python -I build_young_ref.py [male|female|both]
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gait_model as G
import gent_pose_kit as K
import build_q6_gentref as GR

NAMES = ['1 착지', '2 내려앉음', '3 지나감', '4 솟음']
W, H = K.CW, K.CH

CFG = {
    'male': dict(style='gent', opts={'jacket', 'flatcap'}, bob=0.014, prof=dict(hip=1.15, knee=1.15, arm=1.5, elbow=1.3, lean=-1),
                 # 힘찬 걸음: 팔을 크게 흔들고 칸마다 모양이 다르다 (가까운 팔, 먼 팔)
                 arms=[((38, 24), (-34, 10)), ((22, 30), (-18, 14)), ((4, 34), (-4, 20)), ((-30, 14), (18, 30))]),
    'female': dict(style='lady', opts={'updo', 'slim'}, bob=0.01, prof=dict(hip=1.0, knee=1.05, arm=1.15, elbow=1.9, lean=-3),
                   arms=[((28, 30), (-26, 10)), ((18, 36), (-15, 12)), ((4, 40), (-4, 18)), ((-22, 14), (12, 34))]),
}


def font(sz):
    return ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', sz)


def walk_poses(who):
    c = CFG[who]
    G.BOB = c['bob']
    tr, stride = G.timed_cycle(8, profile=c['prof'])
    out = []
    for i, (p, pose, _, _) in enumerate(tr[:4]):
        P = GR.from_gait(pose)
        (na, ne), (fa, fe) = c['arms'][i]
        P['narm'], P['farm'] = K.arm_fk(P['sh'], na, ne), K.arm_fk(P['sh'], fa, fe)
        out.append(P)
    return out, stride


def build(who):
    c = CFG[who]
    K.STYLE, K.OPTS = c['style'], set(c['opts'])
    out_dir = os.path.join(HERE, 'work', 'young_ref', who); os.makedirs(out_dir, exist_ok=True)
    poses, stride = walk_poses(who)
    for kind in ('tone', 'parts', 'black'):
        row = Image.new('RGB', (W * 4, H), 'white'); lab = row.copy(); d = ImageDraw.Draw(lab)
        for i, P in enumerate(poses):
            im = K.render(P, kind)
            row.paste(im, (i * W, 0)); lab.paste(im, (i * W, 0)); d.text((i * W + 16, 10), NAMES[i], fill=(200, 50, 40), font=font(30))
        row.save(os.path.join(out_dir, f'walk_{kind}_row.png')); lab.resize((W * 2, H // 2)).save(os.path.join(out_dir, f'walk_{kind}_labeled.png'))
    fr = [K.render(P, 'black').crop((100, 0, 620, H)).resize((260, 288), Image.LANCZOS) for P in poses]
    fr[0].save(os.path.join(out_dir, 'walk_black.gif'), save_all=True, append_images=fr[1:], duration=130, loop=0)
    print(who, 'ok stride', round(stride, 1))


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'both'
    for w in (('male', 'female') if which == 'both' else (which,)):
        build(w)
