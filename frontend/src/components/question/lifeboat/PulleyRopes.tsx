'use client';

import { useRef, type MutableRefObject } from 'react';
import { useAnimationFrame } from 'framer-motion';
import { ROPE_CFG, ROPE_LOOK, PIVOT, type Pt } from './ropeConfig';

/**
 * 구명정을 두 도르래에 매다는 줄 네 가닥(왼쪽 도르래에서 선미로 두 가닥, 오른쪽 도르래에서 이물로 두 가닥).
 * 구명정 장면(Q7)과 난간 장면(WB)이 같은 줄을 쓰도록 따로 뺀 부분이다. 구명정 쪽 끝은 drive.current 의 th(라디안)만큼 돌고
 * bob(배경판 px)만큼 오르내린 자리에 걸린다. 값은 장면이 매 프레임 적어 두면 이 컴포넌트가 그 값대로 줄을 다시 그린다.
 * 하중이 걸린 줄이라 처지지 않고 곧게 팽팽하다. 점 위치와 간격, 굵기는 ropeConfig.ts (디버그 패널에서 조정).
 */
export type RopeDrive = { th: number; bob: number };

interface Rope { top: Pt; hook: Pt; off: number }
const ropeOf = (i: number): Rope => {
  const a = i < 2;
  return { top: a ? ROPE_CFG.pulleyA : ROPE_CFG.pulleyB, hook: a ? ROPE_CFG.hookS : ROPE_CFG.hookB, off: (i % 2 === 0 ? -1 : 1) * ((a ? ROPE_LOOK.gapS : ROPE_LOOK.gapB) / 2) };
};
const ROPE_COUNT = 4;
const ROPE_DRAW_W = 6; // 줄을 그릴 때의 기준 굵기. 실제 굵기는 세로 배율로 맞춘다
const perpOf = (r: Rope): Pt => {
  const dx = r.hook.x - r.top.x;
  const dy = r.hook.y - r.top.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: -dy / l, y: dx / l };
};
const turn = (p: Pt, th: number): Pt => {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const dx = p.x - PIVOT.x;
  const dy = p.y - PIVOT.y;
  return { x: PIVOT.x + dx * c - dy * s, y: PIVOT.y + dx * s + dy * c };
};
const ropeEnds = (i: number, th: number, bob: number): [Pt, Pt] => {
  const r = ropeOf(i);
  const n = perpOf(r);
  const a = { x: r.top.x + n.x * r.off, y: r.top.y + n.y * r.off };
  const h = turn({ x: r.hook.x + n.x * r.off, y: r.hook.y + n.y * r.off }, th);
  return [a, { x: h.x, y: h.y + bob }];
};
const ropeTransform = (i: number, th: number, bob: number) => {
  const [a, b] = ropeEnds(i, th, bob);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const k = ROPE_LOOK.width / ROPE_DRAW_W;
  return { transform: `translate(${a.x.toFixed(2)} ${a.y.toFixed(2)}) rotate(${ang.toFixed(3)}) scale(1 ${k.toFixed(3)})`, len };
};

/** 줄의 무늬(꼬임, 입체, 섬유 결). 왼쪽에 늘어진 도르래 밧줄(HaulRope)도 같은 무늬를 쓴다 */
export function RopeDefs() {
  return (
    <defs>
      {/* 꼬임 무늬: 줄 막대의 안쪽 좌표에 붙어 있어(가로가 줄 방향) 줄과 함께 움직인다. 어두운 홈, 중간 결, 빛 받는 가닥 */}
      <pattern id="q7Twist" width="8.4" height="8.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
        <rect width="8.4" height="8.4" fill="none" />
        <rect x="0" y="0" width="2.3" height="8.4" fill="#0e0905" />
        <rect x="2.3" y="0" width="1.6" height="8.4" fill="#2a2013" opacity="0.7" />
        <rect x="4.1" y="0" width="1.3" height="8.4" fill="#8d7a56" opacity="0.5" />
        <rect x="5.4" y="0" width="1.0" height="8.4" fill="#3a2e1d" opacity="0.6" />
      </pattern>
      {/* 입체감: 위는 빛, 아래는 그늘 */}
      <linearGradient id="q7RopeShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#d8c59c" stopOpacity="0.22" />
        <stop offset="38%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
      </linearGradient>
      {/* 삼실의 거친 결: 줄 방향으로 길게 이어진 가는 섬유 얼룩 */}
      <filter id="q7RopeFibre" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.035 0.85" numOctaves="3" seed="4" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.04  0 0 0 0 0.03  0 0 0 0 0.015  1.4 0 0 0 -0.52" />
      </filter>
    </defs>
  );
}

export default function PulleyRopes({ drive }: { drive: MutableRefObject<RopeDrive> }) {
  const refs = useRef<(SVGGElement | null)[]>([]);
  useAnimationFrame(() => {
    const { th, bob } = drive.current;
    for (let i = 0; i < ROPE_COUNT; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const { transform, len } = ropeTransform(i, th, bob);
      g.setAttribute('transform', transform);
      for (const p of Array.from(g.querySelectorAll('[data-len]'))) p.setAttribute('width', len.toFixed(2));
    }
  });
  const w = ROPE_DRAW_W;
  return (
    <g aria-hidden>
      <RopeDefs />
      {Array.from({ length: ROPE_COUNT }, (_, i) => {
        const { transform, len } = ropeTransform(i, 0, 0);
        return (
          <g key={i} ref={(el) => { refs.current[i] = el; }} transform={transform}>
            {/* 아래쪽에 드리운 그림자 */}
            <rect data-len x={0} y={-w / 2 - 1} width={len} height={w + 3} rx={w / 2} fill="#05080d" opacity={0.5} transform="translate(1.2 2.2)" />
            {/* 밧줄 바탕색 (어두운 삼 빛깔) */}
            <rect data-len x={0} y={-w / 2} width={len} height={w} rx={w / 2} fill="#4b3e2b" />
            {/* 꼬임 무늬(홈과 결) */}
            <rect data-len x={0} y={-w / 2} width={len} height={w} rx={w / 2} fill="url(#q7Twist)" />
            {/* 섬유 결 */}
            <rect data-len x={0} y={-w / 2} width={len} height={w} rx={w / 2} filter="url(#q7RopeFibre)" opacity={0.75} />
            {/* 위는 빛, 아래는 그늘 */}
            <rect data-len x={0} y={-w / 2} width={len} height={w} rx={w / 2} fill="url(#q7RopeShade)" />
            {/* 맨 위 가장자리에 스치는 가는 빛 */}
            <rect data-len x={0} y={-w / 2 + 0.5} width={len} height={Math.max(0.8, w * 0.12)} rx={0.5} fill="#bda77b" opacity={0.3} />
          </g>
        );
      })}
    </g>
  );
}
