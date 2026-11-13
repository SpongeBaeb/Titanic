'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { pickEpitaph, markEpitaphSeen, EPITAPH_SOURCE, type Epitaph } from '@/engine/epitaphs';
import { createPortal } from 'react-dom';
import { playFadingHeartbeat } from '@/lib/synth';
import ResetLift from '@/components/ui/ResetLift';
import AnalogOverlay from '@/components/ui/AnalogOverlay';
import { clearCollapse } from '@/lib/collapse';

/**
 * 사망 장면 (오리 사무장에게 총을 맞았을 때).
 * 화면이 흑백으로 바래고 가장자리가 붉게 번지다가 어두워지고, 비즐리의 기록에서 뽑은 문구가 한 줄 나타난다.
 * 문구는 매번 다르다(본 문구는 기록해 두고 모두 본 뒤에야 다시 돌린다). 피나 쓰러진 모습은 그리지 않는다.
 * 문구가 나온 뒤 화면 아래에서 놋쇠 승강 장치(RESET 버튼)가 올라온다. 손님이 누르면 버튼이 눌리고 장치가 내려간 뒤 onDone 으로 처음부터 다시 시작한다.
 * 자동으로 넘어가지 않는다. 죽은 것은 기록 속의 몸이고, 되돌리는 것은 기계 앞에 앉아 있는 손님이다. Enter·스페이스로도 누를 수 있다.
 */
export default function DeathCard({ onDone, soft = false, custom }: {
  onDone: () => void;
  soft?: boolean;
  /** 비즐리의 기록 대신 쓸 문구 (예: Q7 에서 아이를 바다에 놓았을 때). 기록 소모 없이 그대로 보여 준다 */
  custom?: { ko: string; en: string; source: string };
}) {
  // soft: 이미 쓰러지는 연출(playCollapse)로 화면이 어두워진 뒤라서, 하얗게 번쩍이지 않고 어둠에서 이어 간다
  const reduce = useReducedMotion();
  // 렌더링 중에는 고르기만 하고, 실제로 화면에 나온 뒤에 기록한다 (개발 모드의 이중 렌더링에도 한 번만 소모된다)
  const [epitaph] = useState<Epitaph | null>(() => (custom ? null : pickEpitaph()));
  const shown = custom ?? (epitaph ? { ko: epitaph.ko, en: epitaph.en, source: `${EPITAPH_SOURCE}, ${epitaph.where}` } : { ko: '', en: '', source: '' });
  const [ready, setReady] = useState(false);
  // 승강 RESET 버튼이 올라올 때가 되면 true (그 사이 문구는 위로 비켜 선다)
  const [armed, setArmed] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    clearCollapse(); // 쓰러진 화면과 눈꺼풀을 걷어낸다
    onDone();
  };

  useEffect(() => {
    if (epitaph) markEpitaphSeen(epitaph.id);
    if (!reduce) playFadingHeartbeat();
    const a = setTimeout(() => setReady(true), reduce ? 400 : 3200);
    // 문구를 읽을 시간을 준 뒤 장치가 올라온다
    const b = setTimeout(() => setArmed(true), reduce ? 1200 : 7000);
    return () => { clearTimeout(a); clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === 'undefined') return null;
  // 쓰러지는 연출은 게임 화면 루트에 걸리므로, 카드는 그 바깥(body)에 그려서 같이 기울지 않게 한다
  return createPortal(
    <motion.div
      role="alertdialog"
      aria-live="assertive"
      aria-label="사망. RESET 버튼을 누르면 처음부터 다시 시작합니다"
      className="fixed inset-0 z-[9000] flex items-center justify-center overflow-hidden"
      initial={{ backgroundColor: soft ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,0.95)' }}
      animate={{ backgroundColor: 'rgba(0,0,0,1)' }}
      transition={{ duration: reduce ? 0.5 : 3.4, ease: 'easeIn', times: [0, 1] }}
      style={{ backdropFilter: 'grayscale(1) contrast(1.1)', WebkitBackdropFilter: 'grayscale(1) contrast(1.1)' }}
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

      {/* 기록이 닫히면 기계 쪽 화면이 서서히 열린다 */}
      <AnalogOverlay />

      {ready && (
        <motion.figure
          initial={{ opacity: 0, y: 12 }}
          // 승강 장치가 올라오면 문구가 위로 비켜서 서로 겹치지 않는다
          animate={{ opacity: 1, y: armed ? '-20vh' : 0 }}
          transition={{ opacity: { duration: 1.8 }, y: { duration: reduce ? 0.3 : 1.4, ease: 'easeInOut' } }}
          className="relative z-10 mx-auto max-w-2xl px-8 text-center"
        >
          <blockquote>
            {/* 글자도 화면이 아날로그로 바뀌는 만큼 색이 살짝 번진다 */}
            <motion.p className="font-title text-xl leading-loose text-ivory md:text-3xl"
              initial={{ textShadow: '0 2px 18px rgba(0,0,0,0.9), 0px 0 0 rgba(255,70,70,0), 0px 0 0 rgba(70,210,255,0)' }}
              animate={{ textShadow: '0 2px 18px rgba(0,0,0,0.9), 2px 0 1px rgba(255,70,70,0.45), -2px 0 1px rgba(70,210,255,0.45)' }}
              transition={{ delay: reduce ? 0 : 1.2, duration: reduce ? 0.4 : 4 }}>{shown.ko}</motion.p>
            <p lang="en" className="mt-5 font-serif text-sm italic leading-relaxed text-muted-ivory/80 md:text-base">{shown.en}</p>
          </blockquote>
          <figcaption className="mt-6 text-xs tracking-wide text-muted-ivory/70 md:text-sm">
            — {shown.source}
          </figcaption>
        </motion.figure>
      )}

      {/* RESET 승강 장치: 화면 아래에서 올라온다. 누르면 처음부터 다시 시작한다 */}
      <ResetLift armed={armed} onReset={finish} />
    </motion.div>,
    document.body,
  );
}
