'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform, useAnimationFrame, animate } from 'framer-motion';
import type { RendererProps } from '@/engine/renderers';
import { unlock } from '@/engine/achievements';
import { playThud, playRatchet, playSplash } from '@/lib/synth';
import { OfficerBoat, useOfficerStates } from './officer';
import Mist from './Mist';
import HullRope from './HullRope';
import SpeechBubble from './SpeechBubble';
import { STAGE_RATIO } from './LifeboatStage';
import { pick, type Line } from './officerLines';
import PulleyRopes, { type RopeDrive } from './PulleyRopes';

/**
 * WB "다리 연출": Q7 에서 구명정에 못 탄 판이 W1(난간)으로 가기 전에 거치는 장면. Q7 과 같은 그림(배경판, 구명정)을 쓴다.
 *  1. 구명정이 줄과 함께 아래로 내려가 사라진다.
 *  2. 갑판이 기운다.
 *  3. 난간 붙잡기: 조여드는 고리가 안쪽 원과 맞을 때 누른다(클릭, 터치, 스페이스). 두 번 맞추면 매달린다: 첫 번째는 오른손, 두 번째는 왼손.
 *     고리는 그 손이 쥘 난간 자리에 나타난다. 두 번 놓치면 손이 미끄러져 바다로 떨어진다. 떨어진 판은 W1 을 건너뛰고 체력이 깎인 채 W2(헤엄)로 간다.
 * 건너뛰기는 1·2 단계만 넘기고 붙잡기는 직접 해야 한다.
 */

const W = 1376;
const H = 768;
/** Q7 에서 선택을 끝낸 순간의 카메라(LifeboatStage 의 CAMERA 와 같은 값): 이 자리에서 시작해 부드럽게 제자리로 돌아와 장면이 끊기지 않고 이어진다 */
const FROM_CAM: Record<string, { scale: number; rotate: number }> = {
  yield_weak: { scale: 1.1, rotate: -2 },
  yield_seat: { scale: 1.05, rotate: -3 },
  observe: { scale: 1.08, rotate: -2 },
  me_first: { scale: 1.3, rotate: -2 },
};
const SEAT_ORIGIN = '67.3% 44.9%'; // Q7 카메라의 중심(빈자리)
const RAIL_HAND = { w: 112, h: 139 }; // 난간을 쥔 주먹 그림의 크기 (난간 그림 좌표 1000x600)
const OPEN_HAND = { w: 116, h: 146 }; // 난간을 쥐기 전에 뻗은 편 손 그림의 크기
const DROP = 760; // 구명정이 내려가는 거리 (배경판 좌표)
const TILT = 13; // 갑판이 기우는 각도 (천천히 기운다)

/** 붙잡기 한 번의 길이(ms)와 판정 폭(px): 갈수록 빨라지고 좁아진다 */
const ROUNDS = [{ dur: 1800, tol: 20 }, { dur: 1350, tol: 13 }];
const NEED = ROUNDS.length;
const MISS_MAX = 2;
const R0 = 130; // 고리의 처음 반지름
const R_TARGET = 42; // 안쪽 원
/** 손마다 난간을 쥐는 자리(난간 그림 좌표 1000x600, 난간이 -13도 기울어 있는 것을 반영). 첫 번째는 오른손, 두 번째는 왼손 */
/** 난간 각도가 천천히 변하므로 쥐는 자리도 각도에 따라 계산한다: 손이 놓이는 점(난간 그림 좌표, 회전 전)을 (500, 360) 둘레로 돌린 위치 */
const grabAt = (side: 1 | -1, angleDeg: number) => {
  const a = (angleDeg * Math.PI) / 180; const dx = side * 118; const dy = 32;
  return { x: 500 + dx * Math.cos(a) - dy * Math.sin(a), y: 360 + dx * Math.sin(a) + dy * Math.cos(a) };
};
/** 슬로 모션: 갑판이 기우는 시간(초)과 난간 붙잡기 동안 난간이 마저 기우는 각도의 시작·끝 */
const TILT_SECS = 8;
const RAIL_FROM = -3;
const RAIL_TO = -15;
const RAIL_SECS = 9;
const handSideOf = (caught: number): 1 | -1 => (caught === 0 ? 1 : -1);
const R_END = 14;

