#!/usr/bin/env python3
"""자세 참고 그림(마네킹)을 움직여 보는 그림: build_walk_pose_ref.py 의 관절 곡선 그대로.
출력: tools/work/q6walk_check/pose_ref_walk.gif  (왼쪽: 참고 그림의 8칸만, 오른쪽: 같은 곡선을 32칸으로 부드럽게)
      tools/work/q6walk_check/pose_ref_walk_skirt.gif (치마)
"""
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_walk_pose_ref as R  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'work', 'q6walk_check')


def render(p, skirt):
    sub = Image.new('RGB', (R.CW, R.CH), (255, 255, 255))
    d = ImageDraw.Draw(sub)
    d.line([(0, R.BASE + 2), (R.CW, R.BASE + 2)], fill=(210, 210, 210), width=2)
    R.draw_figure(d, R.pose(p), R.CW // 2 - 10, skirt=skirt, t=p)
    return sub.resize((R.CW // 2, R.CH // 2), Image.LANCZOS)


def make(path, skirt):
    fps = 24
    cycle_s = 1.1           # 두 걸음(한 주기) 1.1초: 보통 산책 속도
    frames = []
    for n in range(int(fps * cycle_s * 3)):
        p = (n / fps / cycle_s) % 1.0
        p8 = int(p * 8) / 8   # 참고 그림의 8칸만 쓰면
        a = render(p8, skirt)
        b = render(p, skirt)
        canvas = Image.new('RGB', (a.width * 2 + 12, a.height + 22), (255, 255, 255))
        canvas.paste(a, (0, 22))
        canvas.paste(b, (a.width + 12, 22))
        dd = ImageDraw.Draw(canvas)
        dd.text((8, 4), '8 frames (reference)', fill=(80, 80, 80))
        dd.text((a.width + 20, 4), 'smooth (same curves, 24 fps)', fill=(80, 80, 80))
        frames.append(canvas)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=int(1000 / fps), loop=0)
    print('saved', path)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    make(os.path.join(OUT, 'pose_ref_walk.gif'), False)
    make(os.path.join(OUT, 'pose_ref_walk_skirt.gif'), True)
