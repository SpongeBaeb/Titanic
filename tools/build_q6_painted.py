#!/usr/bin/env python3
"""그려 받은 인물 그림(걷기 4칸 / 기본 3칸 / 넘어짐 4칸)을 게임용 시트 11칸으로 만든다.
입력 tools/work/gen_plan/{번호}_{인물}/out/ 의 1_walk4.*, 2_basic3.*, 3_falls4.* (투명 배경 PNG/WebP, 칸 사이가 비어 있어야 한다)
출력 frontend/public/q6/walk/{이름}.webp, frontend/src/components/question/rumor/{이름}Sprites.ts, 확인용 tools/work/paint_check/{인물}/ (정렬 프레임, GIF)
사용: python -I build_q6_painted.py gent

크기: 그림 높이는 레퍼런스 칸 높이 576px 기준으로 환산한다(걷기·넘어짐 그림은 높이 400, 기본 3칸은 528). 그런 다음 게임 시트 배율(0.749, 신사 실루엣 시트와 같다)을 곱한다.
바닥: 칸마다 맨 아래를 바닥으로 삼고, 한 줄의 바닥선(중앙값)보다 높이 뜬 칸(공중)은 그만큼 아래를 비워 둔다.
x 기준점: 서 있는 칸은 몸통 가운데(윗몸 높이대의 25~75% 분위 가운데, 팔에 흔들리지 않는다), 누운 칸은 그림 가운데.
프레임 번호는 build_q6_gentref.py 의 11칸과 같다: stand 0, walk 1~4, stagger 5(휘청), F2 6, F4 7, B2 8, B4 9, U4 10.
"""
import hashlib
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WHO = {
    # 인물별 설정: 폴더, 시트 이름, 상수, ts 파일, 한 칸에 몸이 나아가는 거리(키 대비), 시트 배율, 모자 높이대(머리 위치 측정: 인물 높이에 대한 비율),
    # 서 있기 칸 몸통을 줄일 때 머리로 보는 윗부분 비율, 색 보정 기준(배경에 어울리는 기존 그림), 방향이 반대로 그려진 칸(넘어짐 줄 번호)
    'gent': dict(folder='1_gent', name='gentpaint', const='GENT_PAINT_SHEET', ts='gentPaintSprites.ts', walk_dist=0.1203, scale=0.749,
                 hat_band=(0.0, 0.07), head_frac=0.15, refs=['bowler.webp'], mirror_falls=(3,), compare_old=True),
    'lady': dict(folder='2_lady', name='ladypaint', const='LADY_PAINT_SHEET', ts='ladyPaintSprites.ts', walk_dist=0.0955, scale=0.723,
                 hat_band=(0.10, 0.17), head_frac=0.20, refs=['flowerhat.webp', 'updo.webp'], mirror_falls=(3,), compare_old=False,
                 grade=dict(strength=0.55)),   # 숙녀는 남색 재킷과 회색 치마의 색을 살리려고 색 보정을 약하게 한다
    'child': dict(folder='3_child', name='childpaint', const='CHILD_PAINT_SHEET', ts='childPaintSprites.ts', walk_dist=0.0956, scale=0.738,
                  hat_band=(0.0, 0.14), head_frac=0.22, refs=['bowler.webp'], mirror_falls=(3,), compare_old=False,
                  grade=dict(strength=0.55)),   # 어린이는 모자가 없어 머리카락 높이대로 머리 위치를 재고, 색 보정은 약하게 한다
    'elder_m': dict(folder='4_elder_m', name='oldmanpaint', const='OLDMAN_PAINT_SHEET', ts='oldManPaintSprites.ts', walk_dist=0.0611, scale=0.733,
                    hat_band=(0.0, 0.10), head_frac=0.16, refs=['bowler.webp'], mirror_falls=(3,), compare_old=False,
                    grade=dict(strength=0.55)),   # 노인 남성: 지팡이를 짚고 걷는다. 걸음 폭이 좁다
    'young_m': dict(folder='6_young_m', name='youngmanpaint', const='YOUNGMAN_PAINT_SHEET', ts='youngManPaintSprites.ts', walk_dist=0.1162, scale=0.673,
                    hat_band=(0.0, 0.10), head_frac=0.17, refs=['bowler.webp'], mirror_falls=(3,), compare_old=False,
                    grade=dict(strength=0.55)),   # 청년 남성: 캡 모자
    'elder_f': dict(folder='5_elder_f', name='oldwomanpaint', const='OLDWOMAN_PAINT_SHEET', ts='oldWomanPaintSprites.ts', walk_dist=0.0511, scale=0.712,
                    hat_band=(0.0, 0.12), head_frac=0.18, refs=['updo.webp'], mirror_falls=(3,), compare_old=False, skirt_match=True, cap_match=True,
                    grade=dict(strength=0.55)),   # 노인 여성: 숄과 쪽머리, 굽은 걸음
    'young_f': dict(folder='7_young_f', name='youngwomanpaint', const='YOUNGWOMAN_PAINT_SHEET', ts='youngWomanPaintSprites.ts', walk_dist=0.1, scale=0.69,
                    hat_band=(0.0, 0.14), head_frac=0.17, refs=['updo.webp'], mirror_falls=(3,), compare_old=False, skirt_match=True,
                    grade=dict(strength=0.55)),   # 청년 여성: 올림머리, 남색 재킷과 긴 치마
    'child_girl': dict(folder='8_child_girl', name='childgirlpaint', const='CHILDGIRL_PAINT_SHEET', ts='childGirlPaintSprites.ts', walk_dist=0.0956, scale=0.705,
                       hat_band=(0.0, 0.14), head_frac=0.22, refs=['bowler.webp'], mirror_falls=(3,), compare_old=False,
                       grade=dict(strength=0.55)),   # 어린 여자아이: 땋은 머리, 멜빵 원피스
}
CFG = WHO['gent']  # main 에서 인물에 맞게 바꾼다
REF_H = 576.0     # 레퍼런스 칸 높이
VARIANT = os.environ.get('PAINT_VARIANT', '')   # 'orig': 머리 위치 보정·색 보정을 끄고(처음 만든 방식) 미리보기만 만든다(시트 파일은 건드리지 않는다)
ANCHOR_BAND = (0.38, 0.58) if VARIANT == 'orig' else (0.20, 0.34)
PAD = 2


