#!/usr/bin/env python3
"""새 걷기 모델(gait_model.py) 확인용 움직이는 그림.
왼쪽: 카메라가 따라가며 바닥 눈금이 뒤로 흐른다 (게임에서 보이는 모습). 오른쪽: 고정 카메라, 사람이 화면을 가로질러 걷는다.
출력: tools/work/q6walk_check/gait_walk.gif, gait_walk_skirt.gif
"""
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_walk_pose_ref as R  # noqa: E402  (그리기 함수)
import gait_model as G  # noqa: E402

OUT = os.path.join(os.path.dirname(HERE), 'tools', 'work', 'q6walk_check')
FPS = 24
CYCLE_S = 1.1   # 두 걸음 1.1초 (보통 걸음: 1초에 약 1.8걸음)
BOB_KEEP = 1.0  # 골반 기울기를 바로잡은 뒤로는 오르내림이 키의 약 1.3% 로 자연스러워 그대로 쓴다


def clamp_feet(P, floor):
    Q = dict(P)
    for side in ('right', 'left'):
        knee, ankle, heel, toe = P[side]
        Q[side] = (knee, ankle, (heel[0], min(heel[1], floor)), (toe[0], min(toe[1], floor)))
    return Q


def lift(P, dy):
    """몸 전체를 위아래로 옮긴다 (발은 바닥에 맞춰 clamp 한다)"""
    def mv(q):
        return (q[0], q[1] + dy)
    Q = {}
    for k, v in P.items():
        if k in ('right', 'left', 'r_arm', 'l_arm'):
            Q[k] = tuple(mv(q) for q in v)
        else:
            Q[k] = mv(v)
    return Q


def frame(p, P, hy, mean_hy, skirt, ox):
    # 엉덩이 높이 오르내림을 줄이고, 바닥을 뚫는 발은 바닥에 맞춘다
    floor = -hy
    target_floor = -(mean_hy + (hy - mean_hy) * BOB_KEEP)
    Q = lift(P, target_floor - floor)
    Q = clamp_feet(Q, target_floor)
    sub = Image.new('RGB', (R.CW, R.CH), (255, 255, 255))
    d = ImageDraw.Draw(sub)
    # draw_figure 는 가장 낮은 점을 바닥선에 맞추므로, 디딘 발이 바닥선에 오고 몸이 그 위에서 오르내린다
    R.draw_figure(d, Q, ox, skirt=skirt, t=p)
    return sub, d


def make(path, skirt):
    n = int(FPS * CYCLE_S)
    tr, stride = G.timed_cycle(n)
    hys = [t[3] for t in tr]
    mean_hy = sum(hys) / len(hys)
    px_per = stride / n
    frames = []
    for k in range(n * 3):
        p, P, x, hy = tr[k % n]
        wx = (k // n) * stride + x  # 세계에서 엉덩이 위치
        # 왼쪽: 카메라가 따라감 (바닥 눈금이 흐른다)
        a, da = frame(p, P, hy, mean_hy, skirt, R.CW // 2 - 10)
        for t in range(-2, 12):
            tx = (t * 90 - wx) % (R.CW + 90) - 45
            da.line([(tx, R.BASE + 2), (tx, R.BASE + 14)], fill=(150, 150, 150), width=3)
        da.line([(0, R.BASE + 2), (R.CW, R.BASE + 2)], fill=(190, 190, 190), width=2)
        # 오른쪽: 고정 카메라 (사람이 지나간다)
        span = R.CW + 160
        sx = (wx * 0.5) % span - 80
        b, db = frame(p, P, hy, mean_hy, skirt, int(sx))
        db.line([(0, R.BASE + 2), (R.CW, R.BASE + 2)], fill=(190, 190, 190), width=2)
        a = a.resize((R.CW // 2, R.CH // 2), Image.LANCZOS)
        b = b.resize((R.CW // 2, R.CH // 2), Image.LANCZOS)
        c = Image.new('RGB', (a.width * 2 + 12, a.height + 22), (255, 255, 255))
        c.paste(a, (0, 22)); c.paste(b, (a.width + 12, 22))
        dd = ImageDraw.Draw(c)
        dd.text((8, 4), 'camera follows (game view)', fill=(80, 80, 80))
        dd.text((a.width + 20, 4), 'fixed camera', fill=(80, 80, 80))
        frames.append(c)
        _ = px_per
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=int(1000 / FPS), loop=0)
    print('saved', path, 'stride/H', round(stride / G.H, 2))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    make(os.path.join(OUT, 'gait_walk.gif'), False)
    make(os.path.join(OUT, 'gait_walk_skirt.gif'), True)
