#!/usr/bin/env python3
"""Q6 갑판 군중의 걷기 그림: 흰 배경 시트(한 장에 여러 사람, 같은 자세)를 사람별 투명 그림으로 자른다.

입력: tools/work/src/q6walk/{묶음}/raw_*.webp  (POSES 표에서 파일마다 어떤 자세인지 정한다)
출력: frontend/public/q6/walk/{인물}.webp  (인물 하나당 가로로 이어 붙인 프레임 띠 한 장) + {인물}.json (프레임 위치)
      tools/work/q6walk_check/*.png          (눈으로 확인하는 시트)

흰 배경 지우기 (흰색이 조금도 남지 않게):
  1. 가장자리에서 이어진 밝은 영역 = 배경 (flood fill). 몸에 둘러싸인 순백의 구멍(팔과 몸 사이 등)도 배경.
  2. 몸 안의 밝은 부분(셔츠 깃, 속치마 레이스)은 배경과 이어지지 않으므로 지우지 않는다.
  3. 가장자리는 부드러운 알파를 주고, 흰색이 섞인 테두리 색을 되돌린다(흰 테두리 제거).
  4. 거의 투명한 점, 떨어져 나간 작은 얼룩은 버린다.
"""
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'work', 'src', 'q6walk')
OUT = os.path.join(ROOT, 'frontend', 'public', 'q6', 'walk')
CHECK = os.path.join(ROOT, 'tools', 'work', 'q6walk_check')

# 묶음마다: 인물 이름(왼쪽부터), 자세별 원본 파일
GROUPS = {
    'A': {
        'people': ['bowler', 'flowerhat', 'tophat', 'updo'],
        # 자세 이름 -> 원본 번호 (시트를 보고 정함). walk 는 걷기 순환 순서: 두 발 딛음 -> 뒷발 떼기 -> 다리 앞으로 -> 앞발 딛음
        'poses': {'stand': [86], 'walk': [85, 84, 82, 83], 'back': [81, 88], 'stagger': [89], 'getup': [87]},
        # 키 기준: 서 있는 시트(86)의 중절모 남자 키(위 31 ~ 아래 528)
        'ref_h': 497,
    },
}
# 화면에 쓰는 높이: 기존 군중 그림(crowd_0, 중절모 남자)의 키 368px 에 맞춘다
REF_H = 368

# 8칸 걷기 순환 시트 (29-6: 자세 참고 그림을 붙여 받은 것). 있으면 그 인물의 걷기 프레임을 이것으로 바꾼다.
# 4칸 x 2줄, 왼쪽 위부터 1 오른발 착지 ~ 8 솟음 순서
WALK8 = {
    # (파일, 가로 칸, 세로 칸) 목록을 순서대로 이어 8칸을 만든다. 29-7: 1~4칸과 5~8칸을 따로 받은 것
    # 로컬 생성(ControlNet 자세 고정 + IP-Adapter 인물 고정, tools/sd_walk_generate2.py) 결과 8칸. 예전 받은 그림: A8/bowler_1-4.webp, bowler_5-8.webp
    'bowler': [('A8/bowler_sd8.png', 4, 2)],
}