def find(d, stem):
    for ext in ('png', 'webp', 'PNG', 'WEBP'):
        p = os.path.join(d, f'{stem}.{ext}')
        if os.path.exists(p):
            return p
    raise FileNotFoundError(os.path.join(d, stem + '.*'))


def find_opt(d, stem):
    try:
        return find(d, stem)
    except FileNotFoundError:
        return None


ISO = {}


def cells(path, n, gap=25, thr=40):
    """투명 배경 그림에서 인물 n명의 상자(x0, y0, x1, y1)를 왼쪽부터 찾는다"""
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    m = a[..., 3] > thr
    xs = np.where(m.any(axis=0))[0]
    runs = []
    s = p = xs[0]
    for x in xs[1:]:
        if x - p > gap:
            runs.append((int(s), int(p)))
            s = x
        p = x
    runs.append((int(s), int(p)))
    runs = [r for r in runs if r[1] - r[0] > 15]
    if len(runs) != n:
        # 칸끼리 가로로 겹쳐(손·발끝) 열이 이어지면, 덩어리(연결 성분)를 가로 중심 위치로 n칸에 나누어 칸마다 따로 떼어 낸다
        W = im.size[0]
        k, lab, stats, cent = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
        groups = [[] for _ in range(n)]
        for i in range(1, k):
            if stats[i, cv2.CC_STAT_AREA] < 60:
                continue
            groups[min(n - 1, int(cent[i][0] / (W / n)))].append(i)
        assert all(groups), f'{path}: 덩어리로도 {n}칸을 나누지 못함 {[len(g) for g in groups]}'
        isos, boxes = [], []
        for g in groups:
            mk = np.isin(lab, g)
            ys = np.where(mk.any(axis=1))[0]; xs = np.where(mk.any(axis=0))[0]
            boxes.append((int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
            arr = a.copy(); arr[~mk] = 0
            isos.append(Image.fromarray(arr, 'RGBA'))
        ISO[path] = isos
        print('칸이 가로로 겹쳐 덩어리 기준으로 나눔:', os.path.basename(path), boxes)
        return im, m, boxes
    assert len(runs) == n, f'{path}: 인물 {len(runs)}명 (기대 {n})  {runs}'
    boxes = []
    for s, e in runs:
        ys = np.where(m[:, s:e + 1].any(axis=1))[0]
        boxes.append((s, int(ys.min()), e, int(ys.max())))
    return im, m, boxes


def resize_rgba(img, size):
    """가장자리가 어두워지지 않게 곱한 알파로 줄이고 늘린다"""
    a = np.array(img).astype(np.float32)
    al = a[..., 3:4] / 255.0
    pm = np.concatenate([a[..., :3] * al, a[..., 3:4]], axis=2)
    out = np.array(Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS)).astype(np.float32)
    al2 = np.clip(out[..., 3:4] / 255.0, 1e-4, 1)
    rgb = np.clip(out[..., :3] / al2, 0, 255)
    return Image.fromarray(np.concatenate([rgb, out[..., 3:4]], axis=2).astype(np.uint8), 'RGBA')


def anchor_x(m, box):
    x0, y0, x1, y1 = box
    w, h = x1 - x0 + 1, y1 - y0 + 1
    if w > 1.2 * h:  # 누운 그림은 가운데
        return (x0 + x1) / 2.0
    top = int(y0 + h * ANCHOR_BAND[0]); bot = int(y0 + h * ANCHOR_BAND[1])   # 기본은 가슴께(어깨 아래): 팔이 몸 가까이 있고 머리와 다리의 흔들림이 적다
    xs = np.where(m[top:bot, x0:x1 + 1])[1]
    if len(xs) == 0:
        return (x0 + x1) / 2.0
    return x0 + (np.percentile(xs, 25) + np.percentile(xs, 75)) / 2.0


def hat_x(m, box):
    x0, y0, x1, y1 = box
    h = y1 - y0 + 1
    lo, hi = CFG['hat_band']
    xs = np.where(m[int(y0 + h * lo):int(y0 + h * hi) + 1, x0:x1 + 1])[1]
    return x0 + (xs.mean() if len(xs) else (x1 - x0) / 2)


def shear_rows(arr, shifts):
    """행마다 가로로 shifts[r] 픽셀씩 민다(오른쪽 +). 투명으로 채운다"""
    out = np.zeros_like(arr)
    W = arr.shape[1]
    for r, sft in enumerate(shifts):
        sft = int(round(sft))
        if sft == 0:
            out[r] = arr[r]
        elif sft > 0:
            out[r, sft:] = arr[r, :W - sft]
        else:
            out[r, :W + sft] = arr[r, -sft:]
    return out


# ---- 장면에 어울리게 하는 색 보정 ----------------------------------------------------------------------------------
# 밤 갑판 배경에 이미 어울리는 기존 군중 그림(예전 신사 시트)의 Lab 색 분포(명도·색 평균과 퍼짐)에 맞추고, 왼쪽에서 비치는 따뜻한 가장자리 빛을 얹는다.
REF_DIR = os.path.join(ROOT, 'frontend', 'public', 'q6', 'walk')
GRADE = dict(strength=0.85, rim=0.55, rim_color=(255, 172, 96), rim_px=3)


def lab_pixels(img_rgba, amin=230):
    a = np.array(img_rgba)
    m = a[..., 3] >= amin
    rgb = a[..., :3][m].reshape(-1, 1, 3).astype(np.float32) / 255.0
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).reshape(-1, 3)


