'use client';

import { useEffect, useRef } from 'react';
import { useBgMap } from './useBgMap';

/**
 * 배경 속 계기판들: 배경 그림(telegraph_gauges.webp)은 눈금판의 바늘을 지운 상태이고,
 * 여기서 눈금과 움직이는 바늘만 얹는다. 눈금판의 질감·테두리·조명은 원래 그림 그대로다.
 * 좌표·반지름은 배경 그림(1376x768) 기준이다.
 *
 * 바늘은 스프링으로 움직여서(목표를 지나쳤다 돌아온다) 무거운 기계 바늘처럼 튕긴다.
 *  - 압력계(큰 계기): 증기 유지·기관 가속에 오르고, 증기 분출 때 확 튄다
 *  - 회전계: 기관 가속에서 높게 떨린다
 *  - 온도계: 압력을 천천히 따라간다
 *  - 나이 계기: 고른 나이 위치를 가리킨다 (고르기 전에는 영점에서 가늘게 떤다)
 *  - 전압계: 조명 밝기를 가리키고, 전구 점멸을 켜면 깜빡인다
 */
type Kind = 'pressure' | 'rpm' | 'temp' | 'age' | 'volt' | 'load' | 'wander' | 'steam';

interface G {
  /** 눈금판(타원) 중심·가로·세로·기울기: 배경 그림에서 눈금판 유리 면을 따서 맞춘 값 */
  x: number;
  y: number;
  w: number;
  h: number;
  ang: number;
  kind: Kind;
  sweep: number; // 바늘이 도는 총 각도(도)
}

const GAUGES: G[] = [
  { x: 385.4, y: 358.8, w: 25.8, h: 47.0, ang: 133.5, kind: 'pressure', sweep: 250 },
  { x: 437.8, y: 359.2, w: 17.0, h: 36.3, ang: 132.5, kind: 'rpm', sweep: 240 },
  { x: 443.7, y: 272.3, w: 25.0, h: 33.9, ang: 166.9, kind: 'temp', sweep: 230 },
  { x: 538.9, y: 281.3, w: 20.4, h: 32.2, ang: 172.9, kind: 'age', sweep: 230 },
  { x: 582.4, y: 351.0, w: 7.9, h: 17.2, ang: 126.3, kind: 'volt', sweep: 220 },
  { x: 616.3, y: 352.5, w: 6.9, h: 18.1, ang: 133.7, kind: 'load', sweep: 220 },
  { x: 637.1, y: 351.9, w: 6.7, h: 15.8, ang: 130.8, kind: 'temp', sweep: 220 },
  { x: 655.0, y: 352.2, w: 8.2, h: 16.0, ang: 124.2, kind: 'wander', sweep: 220 },
  { x: 647.7, y: 382.2, w: 10.4, h: 18.3, ang: 144.6, kind: 'steam', sweep: 220 },
  { x: 800.0, y: 457.0, w: 17.1, h: 17.1, ang: 0, kind: 'rpm', sweep: 220 },
  { x: 794.9, y: 494.9, w: 22.5, h: 23.0, ang: 34.1, kind: 'pressure', sweep: 230 },
];

export interface GaugeInputs {
  hold: boolean;
  engine: boolean;
  level: 0 | 1 | 2;
  flicker: boolean;
  /** 고른 나이 위치 (0..count-1), 아직 안 골랐으면 null */
  age: number | null;
  ageCount: number;
  /** 증기 분출 버튼을 누를 때마다 1 올라간다 */
  burstTick: number;
}

