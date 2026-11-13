#!/usr/bin/env python3
"""숙녀 레퍼런스(긴 치마 + 챙 넓은 모자 + 쪽머리): 여성스러운 걸음 4프레임 + 넘어짐·버티기·일어나기 + 단일 자세 6장.
자세 도구(gent_pose_kit)를 STYLE='lady' 로 쓴다. 신사와 같은 몸 치수, 걸음은 보폭을 줄이고 팔꿈치를 굽혀 몸에 붙이고 상체를 곧게 세운다.
출력 tools/work/lady_ref/: walk_{tone,parts,black}_row.png, 동작별 줄(F B K U V), poses6_*.png, walk_black.gif, 확인용 시트
"""
import os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gait_model as G
import gent_pose_kit as K
import build_gentleman_poses as BP
import build_q6_gentref as GR

K.STYLE = 'lady'
G.BOB = 0.006
PROF = dict(hip=0.95, knee=1.05, arm=1.15, elbow=1.9, lean=-3)  # 여성스러운 걸음: 작은 걸음, 굽힌 팔꿈치, 곧은 상체
OUT = os.path.join(HERE, 'work', 'lady_ref'); os.makedirs(OUT, exist_ok=True)
BP.OUT = OUT
NAMES = ['1 착지', '2 내려앉음', '3 지나감', '4 솟음']
W, H = K.CW, K.CH


# 칸마다 팔 모양을 다르게 (윤곽만 보여도 네 칸이 구별되게): (가까운 팔(어깨각, 팔꿈치굽힘), 먼 팔(어깨각, 팔꿈치굽힘))
# (차분하게: 흔들림 ±24도 안팎) 1 착지: 두 팔이 가장 크게 벌어짐 / 2 내려앉음: 앞팔이 조금 낮아지며 모임 / 3 지나감: 팔이 몸에 모이고 앞팔만 허리 앞에 / 4 솟음: 반대로 벌어지기 시작
ARMS = [
    ((24, 30), (-22, 10)),
    ((15, 36), (-13, 12)),
    ((4, 40), (-4, 18)),
    ((-19, 14), (10, 34)),
]


def lady_arms(P, i):
    sh = P['sh']
    (na, ne), (fa, fe) = ARMS[i]
    P['narm'], P['farm'] = K.arm_fk(sh, na, ne), K.arm_fk(sh, fa, fe)
    return P


def walk_poses():
    tr, stride = G.timed_cycle(8, profile=PROF)
    return [lady_arms(GR.from_gait(pose), i) for i, (p, pose, _, _) in enumerate(tr[:4])], stride


def main():
    poses, stride = walk_poses()
    for kind in ('tone', 'parts', 'black'):
        row = Image.new('RGB', (W * 4, H), 'white'); lab = row.copy(); d = ImageDraw.Draw(lab)
        for i, P in enumerate(poses):
            im = K.render(P, kind)
            row.paste(im, (i * W, 0)); lab.paste(im, (i * W, 0)); d.text((i * W + 16, 10), NAMES[i], fill=(200, 50, 40), font=BP.font(30))
            im.save(os.path.join(OUT, f'walk{i}_{kind}.png'))
        row.save(os.path.join(OUT, f'walk_{kind}_row.png')); lab.resize((W * 2, H // 2)).save(os.path.join(OUT, f'walk_{kind}_labeled.png'))
    # 걷기 GIF (검은 실루엣, 한 걸음 4칸 반복)
    fr = [K.render(P, 'black').crop((120, 0, 600, H)).resize((240, 288), Image.LANCZOS) for P in poses]
    fr[0].save(os.path.join(OUT, 'walk_black.gif'), save_all=True, append_images=fr[1:], duration=140, loop=0)
    BP.main(('tone', 'parts', 'black'))
    # 단일 자세 6장
    want = [('F2 쏠림', '앞으로 넘어지는 중'), ('F4 엎드림', '엎드려 쓰러짐'), ('B2 허공', '뒤로 넘어지는 중'), ('B4 드러누움', '누워 쓰러짐'), ('K2 휘청', '휘청, 버팀'), ('U4 한 무릎 세움', '일어나는 중')]
    allf = {lb: (P, l) for _, frs in BP.SEQ for lb, P, l in frs}
    for kind in ('tone', 'parts', 'black'):
        g = Image.new('RGB', (W * 3, H * 2), 'white'); lab = g.copy(); d = ImageDraw.Draw(lab)
        for i, (lb, nm) in enumerate(want):
            P, l = allf[lb]; im = K.render(P, kind, l)
            x, y = (i % 3) * W, (i // 3) * H
            g.paste(im, (x, y)); lab.paste(im, (x, y)); d.text((x + 16, y + 10), f'{i + 1} {nm}', fill=(200, 50, 40), font=BP.font(32))
        g.save(os.path.join(OUT, f'poses6_{kind}.png')); lab.resize((W * 3 // 2, H)).save(os.path.join(OUT, f'poses6_{kind}_labeled.png'))
    print('ok', 'stride', round(stride, 1))


if __name__ == '__main__':
    main()