def lab_stats(imgs):
    px = np.concatenate([lab_pixels(i) for i in imgs])
    return px.mean(axis=0), px.std(axis=0)


def grade_frame(img, src_stats, ref_stats, strength, rim, rim_color, rim_px):
    a = np.array(img).astype(np.float32)
    alpha = a[..., 3] / 255.0
    rgb = (a[..., :3] / 255.0).astype(np.float32)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    (sm, ss), (rm, rs) = src_stats, ref_stats
    ratio = np.clip(rs / np.maximum(ss, 1e-3), 0.8, 2.0)           # 퍼짐 비율: 색이 폭주하지 않게 제한
    ratio[0] = np.clip(rs[0] / np.maximum(ss[0], 1e-3), 0.7, 1.3)  # 명도 대비는 크게 바꾸지 않는다
    tr = (lab - sm) * ratio + rm
    lab2 = lab * (1 - strength) + tr * strength
    lab2[..., 0] = np.clip(lab2[..., 0], 0, 100)
    out = cv2.cvtColor(lab2.astype(np.float32), cv2.COLOR_LAB2RGB)
    if rim > 0:
        # 광원은 오른쪽 뒤: 오른쪽(위) 윤곽에 빛이 맺힌다. 오른쪽 위 이웃의 알파를 빼서 그쪽 가장자리만 남긴 뒤 번지게 한다
        sh = np.roll(np.roll(alpha, -rim_px, axis=1), max(1, rim_px // 2), axis=0)
        edge = np.clip(alpha - cv2.GaussianBlur(sh, (0, 0), 1.0), 0, 1)
        edge = cv2.GaussianBlur(edge, (0, 0), 1.1) * alpha
        glow = np.array(rim_color, np.float32).reshape(1, 1, 3) / 255.0
        w = (rim * np.clip(edge * 1.6, 0, 1))[..., None]
        out = out * (1 - w) + glow * w
    res = np.concatenate([np.clip(out, 0, 1) * 255.0, a[..., 3:4]], axis=2).astype(np.uint8)
    return Image.fromarray(res, 'RGBA')


def grade_all(order):
    ref_stats = lab_stats([Image.open(os.path.join(REF_DIR, f)).convert('RGBA') for f in CFG['refs']])
    src_stats = lab_stats([fr['img'] for _, fr in order])
    for _, fr in order:
        fr['orig'] = fr['img']
        fr['img'] = grade_frame(fr['img'], src_stats, ref_stats, **dict(GRADE, **CFG.get('grade', {})))
    return src_stats, ref_stats


def squash_body(img, head_frac, ratio):
    """머리(위쪽 head_frac)는 그대로 두고 그 아래(몸통·다리)만 세로로 줄여 전체 키를 ratio 배로 만든다. 가로는 그대로."""
    w, h = img.size
    hh = max(1, int(round(h * head_frac)))
    new_h = int(round(h * ratio))
    body_h = max(1, new_h - hh)
    top = img.crop((0, 0, w, hh))
    body = resize_rgba(img.crop((0, hh, w, h)), (w, body_h))
    out = Image.new('RGBA', (w, hh + body_h), (0, 0, 0, 0))
    out.paste(top, (0, 0)); out.paste(body, (0, hh))
    return out


# ---- 칸별 그림자 -------------------------------------------------------------------------------------------------
# 광원은 오른쪽 뒤: 그림자는 왼쪽 앞(보는 사람 쪽)으로 떨어진다. 윤곽을 바닥에 눕혀(높이에 비례해 왼쪽·앞으로), 발밑(몸 아래 7%)은 납작하게 눌러 진한 접지 그림자를 더한다.
# 높은 부분일수록 흐리게, 공중에 뜬 칸은 몸이 바닥에서 떨어진 만큼 그림자도 떨어진다(칸 아래 끝이 바닥선).
# 인물이 왼쪽을 볼 때는 게임이 그림을 좌우로 뒤집는데, 그림자 방향까지 뒤집히면 광원이 어긋난다: 뒤집힌 인물의 그림자를 따로 만들어(rectsFlip) 방향을 고정한다.
SHADOW = dict(sx=0.30, sy=0.13, proj=0.55, blob=0.8, blur_proj=2.4, blur_blob=3.2, fade=0.6, pad=26, up=20, pad_b=22, cap=0.8)


def shadow_frame(img):
    a = np.array(img)[..., 3].astype(np.float32) / 255.0
    H, W = a.shape
    c = SHADOW
    dx = int(math.ceil(H * c['sx'])); below = int(math.ceil(H * c['sy'])) + c['pad_b']
    off = dx + c['pad']                                   # 그림자가 왼쪽으로 뻗는 만큼 왼쪽 여백
    Ws, Hs = W + dx + 2 * c['pad'], c['up'] + below
    rows = np.arange(H, dtype=np.float32)[:, None]
    a_fade = a * (1 - c['fade'] * (H - 1 - rows) / max(1, H - 1))
    M = np.float32([[1, c['sx'], off - c['sx'] * H], [0, -c['sy'], c['up'] + H * c['sy']]])   # x' = x - sx*(H-y) + off, y' = up + sy*(H-y)
    proj = cv2.warpAffine(a_fade, M, (Ws, Hs), flags=cv2.INTER_LINEAR, borderValue=0)
    nb = max(2, int(H * 0.07))
    foot = a.copy(); foot[:H - nb] = 0
    M2 = np.float32([[1, 0, off], [0, 0.30, c['up'] - 0.30 * H]])
    blob = cv2.warpAffine(foot, M2, (Ws, Hs), flags=cv2.INTER_LINEAR, borderValue=0)
    al = np.clip(c['proj'] * cv2.GaussianBlur(proj, (0, 0), c['blur_proj']) + c['blob'] * cv2.GaussianBlur(blob, (0, 0), c['blur_blob']), 0, c['cap'])
    out = np.zeros((Hs, Ws, 4), np.uint8)
    out[..., 3] = (al * 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA'), off, c['up']


def build_shadows(order):
    items, items_f = [], []
    for _, fr in order:
        img = fr['img']
        sim, off, up = shadow_frame(img)
        simf, offf, _ = shadow_frame(img.transpose(Image.FLIP_LEFT_RIGHT))
        fr['shadow'] = dict(img=sim, ax=fr['ax'] + off, up=up)
        fr['shadow_f'] = dict(img=simf, ax=(img.width - fr['ax']) + offf, up=up)
        items.append(fr['shadow']); items_f.append(fr['shadow_f'])
    Hm = max(i['img'].height for i in items)
    strip = Image.new('RGBA', (sum(i['img'].width for i in items) + 4 * len(items), Hm * 2), (0, 0, 0, 0))
    rects, rects_f, x = [], [], 0
    for i, fi in zip(items, items_f):
        strip.paste(i['img'], (x, 0)); strip.paste(fi['img'], (x, Hm))
        rects.append([x, 0, i['img'].width, i['img'].height, round(i['ax'], 1), i['up']])
        rects_f.append([x, Hm, fi['img'].width, fi['img'].height, round(fi['ax'], 1), fi['up']])
        x += i['img'].width + 4
    return strip, rects, rects_f


def defringe(img, erode=1, interior=2):
    """흰 배경에서 따라온 밝은 테두리를 없앤다: 알파를 erode 픽셀 깎고, 가장자리 색은 안쪽 몸 색으로 바꿔 채운다(밝은 흰 번짐이 어두운 배경에서 윤곽선처럼 보이지 않게)"""
    a = np.array(img).astype(np.float32)
    al = a[..., 3]
    solid = (al > 200).astype(np.uint8)
    k = np.ones((2 * interior + 1, 2 * interior + 1), np.uint8)
    inner = cv2.erode(solid, k).astype(np.float32)          # 확실히 몸 안쪽인 곳
    rgb = a[..., :3]
    for sig in (2.0, 5.0):                                    # 안쪽 색을 바깥으로 번지게 해 가장자리 색을 대신한다
        w = cv2.GaussianBlur(inner, (0, 0), sig)
        fill = cv2.GaussianBlur(rgb * inner[..., None], (0, 0), sig) / np.maximum(w[..., None], 1e-4)
        edge = (inner < 0.5) & (al > 0) & (w > 0.02)
        rgb = np.where(edge[..., None], fill, rgb)
    m = cv2.erode((al > 40).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=erode).astype(np.float32)
    al2 = np.minimum(al, cv2.GaussianBlur(m, (0, 0), 0.7) * 255)
    out = np.dstack([np.clip(rgb, 0, 255), al2]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def night_look(img, dim=0.62, blue=(0.80, 0.90, 1.05), desat=0.30, face=0.38, rim=0.75, rim_px=3, rim_color=(255, 178, 110)):
    """어두운 밤 장면용 군중 그림: 전체를 어둡게 하고 푸른 기를 입히며 채도를 낮추고, 살색(얼굴·손)은 더 어둡게 눌러 표정이 잘 안 보이게 한다"""
    a = np.array(img).astype(np.float32)
    rgb = a[..., :3]
    hsv = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    skin = ((hsv[..., 0] >= 2) & (hsv[..., 0] <= 24) & (hsv[..., 1] >= 35) & (hsv[..., 1] <= 190) & (hsv[..., 2] >= 90)).astype(np.float32)
    skin = cv2.GaussianBlur(skin, (0, 0), 1.5)[..., None]
    g = rgb.mean(axis=2, keepdims=True)
    rgb = rgb * (1 - desat) + g * desat
    rgb = rgb * np.array(blue, np.float32)[None, None, :] * dim
    rgb = rgb * (1 - skin * (1 - face))
    # 역광: 광원이 인물 뒤(오른쪽 위)에 있어 위·오른쪽 윤곽만 따뜻하게 빛난다(윤곽선 바깥쪽 rim_px 폭, 안쪽으로 부드럽게)
    if rim > 0:
        inside = (a[..., 3] > 128).astype(np.uint8)
        M = np.float32([[1, 0, -rim_px], [0, 1, rim_px]])      # dst(x, y) = src(x + rim_px, y - rim_px): 오른쪽 위 이웃
        up_right = cv2.warpAffine(inside, M, (inside.shape[1], inside.shape[0]), flags=cv2.INTER_NEAREST)
        edge = ((inside > 0) & (up_right == 0)).astype(np.float32)
        for dx, dy in ((rim_px, 0), (0, -rim_px)):             # 오른쪽, 위쪽 이웃도 비면 윤곽
            Mx = np.float32([[1, 0, -dx], [0, 1, -dy]])
            nb = cv2.warpAffine(inside, Mx, (inside.shape[1], inside.shape[0]), flags=cv2.INTER_NEAREST)
            edge = np.maximum(edge, ((inside > 0) & (nb == 0)).astype(np.float32))
        edge = cv2.GaussianBlur(edge, (0, 0), 1.2)[..., None] * rim
        rgb = rgb * (1 - edge) + np.array(rim_color, np.float32)[None, None, :] * edge
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a[..., 3]]).astype(np.uint8), 'RGBA')


def row_leans(path, n):
    im, m, boxes = cells(path, n)
    return [hat_x(m, b) - anchor_x(m, b) for b in boxes]


def process_row(path, n, game_scale, level_lean=False, lean_target=None, mirror=()):
    """level_lean: 걷기 줄에서 칸마다 달랐던 상체 기울기(머리와 가슴의 가로 거리)를 평균으로 맞춘다. 4칸을 반복할 때 머리가 앞뒤로 튀지 않게 한다"""
    im, m, boxes = cells(path, n)
    scale_img = im.size[1] / REF_H
    f = game_scale / scale_img
    bottoms = [b[3] for b in boxes]
    ground = float(np.median(bottoms))
    tol = 0.025 * im.size[1]
    lean = [hat_x(m, b) - anchor_x(m, b) for b in boxes]
    if lean_target is None:
        lean_target = float(np.mean(lean))
    out = []
    for k, (box, bt) in enumerate(zip(boxes, bottoms)):
        x0, y0, x1, y1 = box
        crop = (ISO[path][k] if path in ISO else im).crop((x0 - PAD, y0 - PAD, x1 + PAD + 1, y1 + 1))
        if k in mirror:  # 방향이 레퍼런스와 반대로 그려진 칸은 좌우로 뒤집는다
            crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
        arr = np.array(crop)
        if level_lean:
            d = lean_target - lean[k]
            P = int(abs(d)) + 4
            arr = np.pad(arr, ((0, 0), (P, P), (0, 0)))
            hh = arr.shape[0]
            fig_h = (hh - 1) - PAD                      # 인물 높이(맨 위 ~ 맨 아래)
            chest_hb = fig_h * (1 - 0.27)               # 바닥에서 가슴께까지 높이
            hat_hb = fig_h * (1 - 0.035)                # 바닥에서 모자까지 높이
            # 가슴께 아래(다리·몸통 아래)는 그대로 두고, 그 위로 올라갈수록 머리 쪽으로 밀어 머리-가슴 거리만 바꾼다
            shifts = [d * min(1.1, max(0.0, (((hh - 1) - r) - chest_hb) / (hat_hb - chest_hb))) for r in range(hh)]
            arr = shear_rows(arr, shifts)
        crop = Image.fromarray(arr, 'RGBA')
        m2 = arr[..., 3] > 40
        ys = np.where(m2.any(axis=1))[0]; xs = np.where(m2.any(axis=0))[0]
        box2 = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        ax = anchor_x(m2, box2)
        lift = 0 if abs(bt - ground) <= tol else max(0, int(round(ground - bt)))  # 공중에 뜬 칸만 아래를 비운다
        if lift:
            ext = Image.new('RGBA', (crop.width, crop.height + lift), (0, 0, 0, 0))
            ext.paste(crop, (0, 0))
            crop = ext
        w2, h2 = max(1, round(crop.width * f)), max(1, round(crop.height * f))
        out.append(dict(img=defringe(resize_rgba(crop, (w2, h2))), ax=ax * f, lift=lift * f, head=(hat_x(m2, box2) - ax) * f))
    return out


def match_garment(frames, ref_frame, shawl_band=(0.26, 0.46), skirt_band=(0.58, 0.90), blend=(0.44, 0.58)):
    """걷기 칸의 숄(위)과 치마(아래) 색을 기준 칸(서 있는 칸)의 색으로 맞춘다. 각 띠에서 살색(a 높음)과 거의 검은 부분을 뺀 픽셀의 Lab 평균 차이를 구하고,
    행마다 두 차이를 부드럽게 섞어 적용한다(두 띠 사이 blend 구간에서 숄 -> 치마로 천천히 바뀌어 가로 줄무늬가 생기지 않는다)"""
    def stats(img, band):
        a = np.array(img)
        lab = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2LAB).astype(np.float32)
        h = a.shape[0]
        m = (a[..., 3] > 200)
        m[:int(h * band[0])] = False; m[int(h * band[1]):] = False
        m &= (lab[..., 1] < 140) & (lab[..., 0] > 22)   # a 128 이 중립: 살색(붉음)과 거의 검은 부분은 뺀다
        return a, lab, m
    tg = {}
    for key, band in (('shawl', shawl_band), ('skirt', skirt_band)):
        _, rlab, rm = stats(ref_frame, band)
        tg[key] = rlab[rm].mean(axis=0)
    for fr in frames:
        a, lab, _ = stats(fr['img'], (0, 1))
        h = a.shape[0]
        ds = {}
        for key, band in (('shawl', shawl_band), ('skirt', skirt_band)):
            _, l2, m = stats(fr['img'], band)
            if m.sum() < 200:
                break
            ds[key] = tg[key] - l2[m].mean(axis=0)
        else:
            y = np.arange(h, dtype=np.float32) / h
            t = np.clip((y - blend[0]) / (blend[1] - blend[0]), 0, 1)[:, None, None]
            d = ds['shawl'][None, None, :] * (1 - t) + ds['skirt'][None, None, :] * t
            d = d * np.clip((0.96 - y) / 0.06, 0, 1)[:, None, None]   # 신발(맨 아래)은 색을 밀지 않는다
            keep = (lab[..., 1] < 140)[..., None].astype(np.float32)   # 살색은 그대로
            keep = cv2.GaussianBlur(keep[..., 0], (0, 0), 1.2)[..., None]
            lab2 = np.clip(lab + d * keep, 0, 255).astype(np.uint8)
            rgb = cv2.cvtColor(lab2, cv2.COLOR_LAB2RGB)
            out = a.copy(); out[..., :3] = np.where(a[..., 3:4] > 0, rgb, a[..., :3])
            fr['img'] = Image.fromarray(out, 'RGBA')


