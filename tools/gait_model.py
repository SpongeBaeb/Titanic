#!/usr/bin/env python3
"""자연스러운 걷기 동작 모델 (마네킹용).

관절 각도는 정상 보행의 시상면 각도 곡선(Winter, Perry 등 보행 생체역학 교과서의 평균 곡선)을 요약한 값이다:
  - 엉덩이: 뒤꿈치 착지 때 약 +30도(앞으로 굽힘), 걸음 주기 55% 무렵 약 -10도(뒤로 폄), 흔드는 다리에서 다시 +30도
  - 무릎: 착지 직후 15~20도 굽혀 충격을 받고, 서 있는 동안 거의 펴졌다가, 발을 뗀 뒤 흔들 때 약 60도까지 굽힘
  - 발목: 착지 직후 발바닥이 바닥으로 내려가고(-5도), 서 있는 동안 +10도까지 발등 쪽으로, 발을 떼는 순간(약 60%) -18도로 밀어냄
  - 팔: 반대쪽 다리와 함께 앞뒤로 약 ±20도, 팔꿈치는 걸음마다 약 30도 범위에서 굽혔다 폈다 (Kang 외 2023)
점과 점 사이는 '주기 스플라인'으로 이어서 어느 관절도 중간에 멈칫하지 않는다 (예전 마네킹이 뚝딱거린 원인).
발은 뒤꿈치 → 발바닥 → 앞꿈치 순서로 바닥을 구르고, 몸은 바닥에 디딘 발을 축으로 앞으로 나아간다(제자리걸음 아님).
"""
import math

import numpy as np
from scipy.interpolate import CubicSpline

# (걸음 주기 %, 각도) — 0% = 오른발 뒤꿈치 착지, 약 62% = 오른발 앞꿈치가 땅에서 떨어짐
_HIP = [(0, 30), (10, 27), (20, 19), (30, 10), (40, 1), (50, -7), (55, -10), (60, -6), (65, 2), (70, 11),
        (75, 19), (80, 25), (85, 30), (90, 32), (95, 31), (100, 30)]
_KNEE = [(0, 5), (5, 12), (10, 17), (15, 19), (20, 16), (25, 11), (30, 7), (35, 5), (40, 4), (45, 6), (50, 11),
         (55, 22), (60, 36), (65, 54), (70, 63), (73, 65), (77, 60), (80, 50), (85, 35), (90, 18), (95, 7), (100, 5)]
# 흔드는 동안(70~90%)에는 발끝을 들어(발등 쪽으로) 바닥에 걸리지 않게 한다
_ANKLE = [(0, 0), (4, -5), (8, -4), (12, 0), (20, 5), (30, 8), (40, 10), (46, 11), (50, 7), (55, -3), (60, -14),
          (63, -18), (66, -12), (70, -2), (75, 4), (80, 5), (88, 3), (95, 1), (100, 0)]


def _spline(pts):
    x = np.array([p[0] for p in pts], float) / 100.0
    y = np.array([p[1] for p in pts], float)
    y[-1] = y[0]
    return CubicSpline(x, y, bc_type='periodic')


# 실제 사람은 골반도 앞뒤로 돌아 보폭이 엉덩이 각도만으로 계산한 것보다 길다(두 걸음에 키의 약 0.75~0.8배). 평면 마네킹에서는 엉덩이 각도를 조금 키워 대신한다
# (예전: 엉덩이 각도를 1.18배 키움 → 앞발이 착지 때 바닥에 닿지 않아 빼고, 아래 골반 기울기로 바로잡는다)
PELVIC_TILT = 9.0  # 보행 자료의 엉덩이 각도는 골반 기준이다. 골반이 앞으로 약 9~10도 기울어 있어 허벅지의 실제 세로 기준 각도는 그만큼 작다
HIP, KNEE, ANKLE = _spline(_HIP), _spline(_KNEE), _spline(_ANKLE)
STANCE_END = 0.62  # 주기 중 발이 땅에 붙어 있는 구간 (0 ~ 62%)
BOB = 0.012       # 몸의 오르내림 (키에 대한 비율, 위아래 끝 사이). 차분한 산책 걸음, 발이 바닥에 가장 잘 붙는 값
BOB_PHASE = 0.13  # 가장 낮은 순간: 착지 직후 몸이 충격을 받아 내려앉는 때 (주기의 13% 늦게)

# 몸 치수 (키 H 에 대한 비율, 사람 몸 비율 표준값을 단순화)
H = 470.0
THIGH = 0.245 * H
SHIN = 0.246 * H
ANKLE_H = 0.039 * H      # 발목 높이
HEEL_BACK = 0.04 * H     # 발목에서 뒤꿈치까지
TOE_FWD = 0.115 * H      # 발목에서 앞꿈치까지
TORSO = 0.30 * H
NECK = 0.03 * H
HEAD_R = 0.064 * H
UPPER_ARM = 0.186 * H
FOREARM = 0.146 * H
HAND = 0.05 * H


