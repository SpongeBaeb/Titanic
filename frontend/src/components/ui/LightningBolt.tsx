'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * 실제 번개에 가깝게 그린 번개: 하늘에서 맞은 자리까지 이어지는 불규칙한 방전 길(중점 변위로 만든 갈라지는 꺾임)과
 * 가지, 푸른 흰빛의 핵과 번지는 빛, 두세 번 되살아나는 깜빡임(재방전), 하늘 전체가 번쩍이는 섬광, 맞은 자리의 불빛.
 * 곧은 선을 늘려 그린 만화식 번개 대신, 매번 모양이 다르다.
 */
type P = [number, number];

/** 중점 변위: 두 점 사이를 반복해서 쪼개며 옆으로 흔든다 (흔들림 폭은 조각이 짧아질수록 줄어든다) */
function jag(a: P, b: P, rough: number, depth: number): P[] {
  if (depth === 0) return [a, b];
  const mx = (a[0] + b[0]) / 2; const my = (a[1] + b[1]) / 2;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / (len || 1); const ny = (b[0] - a[0]) / (len || 1);
  const off = (Math.random() - 0.5) * len * rough;
  const m: P = [mx + nx * off, my + ny * off];
  return [...jag(a, m, rough, depth - 1).slice(0, -1), ...jag(m, b, rough, depth - 1)];
}

const toPoints = (pts: P[]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

export default function LightningBolt({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const bolt = useMemo(() => {
    const top: P = [x + (Math.random() - 0.5) * 140, -10];
    const end: P = [x, y];
    const main = jag(top, end, 0.5, 7);
    // 가지: 본줄기의 중간쯤에서 아래쪽 바깥으로 뻗는다. 가지에서 다시 짧은 가지가 한 번 더 갈라지기도 한다
    const branches: { pts: P[]; w: number }[] = [];
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const k = Math.floor(main.length * (0.2 + Math.random() * 0.62));
      const s = main[k]; const dir = Math.random() < 0.5 ? -1 : 1;
      const L = (y - s[1]) * (0.18 + Math.random() * 0.3);
      const e: P = [s[0] + dir * (L * (0.5 + Math.random() * 0.6)), s[1] + L * (0.7 + Math.random() * 0.5)];
      const bp = jag(s, e, 0.55, 5);
      branches.push({ pts: bp, w: 0.55 });
      if (Math.random() < 0.6 && bp.length > 6) {
        const s2 = bp[Math.floor(bp.length * 0.5)]; const d2 = dir * (Math.random() < 0.5 ? -1 : 1);
        branches.push({ pts: jag(s2, [s2[0] + d2 * L * 0.4, s2[1] + L * 0.45], 0.6, 4), w: 0.35 });
      }
    }
    return { main: toPoints(main), branches: branches.map((b) => ({ pts: toPoints(b.pts), w: b.w })) };
  }, [x, y]);

  // 재방전: 번개는 같은 길로 여러 번 번쩍인다 (밝게-어둡게-더 밝게-희미하게)
  const flicker = [0, 1, 0.25, 0.95, 0.1, 0.55, 0.12, 0.3, 0];
  const times = [0, 0.06, 0.14, 0.2, 0.3, 0.38, 0.5, 0.62, 1];
  const dur = 0.95;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {/* 하늘 전체가 푸르스름하게 번쩍인다 */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(200,220,255,0.85), rgba(120,150,255,0.25) 55%, rgba(60,70,140,0) 80%)', mixBlendMode: 'screen' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0.1, 0.45, 0.05, 0.2, 0] }}
        transition={{ duration: dur, times: [0, 0.06, 0.14, 0.2, 0.3, 0.38, 1] }}
      />
      <motion.svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${w} ${h}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: flicker }}
        transition={{ duration: dur, times }}
        aria-hidden
      >
        <defs>
          <filter id="bolt-blur" x="-20%" y="-5%" width="140%" height="110%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="bolt-soft" x="-20%" y="-5%" width="140%" height="110%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        {/* 번지는 빛 → 푸른 겉 → 흰 핵 */}
        <polyline points={bolt.main} fill="none" stroke="#6f93ff" strokeWidth="20" strokeLinejoin="round" strokeLinecap="round" opacity="0.45" filter="url(#bolt-blur)" />
        {bolt.branches.map((b, i) => (
          <polyline key={`g${i}`} points={b.pts} fill="none" stroke="#6f93ff" strokeWidth={9 * b.w * 2} strokeLinejoin="round" opacity="0.35" filter="url(#bolt-blur)" />
        ))}
        <polyline points={bolt.main} fill="none" stroke="#bcd0ff" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" filter="url(#bolt-soft)" />
        {bolt.branches.map((b, i) => (
          <polyline key={`m${i}`} points={b.pts} fill="none" stroke="#bcd0ff" strokeWidth={4 * b.w * 2} strokeLinejoin="round" opacity="0.8" filter="url(#bolt-soft)" />
        ))}
        <polyline points={bolt.main} fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {bolt.branches.map((b, i) => (
          <polyline key={`c${i}`} points={b.pts} fill="none" stroke="#ffffff" strokeWidth={1.4 * b.w * 2} strokeLinejoin="round" />
        ))}
      </motion.svg>

      {/* 맞은 자리: 눈부신 불빛과 튀는 불꽃 */}
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: x, top: y, width: 260, height: 260, background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(170,200,255,0.55) 28%, rgba(110,140,255,0) 70%)' }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: flicker, scale: [0.3, 1.1, 0.8, 1.2, 0.7, 1, 0.8, 0.9, 0.6] }}
        transition={{ duration: dur, times }}
      />
      {Array.from({ length: 9 }).map((_, i) => {
        const a = -Math.PI * (0.1 + Math.random() * 0.8); const d = 40 + Math.random() * 90;
        return (
          <motion.div
            key={i}
            className="absolute h-[3px] w-[3px] rounded-full bg-white"
            style={{ left: x, top: y, boxShadow: '0 0 6px 2px rgba(170,200,255,0.9)' }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(a) * d, y: [0, Math.sin(a) * d, Math.sin(a) * d + 50], opacity: [1, 1, 0] }}
            transition={{ duration: 0.55 + Math.random() * 0.3, delay: 0.04, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}
