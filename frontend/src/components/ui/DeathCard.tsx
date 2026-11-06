'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { pickEpitaph, markEpitaphSeen, EPITAPH_SOURCE, type Epitaph } from '@/engine/epitaphs';
import { playFadingHeartbeat } from '@/lib/synth';

/**
 * 사망 장면 (오리 사무장에게 총을 맞았을 때).
 * 화면이 흑백으로 바래고 가장자리가 붉게 번지다가 어두워지고, 비즐리의 기록에서 뽑은 문구가 한 줄 나타난다.
 * 문구는 매번 다르다(본 문구는 기록해 두고 모두 본 뒤에야 다시 돌린다). 피나 쓰러진 모습은 그리지 않는다.
 * 문구가 나온 뒤 onDone 으로 처음부터 다시 시작한다. 누르거나 Enter 를 눌러 건너뛸 수 있다.
 */
export default function DeathCard({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  // 렌더링 중에는 고르기만 하고, 실제로 화면에 나온 뒤에 기록한다 (개발 모드의 이중 렌더링에도 한 번만 소모된다)
  const picked = useRef<Epitaph | null>(null);
  if (!picked.current) picked.current = pickEpitaph();
  const epitaph = picked.current;
  const [ready, setReady] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    markEpitaphSeen(epitaph.id);
    if (!reduce) playFadingHeartbeat();
    const a = setTimeout(() => setReady(true), reduce ? 400 : 3200);
    const b = setTimeout(finish, reduce ? 6000 : 13000);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') finish(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(a); clearTimeout(b); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      role="alertdialog"
      aria-live="assertive"
      aria-label="사망. 문구 이후 처음부터 다시 시작합니다"
      className="fixed inset-0 z-[9000] flex items-center justify-center overflow-hidden"
      initial={{ backgroundColor: 'rgba(255,255,255,0.95)' }}
      animate={{ backgroundColor: 'rgba(0,0,0,1)' }}
      transition={{ duration: reduce ? 0.5 : 3.4, ease: 'easeIn', times: [0, 1] }}
      style={{ backdropFilter: 'grayscale(1) contrast(1.1)', WebkitBackdropFilter: 'grayscale(1) contrast(1.1)' }}
      onClick={() => { if (ready) finish(); }}
    >
      {/* 붉은 가장자리가 안쪽으로 좁혀 온다 */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.55] }}
        transition={{ duration: reduce ? 0.4 : 2.6, times: [0, 0.35, 1] }}
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 20%, rgba(120,0,10,0.75) 85%, rgba(60,0,5,0.95) 100%)' }}
      />

      {ready && (
        <motion.figure
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.8 }}
          className="relative z-10 mx-auto max-w-2xl px-8 text-center"
        >
          <blockquote>
            <p className="font-title text-xl leading-loose text-ivory md:text-3xl" style={{ textShadow: '0 2px 18px rgba(0,0,0,0.9)' }}>{epitaph.ko}</p>
            <p lang="en" className="mt-5 font-serif text-sm italic leading-relaxed text-muted-ivory/80 md:text-base">{epitaph.en}</p>
          </blockquote>
          <figcaption className="mt-6 text-xs tracking-wide text-muted-ivory/70 md:text-sm">
            — {EPITAPH_SOURCE}, {epitaph.where}
          </figcaption>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.75 }}
            transition={{ delay: 2.4, duration: 1.2 }}
            className="mt-10 text-sm tracking-widest text-white/70"
          >
            처음부터 다시 시작합니다 · 눌러서 지금 시작
          </motion.p>
        </motion.figure>
      )}
    </motion.div>
  );
}