def _rot(v, deg):
    a = math.radians(deg)
    return (v[0] * math.cos(a) - v[1] * math.sin(a), v[0] * math.sin(a) + v[1] * math.cos(a))


def leg(hip, p, hipk=1.0, kneek=1.0):
    """p: 이 다리의 주기 위치(0=이 다리 뒤꿈치 착지). 화면 좌표(오른쪽 +x, 아래 +y), 오른쪽을 보고 걷는다"""
    p %= 1.0
    a = math.radians(float(HIP(p)) * hipk - PELVIC_TILT)
    knee = (hip[0] + THIGH * math.sin(a), hip[1] + THIGH * math.cos(a))
    b = a - math.radians(float(KNEE(p)) * kneek)          # 정강이 방향 (무릎이 굽으면 뒤로)
    ankle = (knee[0] + SHIN * math.sin(b), knee[1] + SHIN * math.cos(b))
    # 발: 정강이에 수직인 방향을 기준으로 발목 각도만큼 돌린다
    c = b + math.radians(float(ANKLE(p)))
    fwd = (math.cos(c), -math.sin(c))             # 발끝 방향
    down = (math.sin(c), math.cos(c))             # 발바닥 방향
    heel = (ankle[0] - fwd[0] * HEEL_BACK + down[0] * ANKLE_H, ankle[1] - fwd[1] * HEEL_BACK + down[1] * ANKLE_H)
    toe = (ankle[0] + fwd[0] * TOE_FWD + down[0] * ANKLE_H, ankle[1] + fwd[1] * TOE_FWD + down[1] * ANKLE_H)
    return knee, ankle, heel, toe


def arm(shoulder, flex, elbow):
    """flex: 어깨를 앞으로 든 각도(+앞), elbow: 팔꿈치 굽힘"""
    a = math.radians(flex)
    el = (shoulder[0] + UPPER_ARM * math.sin(a), shoulder[1] + UPPER_ARM * math.cos(a))
    b = a + math.radians(elbow)
    wr = (el[0] + FOREARM * math.sin(b), el[1] + FOREARM * math.cos(b))
    hd = (wr[0] + HAND * math.sin(b), wr[1] + HAND * math.cos(b))
    return el, wr, hd


def pose(p, prof=None):
    """p: 오른발 착지 기준 주기 위치. 엉덩이(0,0) 기준 점들. 바닥 높이 맞추기와 앞으로 나아가기는 walk_track 이 한다"""
    pr = prof or {}
    hipk, kneek = pr.get('hip', 1.0), pr.get('knee', 1.0)
    armk, elbk = pr.get('arm', 1.0), pr.get('elbow', 1.0)
    hip = (0.0, 0.0)
    lean = math.radians(3 + pr.get('lean', 0.0))
    sh = (TORSO * math.sin(lean), -TORSO * math.cos(lean))
    neck = (sh[0] + NECK * math.sin(lean), sh[1] - NECK * math.cos(lean))
    head = (neck[0] + 3, neck[1] - HEAD_R)
    right = leg(hip, p, hipk, kneek)
    left = leg(hip, p + 0.5, hipk, kneek)
    # 팔: 반대쪽 다리가 앞에 있을 때 앞으로. 다리보다 주기의 약 5% 늦게 따라온다. 앞으로 갈수록 팔꿈치가 더 굽는다
    lag = 0.05
    l_ph = math.cos(2 * math.pi * (p - lag))        # 왼팔: 오른다리와 함께 (p=0 무렵 앞)
    r_ph = math.cos(2 * math.pi * (p - lag + 0.5))
    l_arm = arm(sh, -4 + 20 * armk * l_ph, (16 + 14 * (0.5 + 0.5 * l_ph)) * elbk)
    r_arm = arm(sh, -4 + 20 * armk * r_ph, (16 + 14 * (0.5 + 0.5 * r_ph)) * elbk)
    return dict(hip=hip, sh=sh, neck=neck, head=head, right=right, left=left, r_arm=r_arm, l_arm=l_arm)


