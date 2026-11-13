#!/usr/bin/env python3
"""게임(RumorView)의 '내 걷기' 규칙을 그대로 흉내 내 보는 도구: 커서를 따라 지수적으로 움직이고, 걸은 거리에 따라 걷기 칸을 넘기고,
속도가 낮으면 서 있는 칸으로 바꾼다. 바닥 무늬를 몸의 속도로 흘려 발이 미끄러지는지도 보인다.
사용: python -I sim_walk.py <시트 이름: gentpaint|gentref> [프로필: steady|slow|stopgo]
출력: tools/work/paint_check/sim_{시트}_{프로필}.gif, 요약은 표준출력
규칙 출처(RumorView.tsx): pullK=3.4, me += (tgt-me)*min(1, dt*pullK), walking 전환 속도 5*depth 아래로면 멈춤/14*depth 위로면 걸음,
  gait += (sp*dt)/(personH*scale) 를 칸마다 walkDist 만큼 쌓으면 다음 칸(advanceGait), k = 116*depth*scale/380 (그림 한 픽셀 = k 화면 픽셀).
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHEETS = {'gentpaint': ('gentPaintSprites.ts', 'gentpaint'), 'gentref': ('gentRefSprites.ts', 'gentref')}
name = sys.argv[1] if len(sys.argv) > 1 else 'gentpaint'
profile = sys.argv[2] if len(sys.argv) > 2 else 'steady'
ts_name, sheet_name = SHEETS[name]
ts = open(os.path.join(ROOT, 'frontend', 'src', 'components', 'question', 'rumor', ts_name), encoding='utf-8').read()
sheet = json.loads(ts[ts.index('= {') + 2:ts.rindex(';')])
img = Image.open(os.path.join(ROOT, 'frontend', 'public', 'q6', 'walk', sheet_name + '.webp')).convert('RGBA')


def personH(y):
    return max(36.0, 0.49 * y - 170)


def depth(y):
    return personH(y) / 110.0


Y = 700.0
PH = personH(Y)
D = depth(Y)
K = 116 * D / 380.0          # 그림 한 픽셀 = K 화면 픽셀
dist = sheet['walkDist']
walk = sheet['walk']
rects = sheet['rects']


def advance(g, d_h):
    d = d_h
    for _ in range(16):
        if d <= 0:
            break
        i = int(math.floor(g)) % len(dist)
        frac = g - math.floor(g)
        need = (1 - frac) * dist[i]
        if d >= need:
            d -= need
            g = math.floor(g) + 1
        else:
            g += d / dist[i]
            d = 0
    return g


# 커서(목표) 위치 프로필: (시간 구간, 커서 속도 px/s)
PROFILES = {
    'steady': [(0.0, 0.6, 0), (0.6, 3.6, 220), (3.6, 5.0, 0)],
    'slow': [(0.0, 0.6, 0), (0.6, 4.6, 60), (4.6, 5.6, 0)],
    'stopgo': [(0.0, 0.5, 0), (0.5, 1.6, 200), (1.6, 2.1, 0), (2.1, 3.2, 200), (3.2, 3.7, 0), (3.7, 4.8, 120), (4.8, 6.0, 0)],
}[profile]
DT = 1 / 60.0
T = PROFILES[-1][1]
tgt = 0.0
me = 0.0
walking = False
gait = 0.0
face = 1
log = []
t = 0.0
while t < T:
    v = 0
    for a, b, c in PROFILES:
        if a <= t < b:
            v = c
    tgt += v * DT
    mx = me
    me += (tgt - me) * min(1.0, DT * 3.4)
    sp = abs(me - mx) / DT
    if (walking and sp < 5 * D) or ((not walking) and sp > 14 * D):
        walking = not walking
    if walking:
        gait = advance(gait, (sp * DT) / PH)
    frame = 'stand' if not walking else walk[int(math.floor(gait)) % len(walk)]
    log.append((t, me, sp, walking, frame))
    t += DT

# 요약: 걷는 동안 칸마다 머문 시간
holds = []
cur = None
for t, me_, sp, w, fr in log:
    if cur is None or fr != cur[0]:
        if cur is not None:
            holds.append((cur[0], t - cur[1]))
        cur = (fr, t)
holds.append((cur[0], T - cur[1]))
walk_holds = [h for f, h in holds if f != 'stand']
print(f'시트 {name}, 프로필 {profile}: 화면 속 키 {PH:.0f}px, 그림 배율 K={K:.3f}, 칸당 이동 거리 {[round(x * PH) for x in dist]}px')
print('최대 속도 %.0f px/s, 걷는 칸 전환 %d회, 칸 머문 시간(초): 최소 %.2f 중앙 %.2f 최대 %.2f' % (
    max(sp for _, _, sp, _, _ in log), len(walk_holds), min(walk_holds), sorted(walk_holds)[len(walk_holds) // 2], max(walk_holds)))
stand_frames = sum(1 for *_, fr in log if fr == 'stand')
print('서 있기로 보낸 시간 %.2f초 / 전체 %.2f초' % (stand_frames * DT, T))

# GIF: 30fps, 바닥 무늬는 몸이 나아간 만큼 뒤로 흘린다
W, H, GY = 520, 300, 262
font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 14)
frames = []
for i in range(0, len(log), 2):
    t, me_, sp, w, fr = log[i]
    im = Image.new('RGB', (W, H), (40, 44, 56))
    d = ImageDraw.Draw(im)
    off = -(me_ % 60)
    for x in range(-60, W + 60, 60):
        xx = x + off
        d.line([(xx, GY), (xx - 18, H)], fill=(80, 88, 108), width=2)
        d.rectangle([xx + 2, GY + 2, xx + 8, GY + 8], fill=(120, 130, 150))
    d.line([(0, GY), (W, GY)], fill=(90, 98, 118), width=2)
    idx = 0 if fr == 'stand' else fr
    rc = rects[idx]
    sp_img = img.crop((rc[0], rc[1], rc[0] + rc[2], rc[1] + rc[3]))
    sp_img = sp_img.resize((max(1, round(sp_img.width * K)), max(1, round(sp_img.height * K))), Image.LANCZOS)
    x = W // 2 - rc[4] * K
    im.paste(sp_img, (int(x), int(GY - sp_img.height)), sp_img)
    d.text((8, 6), f't={t:4.2f}s  속도 {sp:4.0f}px/s  칸 {"서 있기" if fr == "stand" else walk.index(fr) + 1 if fr in walk else fr}', fill=(235, 230, 215), font=font)
    frames.append(im)
out = os.path.join(ROOT, 'tools', 'work', 'paint_check', f'sim_{name}_{profile}.gif')
frames[0].save(out, save_all=True, append_images=frames[1:], duration=33, loop=0)
print('저장', out)
