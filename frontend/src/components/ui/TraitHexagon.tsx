'use client';

import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { AXES } from '@/engine/traits';

interface Props {
  /** 축 순서(AXES)대로 0~100 */
  values: number[];
  /** 강조할 상위 두 축의 index */
  top: [number, number];
  /** 그려지는 데 걸리는 시간(초) */
  duration?: number;
  delay?: number;
  /** dark: 어두운 바탕(기본), paper: 결과지 종이 위(짙은 잉크색) */
  tone?: 'dark' | 'paper';
}

const PALETTE = {
  dark: { ring: 'rgba(226,205,160,0.16)', ringOuter: 'rgba(226,205,160,0.16)', spoke: 'rgba(226,205,160,0.14)', fillA: 'rgba(251,191,36,0.10)', fillB: 'rgba(251,191,36,0.42)', stroke: 'rgba(252,211,77,0.95)', glow: 'drop-shadow(0 0 10px rgba(251,191,36,0.45))', hot: '#fcd34d', dot: '#e5d3a3', dotEdge: 'rgba(10,8,6,0.8)', label: '#d8c9a6', labelHot: '#fcd34d', num: '#a89a78', numHot: '#fde68a', shadow: 'rgba(251,191,36,0.6)' },
  paper: { ring: 'rgba(90,60,30,0.22)', ringOuter: 'rgba(90,60,30,0.4)', spoke: 'rgba(90,60,30,0.2)', fillA: 'rgba(138,58,20,0.10)', fillB: 'rgba(138,58,20,0.38)', stroke: '#7a3a14', glow: 'none', hot: '#8a2a14', dot: '#5a3a1c', dotEdge: 'rgba(240,226,190,0.9)', label: '#3a2a14', labelHot: '#8a2a14', num: '#6a5128', numHot: '#8a2a14', shadow: 'transparent' },
} as const;

const C = 200; // 중심
const R = 118; // 100점의 반지름
const LABEL_R = R + 40;

const angle = (i: number) => (-90 + i * 60) * (Math.PI / 180); // 위쪽에서 시계 방향
const pt = (i: number, r: number) => [C + Math.cos(angle(i)) * r, C + Math.sin(angle(i)) * r] as const;

/**
 * 성향 육각형: 중심에서 바깥으로 면이 자라며 그려진다.
 * 상위 두 축은 황동색으로 강조하고, 점수 숫자도 함께 올라간다.
 */
export default function TraitHexagon({ values, top, duration = 2.4, delay = 0.5, tone = 'dark' }: Props) {
  const pal = PALETTE[tone];
  const reduce = useReducedMotion();
  const [p, setP] = useState(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      setP(1);
      return;
    }
    setP(0);
    const c = animate(0, 1, { duration, delay, ease: [0.25, 0.6, 0.25, 1], onUpdate: (x) => setP(x) });
    return () => c.stop();
  }, [values, duration, delay, reduce]);

  const poly = values.map((v, i) => pt(i, (Math.max(v, 4) / 100) * R * p).join(',')).join(' ');
  const rings = [25, 50, 75, 100];

  return (
    <svg viewBox="0 0 400 400" className="mx-auto h-auto w-full max-w-[420px]" role="img" aria-label={`성향 육각형: ${AXES.map((a, i) => `${a.ko} ${values[i]}점`).join(', ')}`}>
      <defs>
        <radialGradient id={`hexFill-${tone}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={pal.fillA} />
          <stop offset="100%" stopColor={pal.fillB} />
        </radialGradient>
      </defs>
      {/* 눈금 육각형 */}
      {rings.map((r) => (
        <polygon key={r} points={AXES.map((_, i) => pt(i, (r / 100) * R).join(',')).join(' ')} fill="none" stroke={r === 100 ? pal.ringOuter : pal.ring} strokeWidth={r === 100 ? 1.4 : 1} />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke={pal.spoke} strokeWidth="1" />;
      })}
      {/* 내 성향 */}
      <polygon points={poly} fill={`url(#hexFill-${tone})`} stroke={pal.stroke} strokeWidth="2" strokeLinejoin="round" style={{ filter: pal.glow }} />
      {values.map((v, i) => {
        const [x, y] = pt(i, (Math.max(v, 4) / 100) * R * p);
        const hot = i === top[0] || i === top[1];
        return <circle key={i} cx={x} cy={y} r={hot ? 5.5 : 3.5} fill={hot ? pal.hot : pal.dot} stroke={pal.dotEdge} strokeWidth="1.5" />;
      })}
      {/* 축 이름과 점수 */}
      {AXES.map((a, i) => {
        const [x, y] = pt(i, LABEL_R);
        const hot = i === top[0] || i === top[1];
        const anchor = Math.abs(Math.cos(angle(i))) < 0.2 ? 'middle' : Math.cos(angle(i)) > 0 ? 'start' : 'end';
        return (
          <g key={a.id}>
            <text x={x} y={y - 2} textAnchor={anchor} className="font-serif" fontSize="17" fill={hot ? pal.labelHot : pal.label} style={{ textShadow: hot && tone === 'dark' ? `0 0 8px ${pal.shadow}` : undefined }}>
              {a.ko}
            </text>
            <text x={x} y={y + 17} textAnchor={anchor} className="font-numeric" fontSize="14" fill={hot ? pal.numHot : pal.num}>
              {Math.round(values[i] * p)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