def match_cap(frames, ref_img):
    """기본·넘어짐 칸의 머리를 걷는 칸과 같게 칠한다: 머리 덮개는 따뜻한 베이지(두건), 쪽머리와 얼굴 옆 잔머리는 밝고 서늘한 회색(머리카락).
    걷는 칸 머리 위쪽에서 채도가 낮은 픽셀(머리카락)과 채도가 조금 있는 비살색 픽셀(두건)의 Lab 색을 기준으로 삼고,
    다른 칸에서는 회색 픽셀 중 얼굴에서 가장 먼 뒤쪽 28%(쪽머리)와 살색에 닿은 가장자리(잔머리)를 머리카락으로, 나머지를 두건으로 나눈다."""
    ra = np.array(ref_img)
    h = ra.shape[0]
    zone = np.zeros(ra.shape[:2], bool); zone[:int(h * 0.16)] = True
    hsv = cv2.cvtColor(ra[..., :3], cv2.COLOR_RGB2HSV).astype(np.float32)
    lab = cv2.cvtColor(ra[..., :3], cv2.COLOR_RGB2LAB).astype(np.float32)
    base = zone & (ra[..., 3] > 200) & (hsv[..., 2] > 110) & (lab[..., 1] < 140)
    cap = base & (hsv[..., 1] >= 25) & (hsv[..., 1] < 110)
    hair = base & (hsv[..., 1] < 25)
    if cap.sum() < 80 or hair.sum() < 40:
        return
    cap_L, cap_a, cap_b = lab[cap].mean(axis=0); hair_L, hair_a, hair_b = lab[hair].mean(axis=0)
    cap_b += 0.5; cap_a -= 1.8   # 이후 색 보정이 노란기를 조금 줄이는 만큼만 미리 더한다 (걷는 칸과 같은 베이지로 보이게)
    for fr in frames:
        a = np.array(fr['img'])
        hsvf = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV).astype(np.float32)
        m = (a[..., 3] > 200) & (hsvf[..., 1] < 70) & (hsvf[..., 2] > 105) & (hsvf[..., 2] < 225)
        # 숄의 잔무늬 같은 흩어진 회색 점은 빼고, 크게 뭉친 덩어리(머리 덮개와 쪽머리)만 머리로 본다
        mo = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        nl, lab_, st, _ = cv2.connectedComponentsWithStats(mo, connectivity=8)
        keep = [i for i in range(1, nl) if st[i, cv2.CC_STAT_AREA] >= 250]
        if not keep:
            continue
        head = cv2.dilate(np.isin(lab_, keep).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        m = m & head
        if m.sum() < 60:
            continue
        ys, xs = np.where(m)
        box = (max(0, xs.min() - 25), max(0, ys.min() - 25), xs.max() + 26, ys.max() + 26)
        skin = ((hsvf[..., 0] >= 3) & (hsvf[..., 0] <= 25) & (hsvf[..., 1] >= 50) & (hsvf[..., 2] > 150) & (a[..., 3] > 200))   # 숄(갈색)과 구분하려고 밝기도 본다
        sk = np.zeros_like(skin); sk[box[1]:box[3], box[0]:box[2]] = skin[box[1]:box[3], box[0]:box[2]]
        if sk.sum() < 20:
            continue
        sy, sx = np.where(sk); fx = sx.mean()
        gx0, gx1, gy0, gy1 = xs.min(), xs.max(), ys.min(), ys.max()
        facing = 1 if fx > (gx0 + gx1) / 2 else -1                      # 얼굴이 오른쪽이면 뒤통수는 왼쪽
        wd = gx1 - gx0 + 1
        back = (np.arange(m.shape[1])[None, :] < gx0 + 0.32 * wd) if facing > 0 else (np.arange(m.shape[1])[None, :] > gx1 - 0.32 * wd)
        low = (np.arange(m.shape[0])[:, None] > gy0 + 0.22 * (gy1 - gy0 + 1))
        bun = m & back & low                                           # 쪽머리: 머리 뒤쪽 32%의 아래쪽
        near = cv2.dilate(sk.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & m
        hair_m = bun | near
        cap_m = m & ~hair_m
        labf = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2LAB).astype(np.float32)
        out = labf.copy()
        for mask, (tL, ta, tb) in ((cap_m, (cap_L, cap_a, cap_b)), (hair_m, (hair_L, hair_a, hair_b))):
            if mask.sum() < 20:
                continue
            w = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.0)
            out[..., 1] = out[..., 1] * (1 - w) + ta * w
            out[..., 2] = out[..., 2] * (1 - w) + tb * w
            out[..., 0] = out[..., 0] + (tL - labf[mask][:, 0].mean()) * 0.5 * w
        edge = cv2.GaussianBlur((near & ~bun).astype(np.float32), (0, 0), 1.0)
        out[..., 0] = out[..., 0] - 12 * edge     # 두건 가장자리 안쪽의 머리선을 조금 어둡게
        rgb = cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
        res = a.copy(); res[..., :3] = np.where(a[..., 3:4] > 0, rgb, a[..., :3])
        fr['img'] = Image.fromarray(res, 'RGBA')


