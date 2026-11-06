'use client';

import { useEffect, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { ProbabilityNumber } from '@/components/ui/ProbabilityNumber';

interface Props {
  from: number;
  to: number;
  /** 세는 데 걸리는 시간(초) */
  duration?: number;
  /** 보여 준 뒤 세기 시작하기까지의 여유(초) */
  delay?: number;
  size?: 'xl' | 'lg';
}

/**
 * 확률이 앞 값에서 새 값으로 점진적으로 커지거나 작아진다.
 * 숫자가 움직이는 동안 색이 방향에 따라 서서히 물들고(올라가면 초록, 내려가면 붉은색), 끝나면 변화량을 작게 보여 준다.
 */
export default function CountingProbability({ from, to, duration = 2.4, delay = 0.7, size = 'xl' }: Props) {
  const reduce = useReducedMotion();
  const decimals = Number.isInteger(from) && Number.isInteger(to) ? 0 : 1;
  const [v, setV] = useState(from);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (reduce || from === to) {
      setV(to);
      setDone(true);
      return;
    }
    setV(from);
    setDone(false);
    const c = animate(from, to, {
      duration,
      delay,
      // 처음엔 천천히 출발해 가속하다 끝에서 부드럽게 멈춘다
      ease: [0.45, 0.05, 0.25, 1],
      onUpdate: (x) => setV(x),
      onComplete: () => {
        setV(to);
        setDone(true);
      },
    });
    return () => c.stop();
  }, [from, to, duration, delay, reduce]);

  const total = to - from;
  const progress = total === 0 ? 1 : (v - from) / total;
  const up = to > from;
  const tone = from === to || progress < 0.25 ? 'ivory' : up ? 'survive' : 'danger';
  const delta = to - from;

  return (
    <div className="flex flex-col items-center">
      <ProbabilityNumber value={v.toFixed(decimals)} size={size} tone={tone} />
      <motion.span
        aria-live="polite"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: done && delta !== 0 ? 1 : 0, y: done && delta !== 0 ? 0 : 8 }}
        transition={{ duration: 0.6 }}
        className={`mt-3 font-numeric text-sm tracking-widest ${up ? 'text-survive' : 'text-danger-text'}`}
      >
        {up ? '▲' : '▼'} {Math.abs(delta).toFixed(decimals)}%p
      </motion.span>
    </div>
  );
}