export default function GaugeLayer({ inputs, reduced }: { inputs: GaugeInputs; reduced: boolean }) {
  const m = useBgMap();
  const needleRefs = useRef<(SVGGElement | null)[]>([]);
  const inRef = useRef(inputs);
  inRef.current = inputs;
  const burst = useRef({ tick: inputs.burstTick, energy: 0 });

  useEffect(() => {
    if (inputs.burstTick !== burst.current.tick) {
      burst.current.tick = inputs.burstTick;
      burst.current.energy = 1;
    }
  }, [inputs.burstTick]);

  useEffect(() => {
    const st = GAUGES.map((_, i) => ({ v: 0.04, vel: 0, ph: i * 1.7 + 0.4 }));
    let raf = 0;
    let last = performance.now();
    let pressure = 0.3; // 온도계가 천천히 따라가는 값
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const inp = inRef.current;
      const b = burst.current;
      b.energy = Math.max(0, b.energy - dt * 0.55);
      const P = Math.min(1, 0.26 + (inp.hold ? 0.22 : 0) + (inp.engine ? 0.28 : 0) + b.energy * 0.38);
      pressure += (P - pressure) * Math.min(1, dt * 0.7);
      const noise = (i: number, amp: number, speed = 1) =>
        reduced ? 0 : amp * (Math.sin(t * 3.1 * speed + st[i].ph) * 0.6 + Math.sin(t * 7.3 * speed + st[i].ph * 2.1) * 0.4);
      GAUGES.forEach((g, i) => {
        let target = 0.3;
        switch (g.kind) {
          case 'pressure':
            target = P + noise(i, inp.engine ? 0.035 : 0.012);
            break;
          case 'rpm':
            target = (inp.engine ? 0.86 : 0.3) + noise(i, inp.engine ? 0.06 : 0.015, inp.engine ? 2.2 : 1);
            break;
          case 'temp':
            target = 0.22 + pressure * 0.62 + noise(i, 0.01);
            break;
          case 'age':
            target = inp.age === null ? 0.035 + noise(i, 0.012, 1.6) : 0.1 + (inp.ageCount > 1 ? inp.age / (inp.ageCount - 1) : 0.5) * 0.8;
            break;
          case 'volt':
            target = (inp.level === 0 ? 0.32 : inp.level === 1 ? 0.58 : 0.86) + (inp.flicker ? noise(i, 0.12, 3.2) : noise(i, 0.008));
            break;
          case 'load':
            target = (inp.engine ? 0.72 : 0.36) + (inp.flicker ? noise(i, 0.1, 2.6) : noise(i, 0.012));
            break;
          case 'wander':
            target = 0.45 + 0.28 * Math.sin(t * 0.35 + st[i].ph) + noise(i, 0.01);
            break;
          case 'steam':
            target = (inp.hold ? 0.8 : 0.3) + b.energy * 0.15 + noise(i, 0.012);
            break;
        }
        target = Math.max(0.02, Math.min(0.98, target));
        const s = st[i];
        // 스프링: 목표를 지나쳤다가 돌아온다
        const k = 150;
        const c = 9.5;
        s.vel += ((target - s.v) * k - s.vel * c) * dt;
        s.v += s.vel * dt;
        const el = needleRefs.current[i];
        if (el) el.setAttribute('transform', `rotate(${((Math.max(0, Math.min(1, s.v)) - 0.5) * g.sweep).toFixed(2)})`);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {GAUGES.map((g, i) => {
        // 눈금판 유리 면(타원) 안에만 그린다: 가장자리를 넘지 않게 살짝 작게
        const w = g.w * m.s * 0.94;
        const h = g.h * m.s * 0.94;
        const px = Math.max(1, m.s * 1.1); // 선 굵기(화면 px)
        const ticks = Array.from({ length: 11 }, (_, k) => k / 10);
        return (
          <svg
            key={i}
            width={w}
            height={h}
            viewBox="-50 -50 100 100"
            preserveAspectRatio="none"
            className="absolute"
            style={{
              left: m.toX(g.x) - w / 2,
              top: m.toY(g.y) - h / 2,
              transform: `rotate(${g.ang}deg)`,
              filter: 'brightness(0.92) saturate(0.95)',
              overflow: 'hidden',
            }}
          >
            {/* 눈금: 눈금판 바탕에 스며든 듯 옅게 */}
            {ticks.map((p, k) => {
              const a = ((p - 0.5) * g.sweep * Math.PI) / 180;
              const long = k % 5 === 0;
              const r1 = 40;
              const r2 = long ? 29 : 34;
              return (
                <line
                  key={k}
                  x1={Math.sin(a) * r1}
                  y1={-Math.cos(a) * r1}
                  x2={Math.sin(a) * r2}
                  y2={-Math.cos(a) * r2}
                  stroke="rgba(38,26,12,0.6)"
                  strokeWidth={long ? px * 1.2 : px * 0.8}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {/* 바늘 */}
            <g
              ref={(el) => {
                needleRefs.current[i] = el;
              }}
            >
              <line x1="0" y1="8" x2="0" y2="-36" stroke="#17100a" strokeWidth={px * 1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1="8" x2="0" y2="2" stroke="#8c2a1f" strokeWidth={px * 1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </g>
            <ellipse rx="5" ry="5" fill="#3a2c14" stroke="#9c8140" strokeWidth={px * 0.7} vectorEffect="non-scaling-stroke" />
          </svg>
        );
      })}
    </div>
  );
}
