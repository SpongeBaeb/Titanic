'use client';

import { useEffect, useRef } from 'react';
import { useBgMap } from './useBgMap';

/**
 * 배경(기관실) 오른쪽 벽의 톱니바퀴를 돌린다.
 * 배경 그림(telegraph_clean, 1376x768, object-cover) 위의 좌표에 개별 톱니 스프라이트를 올려 회전시킨다.
 * 좌표(cx, cy)와 반지름(r)은 배경 그림 기준 픽셀이다. 스프라이트는 톱니 가장자리까지 잘려 있어 지름 = 2r.
 *
 * 서로 맞물린 톱니는 반대 방향으로, 반지름에 비례해 회전 주기를 정한다(작을수록 빨리 돈다).
 * speed 를 올리면(기관 가속 레버) 현재 속도에서 목표 속도로 부드럽게 빨라지고 느려진다.
 */
type Gear = { src: string; cx: number; cy: number; r: number; dir: 1 | -1; period: number };

const GEARS: Gear[] = [
  // 가운데 큰 시계 톱니: 느리게 시계 방향
  { src: '/gears/gear_clock.webp', cx: 1100, cy: 205, r: 120, dir: 1, period: 140 },
  // 왼쪽에서 맞물리는 강철·구리 톱니: 반대 방향
  { src: '/gears/gear_spoke_l.webp', cx: 905, cy: 222, r: 76, dir: -1, period: 88 },
  // 오른쪽 위에서 맞물리는 얇은 청동 바큇살 톱니
  { src: '/gears/gear_spoke_m.webp', cx: 1240, cy: 112, r: 46, dir: -1, period: 53 },
  // 왼쪽 톱니 위쪽에서 맞물리는 구리 5살 톱니
  { src: '/gears/gear_solid.webp', cx: 858, cy: 108, r: 50, dir: 1, period: 58 },
];

export default function GearLayer({ reduced, speed = 1 }: { reduced: boolean; speed?: number }) {
  const m = useBgMap();
  const els = useRef<(HTMLImageElement | null)[]>([]);
  const angles = useRef<number[]>(GEARS.map(() => 0));
  const cur = useRef(1);
  const target = useRef(speed);
  target.current = speed;

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // 목표 속도로 부드럽게 따라간다(레버를 당기면 서서히 빨라진다)
      cur.current += (target.current - cur.current) * Math.min(1, dt * 1.6);
      GEARS.forEach((g, i) => {
        angles.current[i] += (g.dir * 360 / g.period) * cur.current * dt;
        const el = els.current[i];
        if (el) el.style.transform = `rotate(${angles.current[i]}deg)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {GEARS.map((g, i) => {
        const d = g.r * 2 * m.s;
        return (
          // 그림자와 밝기는 돌지 않는 바깥 껍질에 둬서, 톱니가 돌아도 그림자 방향은 그대로다
          <div
            key={g.src}
            className="absolute"
            style={{
              left: m.toX(g.cx) - d / 2,
              top: m.toY(g.cy) - d / 2,
              width: d,
              height: d,
              filter: 'brightness(0.9) saturate(0.95) drop-shadow(2px 5px 6px rgba(0,0,0,0.6))',
            }}
          >
            <img
              ref={(el) => { els.current[i] = el; }}
              src={g.src}
              alt=""
              draggable={false}
              className="h-full w-full will-change-transform"
            />
          </div>
        );
      })}
    </div>
  );
}
