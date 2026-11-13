#!/usr/bin/env python3
"""부품 인형 걷기: 중절모 남자 (부품 시트 tools/work/src/q6parts/bowler_parts.webp 사용).

부품: 몸통(머리·모자·외투, 그려져 있던 팔은 지우고 외투로 메움) · 위팔 · 아래팔+손 · 허벅지 · 정강이 · 구두.
놓는 법: 부품마다 두 관절 점(예: 위팔은 어깨·팔꿈치)을 정하고, 걷기 모델(gait_model)이 준 두 관절 위치에 맞춰
돌리고 늘인다(두 점 맞춤). 몸통은 엉덩이·어깨, 구두는 뒤꿈치·앞꿈치. 먼 쪽 팔다리는 같은 부품을 어둡게.
외투 아랫자락은 허벅지를 따라 조금 늦게 흔들린다.
출력: tools/work/q6walk_check/rig2_bowler_zoom.mp4, rig2_bowler.mp4 (갑판 위, 게임 크기)
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
import build_q6_walk as B  # noqa: E402  (흰 배경 지우기)
import gait_model as G  # noqa: E402

CHECK = os.path.join(ROOT, 'tools', 'work', 'q6walk_check')
SHEET = os.path.join(ROOT, 'tools', 'work', 'src', 'q6parts', 'bowler_parts.webp')

PROFILE = dict(cycle_s=0.98, hip=1.0, knee=1.0, arm=0.75, elbow=1.0, lean=5.0, speed=0.62)  # 바쁜 사무원


def load_parts():
    rgba = B.cutout(cv2.imread(SHEET))
    a = (rgba[..., 3] > 40).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(a, np.ones((7, 7), np.uint8)), 8)
    comps = sorted([(st[i, 0], st[i, 1], st[i, 2], st[i, 3], i) for i in range(1, n) if st[i, 4] > 800])
    names = ['body', 'upper', 'lower', 'thigh', 'shin', 'shoe', 'coat']
    P = {}
    for name, (x, y, w, h, i) in zip(names, comps):
        piece = rgba[y:y + h, x:x + w].copy()
        piece[..., 3] = np.where(lab[y:y + h, x:x + w] == i, piece[..., 3], 0)
        P[name] = piece
    # 몸통에 그려져 있던 팔(등 쪽 가장자리를 따라 내려온 소매)을 지우고 외투로 메운다
    body = P['body']; h, w = body.shape[:2]
    pct = lambda pts: np.array([[int(px * w / 100), int(py * h / 100)] for px, py in pts], np.int32)  # noqa: E731
    arm = np.zeros((h, w), np.uint8)
    cv2.fillPoly(arm, [pct([(17, 23), (46, 21), (54, 29), (54, 45), (53, 60), (51, 73), (22, 74), (16, 60), (14, 45), (15, 30)])], 255)
    arm &= (body[..., 3] > 0).astype(np.uint8) * 255
    # 메우기 전에 투명한 바깥의 색을 외투 색으로 바꿔 둔다 (그대로 두면 검정이 빨려 들어와 등에 검은 자국이 생긴다)
    solid = (body[..., 3] > 200) & (arm == 0)
    coat_col = np.median(body[..., :3][solid], axis=0)
    rgb = body[..., :3].copy(); rgb[body[..., 3] < 200] = coat_col
    hole = cv2.dilate(arm, np.ones((7, 7), np.uint8)) & (body[..., 3] > 0).astype(np.uint8) * 255
    filled = cv2.inpaint(np.ascontiguousarray(rgb), hole, 15, cv2.INPAINT_TELEA)
    # 메운 자리에 외투의 결(잔무늬)을 조금 되살린다: 근처 외투의 고주파 성분을 덧입힌다
    # 등 쪽 가장자리의 등불 빛(주황 테두리)을 메운 자리에도 다시 칠한다: 바깥에서 가까울수록 밝게
    edge_d = cv2.distanceTransform((body[..., 3] > 100).astype(np.uint8), cv2.DIST_L2, 5)
    below = body[int(0.74 * h):int(0.85 * h)]
    rim_px = below[..., :3][(below[..., 3] > 200) & (cv2.distanceTransform((below[..., 3] > 100).astype(np.uint8), cv2.DIST_L2, 5) < 4)]
    rim_col = np.percentile(rim_px.reshape(-1, 3), 80, axis=0) if len(rim_px) else np.array([60, 110, 190])
    rimw = np.exp(-edge_d / 5.0)[..., None] * 0.85
    # 외투의 잔결: 아래쪽 외투에서 고주파(밝기 차이)만 떼어 덧입힌다
    gray = cv2.cvtColor(np.ascontiguousarray(body[..., :3]), cv2.COLOR_BGR2GRAY).astype(np.float32)
    detail = gray - cv2.GaussianBlur(gray, (0, 0), 3)
    off = int(0.3 * h)
    tex = np.zeros_like(detail); tex[:h - off] = detail[off:]
    filled = np.clip(filled.astype(np.float32) * (1 - rimw) + rim_col * rimw + tex[..., None] * 0.8, 0, 255).astype(np.uint8)
    body[..., :3] = np.where(hole[..., None] > 0, filled, body[..., :3])
    # 부품(소매·바지)의 색을 몸통 외투의 색 분포에 맞춘다 (따로 그려져 조명이 달라 팔이 허옇게 떠 보인다)
    ref = body[..., :3][solid].astype(np.float32); rm, rs = ref.mean(0), ref.std(0) + 1e-3
    hand_keep = P['lower'].copy()
    for nm in ('upper', 'lower', 'thigh', 'shin'):
        pc = P[nm]; sel = pc[..., 3] > 200
        px = pc[..., :3].astype(np.float32); m, sd = px[sel].mean(0), px[sel].std(0) + 1e-3
        k = 1.0 if nm in ('upper', 'lower') else 0.85   # 바지는 외투보다 조금 어둡게
        pc[..., :3] = np.clip(((px - m) / sd * rs + rm) * k, 0, 255).astype(np.uint8)
        if nm == 'lower':
            # 손(살색)과 소매 끝 셔츠는 원래 색으로 되돌린다: 따뜻하고 밝은 색 = 피부
            hk = hand_keep[..., :3].astype(np.int32)
            skin = (hk[..., 2] > hk[..., 0] + 25) & (hk.max(axis=2) > 90)
            pc[..., :3] = np.where(skin[..., None], hand_keep[..., :3], pc[..., :3])
    J = {}
    J['body'] = dict(hip=(0.45 * w, 0.64 * h), shoulder=(0.35 * w, 0.27 * h), hem=0.99 * h)
    for nm in ('upper', 'lower', 'thigh', 'shin'):
        ph, pw = P[nm].shape[:2]
        r = pw * 0.45
        J[nm] = dict(a=(pw / 2, r), b=(pw / 2, ph - (r if nm != 'lower' else 4)))
    sh, sw = P['shoe'].shape[:2]
    J['shoe'] = dict(heel=(0.04 * sw, 0.96 * sh), toe=(0.98 * sw, 0.96 * sh), ankle=(0.25 * sw, 0.3 * sh))
    return P, J


def darken(im, k=0.5):
    o = im.copy(); o[..., :3] = (o[..., :3].astype(np.float32) * k).astype(np.uint8); return o


def place(canvas, piece, a, b, A, Bp):
    """두 점 맞춤: 부품의 점 a→화면 A, b→화면 B 가 되도록 돌리고 늘여서 합성"""
    va = np.array(b, float) - np.array(a, float)
    vA = np.array(Bp, float) - np.array(A, float)
    s = np.linalg.norm(vA) / max(1e-6, np.linalg.norm(va))
    ang = math.atan2(vA[1], vA[0]) - math.atan2(va[1], va[0])
    c, si = math.cos(ang) * s, math.sin(ang) * s
    R = np.array([[c, -si], [si, c]])
    t = np.array(A, float) - R @ np.array(a, float)
    M = np.hstack([R, t[:, None]]).astype(np.float32)
    H, W = canvas.shape[:2]
    wp = cv2.warpAffine(piece, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    al = wp[..., 3:4].astype(np.float32) / 255
    canvas[..., :3] = (wp[..., :3] * al + canvas[..., :3] * (1 - al)).astype(np.uint8)
    canvas[..., 3] = np.maximum(canvas[..., 3], wp[..., 3])


def shear_coat(body, hip_y, hem_y, swing):
    out = body.copy(); W = body.shape[1]
    y0, y1 = int(hip_y), int(hem_y)
    for y in range(y0, min(y1 + 1, body.shape[0])):
        k = ((y - y0) / max(1, y1 - y0)) ** 1.5
        M = np.float32([[1, 0, swing * k], [0, 1, 0]])
        out[y:y + 1] = cv2.warpAffine(body[y:y + 1], M, (W, 1), borderValue=(0, 0, 0, 0))
    return out


def render(P, J, tr_item, tr_prev, scale, size):
    p, pose, _, hy = tr_item
    W, Hc = size
    cv = np.zeros((Hc, W, 4), np.uint8)
    floor = Hc - 8 * scale - 2
    hip = (W * 0.45, floor + hy * scale)  # hy 는 엉덩이 기준 바닥까지의 거리에 - 를 붙인 값 (음수)
    S = lambda q: (hip[0] + q[0] * scale, hip[1] + q[1] * scale)  # noqa: E731
    sh = S(pose['sh'])

    def arm(A, dark):
        el, wr, hd = (S(q) for q in A)
        u, lw = (darken(P['upper']), darken(P['lower'])) if dark else (P['upper'], P['lower'])
        place(cv, u, J['upper']['a'], J['upper']['b'], sh, el)
        place(cv, lw, J['lower']['a'], J['lower']['b'], el, hd)

    def leg(Lg, dark):
        knee, ankle, heel, toe = (S(q) for q in Lg)
        th, sn, so = (darken(P['thigh']), darken(P['shin']), darken(P['shoe'])) if dark else (P['thigh'], P['shin'], P['shoe'])
        place(cv, th, J['thigh']['a'], J['thigh']['b'], hip, knee)
        place(cv, sn, J['shin']['a'], J['shin']['b'], knee, ankle)
        place(cv, so, J['shoe']['heel'], J['shoe']['toe'], heel, toe)

    arm(pose['r_arm'], True)
    leg(pose['right'], True)
    leg(pose['left'], False)
    # 외투 자락: 두 무릎의 평균 앞뒤 위치를 0.08 주기 늦게 따라간다 (몸통 그림 단위로 바꿔서)
    pl = tr_prev[1]
    avg = (pl['right'][0][0] + pl['left'][0][0]) / 2
    jb = J['body']
    body_scale = math.dist(jb['hip'], jb['shoulder']) / G.TORSO
    body = shear_coat(P['body'], jb['hip'][1], jb['hem'], avg * 0.5 * body_scale)
    place(cv, body, jb['hip'], jb['shoulder'], hip, sh)
    arm(pose['l_arm'], False)
    return cv


def main():
    P, J = load_parts()
    fps = 30
    n = int(PROFILE['cycle_s'] * fps)
    tr, stride = G.timed_cycle(n, profile=PROFILE)
    lag = max(1, int(0.08 * n))

    def frame_at(i, scale, size):
        return render(P, J, tr[i % n], tr[(i - lag) % n], scale, size)

    # (A) 크게 보기: 카메라가 따라간다
    big = []
    for i in range(n * 4):
        fr = frame_at(i, 1.0, (380, 520))
        bg = np.full((520, 380, 3), (30, 22, 18), np.uint8)
        wx = (i // n) * stride + tr[i % n][2]
        for t in range(-2, 9):
            tx = int((t * 80 - wx) % 460) - 40
            cv2.line(bg, (tx, 512), (tx, 519), (75, 62, 52), 2)
        al = fr[..., 3:4] / 255.0
        bright = np.clip(fr[..., :3].astype(np.float32) * 1.7, 0, 255)
        big.append((bright * al + bg * (1 - al)).astype(np.uint8))
    # (B) 게임 화면: 갑판 위
    deck = cv2.imread(os.path.join(ROOT, 'frontend', 'public', 'bg', 'rumor_q6.webp'))
    crop = deck[300:820, 260:1660]
    view = cv2.resize(crop, (960, int(crop.shape[0] * 960 / crop.shape[1])))
    sc = 960 / crop.shape[1]
    game = []
    for i in range(fps * 6):
        im = view.copy()
        for y_world, x0, dr in ((760, 80.0, 1), (640, 700.0, -1)):
            hpx = max(36, 0.49 * y_world - 170) * sc
            kk = hpx / G.H
            t = i / fps
            dist = PROFILE['speed'] * G.H * t
            idx = int((dist / stride) * n) % n
            fr = frame_at(idx, kk, (int(380 * kk) + 6, int(520 * kk) + 6))
            if dr < 0:
                fr = fr[:, ::-1]
            sx = int((x0 + dr * dist * kk) % (960 + 160) - 80 - fr.shape[1] * 0.45)
            sy = int((y_world - 300) * sc - fr.shape[0] + 8 * kk)
            h_, w_ = fr.shape[:2]
            x1, y1, x2, y2 = max(0, sx), max(0, sy), min(960, sx + w_), min(im.shape[0], sy + h_)
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
                        '-c:v', 'libx264', '-crf', '19', '-movflags', '+faststart', path], check=True)
        os.remove(tmp)
        print('saved', path)
    write(big, os.path.join(CHECK, 'rig2_bowler_zoom.mp4'))
    write(game, os.path.join(CHECK, 'rig2_bowler.mp4'))


if __name__ == '__main__':
    main()
