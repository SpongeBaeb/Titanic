'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ENGINE_EVENT, isEngineOn } from '@/lib/ambience';

/**
 * 엔진의 박동을 눈으로도 전한다 (소리를 끄고 있는 사람을 위한 신호).
 * 화면 가장자리가 엔진 박동(약 1.15Hz)에 맞춰 아주 약하게 숨 쉬듯 어두워진다.
 * 엔진이 멎으면(Q6) 이 박동도 함께 멈춘다. 동작 줄이기 설정에서는 나타나지 않는다.
 */
export default function EnginePulse({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(isEngineOn());
    const h = (e: Event) => setOn(!!(e as CustomEvent).detail?.on);
    window.addEventListener(ENGINE_EVENT, h);
    return () => window.removeEventListener(ENGINE_EVENT, h);
  }, []);

  if (reduce || !active || !on) return null;
  return (
    <div
      aria-hidden
      className="engine-pulse pointer-events-none fixed inset-0 z-[5]"
      style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)' }}
    />
  );
}
