'use client';

import { useEffect, useState } from 'react';

/** 배경 그림(telegraph_clean, 1376x768)이 object-cover 로 깔렸을 때, 그림 좌표를 화면 좌표로 바꿔 주는 값 */
export const BG_W = 1376;
export const BG_H = 768;

export type BgMap = { s: number; ox: number; oy: number; toX: (x: number) => number; toY: (y: number) => number };

export function useBgMap(): BgMap {
  const [size, setSize] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const f = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const s = Math.max(size.w / BG_W, size.h / BG_H);
  const ox = (size.w - BG_W * s) / 2;
  const oy = (size.h - BG_H * s) / 2;
  return { s, ox, oy, toX: (x) => ox + x * s, toY: (y) => oy + y * s };
}
