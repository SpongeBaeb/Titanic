#!/usr/bin/env python3
"""부품 인형(컷아웃) 걷기 시제품: 중절모 남자.

지금은 따로 그린 부품 그림이 없어서, 서 있는 그림(group A 의 86번 시트) 한 장을 잘라 부품을 만든다:
  몸통+머리+외투(팔 자리는 주변 외투 색으로 메움) / 위팔 / 아래팔+손 / 정강이 둘 / 발 둘.
허벅지는 외투에 거의 가려지므로 바지 색의 굵은 막대로 그린다. 먼 쪽 팔다리는 같은 부품을 어둡게.
외투 아래자락은 허벅지를 따라 행(가로줄)마다 조금씩 밀려 흔들린다(조금 늦게).
움직임은 gait_model(정상 보행 관절 곡선) + 걸음 성격(profile).
출력: tools/work/q6walk_check/rig_bowler.mp4 (게임 화면 크기, 갑판 위) / rig_bowler_zoom.mp4 (크게)
"""
import math
import os
import subprocess
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import gait_model as G  # noqa: E402

CHECK = os.path.join(ROOT, 'tools', 'work', 'q6walk_check')

# ── 걸음 성격 (사람마다 다르게) ─────────────────────────────
PROFILES = {
    # 바쁜 사무원: 빠르고, 몸을 조금 앞으로 숙이고, 팔은 짧게 흔든다
    'clerk': dict(cycle_s=0.98, stride=1.0, hip=1.0, knee=1.0, arm=0.7, elbow=1.0, lean=6.0, bob=1.0, speed=0.62),
    # 점잖은 신사: 느리고 꼿꼿하게, 보폭은 길게
    'gentleman': dict(cycle_s=1.25, stride=1.08, hip=1.08, knee=0.9, arm=0.55, elbow=0.6, lean=0.0, bob=0.8, speed=0.5),
}


def landmarks(w, h):
    """서 있는 그림에서 관절 위치 (원본 그림 기준 px). 격자를 보고 정한 비율"""
    P = lambda x, y: (x * w / 100.0, y * h / 100.0)  # noqa: E731
    return dict(shoulder=P(40, 24), elbow=P(46, 42), hand=P(44, 61), hip=P(45, 50), knee_n=P(30, 71), knee_f=P(60, 71),
                ankle_n=P(30, 94), ankle_f=P(68, 94), hem=0.74 * h, leg_split=0.47 * w)


def cut_parts(src):
    h, w = src.shape[:2]
    L = landmarks(w, h)
    poly = lambda pts: np.array([[int(x * w / 100), int(y * h / 100)] for x, y in pts], np.int32)  # noqa: E731
    arm_mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(arm_mask, [poly([(22, 24), (44, 22), (51, 30), (53, 45), (54, 55), (53, 64), (35, 64), (31, 52), (25, 40), (20, 30)])], 255)
    arm_mask &= (src[..., 3] > 0).astype(np.uint8) * 255
    # 몸통: 다리(밑단 아래)와 팔을 뺀 것. 팔 자리는 주변 외투로 메운다
    body = src.copy()
    body[int(L['hem']) + 2:, :, 3] = 0
    hole = arm_mask.copy()
    body[..., :3] = cv2.inpaint(np.ascontiguousarray(body[..., :3]), cv2.dilate(hole, np.ones((5, 5), np.uint8)), 7, cv2.INPAINT_TELEA)
    # 팔: 팔꿈치 높이에서 위팔 / 아래팔+손으로 나눈다
    arm = src.copy(); arm[..., 3] = np.where(arm_mask > 0, src[..., 3], 0)
    ey = int(L['elbow'][1])
    upper = arm.copy(); upper[ey + 4:, :, 3] = 0           # 4px 겹쳐 이음매를 가린다
    lower = arm.copy(); lower[:ey - 4, :, 3] = 0
    # 다리: 밑단 아래를 가운데에서 둘로, 발목 높이에서 정강이 / 발로
    legs = src.copy(); legs[:int(L['hem']) - 2, :, 3] = 0
    ay = int(L['ankle_n'][1])
    xs = int(L['leg_split'])

    def side(x0, x1):
        p = legs.copy(); p[:, :x0, 3] = 0; p[:, x1:, 3] = 0
        shin = p.copy(); shin[ay + 3:, :, 3] = 0
        foot = p.copy(); foot[:ay - 6, :, 3] = 0
        return shin, foot
    shin_n, foot_n = side(0, xs + 2)
    shin_f, foot_f = side(xs - 2, w)
    # 정강이 위쪽(무릎~밑단)은 외투에 가려 그림이 없다 → 맨 윗줄 바지를 위로 늘여 채운다
    def extend_up(shin, knee_y):
        top = int(L['hem']) - 1
        rows = np.where(shin[..., 3].max(axis=1) > 0)[0]
        if len(rows) == 0:
            return shin
        r0 = rows[0] + 2
        for yy in range(int(knee_y) - 6, r0):
            shin[yy] = shin[r0]
        return shin
    shin_n = extend_up(shin_n, L['knee_n'][1])
    shin_f = extend_up(shin_f, L['knee_f'][1])
    trouser = np.median(src[int(L['hem']) + 6:int(L['hem']) + 30][src[int(L['hem']) + 6:int(L['hem']) + 30, :, 3] > 200][:, :3], axis=0)
    return dict(body=body, upper=upper, lower=lower, shin_n=shin_n, foot_n=foot_n, shin_f=shin_f, foot_f=foot_f, L=L, trouser=trouser)


