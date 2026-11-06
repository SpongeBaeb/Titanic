#!/usr/bin/env python3
"""크로마키 이미지를 투명 배경(WebP)으로 바꾼다.

용도: Q5 갑판의 "앞쪽 레이어"처럼 하늘·바다 자리가 한 가지 색(예: 순수한 초록 #00FF00)으로 칠해진 그림을
      진짜 투명도로 바꾼다. 가는 난간대 사이의 틈도 색으로 구분되므로 끊기지 않는다.

사용:
    python tools/key_chroma.py 입력.png 출력.webp              # 키 색을 자동으로 찾는다
    python tools/key_chroma.py 입력.png 출력.webp --key 00ff00
    python tools/key_chroma.py 입력.png 출력.webp --lo 18 --hi 70 --preview 미리보기.png

방법
  1) 키 색 K 와의 거리(밝기를 뺀 색차 + 약간의 밝기 차)를 구해, lo 이하는 완전 투명, hi 이상은 완전 불투명,
     그 사이는 부드럽게 섞는다 (가장자리의 반투명 테두리).
  2) 반투명 픽셀에서는 배경색 K 가 섞여 있으므로 (픽셀 - (1-알파)·K) / 알파 로 원래 색을 복원한다(번짐 제거).
  3) 키 색이 초록이면 남은 초록 번짐을 줄인다(despill).
  4) 용량 상한(이미지_최적화_기준.md: 일반 200KB)을 넘으면 품질을 낮춰 맞춘다. 투명 영역은 색을 비워 용량을 줄인다.
"""
import argparse
import os
import sys

import cv2
import numpy as np


def parse_key(s):
    s = s.lstrip('#')
    return np.array([int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)], np.float32)  # R,G,B


def detect_key(rgb):
    """가장 흔한 '진한 단색'을 키 색으로 본다. 색을 8단계로 뭉쳐 세고, 채도가 높은 것만 후보로 둔다."""
    q = (rgb // 16).reshape(-1, 3)
    codes = q[:, 0].astype(np.int32) * 256 + q[:, 1].astype(np.int32) * 16 + q[:, 2].astype(np.int32)
    vals, cnt = np.unique(codes, return_counts=True)
    order = np.argsort(-cnt)
    for i in order[:12]:
        c = vals[i]
        r, g, b = (c >> 8) & 15, (c >> 4) & 15, c & 15
        if max(r, g, b) - min(r, g, b) >= 8:  # 충분히 채도가 높은 색
            mask = codes == c
            return rgb.reshape(-1, 3)[mask].mean(axis=0).astype(np.float32), float(cnt[i]) / codes.size
    raise SystemExit('키 색을 자동으로 찾지 못했습니다. --key 로 지정하세요.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--key', help='키 색 (예: 00ff00). 생략하면 자동으로 찾는다')
    ap.add_argument('--lo', type=float, default=22.0, help='이 거리 이하는 완전 투명')
    ap.add_argument('--hi', type=float, default=80.0, help='이 거리 이상은 완전 불투명')
    ap.add_argument('--shrink', type=int, default=1, help='가장자리를 안쪽으로 줄이는 픽셀 수(번짐 제거). 얇은 난간이 사라지면 0')
    ap.add_argument('--spill', type=int, default=4, help='투명한 곳에서 이 픽셀 안쪽까지 초록 번짐을 지운다(가는 난간대는 전체가 번져 있으니 크게)')
    ap.add_argument('--budget', type=int, default=195, help='용량 상한(KB)')
    ap.add_argument('--preview', help='미리보기 PNG 경로 (체크무늬 위에 얹어 저장)')
    a = ap.parse_args()

    bgr = cv2.imread(a.src, cv2.IMREAD_COLOR)
    if bgr is None:
        sys.exit('이미지를 열 수 없습니다: ' + a.src)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    if a.key:
        K, share = parse_key(a.key), None
    else:
        K, share = detect_key(rgb)
    print('키 색 RGB =', K.astype(int).tolist(), '' if share is None else '(화면의 %.1f%%)' % (share * 100))

    f = rgb.astype(np.float32)
    # 거리: 색차(밝기 정규화)를 크게, 밝기 차는 작게 반영
    def chroma(x):
        s = x.sum(axis=-1, keepdims=True) + 1e-3
        return x / s
    dc = np.linalg.norm(chroma(f) - chroma(K[None, None, :]), axis=-1) * 255.0 * 1.6
    dl = np.abs(f.mean(axis=-1) - K.mean()) * 0.35
    dist = np.sqrt(dc ** 2 + dl ** 2)
    alpha = np.clip((dist - a.lo) / max(a.hi - a.lo, 1e-3), 0, 1)
    alpha = alpha * alpha * (3 - 2 * alpha)
    if a.shrink > 0:
        k = np.ones((2 * a.shrink + 1, 2 * a.shrink + 1), np.uint8)
        alpha = cv2.GaussianBlur(cv2.erode(alpha, k), (0, 0), 0.6)

    # 번짐 제거: 반투명 픽셀에서 키 색을 걷어 낸다
    A = alpha[..., None]
    safe = np.where(A > 0.02, A, 1.0)
    un = np.where(A > 0.02, (f - (1 - A) * K[None, None, :]) / safe, f)
    un = np.clip(un, 0, 255)
    # 초록 키라면 가장자리에 남은 초록 기운을 줄인다
    if K[1] > 150 and K[0] < 100 and K[2] < 100:
        r, g, b = un[..., 0], un[..., 1], un[..., 2]
        lim = np.maximum(r, b) + 4
        # 투명한 곳에서 3픽셀 안쪽까지는 초록 기운을 모두 걷어 낸다
        kk = 2 * a.spill + 1
        near = cv2.dilate((alpha < 0.5).astype(np.uint8), np.ones((kk, kk), np.uint8)).astype(bool)
        un[..., 1] = np.where(near, np.minimum(g, lim), g)
    un = np.where(A > 0.004, un, 0)

    out = np.dstack([cv2.cvtColor(un.astype(np.uint8), cv2.COLOR_RGB2BGR), (alpha * 255).astype(np.uint8)])
    q = 92
    while True:
        ok, buf = cv2.imencode('.webp', out, [cv2.IMWRITE_WEBP_QUALITY, q])
        if len(buf) <= a.budget * 1024 or q <= 40:
            break
        q -= 4
    with open(a.dst, 'wb') as fh:
        fh.write(buf.tobytes())
    print('저장: %s (%d KB, 품질 %d, 투명 %.1f%%)' % (a.dst, len(buf) // 1024, q, 100 * float((alpha < 0.01).mean())))
    if len(buf) > a.budget * 1024:
        print('주의: 용량 상한을 넘었습니다. 해상도를 줄이거나 --budget 을 조정하세요.')

    if a.preview:
        h, w = alpha.shape
        yy, xx = np.mgrid[0:h, 0:w]
        checker = (((yy // 24) + (xx // 24)) % 2 * 40 + 70).astype(np.float32)[..., None] * np.array([1, 1, 1], np.float32)
        comp = (un * A + checker * (1 - A)).astype(np.uint8)
        cv2.imwrite(a.preview, cv2.cvtColor(cv2.resize(comp, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2BGR))
        print('미리보기:', a.preview)


if __name__ == '__main__':
    main()