def main(who='gent'):  # 두 번째 인자 nograde: 색 보정 없이 만든다
    global CFG
    CFG = WHO[who]
    folder, name, const, ts_name, walk_dist, game_scale = CFG['folder'], CFG['name'], CFG['const'], CFG['ts'], CFG['walk_dist'], CFG['scale']
    d = os.path.join(ROOT, 'tools', 'work', 'gen_plan', folder, 'out')
    walk4_path, extra_path = find(d, '1_walk4'), find_opt(d, '4_walkextra2')
    if VARIANT == 'orig':
        extra_path = None
    if extra_path:
        # 사이 프레임 2칸이 있으면 6칸 걷기: 기존 1, 2, 3칸 + 사이 2칸(엇갈리는 구간) + 기존 4칸. 걸음 안의 위치(24칸 중)가 [0, 6, 12, 13, 15, 18]이다
        target = float(np.mean(row_leans(walk4_path, 4) + row_leans(extra_path, 2)))
        w4 = process_row(walk4_path, 4, game_scale, level_lean=True, lean_target=target)
        ex = process_row(extra_path, 2, game_scale, level_lean=True, lean_target=target)
        walk = [w4[0], w4[1], w4[2], ex[0], ex[1], w4[3]]
        walk_j = [0, 6, 12, 13, 15, 18]
    else:
        walk = process_row(walk4_path, 4, game_scale, level_lean=(VARIANT != 'orig'))
        walk_j = [0, 6, 12, 18]
    basic = process_row(find(d, '2_basic3'), 3, game_scale)
    if CFG.get('skirt_match'):
        match_garment(walk, basic[0]['img'])   # 걷는 칸의 숄(초록빛)과 치마(청회색)를 기본 칸의 갈색 계열에 맞춘다
    # 넘어짐 4번째 칸(뒤로 넘어져 누움)은 머리가 오른쪽에 그려져 왔다. 뒤로 넘어지면 머리가 왼쪽(레퍼런스 방향)이어야 하므로 뒤집는다
    falls = process_row(find(d, '3_falls4'), 4, game_scale, mirror=CFG['mirror_falls'])
    if CFG.get('cap_match'):
        match_cap([basic[0], basic[1], basic[2]] + falls, walk[0]['img'])   # 걷는 칸에만 두건이 있던 것을 모든 칸에 맞춘다
    order = [('stand', basic[0])] + [(f'walk{i}', w) for i, w in enumerate(walk)] + [('stagger', basic[1]),
             ('F2', falls[0]), ('F4', falls[1]), ('B2', falls[2]), ('B4', falls[3]), ('U4', basic[2])]
    # 서 있는 칸이 걷는 칸(곧게 선 칸 2, 3)보다 키가 크게 그려져 있어, 멈추면 키가 튄다: 머리는 두고 몸통·다리만 줄여 걷는 칸의 비율에 맞춘다
    stand = basic[0]
    walk_up = [walk[2]['img'].height, walk[3]['img'].height] if len(walk) == 4 else [walk[2]['img'].height, walk[5]['img'].height]
    ratio = float(np.mean(walk_up)) / stand['img'].height
    if VARIANT != 'orig' and abs(1 - ratio) > 0.01:
        stand['pre_squash'] = stand['img']
        stand['img'] = squash_body(stand['img'], CFG['head_frac'], ratio)
        print('서 있는 칸 키 %d -> %d px (걷는 칸 평균 %d px, 머리는 그대로)' % (stand['pre_squash'].height, stand['img'].height, np.mean(walk_up)))
    if 'nograde' not in sys.argv[2:] and VARIANT != 'orig':
        ss, rs = grade_all(order)
        print('색 보정: 명도 %.1f -> %.1f, a %+.1f -> %+.1f, b %+.1f -> %+.1f (기존 군중 그림 기준)' % (ss[0][0], rs[0][0], ss[0][1], rs[0][1], ss[0][2], rs[0][2]))
    Hh = max(fr['img'].height for _, fr in order)
    strip_w = sum(fr['img'].width for _, fr in order) + 4 * len(order)
    strip = Image.new('RGBA', (strip_w, Hh), (0, 0, 0, 0))
    rects, x = [], 0
    for _, fr in order:
        im = fr['img']
        strip.paste(im, (x, Hh - im.height))
        rects.append([x, Hh - im.height, im.width, im.height, round(fr['ax'], 1)])
        x += im.width + 4
    out_img = os.path.join(ROOT, 'frontend', 'public', 'q6', 'walk', name + '.webp')
    if VARIANT == 'orig':
        out_img = os.path.join(ROOT, 'tools', 'work', 'paint_check', 'gent_orig_strip.webp')
    strip.save(out_img, 'WEBP', quality=90, method=6, alpha_quality=100)
    ver = hashlib.md5(open(out_img, 'rb').read()).hexdigest()[:8]
    night_img = None
    if VARIANT != 'orig':
        night_img = os.path.join(ROOT, 'frontend', 'public', 'q6', 'walk', name + '_night.webp')
        night_look(strip, **CFG.get('night', {})).save(night_img, 'WEBP', quality=88, method=6, alpha_quality=100)
        nver = hashlib.md5(open(night_img, 'rb').read()).hexdigest()[:8]
    idx = {n_: i for i, (n_, _) in enumerate(order)}
    # 칸마다 다음 칸까지 몸이 나아가는 거리(키 대비): 한 걸음(=4칸 x walk_dist)을 24등분한 걸음 안의 위치 차이에 비례한다
    gaps = [b - a for a, b in zip(walk_j, walk_j[1:] + [24])]
    walk_dists = [round(walk_dist * 4 * g / 24, 4) for g in gaps]
    sheet = dict(src=f'/q6/walk/{name}.webp?v={ver}', rects=rects, stand=[idx['stand']], walk=[idx[f'walk{i}'] for i in range(len(walk))], back=[],
                 stagger=[idx['stagger']], getup=[idx['U4']], walkDist=walk_dists,
                 fallF=[idx['stagger'], idx['F2']], lyingF=idx['F4'], getupF=[idx['U4']],
                 fallB=[idx['stagger'], idx['B2']], lyingB=idx['B4'], getupB=[idx['U4']],
                 noBob=True)  # 그려 받은 걷기 그림에 몸의 오르내림이 이미 들어 있으므로 게임이 오르내림을 더하지 않는다
    if night_img:
        sheet['nightSrc'] = f'/q6/walk/{name}_night.webp?v={nver}'
    if 'noshadow' not in sys.argv[2:]:
        sstrip, srects, srects_f = build_shadows(order)
        sh_path = os.path.join(ROOT, 'tools', 'work', 'paint_check', 'gent_orig_shadow.webp') if VARIANT == 'orig' else os.path.join(ROOT, 'frontend', 'public', 'q6', 'walk', name + '_shadow.webp')
        sstrip.save(sh_path, 'WEBP', quality=85, method=6, alpha_quality=90)
        sver = hashlib.md5(open(sh_path, 'rb').read()).hexdigest()[:8]
        sheet['shadow'] = dict(src=f'/q6/walk/{name}_shadow.webp?v={sver}', rects=srects, rectsFlip=srects_f)
        print('그림자 시트', sstrip.size, os.path.getsize(sh_path) // 1024, 'KB')
    NL = chr(10)
    head = ('// 자동 생성: tools/build_q6_painted.py ' + who + ' (손으로 고치지 말 것)' + NL +
            '// 그려 받은 그림으로 만든 시트. 주소에 ?gentpaint 가 있을 때만 RumorView 가 쓴다. 프레임 번호는 실루엣 시트와 같다(11칸).' + NL +
            "import type { FallSheet } from './gentRefSprites';" + NL)
    ts = head + f'export const {const}: FallSheet = ' + json.dumps(sheet, ensure_ascii=False, indent=2) + ';' + NL
    if VARIANT != 'orig':
        with open(os.path.join(ROOT, 'frontend', 'src', 'components', 'question', 'rumor', ts_name), 'w', encoding='utf-8') as f:
            f.write(ts)
    previews(who + ('_orig' if VARIANT == 'orig' else ''), order, Hh, walk_dists)
    if 'orig' in order[0][1] and CFG['compare_old']:
        compare_preview(who, order)
    print('frames', len(rects), 'strip', strip.size, 'file', os.path.getsize(out_img) // 1024, 'KB', 'ver', ver)
    for (n_, fr), r in zip(order, rects):
        print(f'  {n_:8s} {r[2]}x{r[3]} ax={r[4]} lift={round(fr["lift"], 1)} head-ax={round(fr.get("head", 0), 1)}')


def compare_preview(who, order):
    """배경 그림 위에 예전 신사(왼쪽), 보정 전 새 신사, 보정 후 새 신사(서 있기와 걷기 한 칸)를 올려 비교한다"""
    bgp = os.path.join(ROOT, 'frontend', 'public', 'bg', 'rumor_q6.webp')
    bg = Image.open(bgp).convert('RGB')
    crop = bg.crop((560, 330, 1560, 820)).convert('RGBA')
    ts = open(os.path.join(ROOT, 'frontend', 'src', 'components', 'question', 'rumor', 'walkSprites.ts'), encoding='utf-8').read()
    k = ts.index('"bowler":') + len('"bowler":')
    old = json.JSONDecoder().raw_decode(ts[k:].lstrip())[0]
    oldim = Image.open(os.path.join(REF_DIR, 'bowler.webp')).convert('RGBA')
    S = 0.55
    fr = dict(order)

    def put(im, ax, x, ground=460):
        im2 = im.resize((max(1, round(im.width * S)), max(1, round(im.height * S))), Image.LANCZOS)
        crop.alpha_composite(im2, (int(x - ax * S), int(ground - im2.height)))

    def old_frame(i):
        r = old['rects'][i]
        return oldim.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])), r[4]
    cols = [(80, 'old'), (200, 'orig'), (320, 'grade')]
    for x, kind in cols:
        for row, nm in ((0, 'stand'), (1, 'walk1')):
            gx = x + row * 450
            if kind == 'old':
                im, ax = old_frame(old['stand'][0] if nm == 'stand' else old['walk'][1])
            else:
                f = fr[nm]; im, ax = f['orig'] if kind == 'orig' and 'orig' in f else f['img'], f['ax']
            put(im, ax, gx + 40)
    crop.convert('RGB').save(os.path.join(ROOT, 'tools', 'work', 'paint_check', who, 'grade_compare.png'))


