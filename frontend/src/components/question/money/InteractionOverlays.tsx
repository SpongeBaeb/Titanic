'use client';

import { motion } from 'framer-motion';

/** 시설 상호작용의 화면 효과 (상태 없이 받은 값만 그린다) */

export interface BubblePop { id: number; x: number; y: number }
export interface WaterZapFx { id: number; paths: string[]; w: number; h: number }

/** 거품이 터진 자리: 고리 하나와 흩날리는 작은 거품들 */
export function BubblePops({ pops }: { pops: BubblePop[] }) {
  return (
    <>
      {pops.map((b) => (
        <div key={b.id} className="pointer-events-none fixed z-[300]" style={{ left: b.x, top: b.y }}>
          <motion.div initial={{ scale: 0.3, opacity: 0.9 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }} className="absolute h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70" />
          {Array.from({ length: 22 }).map((_, i) => {
            const a = ((Math.PI * 2) / 22) * i + Math.random() * 0.3;
            const d = 120 + Math.random() * 220;
            const sz = 10 + Math.random() * 26;
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 0.95, scale: 1 }}
                animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d + 60, opacity: 0, scale: 0.4 }}
                transition={{ duration: 1.2 + Math.random() * 0.5, ease: 'easeOut' }}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/25"
                style={{ width: sz, height: sz }}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}

/** 수영장 물에 친 번개: 수면을 따라 갈라져 퍼지고 물이 번쩍인다 */
export function WaterZap({ zap }: { zap: WaterZapFx | null }) {
  if (!zap) return null;
  return (
    <motion.div
      key={zap.id}
      className="pointer-events-none fixed bottom-0 left-0 z-[56] w-full"
      style={{ height: '15vh' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0.3, 0.9, 0.2, 0] }}
      transition={{ duration: 1.4, times: [0, 0.08, 0.2, 0.35, 0.6, 1] }}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(165,243,252,0.85), rgba(255,255,255,0.15))' }} />
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${zap.w} ${zap.h}`} preserveAspectRatio="none" aria-hidden>
        {zap.paths.map((pts, i) => (
          <polyline key={i} points={pts} fill="none" stroke="#e8fcff" strokeWidth="3" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px #22d3ee)' }} />
        ))}
      </svg>
    </motion.div>
  );
}
