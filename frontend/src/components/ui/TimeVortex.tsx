'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * 타임머신 소용돌이. 나이 레버를 확정하면 기계가 작동해, 화면이 소용돌이처럼 빨려 들어가다 하얗게 터진다.
 * phase 'in': 나타나서 점점 빨라진다 (약 3.2초, 끝에서 흰색으로 가득 찬다)
 * phase 'out': 흰빛이 걷히며 그 뒤의 장면(카메라 속 항구)이 드러난다
 * QuizContainer 가 장면 전환과 이어 붙이려고 장면 바깥에서 그린다.
 */
// 안쪽에서 바깥으로 이어지는 고리 구간(%): 구간마다 비틀림이 달라 나선이 된다
const SPIRAL: [number, number][] = Array.from({ length: 30 }, (_, i) => [4 + i * 2.5, 4 + (i + 1) * 2.5 + 1.2]);

export default function TimeVortex({ phase }: { phase: 'in' | 'out' }) {
  const reduce = useReducedMotion();
  const IN = reduce ? 0.6 : 3.2;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9500] overflow-hidden bg-black"
      initial={{ opacity: phase === 'in' ? 0 : 1 }}
      animate={{ opacity: phase === 'in' ? 1 : 0 }}
      transition={phase === 'in' ? { duration: 0.35 } : { duration: reduce ? 0.4 : 1.6, ease: 'easeOut' }}
    >
      {phase === 'in' && (
        <>
          {/* 소용돌이 팔: 안쪽 고리일수록 더 비틀려 있어 나선처럼 보인다. 점점 빨라지며 조여든다 */}
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{ width: '170vmax', height: '170vmax', x: '-50%', y: '-50%' }}
            initial={{ rotate: 0, scale: 0.6 }}
            animate={{ rotate: reduce ? 90 : 1500, scale: reduce ? 1 : 1.5 }}
            transition={{ duration: IN, ease: [0.5, 0, 0.9, 0.6] }}
          >
            {SPIRAL.map((r, i) => (
              <div key={i} className="absolute inset-0" style={{
                transform: `rotate(${(SPIRAL.length - i) * 6.5}deg)`,
                background: 'repeating-conic-gradient(from 0deg, rgba(120,220,255,0) 0deg, rgba(120,220,255,0.6) 13deg, rgba(255,205,120,0) 30deg, rgba(255,205,120,0.55) 43deg, rgba(255,255,255,0) 60deg)',
                WebkitMaskImage: `radial-gradient(circle closest-side, rgba(0,0,0,0) ${r[0]}%, #000 ${r[0] + 2}%, #000 ${r[1] - 2}%, rgba(0,0,0,0) ${r[1]}%)`,
                maskImage: `radial-gradient(circle closest-side, rgba(0,0,0,0) ${r[0]}%, #000 ${r[0] + 2}%, #000 ${r[1] - 2}%, rgba(0,0,0,0) ${r[1]}%)`,
              }} />
            ))}
          </motion.div>
          {/* 반대로 도는 가는 팔 */}
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{ width: '150vmax', height: '150vmax', x: '-50%', y: '-50%',
              background: 'repeating-conic-gradient(from 20deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.35) 3deg, rgba(255,255,255,0) 9deg)',
              WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,0) 8%, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 72%)',
              maskImage: 'radial-gradient(circle, rgba(0,0,0,0) 8%, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 72%)' }}
            initial={{ rotate: 0, scale: 0.8 }}
            animate={{ rotate: reduce ? -90 : -2200, scale: reduce ? 1 : 1.9 }}
            transition={{ duration: IN, ease: [0.5, 0, 0.9, 0.6] }}
          />
          {/* 빨려 들어가는 고리들 */}
          {!reduce && [0, 1, 2, 3, 4, 5].map((i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{ width: '120vmax', height: '120vmax', x: '-50%', y: '-50%', border: '2px solid rgba(190,235,255,0.55)', boxShadow: '0 0 40px 6px rgba(120,200,255,0.25), inset 0 0 40px 6px rgba(255,200,120,0.15)' }}
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: 0, opacity: [0, 0.9, 0.9, 0] }}
              transition={{ duration: 1.05, delay: i * 0.5, repeat: 0, ease: [0.6, 0, 0.9, 0.5], times: [0, 0.15, 0.8, 1] }}
            />
          ))}
          {/* 중심에서 커지는 빛 */}
          <motion.div
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{ width: '40vmax', height: '40vmax', x: '-50%', y: '-50%', background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(190,235,255,0.7) 30%, rgba(255,200,120,0) 70%)' }}
            initial={{ scale: 0.05, opacity: 0.3 }}
            animate={{ scale: reduce ? 1 : [0.05, 0.25, 0.5, 6], opacity: [0.3, 0.7, 0.9, 1] }}
            transition={{ duration: IN, times: [0, 0.55, 0.85, 1], ease: 'easeIn' }}
          />
          {/* 기계가 떨리는 느낌: 화면 전체가 가볍게 흔들리는 어두운 가장자리 */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.85) 100%)' }}
            animate={reduce ? undefined : { x: [0, -3, 4, -2, 3, 0], y: [0, 2, -3, 3, -2, 0] }}
            transition={{ duration: 0.18, repeat: Infinity }}
          />
          {/* 끝에서 하얗게 가득 찬다 */}
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1] }}
            transition={{ duration: IN, times: [0, 0.82, 1], ease: 'easeIn' }}
          />
        </>
      )}
      {phase === 'out' && <div className="absolute inset-0 bg-white" />}
    </motion.div>
  );
}