def darken_pale_limbs(im: np.ndarray) -> np.ndarray:
    """자세 참고 그림의 회색(먼 쪽 팔다리)을 따라 그려 허옇게(반투명하게) 나온 팔다리를 몸과 같은 그늘 색으로 칠한다.
    흰 배경과 거의 같은 밝기(245~253)라 그대로 두면 반투명 유령처럼 남는다.
    몸 가장자리의 옅은 빛무리도 같은 밝기이므로 모양으로 가른다: 어두운 몸에서 10px 넘게 떨어진 밝은 부분(팔다리 끝)을 씨앗으로 잡고,
    밝은 영역 안에서만 10px 까지 키워 몸에 붙은 뿌리까지 채운다(빛무리 전체로 번지지 않는다)."""
    f = im.astype(np.float32)
    mn = f.min(axis=2); mx = f.max(axis=2)
    mnb = cv2.medianBlur(mn.astype(np.uint8), 5).astype(np.float32)
    pale = ((mnb > 120) & (mnb <= 252) & ((mx - mn) < 40)).astype(np.uint8)
    dark = (mnb < 150).astype(np.uint8)
    dist = cv2.distanceTransform(1 - dark, cv2.DIST_L2, 5)
    seed = (pale & (dist > 6)).astype(np.uint8)
    seed = cv2.morphologyEx(seed, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    # 작은 얼룩 씨앗은 버린다 (팔다리는 큰 덩어리)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(seed, connectivity=8)
    keep = np.zeros_like(seed)
    for k in range(1, n):
        if stats[k, cv2.CC_STAT_AREA] >= 160:
            keep[lab == k] = 1
    grown = keep.copy()
    for _ in range(14):
        grown = cv2.dilate(grown, np.ones((3, 3), np.uint8)) & np.maximum(pale, dark)
    limb = cv2.morphologyEx(grown, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    w = cv2.GaussianBlur(limb.astype(np.float32), (5, 5), 0)[..., None]
    lum = np.clip((mnb[..., None] - 200) / 54.0, 0, 1)
    shade = np.array([40, 46, 56], np.float32) * (1.25 - 0.5 * lum)  # 따뜻한 그늘 (BGR), 원래 명암을 조금 남긴다
    return np.clip(f * (1 - w) + shade * w, 0, 255).astype(np.uint8)


def recolor_ghost_limbs(rgba: np.ndarray) -> np.ndarray:
    """배경을 지운 뒤에도 남은 허연 팔다리(색이 거의 없는 밝은 큰 덩어리)를 몸의 그늘 색으로 칠한다.
    얼굴·손(따뜻한 색), 셔츠 깃(작은 덩어리)은 색과 크기로 걸러 남긴다"""
    out = rgba.copy()
    f = rgba[..., :3].astype(np.float32)
    mn = f.min(axis=2); mx = f.max(axis=2)
    ghost = ((rgba[..., 3] > 0) & (mn > 78) & ((mx - mn) < 40)).astype(np.uint8)  # 앞 단계에서 반쯤 어두워진 회색(80~250)까지
    ghost = cv2.morphologyEx(ghost, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ghost, connectivity=8)
    m = np.zeros_like(ghost)
    for k in range(1, n):
        if stats[k, cv2.CC_STAT_AREA] >= 120:
            m[lab == k] = 1
    m = cv2.dilate(m, np.ones((3, 3), np.uint8)) & (rgba[..., 3] > 0)
    w = cv2.GaussianBlur(m.astype(np.float32), (5, 5), 0)[..., None]
    lum = np.clip((mn[..., None] - 78) / 177.0, 0, 1)
    shade = np.array([40, 46, 56], np.float32) * (1.2 - 0.45 * lum)  # 따뜻한 그늘 (BGR), 밝기 차이로 주름은 조금 남긴다
    out[..., :3] = np.clip(f * (1 - w) + shade * w, 0, 255).astype(np.uint8)
    out[..., 3] = np.where(m > 0, np.maximum(out[..., 3], 235), out[..., 3])  # 반투명하게 남지 않도록
    return out


def grid_frames(rgba: np.ndarray, cols: int, rows: int):
    """칸으로 나눈 뒤 칸마다 가장 큰 덩어리(사람)만 남겨 잘라 낸다"""
    H, W = rgba.shape[:2]
    out = []
    for r in range(rows):
        for c in range(cols):
            cell = rgba[r * H // rows:(r + 1) * H // rows, c * W // cols:(c + 1) * W // cols].copy()
            a = (cell[..., 3] > 30).astype(np.uint8)
            n, lab, stats, _ = cv2.connectedComponentsWithStats(cv2.dilate(a, np.ones((9, 9), np.uint8)), connectivity=8)
            big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            cell[..., 3] = np.where(lab == big, cell[..., 3], 0)
            ys, xs = np.where(cell[..., 3] > 0)
            out.append(cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    return out


def cutout(im: np.ndarray) -> np.ndarray:
    """흰 배경을 지운 RGBA"""
    h, w = im.shape[:2]
    f = im.astype(np.float32)
    minc = f.min(axis=2)
    # 밝은 후보 (배경일 수 있는 곳)
    light = (minc > 222).astype(np.uint8)
    # 1. 가장자리에서 이어진 밝은 영역
    n, lab, stats, _ = cv2.connectedComponentsWithStats(light, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # 둘러싸인 순백 구멍도 배경 (평균이 거의 흰색이고 크기가 있는 것)
    for i in range(1, n):
        if i in border:
            continue
        m = lab == i
        if stats[i, cv2.CC_STAT_AREA] >= 25 and minc[m].mean() > 243:
            bg |= m
    # 2~3. 부드러운 알파: 배경 쪽 가장자리만 흰색과의 거리로 알파를 준다
    soft = np.clip((250 - minc) / 38.0, 0, 1)
    near_bg = cv2.dilate(bg.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    a = np.where(bg, 0.0, np.where(near_bg, soft, 1.0))
    a = np.where(bg & (soft > 0.5), soft, a)  # 배경으로 잡혔지만 실제로는 어두운 가는 선(지팡이 끝 등)
    # 흰색이 섞인 테두리 색 되돌리기: c = a*fg + (1-a)*255
    af = a[..., None]
    rgb = np.where(af > 0.02, (f - 255 * (1 - af)) / np.maximum(af, 0.02), 0)
    rgb = np.clip(rgb, 0, 255)
    # 4. 거의 투명한 점 제거
    a = np.where(a < 0.08, 0, a)
    rgba = np.dstack([rgb, a * 255]).astype(np.uint8)
    return rgba


def split_people(rgba: np.ndarray, count: int):
    """가로로 늘어선 사람들을 나눈다: 알파가 있는 열이 끊기는 곳을 경계로, 큰 덩어리 count 개"""
    a = rgba[..., 3] > 40
    # 작은 얼룩 제거
    n, lab, stats, _ = cv2.connectedComponentsWithStats(a.astype(np.uint8), connectivity=8)
    keep = np.zeros_like(a)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= 120:
            keep |= lab == i
    cols = keep.sum(axis=0) > 0
    spans = []
    start = None
    gap = 0
    end = 0
    for x, on in enumerate(cols):
        if on:
            if start is None:
                start = x
            gap = 0
            end = x
        elif start is not None:
            gap += 1
            if gap > 12:
                spans.append((start, end)); start = None
    if start is not None:
        spans.append((start, end))
    spans = [s for s in spans if s[1] - s[0] > 40]
    if len(spans) != count:
        # 지팡이 등으로 붙어 버리면, 정해진 칸(균등 분할) 안의 가장 큰 덩어리로 나눈다
        W = rgba.shape[1]
        spans = [(int(W * i / count), int(W * (i + 1) / count) - 1) for i in range(count)]
    parts = []
    for x0, x1 in spans:
        m = keep[:, x0:x1 + 1]
        part = rgba[:, x0:x1 + 1].copy()
        part[..., 3] = np.where(m, part[..., 3], 0)
        ys = np.where(part[..., 3] > 0)[0]
        xs = np.where(part[..., 3] > 0)[1]
        part = part[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        parts.append((part, x0 + xs.min(), ys.min(), ys.max()))
    return parts


def anchor_x(part: np.ndarray) -> float:
    """머리 중심(알파 무게중심): 프레임이 바뀌어도 사람이 좌우로 떨리지 않게 이 점을 맞춘다"""
    a = part[..., 3].astype(np.float32)
    h = a.shape[0]
    # 머리(모자 포함) 높이: 걸을 때 팔·다리가 흔들려도 머리는 몸의 중심 위에 머문다. 몸통(가슴)으로 잡으면 흔드는 팔 때문에 좌우로 튄다
    band = a[int(h * 0.02):int(h * 0.13)]
    xs = np.arange(a.shape[1], dtype=np.float32)
    tot = band.sum()
    return float((band.sum(axis=0) * xs).sum() / tot) if tot > 0 else a.shape[1] / 2


def ground_feet(f: np.ndarray, ax: float):
    """바닥에 닿은 발 덩어리들의 가로 중심 (머리 기준 위치)"""
    al = f[..., 3] > 60
    band = al[-12:]
    cols = np.where(band.any(axis=0))[0]
    if len(cols) == 0:
        return []
    segs = []; st = cols[0]; pv = cols[0]
    for c in cols[1:]:
        if c - pv > 3:
            segs.append((st + pv) / 2 - ax); st = c
        pv = c
    segs.append((st + pv) / 2 - ax)
    return segs


def step_distances(frames, anchors, heights):
    """걷기 프레임마다 디딘 발이 뒤로 물러나는 거리(키에 대한 비율) = 그 프레임 동안 몸이 나아가는 거리.
    이 거리만큼 걸었을 때 다음 프레임으로 넘기면 디딘 발이 바닥에서 미끄러지지 않는다"""
    n = len(frames)
    out = []
    for i in range(n):
        a = ground_feet(frames[i], anchors[i]); b = ground_feet(frames[(i + 1) % n], anchors[(i + 1) % n])
        best = None
        for ca in a:
            for cb in b:
                d = ca - cb
                if 4 <= d <= 70 and (best is None or abs(d - 30) < abs(best - 30)):
                    best = d
        out.append(best)
    known = [d for d in out if d is not None]
    med = float(np.median(known)) if known else 0.09 * float(np.median(heights))
    h = float(np.median(heights))
    # 한 프레임이 너무 튀지 않게 중앙값의 0.6~1.5배로 묶는다
    return [round(min(1.5 * med, max(0.6 * med, d if d is not None else med)) / h, 4) for d in out]


def build_atlas(group: str):
    """인물마다 프레임을 가로로 이어 붙인 띠 한 장(webp)과 프레임 표(TS)를 만든다"""
    g = GROUPS[group]
    src = os.path.join(SRC, group)
    os.makedirs(OUT, exist_ok=True)
    sc = REF_H / g['ref_h']
    cache = {}
    for pose, nums in g['poses'].items():
        for n in nums:
            if n not in cache:
                im = cv2.imread(os.path.join(src, f'raw_{n}.webp'))
                cache[n] = split_people(cutout(im), len(g['people']))
    table = {}
    for k, name in enumerate(g['people']):
        frames = []
        meta = {}
        for pose, nums in g['poses'].items():
            meta[pose] = []
            for n in nums:
                part = cache[n][k][0]
                part = cv2.resize(part, (max(1, round(part.shape[1] * sc)), max(1, round(part.shape[0] * sc))), interpolation=cv2.INTER_AREA)
                # 줄인 뒤 다시 한 번: 거의 투명한 가장자리 정리
                al = part[..., 3]
                part[..., 3] = np.where(al < 14, 0, al)
                # 바깥 테두리에 남은 흰 점은 지운다 (몸 안쪽의 흰 깃이나 레이스는 테두리가 아니므로 남는다)
                outside = cv2.dilate((part[..., 3] == 0).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
                whiteish = part[..., :3].min(axis=2) > 215
                part[..., 3] = np.where(outside & whiteish, 0, part[..., 3])
                meta[pose].append(len(frames))
                frames.append(part)
        # 8칸 걷기 순환이 있으면 걷기 프레임을 바꾼다. 크기는 기존 걷기 프레임의 키에 맞춘다
        if name in WALK8:
            old_h = float(np.median([frames[i].shape[0] for i in meta['walk']]))
            src8 = WALK8[name] if isinstance(WALK8[name], list) else [(WALK8[name], 4, 2)]
            w8 = []
            for fn, cols, rows in src8:
                raw = cv2.imread(os.path.join(SRC, fn))
                part8 = grid_frames(recolor_ghost_limbs(cutout(darken_pale_limbs(raw))), cols, rows)
                # 따로 받은 시트마다 크기가 조금씩 다르므로 시트별로 기존 걷기 키에 맞춘다
                kk = old_h / float(np.median([f.shape[0] for f in part8]))
                w8 += [cv2.resize(f, (max(1, round(f.shape[1] * kk)), max(1, round(f.shape[0] * kk))), interpolation=cv2.INTER_AREA) for f in part8]
            # 따로 받은 시트는 조명 색이 조금씩 다르다: 모든 프레임의 색 분포(채널별 평균·표준편차)를 첫 4칸에 맞춰 걸음마다 색이 깜빡이지 않게 한다
            ref_px = np.concatenate([f[..., :3][f[..., 3] > 200].reshape(-1, 3) for f in w8[:4]]).astype(np.float32)
            rm, rs = ref_px.mean(0), ref_px.std(0) + 1e-3
            for f in w8:
                px = f[..., :3].astype(np.float32); sel = f[..., 3] > 200
                fm, fs = px[sel].mean(0), px[sel].std(0) + 1e-3
                f[..., :3] = np.clip((px - fm) / fs * rs + rm, 0, 255).astype(np.uint8)
            # 몸 안에 남은 밝고 색 없는 얼룩(허연 무늬 등)은 주변 옷 색으로 메운다. 얼굴과 손은 따뜻한 색이라 걸리지 않는다
            for n8, f in enumerate(w8):
                px = f[..., :3].astype(np.int32); mn8 = px.min(axis=2); mx8 = px.max(axis=2)
                inside = cv2.erode((f[..., 3] > 0).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
                lum8 = px.mean(axis=2).astype(np.float32)
                local = cv2.medianBlur(np.clip(lum8, 0, 255).astype(np.uint8), 21).astype(np.float32)
                # 밝기로만 고르면 조명 받은 옷도 걸리므로: 색이 없고(회색) 주변보다 뚜렷이 밝은 부분만
                spot = (inside & (((mn8 > 110) & ((mx8 - mn8) < 40)) | ((lum8 - local > 18) & ((mx8 - mn8) < 26)))).astype(np.uint8)
                spot = cv2.dilate(spot, np.ones((5, 5), np.uint8)) & (f[..., 3] > 0).astype(np.uint8)
                if spot.sum() > 0:
                    f[..., :3] = cv2.inpaint(np.ascontiguousarray(f[..., :3]), spot, 6, cv2.INPAINT_TELEA)
                    f[..., 3] = np.where(spot > 0, 255, f[..., 3])
            k8 = 1.0
            meta['walk'] = []
            for f8 in w8:
                f8 = cv2.resize(f8, (max(1, round(f8.shape[1] * k8)), max(1, round(f8.shape[0] * k8))), interpolation=cv2.INTER_AREA)
                al = f8[..., 3]
                f8[..., 3] = np.where(al < 14, 0, al)
                outside = cv2.dilate((f8[..., 3] == 0).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
                f8[..., 3] = np.where(outside & (f8[..., :3].min(axis=2) > 215), 0, f8[..., 3])
                meta['walk'].append(len(frames))
                frames.append(f8)
        H = max(f.shape[0] for f in frames)
        x = 0
        rects = []
        atlas = np.zeros((H, sum(f.shape[1] + 4 for f in frames), 4), np.uint8)
        for f in frames:
            fh, fw = f.shape[:2]
            atlas[H - fh:H, x:x + fw] = f
            rects.append([x, H - fh, fw, fh, round(anchor_x(f), 1)])
            x += fw + 4
        q = 86
        while True:
            ok, buf = cv2.imencode('.webp', atlas, [cv2.IMWRITE_WEBP_QUALITY, q])
            if len(buf) <= 160 * 1024 or q <= 60:
                break
            q -= 4
        open(os.path.join(OUT, f'{name}.webp'), 'wb').write(buf.tobytes())
        table[name] = {'src': f'/q6/walk/{name}.webp', 'rects': rects, **{p: v for p, v in meta.items()}}
        if name in WALK8:
            wf = [frames[i] for i in meta['walk']]
            table[name]['walkDist'] = step_distances(wf, [rects[i][4] for i in meta['walk']], [f.shape[0] for f in wf])
        print(name, atlas.shape[1], 'x', H, len(buf) // 1024, 'KB', 'q', q)
    return table


def write_ts(tables: dict):
    path = os.path.join(ROOT, 'frontend', 'src', 'components', 'question', 'rumor', 'walkSprites.ts')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = json.dumps(tables, ensure_ascii=False, indent=2)
    NL = chr(10)
    open(path, 'w', encoding='utf-8', newline=NL).write(NL.join([
        '// 자동 생성: tools/build_q6_walk.py (손으로 고치지 말 것)',
        '// 인물마다 프레임 띠 한 장. rects: [x, y, w, h, 몸통 중심 x]. 발바닥이 프레임 아래끝이다.',
        '// 자세별 프레임 번호: stand(서 있기), walk(걷기 순환), back(뒷모습), stagger(비틀), getup(일어나기)',
        'export interface WalkSheet { src: string; rects: [number, number, number, number, number][]; stand: number[]; walk: number[]; back: number[]; stagger: number[]; getup: number[]; walkDist?: number[] }',
        f'export const WALK_SHEETS: Record<string, WalkSheet> = {body};',
        '',
    ]))
    print('wrote', path)


def main():
    if len(sys.argv) > 2 and sys.argv[2] == 'atlas':
        tables = {}
        for grp in GROUPS:
            if GROUPS[grp]['poses']:
                tables.update(build_atlas(grp))
        write_ts(tables)
        return
    os.makedirs(CHECK, exist_ok=True)
    group = sys.argv[1] if len(sys.argv) > 1 else 'A'
    g = GROUPS[group]
    src = os.path.join(SRC, group)
    files = sorted(f for f in os.listdir(src) if f.startswith('raw_'))
    for fn in files:
        im = cv2.imread(os.path.join(src, fn))
        rgba = cutout(im)
        parts = split_people(rgba, len(g['people']))
        # 확인용: 회색 바탕에 잘린 사람들 (흰 테두리가 남았는지 보기 쉽게 어두운 바탕)
        hmax = max(p[0].shape[0] for p in parts)
        canvas = np.full((hmax + 20, sum(p[0].shape[1] + 20 for p in parts), 3), (40, 30, 30), np.uint8)
        x = 10
        for p, *_ in parts:
            ph, pw = p.shape[:2]
            al = p[..., 3:4].astype(np.float32) / 255
            roi = canvas[10 + hmax - ph:10 + hmax, x:x + pw].astype(np.float32)
            canvas[10 + hmax - ph:10 + hmax, x:x + pw] = (p[..., :3] * al + roi * (1 - al)).astype(np.uint8)
            x += pw + 20
        cv2.imwrite(os.path.join(CHECK, f'{group}_{fn[:-5]}.png'), canvas)
        print(fn, [(p[0].shape[1], p[0].shape[0], top, bot) for p, _, top, bot in parts])


if __name__ == '__main__':
    main()
