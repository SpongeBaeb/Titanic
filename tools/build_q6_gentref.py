#!/usr/bin/env python3
"""Q6 신사·숙녀 레퍼런스 시트 (사용: python -I build_q6_gentref.py [gent|lady|child|elder_m|elder_f|young_m|young_f], 기본 gent): 걷기·넘어짐·일어나기 레퍼런스 자세(gent_pose_kit)를 게임용 프레임 띠 한 장으로 만든다.
출력: frontend/public/q6/walk/gentref.webp (투명 배경 띠), frontend/src/components/question/rumor/gentRefSprites.ts (프레임 표)
게임에서는 주소에 ?gentref 가 있을 때만 쓴다(RumorView): 중년 남자(bowler) 자리에 이 시트가 들어간다.

프레임 번호 (RumorView 가 읽는 이름과 같다), 11칸:
  stand 0 / walk 1~4 (반 걸음 4장 반복) / stagger 5(휘청) / F2 6 / F4 7(엎드림) / B2 8 / B4 9(누움) / U4 10(한 무릎 세움)
  앞으로 넘어짐: fallF=[휘청, F2] -> lyingF=F4 -> getupF=[U4],  뒤로 넘어짐: fallB=[휘청, B2] -> lyingB=B4 -> getupB=[U4]
화면 높이: 서 있는 키를 REF_H(368px, 기존 군중 그림과 같다)에 맞춘다. 모든 칸은 엉덩이를 x 기준점(ax)으로, 바닥선을 아래끝으로 자른다.
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import gait_model as G  # noqa: E402
import gent_pose_kit as K  # noqa: E402
import build_gentleman_poses as BP  # noqa: E402

REF_H = 368
PROF = dict(hip=1.2, knee=1.1, arm=1.7, elbow=1.7, lean=-3)  # A안: 신사 걸음
G.BOB = 0.008
KIND = 'game'
WHO = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ('gent', 'lady', 'child', 'elder_m', 'elder_f', 'young_m', 'young_f') else 'gent'
NAME = {'gent': 'gentref', 'lady': 'ladyref', 'child': 'childref', 'elder_m': 'oldmanref', 'elder_f': 'oldwomanref', 'young_m': 'youngmanref', 'young_f': 'youngwomanref'}[WHO]
CONST = {'gent': 'GENT_REF_SHEET', 'lady': 'LADY_REF_SHEET', 'child': 'CHILD_REF_SHEET', 'elder_m': 'OLDMAN_REF_SHEET', 'elder_f': 'OLDWOMAN_REF_SHEET', 'young_m': 'YOUNGMAN_REF_SHEET', 'young_f': 'YOUNGWOMAN_REF_SHEET'}[WHO]
OUT_IMG = os.path.join(ROOT, 'frontend', 'public', 'q6', 'walk', NAME + '.webp')
OUT_TS = os.path.join(ROOT, 'frontend', 'src', 'components', 'question', 'rumor', {'gent': 'gentRefSprites.ts', 'lady': 'ladyRefSprites.ts', 'child': 'childRefSprites.ts', 'elder_m': 'oldManRefSprites.ts', 'elder_f': 'oldWomanRefSprites.ts', 'young_m': 'youngManRefSprites.ts', 'young_f': 'youngWomanRefSprites.ts'}[WHO])


def from_gait(p):
    """걷기 모델의 자세(점 좌표)를 자세 도구의 자세로 바꾼다"""
    def leg(L):
        knee, ankle, heel, toe = L
        fv = (toe[0] - heel[0], toe[1] - heel[1]); m = math.hypot(*fv) or 1
        fwd = (fv[0] / m, fv[1] / m); down = (-fwd[1], fwd[0])
        return dict(knee=knee, ankle=ankle, heel=heel, toe=toe, fwd=fwd, down=down)

    def arm(A):
        return dict(el=A[0], wr=A[1], hd=A[2])
    sh = p['sh']
    return dict(hip=p['hip'], sh=sh, neck=p['neck'], hc=p['head'], head=0, lean=math.degrees(math.atan2(sh[0], -sh[1])),
                near=leg(p['left']), far=leg(p['right']), narm=arm(p['l_arm']), farm=arm(p['r_arm']))


def frame_rgba(P, lift=0):
    big = Image.new('RGBA', (1600, 1600), (0, 0, 0, 0))
    K.draw(ImageDraw.Draw(big), P, KIND, 800, 800)
    bb = big.getbbox()
    return big, bb, lift


def main():
    if WHO == 'lady':
        import build_lady_ref as LR  # K.STYLE='lady' 와 숙녀 걸음 값(보폭·팔 모양)을 같이 쓴다
        walk, stride = LR.walk_poses()
    elif WHO in ('elder_m', 'elder_f'):
        import build_elder_ref as ER  # 노인 걷기(굽은 등, 직접 설계한 다리). 남성은 지팡이, 여성은 숄과 보닛
        walk, stride = ER.walk_poses('male' if WHO == 'elder_m' else 'female')
    elif WHO in ('young_m', 'young_f'):
        import build_young_ref as YR  # 청년 걷기(힘찬 걸음 / 경쾌한 걸음)
        walk, stride = YR.walk_poses('male' if WHO == 'young_m' else 'female')
    elif WHO == 'child':
        import importlib
        import build_child_ref as CR  # 어린이 체형·스타일을 켠다. 켠 뒤에 자세표(BP)를 다시 읽어 어린이 체형으로 넘어짐·일어남 자세를 다시 계산한다
        importlib.reload(BP)
        walk, stride = CR.walk_poses()
    else:
        tr, stride = G.timed_cycle(8, profile=PROF)
        walk = [from_gait(pose) for (_, pose, _, _) in tr[:4]]
    lab = {lb: (P, lift) for _, fr in BP.SEQ for lb, P, lift in fr}
    order = [  # (이름, 자세, lift)
        ('stand', ER.elder_stand('male' if WHO == 'elder_m' else 'female') if WHO in ('elder_m', 'elder_f') else BP.STAND, 0),
        ('walk0', walk[0], 0), ('walk1', walk[1], 0), ('walk2', walk[2], 0), ('walk3', walk[3], 0),
        ('stagger',) + lab['K2 휘청'],
        ('F2',) + lab['F2 쏠림'], ('F4',) + lab['F4 엎드림'],
        ('B2',) + lab['B2 허공'], ('B4',) + lab['B4 드러누움'],
        ('U4',) + lab['U4 한 무릎 세움'],
    ]
    if WHO in ('elder_m', 'elder_f'):
        # 걷는 칸(서기 포함)은 굽은 등 + 소품(남성: 수염·지팡이, 여성: 보닛·숄), 넘어지고 일어나는 칸은 소품만(굽은 등 외투·치마 처리는 서 있을 때만)
        K.STYLE = 'gent' if WHO == 'elder_m' else 'lady'
        base = {'beard'} if WHO == 'elder_m' else {'bonnet', 'shawl'}
        raw = []
        for name, P, lift in order:
            K.OPTS = (base | {'stoop'}) if (name == 'stand' or name.startswith('walk')) else set(base)
            raw.append(frame_rgba(P, lift))
        # 키 기준은 곧게 선 어른(남성: 신사, 여성: 숙녀) 높이: 굽은 노인은 그만큼 작게 나온다
        K.OPTS = set()
        ref = frame_rgba(BP.STAND, 0)[1]
        hs = ref[3] - ref[1]
    elif WHO in ('young_m', 'young_f'):
        K.STYLE = 'gent' if WHO == 'young_m' else 'lady'
        yopts = {'jacket', 'flatcap'} if WHO == 'young_m' else {'updo', 'slim'}
        K.OPTS = set(yopts)
        raw = [frame_rgba(P, lift) for _, P, lift in order]
        # 키 기준은 곧게 선 어른(남성: 신사, 여성: 숙녀) 높이: 같은 높이 기준을 써서 청년이 어른 시트와 같은 크기로 나온다
        K.OPTS = set()
        ref = frame_rgba(BP.STAND, 0)[1]
        hs = ref[3] - ref[1]
        K.OPTS = set(yopts)
    else:
        raw = [frame_rgba(P, lift) for _, P, lift in order]
        hs = raw[0][1][3] - raw[0][1][1]  # 서 있는 키(모자 위 ~ 구두 바닥), 설계 px
        if WHO == 'child':
            hs = 485  # 어린이는 키 기준을 고정한다(머리를 줄여도 몸이 커지지 않게). 485 는 어른 키 기준(491)보다 약간 작다
    s = REF_H / hs
    pad = 2
    crops = []
    for (big, bb, lift) in raw:
        x0, x1 = bb[0] - pad, bb[2] + pad
        y0, y1 = bb[1] - pad, bb[3] + lift + pad
        c = big.crop((x0, y0, x1, y1))
        w, h = max(1, round(c.width * s)), max(1, round(c.height * s))
        crops.append((c.resize((w, h), Image.LANCZOS), (800 - x0) * s))
    Hh = max(c.height for c, _ in crops)
    strip_w = sum(c.width for c, _ in crops) + 4 * len(crops)
    strip = Image.new('RGBA', (strip_w, Hh), (0, 0, 0, 0))
    rects, x = [], 0
    for c, ax in crops:
        # 바닥선(아래끝)을 띠의 아래끝에 맞춘다. 발바닥이 프레임 아래끝이어야 게임에서 바닥에 서 있는다
        strip.paste(c, (x, Hh - c.height))
        rects.append([x, Hh - c.height, c.width, c.height, round(ax, 1)])
        x += c.width + 4
    os.makedirs(os.path.dirname(OUT_IMG), exist_ok=True)
    strip.save(OUT_IMG, 'WEBP', lossless=True, quality=100, method=6)
    names = [n for n, _, _ in order]
    idx = {n: i for i, n in enumerate(names)}
    walk_dist = round(stride / 8 / hs, 4)  # 한 칸에 몸이 나아가는 거리(키 대비). 8칸 한 주기의 반(4칸)이 한 걸음
    if WHO in ('elder_m', 'elder_f'):
        walk_dist = round((30 if WHO == 'elder_m' else 26) / hs, 4)  # 노인 걸음은 한 칸 남성 30px, 여성 26px 로 설계했다(다리가 그 거리에 맞는다)
    import hashlib
    ver = hashlib.md5(open(OUT_IMG, 'rb').read()).hexdigest()[:8]  # 시트가 바뀌면 주소가 바뀌어 브라우저가 옛 그림을 쓰지 않는다
    sheet = dict(src=f'/q6/walk/{NAME}.webp?v={ver}', rects=rects, stand=[idx['stand']], walk=[idx[f'walk{i}'] for i in range(4)], back=[],
                 stagger=[idx['stagger']], getup=[idx['U4']], walkDist=[walk_dist] * 4,
                 # 한 동작에 한 장씩 추린 6자세: 휘청(K2) -> 앞으로 쏠림(F2) -> 엎드림(F4) / 휘청 -> 뒤로 허공(B2) -> 누움(B4), 일어남은 한 무릎 세움(U4) 한 장
                 fallF=[idx['stagger'], idx['F2']], lyingF=idx['F4'], getupF=[idx['U4']],
                 fallB=[idx['stagger'], idx['B2']], lyingB=idx['B4'], getupB=[idx['U4']])
    who_ko = {'gent': '신사', 'lady': '숙녀', 'child': '어린이(성별 무관)', 'elder_m': '노인 남성', 'elder_f': '노인 여성', 'young_m': '청년 남성', 'young_f': '청년 여성'}[WHO]
    NL = chr(10)
    head = (f'// 자동 생성: tools/build_q6_gentref.py {WHO} (손으로 고치지 말 것)' + NL
            + f'// {who_ko} 레퍼런스 자세 시트. 주소에 ?gentref 가 있을 때만 RumorView 가 쓴다. 프레임 번호: stand, walk(반 걸음 4장 반복), stagger,' + NL
            + '// 앞으로 넘어짐 fallF -> lyingF -> getupF, 뒤로 넘어짐 fallB -> lyingB -> getupB' + NL)
    if WHO == 'gent':
        head += "import type { WalkSheet } from './walkSprites';" + NL
        head += 'export interface FallSheet extends WalkSheet { fallF: number[]; lyingF: number; getupF: number[]; fallB: number[]; lyingB: number; getupB: number[]; noBob?: boolean; nightSrc?: string; shadow?: { src: string; rects: [number, number, number, number, number, number][]; rectsFlip?: [number, number, number, number, number, number][] } }' + NL
    else:
        head += "import type { FallSheet } from './gentRefSprites';" + NL
    ts = head + f'export const {CONST}: FallSheet = ' + json.dumps(sheet, ensure_ascii=False, indent=2) + ';' + NL
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write(ts)
    # 확인용: 띠를 어두운 배경에 올려 본다
    chk = Image.new('RGB', strip.size, (38, 46, 62)); chk.paste(strip, (0, 0), strip)
    os.makedirs(os.path.join(HERE, 'work', 'q6gentref_check'), exist_ok=True)
    chk.save(os.path.join(HERE, 'work', 'q6gentref_check', 'strip.png'))
    print('frames', len(rects), 'strip', strip.size, 'standH', hs, 'scale', round(s, 3), 'walkDist', walk_dist)


if __name__ == '__main__':
    main()