def previews(who, order, Hh, walk_dists=None):
    """정렬한 프레임으로 걷기, 앞으로 넘어짐, 뒤로 넘어짐 GIF 를 만든다(게임과 같은 타이밍: 휘청 0.16, 쏠림 0.16, 누움, 일어남 0.45초)"""
    chk = os.path.join(ROOT, 'tools', 'work', 'paint_check', who)
    os.makedirs(chk, exist_ok=True)
    fr = dict(order)
    CW, CH, G = 520, Hh + 40, Hh + 20
    bg = (40, 44, 56)

    def frame(name):
        f = fr[name]
        im = Image.new('RGB', (CW, CH), bg)
        d = ImageDraw.Draw(im)
        d.line([(0, G), (CW, G)], fill=(70, 76, 92), width=2)
        sp = f['img']
        x = int(round(CW / 2 - f['ax'])); y = G - sp.height
        if 'shadow' in f:
            sd = f['shadow']; im.paste(sd['img'], (int(round(CW / 2 - sd['ax'])), G - sd['up']), sd['img'])
        im.paste(sp, (x, y), sp)
        return im

    def save(seq, fname):
        ims = [frame(n) for n, _ in seq]
        ims[0].save(os.path.join(chk, fname), save_all=True, append_images=ims[1:], duration=[int(t * 1000) for _, t in seq], loop=0)
    wn = [n for n, _ in order if n.startswith('walk')]
    wd = walk_dists or [0.1203] * len(wn)
    save([(n, 0.56 * w / 0.4812) for n, w in zip(wn, wd)], 'walk.gif')   # 걸음 한 번(4칸 기준 0.56초)을 칸마다 이동 거리에 비례한 시간으로 보여 준다
    save([('stand', .5), ('stagger', .16), ('F2', .16), ('F4', 1.0), ('U4', .45), ('stand', .6)], 'fall_forward.gif')
    save([('stand', .5), ('stagger', .16), ('B2', .16), ('B4', 1.0), ('U4', .45), ('stand', .6)], 'fall_back.gif')
    # 한눈에 보는 11칸
    names = [n for n, _ in order]
    sheet = Image.new('RGB', (CW * 4, CH * 3), bg)
    for i, n in enumerate(names):
        sheet.paste(frame(n), ((i % 4) * CW, (i // 4) * CH))
    sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(os.path.join(chk, 'frames11.png'))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'gent')
