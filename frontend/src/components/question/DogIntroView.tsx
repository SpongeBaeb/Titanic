'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Question } from '@/data/questions';
import { playLeashSnap } from '@/lib/synth';

interface Props {
  question: Question;
  onAnswer: (value: string) => void;
  onBack: () => void;
}

/** 배경 그림(dog_q1, 1376x768)이 cover 로 깔렸을 때의 화면 좌표 변환 */
function coverMap(vw: number, vh: number) {
  const s = Math.max(vw / 1376, vh / 768);
  return { s, ox: (vw - 1376 * s) / 2, oy: (vh - 768 * s) / 2 };
}

// 배경 그림에서 주인 손에 쥔 목줄 고리의 위치 (그림 좌표)
const LEASH = { x: 292, y: 235 };

/**
 * 강아지 분기의 시작: 트랩 위에서 목줄이 팽팽해지다 툭 끊어진다.
 * 끊어진 순간 화면이 흔들리고, 줄 조각이 튕겨 나간다. 이후 클릭하거나 잠시 뒤 첫 선택으로 넘어간다.
 */
export default function DogIntroView({ onAnswer, onBack }: Props) {
  const reduce = useReducedMotion();
  // 0 팽팽해짐 · 1 끊어짐 · 2 그 뒤
  const [phase, setPhase] = useState(0);
  const [size, setSize] = useState({ w: 1280, h: 720 });
  const done = useRef(false);

  useEffect(() => {
    const upd = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onAnswer('snapped');
  };

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    const snapAt = reduce ? 700 : 2600;
    if (!reduce) t.push(setTimeout(() => playLeashSnap(), snapAt - 1900));
    t.push(setTimeout(() => setPhase(1), snapAt));
    t.push(setTimeout(() => setPhase(2), snapAt + 700));
    t.push(setTimeout(finish, snapAt + (reduce ? 1600 : 5200)));
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && phase >= 2) finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const m = coverMap(size.w, size.h);
  const px = m.ox + LEASH.x * m.s;
  const py = m.oy + LEASH.y * m.s;

  return (
    <motion.div
      className="fixed inset-0 z-10 select-none"
      onClick={() => phase >= 2 && finish()}
      animate={phase === 1 && !reduce ? { x: [0, -16, 14, -9, 6, -2, 0], y: [0, 6, -5, 3, -2, 0, 0] } : { x: 0, y: 0 }}
      transition={{ duration: 0.55 }}
      style={{ cursor: phase >= 2 ? 'pointer' : 'default' }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBack();
        }}
        className="group fixed bottom-8 left-8 z-50 flex items-center text-slate-300 transition-colors hover:text-amber-300"
      >
        <span className="mr-2 transition-transform group-hover:-translate-x-1">←</span>
        <span className="font-sans text-sm uppercase tracking-widest">Back</span>
      </button>

      {/* 팽팽해질 때: 화면이 어둡게 조여 오고 줄 고리가 떨린다 */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.65) 100%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 0 ? [0, 0.7, 0.9] : 0 }}
        transition={{ duration: phase === 0 ? 2.4 : 0.4 }}
      />
      {phase === 0 && !reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: px - 40, top: py - 70, width: 80, height: 140 }}
          animate={{ x: [0, -1.6, 1.6, -2.2, 2.2, -2.8, 2.8, -3.4, 3.4], rotate: [0, -0.8, 0.8, -1.1, 1.1, -1.4, 1.4, -1.8, 1.8] }}
          transition={{ duration: 2.2, ease: 'linear' }}
        />
      )}

      {/* 끊어지는 순간: 번쩍임, 줄 조각, 파편 */}
      <AnimatePresence>
        {phase === 1 && (
          <>
            <motion.div
              key="flash"
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-white"
              initial={{ opacity: 0.55 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            />
            {!reduce && (
              <svg key="strands" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                {/* 손 쪽으로 튕겨 올라가는 줄 */}
                <motion.path
                  d="M0 0 C 12 -26, 38 -34, 64 -22"
                  fill="none"
                  stroke="#8b2a22"
                  strokeWidth={Math.max(5, 7 * m.s)}
                  strokeLinecap="round"
                  style={{ translateX: px, translateY: py }}
                  initial={{ opacity: 1, rotate: 0, scale: 1 }}
                  animate={{ opacity: 0, rotate: -55, scale: 1.25, y: -48, x: -24 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
                {/* 아래로 떨어지는 줄 */}
                <motion.path
                  d="M0 0 C -8 28, 10 60, -4 96"
                  fill="none"
                  stroke="#8b2a22"
                  strokeWidth={Math.max(5, 7 * m.s)}
                  strokeLinecap="round"
                  style={{ translateX: px, translateY: py }}
                  initial={{ opacity: 1, rotate: 0 }}
                  animate={{ opacity: 0, rotate: 42, y: size.h * 0.34, x: -34 }}
                  transition={{ duration: 0.95, ease: [0.5, 0, 0.9, 0.6] }}
                />
                {/* 튀는 올 */}
                {Array.from({ length: 9 }).map((_, i) => {
                  const a = (i / 9) * Math.PI * 2;
                  return (
                    <motion.line
                      key={i}
                      x1={0}
                      y1={0}
                      x2={Math.cos(a) * 8}
                      y2={Math.sin(a) * 8}
                      stroke="#b9503f"
                      strokeWidth={2}
                      strokeLinecap="round"
                      style={{ translateX: px, translateY: py }}
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0, x: Math.cos(a) * 70, y: Math.sin(a) * 70 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                    />
                  );
                })}
              </svg>
            )}
            <motion.div key="snap" aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.12, 1, 1.05] }} transition={{ duration: 0.9, times: [0, 0.15, 0.6, 1] }}>
              <span className="font-title text-7xl font-bold tracking-widest text-[#f5e6bd] [text-shadow:0_4px_24px_rgba(0,0,0,0.9)] md:text-8xl">툭!</span>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 글 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[16%] flex flex-col items-center gap-3 px-8 text-center">
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.p
              key="p0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, delay: 0.3 }}
              className="break-keep font-serif text-lg leading-loose text-[#f4ead2] [text-shadow:0_2px_14px_rgba(0,0,0,0.95)] md:text-xl"
            >
              트랩이 흔들립니다.
              <br />
              사람들이 밀려들고, 목줄이 팽팽하게 당겨집니다.
            </motion.p>
          )}
          {phase >= 2 && (
            <motion.div key="p2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="flex flex-col items-center gap-4">
              <p className="break-keep font-serif text-lg leading-loose text-[#f4ead2] [text-shadow:0_2px_14px_rgba(0,0,0,0.95)] md:text-xl">
                목줄이 끊어졌습니다.
                <br />
                주인의 손이 사람들 사이로 멀어집니다.
              </p>
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 1.6, duration: 1 }} className="font-sans text-[11px] uppercase tracking-[0.3em] text-amber-200/80">
                클릭하여 계속
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