def walk_track(n_frames, cycles=2.0, prof=None):
    """주기를 n_frames 로 나눠, 디딘 발(가장 낮은 점)이 바닥에서 미끄러지지 않게 몸의 위치를 구한다.
    돌려주는 것: [(p, pose, 엉덩이 세계 x, 엉덩이 세계 y)], 바닥은 y=0, 위가 -y"""
    out = []
    anchor_key = None
    anchor_x = 0.0
    hip_x = 0.0
    for i in range(n_frames):
        p = (i / n_frames * cycles) % 1.0
        P = pose(p, prof)
        pts = {}
        # 땅을 딛고 있는 다리(자기 주기 0~62%)의 뒤꿈치·앞꿈치만 바닥에 닿을 수 있다 (흔드는 발은 아무리 낮아도 축이 아니다)
        if p < STANCE_END:
            pts[('R', 'heel')] = P['right'][2]; pts[('R', 'toe')] = P['right'][3]
        if (p + 0.5) % 1.0 < STANCE_END:
            pts[('L', 'heel')] = P['left'][2]; pts[('L', 'toe')] = P['left'][3]
        key = max(pts, key=lambda k: pts[k][1])          # 가장 낮은 점이 바닥에 닿아 있다
        low_y = pts[key][1]
        if anchor_key is None:
            anchor_key = key
            anchor_x = pts[key][0]
            hip_x = 0.0
        elif key != anchor_key:
            # 디딘 점이 바뀌는 순간: 새 점의 지금 세계 위치를 고정점으로 (앞 프레임의 엉덩이 위치로 계산)
            anchor_x = hip_x + pts[key][0]
            anchor_key = key
        hip_x = anchor_x - pts[key][0]
        out.append((p, P, hip_x, -low_y))
    return out


def timed_cycle(n_frames, warp=0.85, profile=None):
    """한 주기(두 걸음)를 n_frames 장으로: 몸이 일정한 속도로 나아가면서 디딘 발은 바닥에 고정되도록 시간을 다시 맞춘다.
    (관절 곡선만으로는 착지 직후 몸이 거의 멈췄다가 몰아서 나아가 뚝딱거린다.
     디딘 발 기준으로 몸이 실제 나아간 거리 x(p)를 구하고, 같은 시간마다 같은 거리를 가도록 p 를 고른다)
    돌려주는 것: [(p, pose, 엉덩이 x(일정 속도), 엉덩이 높이)], 그리고 한 주기에 나아가는 거리"""
    M = 4000
    tr = walk_track(M * 2, 2.0, profile)[M:]            # 둘째 주기 (시작 순간의 영향 제거)
    xs = np.array([t[2] for t in tr]); xs -= xs[0]
    ps = np.array([t[0] for t in tr])
    ps = np.where(np.arange(M) > M // 2, np.where(ps < 0.5, ps + 1.0, ps), ps)  # 0~1 이 이어지게
    stride = xs[-1] + (xs[-1] - xs[-2])
    xs = np.maximum.accumulate(xs)             # 혹시 모를 작은 뒤로 감 제거
    out = []
    for i in range(n_frames):
        target = stride * i / n_frames
        # warp=1 이면 발이 완전히 고정되지만 흔드는 다리가 구간에 따라 7배까지 빨라진다. 0.85 는 발 미끄러짐 키의 1.5% 로 타협
        p = ((1 - warp) * (i / n_frames) + warp * float(np.interp(target, xs, ps))) % 1.0
        P = pose(p, profile)
        lows = []
        if p < STANCE_END:
            lows += [P['right'][2][1], P['right'][3][1]]
        if (p + 0.5) % 1.0 < STANCE_END:
            lows += [P['left'][2][1], P['left'][3][1]]
        out.append((p, P, target, -max(lows)))
    # 엉덩이 높이: 디딘 점이 뒤꿈치→앞꿈치→다른 발로 바뀌는 순간마다 꺾여 '둠칫'거린다.
    # 실제 몸의 오르내림은 한 주기에 두 번 오르내리는 매끈한 물결이므로, 짝수 배 진동(2, 4번째)만 남겨 다듬는다
    # 실제 걸음에서 머리·엉덩이는 '한 걸음에 한 번' 매끈하게 오르내린다: 두 발이 다 닿은 착지 순간(주기 0, 0.5)이 가장 낮고,
    # 디딘 발 위로 몸이 지나가는 순간(0.25, 0.75)이 가장 높다. 예전처럼 4번째 진동까지 남기면 한 걸음에 두 번 '통통' 튄다.
    hy = np.array([t[3] for t in out]); n = len(hy)
    mean_h = -hy.mean()
    # 시간(프레임) 기준으로 고르게: 프레임 0 = 오른발 착지, 프레임 n/2 = 왼발 착지
    u = np.arange(n) / n
    smooth = -(mean_h - (BOB * H / 2) * np.cos(4 * np.pi * (u - BOB_PHASE)))
    out = [(p, P, x, float(smooth[i])) for i, (p, P, x, _) in enumerate(out)]
    return out, stride


def pose_profile(p, prof):
    """걸음 성격(profile)을 입힌 자세"""
    return pose(p, prof)
