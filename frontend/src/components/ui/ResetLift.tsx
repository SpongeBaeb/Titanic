'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { playServoRise, playThud } from '@/lib/synth';

type LiftState = 'hidden' | 'up' | 'pressed' | 'down';

// 기둥이 세 마디라서 세 번에 나눠 올라온다: 윗판+첫 마디 → 둘째 마디 → 셋째 마디 (보이는 비율 약 45% → 70% → 100%)
const RISE_S = 2.6;
const RISE_Y = ['102%', '55%', '55%', '30%', '30%', '0%'];
const RISE_T = [0, 0.27, 0.365, 0.635, 0.73, 1];
const RISE_EASE = ['easeInOut', 'linear', 'easeInOut', 'linear', 'easeInOut'] as const;
const FALL_S = 1.3;
const FALL_Y = ['0%', '30%', '30%', '55%', '55%', '102%'];
const FALL_T = [0, 0.27, 0.36, 0.63, 0.72, 1];

/**
 * 타임머신의 RESET 승강 버튼. 기록 밖(기계 쪽)에서 손님이 되돌릴 때 쓴다.
 * armed 가 true 가 되면 화면 아래에서 놋쇠 기둥이 올라오고, 누르면 캡이 들어간 뒤 기둥이 내려가며 onReset 이 불린다.
 * 자동으로 넘어가지 않는다. Enter·스페이스로도 누를 수 있다.
 * 사망 카드(DeathCard)와 강아지 분기 결말(DogResultView)이 같이 쓴다.
 */
export default function ResetLift({ armed, onReset, onLift }: {
  armed: boolean;
  onReset: () => void;
  /** 기둥이 올라오기 시작하는 순간 (위쪽 글을 비켜 주는 데 쓴다) */
  onLift?: (up: boolean) => void;
}) {
  const reduce = useReducedMotion();
  const [lift, setLift] = useState<LiftState>('hidden');
  const liftRef = useRef<LiftState>('hidden');
  const done = useRef(false);
  // 세 마디가 다 올라오기 전에는 눌리지 않는다
  const [settled, setSettled] = useState(false);
  const settledRef = useRef(false);
  const set = (v: LiftState) => { liftRef.current = v; setLift(v); };
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const press = () => {
    if (liftRef.current !== 'up' || !settledRef.current) return;
    set('pressed');
    if (!reduce) playThud();
    timers.current.push(setTimeout(() => {
      set('down');
      if (!reduce) playServoRise(0.8);
    }, reduce ? 150 : 420));
    timers.current.push(setTimeout(() => {
      if (done.current) return;
      done.current = true;
      onReset();
    }, reduce ? 500 : 1500));
  };
  const pressRef = useRef(press);
  useEffect(() => { pressRef.current = press; });

  useEffect(() => {
    if (!armed || liftRef.current !== 'hidden') return;
    set('up');
    onLift?.(true);
    timers.current.push(setTimeout(() => { settledRef.current = true; setSettled(true); }, reduce ? 300 : RISE_S * 1000));
    if (!reduce) {
      // 마디마다 모터가 돌고, 멈출 때 철컥 맞물린다
      const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
      playServoRise(0.6);
      at(700, playThud); at(950, () => playServoRise(0.6));
      at(1650, playThud); at(1900, () => playServoRise(0.6));
      at(2600, playThud);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && liftRef.current === 'up' && settledRef.current) { e.preventDefault(); pressRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    const ts = timers.current;
    return () => { window.removeEventListener('keydown', onKey); ts.forEach(clearTimeout); };
  }, []);

  const shown = lift === 'up' || lift === 'pressed';
  return (
    <motion.button
      type="button"
      onClick={press}
      disabled={lift !== 'up' || !settled}
      aria-label="RESET: 처음부터 다시 시작"
      className="fixed bottom-0 left-1/2 z-[9100] -translate-x-1/2 cursor-pointer disabled:cursor-default"
      style={{ height: 'min(36vh, 440px)', aspectRatio: '423 / 1145', containerType: 'inline-size', filter: 'drop-shadow(0 0 22px rgba(0,0,0,0.9))', pointerEvents: shown ? 'auto' : 'none' }}
      initial={{ y: '102%' }}
      animate={{ y: lift === 'hidden' ? '102%' : lift === 'up' ? (reduce ? '0%' : RISE_Y) : lift === 'pressed' ? 5 : (reduce ? '102%' : FALL_Y) }}
      transition={lift === 'pressed' ? { duration: 0.08 }
        : reduce ? { duration: 0.3 }
          : lift === 'up' ? { duration: RISE_S, times: RISE_T, ease: [...RISE_EASE] }
            : { duration: FALL_S, times: FALL_T, ease: [...RISE_EASE] }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ui/reset_lift_up.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" style={{ opacity: lift === 'pressed' || lift === 'down' ? 0 : 1 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ui/reset_lift_down.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" style={{ opacity: lift === 'pressed' || lift === 'down' ? 1 : 0 }} />
      {/* 명판에 새긴 글자 */}
      <span aria-hidden className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-serif font-black"
        style={{ top: '26.6%', fontSize: '9.5cqw', letterSpacing: '0.22em', color: 'rgba(58,36,8,0.82)', textShadow: '0 1px 0 rgba(255,236,170,0.45), 0 -1px 0 rgba(30,18,4,0.3)' }}>
        RESET
      </span>
    </motion.button>
  );
}