type Phase = 'leave' | 'tilt' | 'grip' | 'held' | 'slip';

export default function DeckBridge({ onAnswer, extras, answers }: RendererProps) {
  const reduce = useReducedMotion();
  const have = useOfficerStates();
  const female = answers?.sex === 'female';
  const fin = typeof answers?.finalAction === 'string' ? answers.finalAction : '';
  const fromCam = FROM_CAM[fin] ?? { scale: 1.06, rotate: 0 };
  // Q7 에서 구명정이 이미 내려가 있던 만큼(도르래를 내렸거나 가만히 있었으면 끝까지)에서 이어서 내려간다
  const startBob = fin === 'yield_seat' || fin === 'observe' ? 150 : 40;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const boatY = useMotionValue(startBob);
  const drive = useRef<RopeDrive>({ th: 0, bob: startBob });
  useAnimationFrame(() => { drive.current.bob = boatY.get(); });
  const bubbleY = useTransform(boatY, (v) => `${(v / H) * 100}%`);
  const [speech, setSpeech] = useState<{ text: string; key: number; face?: Line['face'] } | null>(null);
  const speechKey = useRef(0);
  const say = useCallback((l: Line, ms = 2200) => {
    const key = ++speechKey.current;
    setSpeech({ text: l.t, key, face: l.face });
    timers.current.push(setTimeout(() => setSpeech((c) => (c?.key === key ? null : c)), ms));
  }, []);
  const [phase, setPhase] = useState<Phase>('leave');
  const [caught, setCaught] = useState(0);
  const [misses, setMisses] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const [dark, setDark] = useState(false);
  const [railAngle, setRailAngle] = useState(RAIL_FROM); // 난간을 붙잡는 동안에도 난간이 천천히 마저 기운다
  const ringRef = useRef<SVGCircleElement>(null);
  const live = useRef<{ start: number; dur: number; tol: number } | null>(null);
  const tally = useRef({ caught: 0, misses: 0 });
  const done = useRef(false);


  // 1·2 단계: 구명정이 떠나고 갑판이 기운다
  useEffect(() => {
    const k = reduce ? 0.35 : 1;
    const ctl = animate(boatY, DROP, { delay: reduce ? 0 : 0.2, duration: reduce ? 0.8 : 3.3, ease: 'easeIn' });
    if (!reduce) for (let i = 0; i < 5; i++) later(() => playRatchet(), 700 + i * 520);
    const child = extras?.childBoarded === true;
    later(() => say(extras?.pushedIn === true ? pick('bridgeLeavePushed') : child ? pick('bridgeLeaveChild') : pick('bridgeLeave')), 500 * k);
    later(() => say(pick('bridgeLeave2')), 2300 * k);
    later(() => say(pick('bridgeTilt'), 3200), 5200 * k);
    later(() => { setPhase((p) => (p === 'leave' ? 'tilt' : p)); if (!reduce) playThud(); }, 3900 * k);
    later(() => setPhase((p) => (p === 'tilt' ? 'grip' : p)), 8600 * k); // 갑판이 한참 기운 뒤에 난간을 붙잡는다
    return () => ctl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase('grip');
  };

  const finish = useCallback((ok: boolean) => {
    if (done.current) return;
    done.current = true;
    const m = tally.current.misses;
    if (ok) {
      setPhase('held');
      if (m === 0) unlock('one-grab');
      later(() => setDark(true), reduce ? 900 : 2300);
      later(() => onAnswer('held', { grip: { misses: m, fail: false } }), reduce ? 1300 : 3000);
    } else {
      setPhase('slip');
      unlock('slipped-hand');
      later(() => { if (!reduce) playSplash(); }, 1500);
      later(() => setDark(true), reduce ? 900 : 2300);
      later(() => onAnswer('slipped', { grip: { misses: m, fail: true } }), reduce ? 1300 : 3200);
    }
  }, [later, onAnswer, reduce]);

  /** 한 번의 시도가 끝났다 (맞췄거나 놓쳤거나) */
  const resolve = useCallback((hit: boolean) => {
    if (!live.current) return;
    live.current = null;
    setFlash(hit ? 'hit' : 'miss');
    if (!reduce) playThud();
    if (hit) { tally.current.caught += 1; setCaught(tally.current.caught); }
    else { tally.current.misses += 1; setMisses(tally.current.misses); }
    if (tally.current.caught >= NEED) { finish(true); return; }
    if (tally.current.misses >= MISS_MAX) { finish(false); return; }
    later(() => { setFlash(null); setAttempt((a) => a + 1); }, 650);
  }, [finish, later, reduce]);

  // 3 단계: 고리가 조여든다
  useEffect(() => {
    if (phase !== 'grip') return;
    const round = ROUNDS[Math.min(tally.current.caught, NEED - 1)];
    const dur = round.dur * (reduce ? 1.7 : 1);
    const tol = round.tol * (reduce ? 1.6 : 1);
    let raf = 0;
    const begin = setTimeout(() => {
      live.current = { start: performance.now(), dur, tol };
      const tick = () => {
        const cur = live.current;
        if (!cur) return;
        const r = R0 + (R_END - R0) * ((performance.now() - cur.start) / cur.dur);
        ringRef.current?.setAttribute('r', String(Math.max(R_END, r)));
        const inZone = Math.abs(r - R_TARGET) <= cur.tol; // 맞출 구간에 들어오면 고리가 금빛으로 굵어진다
        ringRef.current?.setAttribute('stroke', inZone ? '#ffd68c' : '#fff3d6');
        ringRef.current?.setAttribute('stroke-width', inZone ? '7' : '4');
        if (r < R_TARGET - cur.tol) { resolve(false); return; } // 누르지 않고 지나쳤다
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, 500);
    return () => { clearTimeout(begin); cancelAnimationFrame(raf); };
  }, [phase, attempt, reduce, resolve]);

  const press = useCallback(() => {
    const cur = live.current;
    if (!cur) return;
    const r = R0 + (R_END - R0) * ((performance.now() - cur.start) / cur.dur);
    resolve(Math.abs(r - R_TARGET) <= cur.tol);
  }, [resolve]);

  useEffect(() => {
    if (phase !== 'grip') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); press(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, press]);

  const gripping = phase === 'grip' || phase === 'held';
  useEffect(() => {
    if (!gripping) return;
    const ctl = animate(RAIL_FROM, RAIL_TO, { duration: reduce ? 0.6 : RAIL_SECS, ease: [0.3, 0, 0.35, 1], onUpdate: (v) => setRailAngle(v) });
    return () => ctl.stop();
  }, [gripping, reduce]);

  const tilted = phase !== 'leave';
  const caption =
    phase === 'leave' ? '구명정이 줄에 매달려 내려갑니다.'
      : phase === 'tilt' ? '갑판이 천천히 기웁니다. 발밑이 미끄러집니다.'
        : phase === 'grip' ? (flash === 'miss' ? '손이 미끄러졌습니다!' : flash === 'hit' ? (caught === 1 ? '오른손으로 난간을 쥐었습니다.' : '두 손으로 쥐었습니다.') : caught === 0 ? '오른손부터: 고리가 원과 겹칠 때 누르세요.' : '이번에는 왼손으로 난간을 붙잡으세요.')
          : phase === 'held' ? '난간을 붙잡았습니다. 곁에서 누군가 같은 난간에 매달려 있습니다.'
            : '손이 미끄러졌습니다. 검은 물이 올라옵니다.';

  return (
    <div
      className="fixed inset-0 z-10 select-none overflow-hidden bg-[#02050b]"
      onPointerDown={phase === 'grip' ? press : undefined}
      style={{ touchAction: 'manipulation', cursor: phase === 'grip' ? 'pointer' : 'default' }}
    >
      {/* 갑판: 기울고, 놓치면 흔들리고, 떨어지면 위로 멀어진다 */}
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: phase === 'leave' ? SEAT_ORIGIN : '50% 62%' }}
        initial={{ rotate: fromCam.rotate, scale: fromCam.scale, y: '0%', opacity: 1 }}
        animate={phase === 'slip'
          ? { rotate: TILT + 9, scale: 0.72, y: '-58%', opacity: 0.15 }
          : { rotate: tilted ? TILT : 0, scale: tilted ? 1.16 : 1, y: '0%', opacity: 1 }}
        transition={phase === 'slip' ? { duration: reduce ? 0.6 : 2.2, ease: [0.5, 0, 0.9, 0.4] } : { duration: reduce ? 0.5 : TILT_SECS, ease: [0.4, 0, 0.3, 1] }}
      >
        <motion.div className="absolute inset-0" key={`shake-${misses}`} animate={misses && !reduce ? { x: [0, -18, 14, -9, 5, 0] } : { x: 0 }} transition={{ duration: 0.5 }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
            {/* 맨 아래: 바다. 구명정과 줄은 그 위, 갑판과 데빗은 구명정보다 위(앞)에 그려 구명정이 갑판을 뚫고 가지 않게 한다 */}
            <image href="/q7/deck_sea.webp" x={0} y={0} width={W} height={H} preserveAspectRatio="none" style={{ filter: 'brightness(.9) saturate(.85) contrast(1.05)' }} />
            <motion.g style={{ y: boatY }} animate={{ opacity: phase === 'grip' || phase === 'held' ? 0 : 1 }} transition={{ duration: 0.6 }}>
              <OfficerBoat face="pity" have={have} />
              <HullRope sway={false} />
            </motion.g>
            {/* 도르래 줄: Q7 과 같은 줄이 구명정을 따라 내려간다 (갑판과 데빗 뒤). 갑판이 기울면 사라진다 */}
            <motion.g animate={{ opacity: tilted ? 0 : 1 }} transition={{ duration: 0.8 }}>
              <PulleyRopes drive={drive} />
            </motion.g>
            {/* 난간을 붙잡는 단계에서는 갑판이 어둠 속으로 천천히 사라진다 */}
            <motion.image
              href="/q7/deck_fg.webp" x={0} y={0} width={W} height={H} preserveAspectRatio="none" style={{ filter: 'brightness(.9) saturate(.85) contrast(1.05)' }}
              initial={{ opacity: 1 }} animate={{ opacity: phase === 'grip' || phase === 'held' ? 0 : 1 }}
              transition={{ duration: reduce ? 0.3 : 0.7, ease: 'easeOut' }}
            />
          </svg>
          {/* 장교의 말풍선: 구명정과 함께 내려간다 (Q7 과 같은 자리) */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: `max(100vw, ${100 * STAGE_RATIO}vh)`, aspectRatio: `${STAGE_RATIO}` }}>
            <motion.div className="absolute inset-0" style={{ y: bubbleY }}>
              <AnimatePresence>
                {speech && <SpeechBubble key={speech.key} text={speech.text} x={53} y={34} shout={speech.face === 'angry'} fear={speech.face === 'pity'} />}
              </AnimatePresence>
            </motion.div>
          </div>
          <Mist front />
        </motion.div>
      </motion.div>

      {/* 시야 가장자리가 어두워진다 */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" animate={{ opacity: tilted ? 1 : 0.35 }} transition={{ duration: 2 }}
        style={{ background: 'radial-gradient(ellipse at 50% 55%, transparent 30%, rgba(2,5,11,.55) 68%, rgba(2,5,11,.95) 100%)' }} />

      {/* 놓칠 때마다 시야 가장자리가 붉게 번쩍인다 */}
      <motion.div aria-hidden key={`miss-${misses}`} className="pointer-events-none absolute inset-0" initial={{ opacity: misses ? 0.6 : 0 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }}
        style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 38%, rgba(190,40,30,.55) 100%)' }} />

      {/* 난간과 조여드는 고리 */}
      <AnimatePresence>
        {(phase === 'grip' || phase === 'held') && (
          <motion.div key="grip" className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <radialGradient id="q7GrabSpot">
                  <stop offset="0%" stopColor="#ffd68c" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#ffd68c" stopOpacity="0" />
                </radialGradient>
              </defs>
              {/* 눈앞의 난간 (임시 모양) */}
              <g transform={`rotate(${railAngle} 500 360)`}>
                <image href="/q7/rail_grip.webp" x={-330} y={282} width={1660} height={412} preserveAspectRatio="none" style={{ filter: 'brightness(.5) saturate(.7) contrast(1.05) hue-rotate(-8deg)' }} />
              </g>
              {/* 이번에 쥘 난간 자리: 부드러운 금빛이 숨 쉬듯 일렁인다 */}
              {phase === 'grip' && (() => {
                const g = grabAt(handSideOf(caught), railAngle);
                return (
                  <motion.circle key={`spot-${caught}`} cx={g.x} cy={g.y} r={78} fill="url(#q7GrabSpot)"
                    initial={{ opacity: 0 }} animate={{ opacity: reduce ? 0.7 : [0.45, 0.85, 0.45] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
                );
              })()}
              {(() => {
                const side = phase === 'held' ? handSideOf(NEED - 1) : handSideOf(caught);
                const g = grabAt(side, railAngle);
                return (
                  <g transform={`translate(${g.x} ${g.y})`}>
                    <circle r={R_TARGET} fill={flash === 'hit' || phase === 'held' ? 'rgba(255,214,140,.35)' : 'rgba(0,0,0,.25)'} stroke={flash === 'miss' ? '#e0553f' : '#ffd68c'} strokeWidth={5} />
                    {phase === 'grip' && !flash && <circle ref={ringRef} r={R0} fill="none" stroke="#fff3d6" strokeWidth={4} opacity={0.95} />}
                    {(flash === 'hit' || phase === 'held') && (
                      <motion.circle r={R_TARGET} fill="none" stroke="#ffd68c" strokeWidth={6} initial={{ scale: 1, opacity: 1 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 0.5 }} />
                    )}
                    {/* 어느 손인지 글자로도 알린다 */}
                    {phase === 'grip' && !flash && (
                      <text y={-R_TARGET - 16} textAnchor="middle" fontSize={22} fontWeight={800} fill="#ffe6b0" stroke="rgba(0,0,0,.7)" strokeWidth={4} paintOrder="stroke" style={{ letterSpacing: '0.12em' }}>
                        {side === 1 ? '오른손' : '왼손'}
                      </text>
                    )}
                    {flash && (
                      <motion.text y={-R_TARGET - 16} textAnchor="middle" fontSize={26} fontWeight={800} fill={flash === 'hit' ? '#ffe6b0' : '#ff9a86'} stroke="rgba(0,0,0,.75)" strokeWidth={4} paintOrder="stroke"
                        initial={{ opacity: 0, y: -R_TARGET - 6 }} animate={{ opacity: 1, y: -R_TARGET - 22 }} transition={{ duration: 0.25 }}>
                        {flash === 'hit' ? '붙잡았다' : '놓쳤다'}
                      </motion.text>
                    )}
                  </g>
                );
              })()}
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 난간을 직접 붙잡는 두 손: 팔이 아래에서 올라와 난간 위로 손가락을 걸어 쥔다. 놓치면 미끄러져 내려가고, 붙잡으면 꽉 쥐고 떤다 */}
      {(phase === 'grip' || phase === 'held' || phase === 'slip') && (
        <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="q7RailHandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000" />
              <stop offset="30%" stopColor="#fff" />
            </linearGradient>
            <mask id="q7RailHandFade" maskContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1">
              <rect x="0" y="0" width="1" height="1" fill="url(#q7RailHandGrad)" />
            </mask>
            <linearGradient id="q7OpenHandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="58%" stopColor="#fff" />
              <stop offset="100%" stopColor="#000" />
            </linearGradient>
            <mask id="q7OpenHandFade" maskContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1">
              <rect x="0" y="0" width="1" height="1" fill="url(#q7OpenHandGrad)" />
            </mask>
          </defs>
          <g transform={`rotate(${railAngle} 500 360)`}>
            {([-1, 1] as const).map((side) => {
              // 한 번 맞출 때마다 한 손씩 난간을 쥔다: 첫 번째는 오른손, 두 번째는 왼손, 세 번째는 두 손으로 몸을 끌어당긴다
              const idx = side === 1 ? 0 : 1;
              const gripped = caught > idx;               // 이미 쥔 손
              const reaching = !gripped && caught === idx; // 지금 고리를 맞추는 손 (아래에서 뻗고 있다)
              const justHit = flash === 'hit' && caught - 1 === idx; // 방금 맞춰서 쥔 손
              const dipping = flash === 'miss' && reaching; // 놓치면 지금 뻗던 손이 미끄러진다
              return (
                <motion.g
                  key={side}
                  initial={{ y: 120, opacity: 0 }}
                  animate={
                    phase === 'slip' ? { y: 150, x: side * 10, rotate: side * 5, opacity: 0 }
                      : dipping ? { y: [55, 98, 55], x: [0, side * -8, 0], opacity: 1 }
                        : justHit ? { y: [55, -8, 0], opacity: 1 }
                          : phase === 'held' ? { y: [0, -2, 0, -1, 0], opacity: 1 }
                            : gripped ? { y: 0, opacity: 1 }
                              : reaching ? { y: 55, opacity: 0.95 }
                                : { y: 120, opacity: 0 }
                  }
                  transition={
                    phase === 'slip' ? { duration: reduce ? 0.5 : 1.3, ease: 'easeIn' }
                      : dipping ? { duration: 0.5 }
                        : justHit ? { duration: reduce ? 0.2 : 0.35, ease: 'easeOut' }
                          : phase === 'held' ? { duration: 0.6, repeat: Infinity }
                            : { duration: reduce ? 0.2 : 0.55, ease: 'easeOut', delay: reaching && caught === 0 ? 0.1 : 0 }
                  }
                >
                  {/* 난간을 쥐기 전(뻗는 중)에는 손을 펴고 있고, 맞추면 주먹을 쥔다. 편 손 그림은 손등이 보이고 엄지가 오른쪽이라 왼손 모양이므로, 오른손은 좌우를 뒤집어 쓴다 */}
                  <motion.image
                    href={female ? '/ui/hand_open_f.webp' : '/ui/hand_open_r.webp'}
                    width={OPEN_HAND.w} height={OPEN_HAND.h}
                    transform={`translate(${500 + side * 118} ${392 + 38}) scale(${side < 0 ? 1 : -1} 1) translate(${-OPEN_HAND.w / 2} ${-OPEN_HAND.h / 2})`}
                    mask="url(#q7OpenHandFade)"
                    initial={false}
                    animate={{ opacity: gripped || phase === 'slip' ? 0 : 1 }}
                    transition={{ duration: reduce ? 0.05 : 0.14 }}
                    style={{ filter: 'drop-shadow(0 5px 6px rgba(0,0,0,.6)) brightness(1.02)' }}
                  />
                  {/* 오른손 그림(손목이 위)을 위아래로 뒤집어 팔이 아래에서 오게 쓰고, 왼손은 좌우도 뒤집는다 */}
                  <motion.image
                    href={female ? '/ui/hand_rope_f.webp' : '/ui/hand_rope_m.webp'}
                    width={RAIL_HAND.w} height={RAIL_HAND.h}
                    transform={`translate(${500 + side * 118} 392) scale(${side < 0 ? -1 : 1} -1) translate(${-RAIL_HAND.w / 2} ${-RAIL_HAND.h / 2})`}
                    mask="url(#q7RailHandFade)"
                    initial={false}
                    animate={{ opacity: gripped || phase === 'slip' ? 1 : 0 }}
                    transition={{ duration: reduce ? 0.05 : 0.1 }}
                    style={{ filter: 'drop-shadow(0 5px 6px rgba(0,0,0,.6)) brightness(1.02)' }}
                  />
                </motion.g>
              );
            })}
          </g>
        </svg>
      )}

      {/* 자막 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[11%] flex justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.p key={caption} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
            className="break-keep rounded bg-black/55 px-5 py-2.5 text-center font-serif text-base text-slate-100 md:text-lg">
            {caption}
          </motion.p>
        </AnimatePresence>
      </div>

      {phase === 'grip' && !flash && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[5%] flex justify-center text-xs tracking-[0.25em] text-slate-300/70">클릭 · 터치 · 스페이스</div>
      )}

      {(phase === 'leave' || phase === 'tilt') && (
        <button type="button" onClick={skip} className="absolute bottom-5 right-5 z-20 rounded border border-slate-500/50 bg-black/50 px-3 py-1.5 text-xs tracking-widest text-slate-300 hover:bg-black/70">
          건너뛰기
        </button>
      )}

      <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-black" initial={{ opacity: 0 }} animate={{ opacity: dark ? 1 : 0 }} transition={{ duration: 0.6 }} />
    </div>
  );
}
