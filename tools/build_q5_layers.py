#!/usr/bin/env python3
"""Q5 갑판 장면 조립: 투명하게 만든 레이어(tools/work/keyed)를 1376x768 기준으로 쌓아
frontend/public/bg/deck_q5_fg.webp (앞쪽 레이어: 하늘과 바다 자리는 투명), deck_q5.webp (WebGL 없을 때의 한 장짜리 그림),
frontend/public/q5/obj_*.webp (선택지 물건)을 만든다.

레이어 순서(아래 → 위): 배 구조물 → 갑판 바닥(난간 뒤, 난간 발판 아래에 깔림) → 난간 → 탁자와 찻잔
(하늘과 바다는 셰이더가 맨 뒤에서 그린다.)  좌표는 1376x768 기준이며 tools/work/layout_guide.png 와 같다.
실행: python tools/build_q5_layers.py [--preview]
"""
import os, sys
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = os.path.join(ROOT, 'tools', 'work', 'keyed')
PUB = os.path.join(ROOT, 'frontend', 'public')
W, H = 1376, 768

def load(name):
    im = cv2.imread(os.path.join(K, name), cv2.IMREAD_UNCHANGED)
    if im is None:
        sys.exit('없음: ' + name)
    return im

def place(canvas, layer, x, y, scale=1.0):
    """layer(BGRA)를 canvas(float BGRA, 비곱 알파)의 (x, y)에 scale 배로 얹는다."""
    if scale != 1.0:
        layer = cv2.resize(layer, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    h, w = layer.shape[:2]
    x0, y0 = int(round(x)), int(round(y))
    sx0, sy0 = max(0, -x0), max(0, -y0)
    x1, y1 = min(W, x0 + w), min(H, y0 + h)
    if x1 <= max(0, x0) or y1 <= max(0, y0):
        return
    src = layer[sy0:sy0 + (y1 - max(0, y0)), sx0:sx0 + (x1 - max(0, x0))].astype(np.float32)
    dst = canvas[max(0, y0):y1, max(0, x0):x1]
    a = src[..., 3:4] / 255.0
    da = dst[..., 3:4] / 255.0
    oa = a + da * (1 - a)
    rgb = (src[..., :3] * a + dst[..., :3] * da * (1 - a)) / np.maximum(oa, 1e-4)
    dst[..., :3] = rgb
    dst[..., 3:4] = oa * 255.0

def kill_sparkle(im, box):
    x0, y0, x1, y1 = box
    im[y0:y1, x0:x1, 3] = 0

def main():
    canvas = np.zeros((H, W, 4), np.float32)

    # 1) 배 구조물: 난간 뒤. 바닥선이 난간 발판(y≈650)에 가려지도록 아래로 내린다.
    ship = load('ship.webp')
    kill_sparkle(ship, (1230, 600, 1330, 700))
    # 창문 안쪽이 초록 배경 그대로 나온 곳은 불 켜진 따뜻한 실내색으로 바꾼다
    b, g, r = [ship[..., i].astype(np.int32) for i in range(3)]
    win = (g > r + 30) & (g > b + 30) & (ship[..., 3] > 20)
    ship[win, 0] = 70; ship[win, 1] = 150; ship[win, 2] = 235   # BGR: 따뜻한 주황
    place(canvas, ship, 0, 118, W / ship.shape[1])

    # 2) 갑판 바닥: 난간 발판 아래(앞쪽)만 쓴다. 발판 선 위로 조금 올려 난간이 위에 덮이게 한다.
    floor = load('floor.webp')
    kill_sparkle(floor, (1262, 600, 1330, 700))
    fl = np.zeros((H, W, 4), np.uint8)
    fh, fw = floor.shape[:2]
    # 바닥 그림의 아래 절반(널빤지)을 화면 아래쪽에 맞춰 넓힌다
    floor = floor[:fh - 8]  # 맨 아래 초록 한 줄 제거
    f2 = cv2.resize(floor, (int(W * 1.18), H), interpolation=cv2.INTER_AREA)
    fl[:, :W] = f2[:, :W]
    poly = np.array([(300, H), (640, 585), (1245, 640), (W, 600), (W, H)], np.int32)
    pm = np.zeros((H, W), np.uint8)
    cv2.fillPoly(pm, [poly], 255)
    pm = cv2.GaussianBlur(pm, (0, 0), 1.2)
    fl[..., 3] = (fl[..., 3].astype(np.float32) * (pm / 255.0)).astype(np.uint8)
    place(canvas, fl, 0, 0)

    # 3) 난간
    rail = load('rail_keyed.webp') if os.path.exists(os.path.join(K, 'rail_keyed.webp')) else None
    if rail is None:
        rail = cv2.imread(os.path.join(ROOT, 'tools', 'work', 'rail_keyed.webp'), cv2.IMREAD_UNCHANGED)
    place(canvas, rail, 0, 0)

    # 4) 탁자와 찻잔: 난간 안쪽 가운데
    table = load('table.webp')
    kill_sparkle(table, (1250, 600, 1340, 700))
    s = 190.0 / 1220.0
    place(canvas, table, 625, 456, s)

    fg = np.clip(canvas, 0, 255).astype(np.uint8)
    fg[fg[..., 3] <= 3, :3] = 0
    out = os.path.join(PUB, 'bg', 'deck_q5_fg.webp')
    q = 90
    while True:
        ok, buf = cv2.imencode('.webp', fg, [cv2.IMWRITE_WEBP_QUALITY, q])
        if len(buf) <= 195 * 1024 or q <= 50:
            break
        q -= 5
    open(out, 'wb').write(buf.tobytes())
    print('deck_q5_fg.webp', len(buf) // 1024, 'KB (품질 %d)' % q)

    # WebGL 이 없을 때의 한 장짜리 그림: 하늘 사진 판 + 어두운 바다 위에 앞쪽 레이어를 얹는다
    sky = cv2.imread(os.path.join(PUB, 'bg', 'sky_q5.webp'))
    full = np.zeros((H, W, 3), np.uint8)
    full[:] = (46, 30, 18)
    hy = int(H * 0.393)
    full[:hy] = cv2.resize(sky, (W, hy), interpolation=cv2.INTER_AREA)
    sea = np.linspace((60, 40, 24), (30, 18, 10), H - hy).astype(np.uint8)
    full[hy:] = sea[:, None, :]
    a = fg[..., 3:4] / 255.0
    full = (fg[..., :3] * a + full * (1 - a)).astype(np.uint8)
    cv2.imwrite(os.path.join(PUB, 'bg', 'deck_q5.webp'), full, [cv2.IMWRITE_WEBP_QUALITY, 85])

    # 선택지 물건 (투명 스프라이트)
    os.makedirs(os.path.join(PUB, 'q5'), exist_ok=True)
    for src, dst, mh in [('champagne.webp', 'obj_champagne.webp', 420), ('telescope.webp', 'obj_telescope.webp', 640)]:
        im = load(src)
        if im.shape[0] > mh:
            f = mh / im.shape[0]
            im = cv2.resize(im, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(PUB, 'q5', dst), im, [cv2.IMWRITE_WEBP_QUALITY, 88])
        print(dst, im.shape[1], 'x', im.shape[0])

    if '--preview' in sys.argv:
        bg = full.copy()
        cv2.imwrite(os.path.join(ROOT, 'tools', 'work', 'q5_composite_preview.png'), cv2.resize(bg, None, fx=0.8, fy=0.8, interpolation=cv2.INTER_AREA))

if __name__ == '__main__':
    main()