def darken(im, k=0.55):
    o = im.copy(); o[..., :3] = (o[..., :3].astype(np.float32) * k).astype(np.uint8); return o


def paste_affine(canvas, piece, pivot, target, angle_deg, scale=1.0):
    """piece 를 pivot 기준으로 angle(앞(+x)으로 기울면 +) 만큼 돌려 target 에 놓는다 (알파 합성)"""
    a = math.radians(angle_deg)
    R = np.array([[math.cos(a), math.sin(a)], [-math.sin(a), math.cos(a)]]) * scale
    t = np.array(target) - R @ np.array(pivot)
    M = np.hstack([R, t[:, None]]).astype(np.float32)
    H, W = canvas.shape[:2]
    warped = cv2.warpAffine(piece, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    al = warped[..., 3:4].astype(np.float32) / 255
    canvas[..., :3] = (warped[..., :3] * al + canvas[..., :3] * (1 - al)).astype(np.uint8)
    canvas[..., 3] = np.maximum(canvas[..., 3], warped[..., 3])


def shear_coat(body, L, swing, hip_y):
    """외투 아래자락: 엉덩이 아래 줄부터 밑단까지 점점 더 옆으로 민다 (swing: 밑단에서 민 거리 px)"""
    out = body.copy()
    y0 = int(hip_y); y1 = int(L['hem']) + 2
    for y in range(y0, min(y1 + 1, body.shape[0])):
        k = ((y - y0) / max(1, y1 - y0)) ** 1.4
        dx = swing * k
        M = np.float32([[1, 0, dx], [0, 1, 0]])
        out[y:y + 1] = cv2.warpAffine(body[y:y + 1], M, (body.shape[1], 1), borderValue=(0, 0, 0, 0))
    return out


def thigh(canvas, hip, knee, width, color, alpha=255):
    pts = cv2.ellipse2Poly((0, 0), (1, 1), 0, 0, 360, 10)
    _ = pts
    c = tuple(int(v) for v in color) + (alpha,)
    cv2.line(canvas, tuple(int(v) for v in hip), tuple(int(v) for v in knee), c, int(width), cv2.LINE_AA)


def render_frame(parts, prof, p, size=(320, 560), scale=1.0):
    L = parts['L']
    H0 = G.H
    pose = G.pose_profile(p, prof)
    W, Hc = size
    canvas = np.zeros((Hc, W, 4), np.uint8)
    # 화면에서 엉덩이 위치: 바닥선 위 (다리 길이 + 오르내림)
    floor_y = Hc - 14
    lows = []
    if p < G.STANCE_END:
        lows += [pose['right'][2][1], pose['right'][3][1]]
    if (p + 0.5) % 1 < G.STANCE_END:
        lows += [pose['left'][2][1], pose['left'][3][1]]
    hip_s = (W * 0.42, floor_y - max(lows) * scale)
    S = lambda q: (hip_s[0] + q[0] * scale, hip_s[1] + q[1] * scale)  # noqa: E731
    k = scale * H0 / (L['hip'][1] / 0.5) * 1.0   # 원본 그림 1px 의 화면 크기 (원본 키 = 엉덩이 높이 / 0.5)
    trouser = parts['trouser']
    # 1) 먼 쪽 팔 (어둡게)
    sh = S(pose['sh'])
    def arm(A, dark):
        el, wr, hd = (S(q) for q in A)
        up = math.degrees(math.atan2(el[0] - sh[0], el[1] - sh[1]))
        lo = math.degrees(math.atan2(wr[0] - el[0], wr[1] - el[1]))
        rest_up = math.degrees(math.atan2(L['elbow'][0] - L['shoulder'][0], L['elbow'][1] - L['shoulder'][1]))
        u = parts['upper']; lw = parts['lower']
        if dark:
            u, lw = darken(u), darken(lw)
        su = G.UPPER_ARM * scale / math.dist(L['shoulder'], L['elbow'])
        sl = (G.FOREARM + G.HAND) * scale / math.dist(L['elbow'], L['hand'])
        paste_affine(canvas, u, L['shoulder'], sh, up - rest_up, su)
        paste_affine(canvas, lw, L['elbow'], el, lo - rest_up, sl)
    arm(pose['r_arm'], True)
    # 2) 다리: 먼 쪽(오른다리) → 가까운 쪽(왼다리). 허벅지는 바지 막대, 정강이·발은 그림
    def leg(Lg, shin, foot, knee_src, ankle_src, dark):
        knee, ankle, heel, toe = (S(q) for q in Lg)
        col = trouser * (0.55 if dark else 1.0)
        thigh(canvas, S(pose['hip']), knee, 30 * scale, col)
        sa = math.degrees(math.atan2(ankle[0] - knee[0], ankle[1] - knee[1]))
        rest = math.degrees(math.atan2(ankle_src[0] - knee_src[0], ankle_src[1] - knee_src[1]))
        if dark:
            shin, foot = darken(shin), darken(foot)
        ss = G.SHIN * scale / math.dist(knee_src, ankle_src)
        paste_affine(canvas, shin, knee_src, knee, sa - rest, ss)
        fa = math.degrees(math.atan2(-(toe[1] - heel[1]), toe[0] - heel[0]))  # 발이 바닥과 이루는 각 (앞꿈치가 들리면 +)
        paste_affine(canvas, foot, ankle_src, ankle, fa, k)
    leg(pose['right'], parts['shin_f'], parts['foot_f'], L['knee_f'], L['ankle_f'], True)
    leg(pose['left'], parts['shin_n'], parts['foot_n'], L['knee_n'], L['ankle_n'], False)
    # 3) 몸통+외투: 외투 자락은 두 허벅지의 평균 방향을 조금 늦게 따라간다
    pl = G.pose_profile((p - 0.08) % 1, prof)
    avg_knee_x = (pl['right'][0][0] + pl['left'][0][0]) / 2
    swing = avg_knee_x * 0.55 / k
    body = shear_coat(parts['body'], L, swing, L['hip'][1])
    paste_affine(canvas, body, L['hip'], S(pose['hip']), -prof['lean'] * 0.5, k)
    # 4) 가까운 팔
    arm(pose['l_arm'], False)
    return canvas


def main():
    src = cv2.imread(os.path.join(CHECK, 'bowler_src.png'), cv2.IMREAD_UNCHANGED)
    parts = cut_parts(src)
    prof = PROFILES['clerk']
    fps = 30
    n = int(prof['cycle_s'] * fps)
    tr, stride = G.timed_cycle(n, profile=prof)
    # (A) 크게: 카메라가 따라감, 바닥 눈금이 흐른다
    big = []
    for i in range(n * 4):
        p, _, x, _ = tr[i % n]
        fr = render_frame(parts, prof, p, size=(360, 560), scale=1.0)
        bg = np.full((560, 360, 3), (32, 24, 20), np.uint8)
        wx = (i // n) * stride + x
        for t in range(-2, 8):
            tx = int((t * 80 - wx) % 440) - 40
            cv2.line(bg, (tx, 548), (tx, 558), (70, 60, 52), 2)
        cv2.line(bg, (0, 547), (360, 547), (60, 50, 44), 2)
        al = fr[..., 3:4] / 255.0
        bright = np.clip(fr[..., :3].astype(np.float32) * 1.9, 0, 255)
        big.append((bright * al + bg * (1 - al)).astype(np.uint8))
    # (B) 게임 화면: 갑판 배경 위, 게임 크기
    deck = cv2.imread(os.path.join(ROOT, 'frontend', 'public', 'bg', 'rumor_q6.webp'))
    crop = deck[300:820, 260:1660]
    view = cv2.resize(crop, (960, int(crop.shape[0] * 960 / crop.shape[1])))
    sc = 960 / crop.shape[1]
    game = []
    for y_world, x0, spd_k in ((760, 300, 1.0), (640, 900, 0.92)):
        pass
    walkers = [(760, 0.0), (650, 520.0)]
    for i in range(fps * 6):
        im = view.copy()
        for y_world, x0 in walkers:
            hpx = max(36, 0.49 * y_world - 170) * sc
            kk = hpx / G.H
            t = i / fps
            dist_model = prof['speed'] * G.H * t        # 모델 단위 이동 거리
            ph = (dist_model / stride) % 1.0
            idx = int(ph * n) % n
            p = tr[idx][0]
            fr = render_frame(parts, prof, p, size=(int(360 * kk) + 4, int(560 * kk) + 4), scale=kk)
            sx = int((x0 + dist_model * kk) % (960 + 200) - 100)
            sy = int((y_world - 300) * sc - fr.shape[0] + 14 * kk)
            h_, w_ = fr.shape[:2]
            x1, y1 = max(0, sx), max(0, sy)
            x2, y2 = min(960, sx + w_), min(im.shape[0], sy + h_)
            if x2 <= x1 or y2 <= y1:
                continue
            sub = fr[y1 - sy:y2 - sy, x1 - sx:x2 - sx]
            al = sub[..., 3:4] / 255.0
            im[y1:y2, x1:x2] = (sub[..., :3] * al + im[y1:y2, x1:x2] * (1 - al)).astype(np.uint8)
        game.append(im)

    def write(frames, path):
        h, w = frames[0].shape[:2]
        tmp = path + '.raw.mp4'
        vw = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h))
        for f in frames:
            vw.write(f)
        vw.release()
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                        '-c:v', 'libx264', '-crf', '20', '-movflags', '+faststart', path], check=True)
        os.remove(tmp)
        print('saved', path)
    write(big, os.path.join(CHECK, 'rig_bowler_zoom.mp4'))
    write(game, os.path.join(CHECK, 'rig_bowler.mp4'))


if __name__ == '__main__':
    main()
