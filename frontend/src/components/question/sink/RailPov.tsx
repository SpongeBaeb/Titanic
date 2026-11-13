'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Mood } from './sternScene';

/**
 * 난간 장면(W1)의 가까운 컷: 난간을 붙든 내 눈으로 본 1인칭.
 *
 * 얼굴을 그리지 않고 "손"으로 연기한다. 난간 위에 내 두 손이 있고, 오른쪽에 곁의 승객(노라)의 두 손이 있다.
 *  - 노라의 손은 기분에 따라 다르게 떤다(두려움: 잘게 빠르게, 흐느낌: 크게 들썩임, 가라앉음: 거의 멎음).
 *  - 갑판이 가팔라질수록 손이 난간에서 미끄러졌다가 다시 움켜쥔다.
 *  - 손을 잡으면 내 오른손이 건너가 노라의 손등을 덮어 쥔다. 모진 말을 하면 노라의 손이 움찔 물러난다.
 *  - 노라가 손을 놓으면 손가락이 펴지며 난간 아래로 사라진다. 내가 떨어지면 내 손이 펴지고 난간이 위로 날아간다.
 * 난간 너머로는 밤바다와 수평선이 보이고, 배가 기울수록 수평선이 크게 기운다. 수평선에는 멀어진 구명선의 등불 하나가 떠 있다.
 * 배의 불이 켜져 있는 동안에는 손과 난간에 따뜻한 빛이 닿고, 불이 꺼지면 차가운 별빛만 남는다.
 *
 * 그림은 이미 있는 것을 쓴다: q7/rail_grip(난간), ui/hand_*_r(내 손), ui/hand_*_f(노라의 손), swim/sea_plate(W2 와 같은 밤하늘과 바다).
 */

/** 단계별 갑판의 기울기(도). 수평선과 난간이 서로 반대로 기울어 합이 이만큼 벌어진다 */
const TILT = [5, 10, 16, 23, 33];

type Kind = 'grab' | 'open' | 'reach';
/** 손 그림의 크기와, 그림 안에서 "쥐는 자리"(난간에 놓일 점)의 비율 */
const META: Record<'m' | 'f', Record<Kind, { src: string; w: number; h: number; ax: number; ay: number; k: number }>> = {
  m: {
    grab: { src: '/ui/hand_grab_r.webp', w: 484, h: 430, ax: 0.62, ay: 0.24, k: 1 },
    open: { src: '/ui/hand_open_r.webp', w: 377, h: 475, ax: 0.5, ay: 0.42, k: 0.84 },
    reach: { src: '/ui/hand_reach_r.webp', w: 491, h: 468, ax: 0.62, ay: 0.36, k: 1.04 },
  },
  f: {
    grab: { src: '/ui/hand_grab_f.webp', w: 483, h: 427, ax: 0.62, ay: 0.24, k: 1 },
    open: { src: '/ui/hand_open_f.webp', w: 439, h: 485, ax: 0.5, ay: 0.42, k: 0.9 },
    reach: { src: '/ui/hand_reach_f.webp', w: 499, h: 512, ax: 0.62, ay: 0.36, k: 1.04 },
  },
};

function Hand({ who, kind, flip, w, lit }: { who: 'm' | 'f'; kind: Kind; flip: boolean; w: number; lit: boolean }) {
  const m = META[who][kind];
  const width = w * m.k, height = (width * m.h) / m.w;
  const ax = flip ? 1 - m.ax : m.ax;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.src} alt="" draggable={false} className="absolute max-w-none select-none"
      style={{
        left: -ax * width, top: -m.ay * height, width, height,
        transform: flip ? 'scaleX(-1)' : undefined,
        // 팔뚝은 어둠 속으로 사라진다 (소매 그림이 아직 없다)
        WebkitMaskImage: 'linear-gradient(to bottom, #000 46%, transparent 94%)', maskImage: 'linear-gradient(to bottom, #000 46%, transparent 94%)',
        filter: lit ? `brightness(${who === 'f' ? 0.92 : 0.82}) sepia(.34) saturate(1.25) hue-rotate(-8deg)` : `brightness(${who === 'f' ? 0.7 : 0.58}) saturate(.85)`,
        transition: 'filter 1.4s ease',
      }} />
  );
}

export interface RailPovProps {
  show: boolean;
  beat: number;
  hand: boolean;
  mood: Mood;
  gone: boolean;
  falling: boolean;
  together: boolean;
  /** 값이 바뀔 때마다: 모진 말에 노라의 손이 움찔 물러난다 */
  kickKey: number;
  /** 값이 바뀔 때마다: 잡은 손에 힘을 준다 */
  squeezeKey: number;
  reduce: boolean;
}

export default function RailPov({ show, beat, hand, mood, gone, falling, together, kickKey, squeezeKey, reduce }: RailPovProps) {
  const [vp, setVp] = useState({ w: 600, h: 900 });
  useEffect(() => {
    const f = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const S = Math.min(vp.w, vp.h * 0.8, 680); // 무대의 폭: 손의 크기와 자리가 이 값에 맞춰진다
  const tilt = TILT[Math.min(beat, TILT.length - 1)];
  const lit = beat < 3;

  // 손을 잡는 순간: 잠깐 뻗는 손 모양을 거쳐 쥔 모양으로 바뀐다
  const [reaching, setReaching] = useState(false);
  const wasHand = useRef(false);
  useEffect(() => {
    if (hand && !wasHand.current) {
      wasHand.current = true;
      const a = setTimeout(() => setReaching(true), 0);
      const id = setTimeout(() => setReaching(false), 520);
      return () => { clearTimeout(a); clearTimeout(id); };
    }
    if (!hand) wasHand.current = false;
  }, [hand]);
  // 모진 말: 그때마다 노라의 손이 조금씩 더 멀어진다
  const away = Math.min(3, kickKey);

  const hw = S * 0.47, fw = S * 0.29;
  const herX = S * (0.83 + away * 0.04), herFarX = S * (1.02 + away * 0.045);
  const holding = hand && !gone;
  const myR = holding ? { x: herX - S * 0.1, y: -S * 0.03, rotate: -36 } : { x: S * 0.47, y: 0, rotate: -14 };
  // 노라의 손이 떠는 모양
  const calmer = holding ? 0.45 : 1;
  const shiver = reduce ? {} : mood === 'afraid'
    ? { x: [0, 1.8 * calmer, -1.3 * calmer, 1.5 * calmer, -1.9 * calmer, 0], y: [0, -1.1 * calmer, 1.4 * calmer, -0.8 * calmer, 1.0 * calmer, 0] }
    : mood === 'sob' ? { x: [0, 0.6, 0, -0.5, 0], y: [0, 4.2 * calmer, 0.6, 3.2 * calmer, 0] } : { x: [0, 0.4, 0], y: [0, 0.9, 0] };
  const shiverT = mood === 'afraid' ? { duration: 0.26, repeat: Infinity, ease: 'linear' as const } : mood === 'sob' ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const };
  // 가팔라질수록 자주, 더 많이 미끄러진다
  const slip = reduce || beat < 1 || holding ? {} : { y: [0, 0, 5 + beat * 3, -1, 0], rotate: [0, 0, 3, 0, 0] };
  const slipT = { duration: 5.4 - beat * 0.7, repeat: Infinity, times: [0, 0.8, 0.87, 0.94, 1], ease: 'easeOut' as const };
  const flyRail = falling ? { y: -vp.h * 1.5 } : { y: 0 };
  const flyT = { duration: 0.6, ease: 'easeIn' as const };

  const railW = S * 5.2, railH = railW * (496 / 2000);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] overflow-hidden bg-[#02050b]" style={{ opacity: show ? 1 : 0, transition: 'opacity .14s linear' }}>
      {/* 불이 꺼진 직후에는 아무것도 보이지 않다가, 눈이 어둠에 익는다 */}
      <motion.div className="absolute inset-0" animate={{ filter: lit ? 'brightness(1)' : ['brightness(0.3)', 'brightness(0.95)'] }} transition={{ duration: lit ? 0.4 : 9, ease: 'easeOut' }}>
        {/* 몸이 숨 쉬듯 흔들린다 */}
        <motion.div className="absolute inset-0" animate={reduce ? undefined : { rotate: [0, 0.7, -0.5, 0], y: [0, 5, -3, 0] }} transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}>
          {/* 밤바다와 수평선: 배가 기우는 만큼 반대로 기운다. 떨어지면 수평선이 치솟는다 */}
          <motion.div className="absolute left-1/2 top-[30%]" style={{ width: '210vmax', height: '117vmax', marginLeft: '-105vmax', marginTop: '-55vmax' }}
            initial={false} animate={{ rotate: -tilt * 0.62 + (falling ? -14 : 0), y: falling ? -vp.h * 0.5 : 0 }} transition={falling ? { duration: 0.7, ease: 'easeIn' } : { duration: 5, ease: 'easeInOut' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/swim/sea_plate.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ filter: lit ? 'brightness(.85)' : 'brightness(1.45) contrast(1.05)', transition: 'filter 6s ease' }} />
            {/* 멀어진 구명선의 등불 */}
            <span className="absolute h-[3px] w-[3px] rounded-full bg-amber-200" style={{ left: '54.6%', top: '46.6%', boxShadow: '0 0 6px 2px rgba(255,190,110,.75), 0 0 22px 7px rgba(255,160,80,.28)' }} />
            <span className="absolute w-[2px]" style={{ left: '54.6%', top: '46.9%', height: '1.6%', background: 'linear-gradient(to bottom, rgba(255,180,100,.5), transparent)' }} />
          </motion.div>
          {/* 배의 불빛: 왼쪽 어깨 너머에서 번져 온다 */}
          <motion.div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 60% at -8% 34%, rgba(255,170,90,.42), rgba(255,150,70,.12) 45%, transparent 72%)', mixBlendMode: 'screen' }}
            animate={{ opacity: !lit ? 0 : beat === 2 && !reduce ? [1, 0.35, 0.9, 0.2, 1, 0.75, 0.3, 1] : 1 }}
            transition={!lit ? { duration: 0.25 } : beat === 2 ? { duration: 2.3, repeat: Infinity, ease: 'linear' } : { duration: 0.6 }} />

          {/* 난간과 손: 난간의 윗대가 이 묶음의 원점(0,0)을 지난다 */}
          <motion.div className="absolute left-1/2 top-[41%]" style={{ width: 0, height: 0 }} initial={false} animate={{ rotate: tilt * 0.38 }} transition={{ duration: 5, ease: 'easeInOut' }}>
            <div className="absolute" style={{ left: -S / 2, top: 0, width: 0, height: 0 }}>
              <motion.div className="absolute" initial={false} animate={flyRail} transition={flyT}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/q7/rail_grip.webp" alt="" draggable={false} className="absolute max-w-none"
                  style={{ left: S / 2 - railW / 2 + S * 0.31, top: -railH * (90 / 496), width: railW, height: railH, filter: lit ? 'brightness(.62) sepia(.45) saturate(1.2) hue-rotate(-12deg)' : 'brightness(.42) saturate(.7)', transition: 'filter 1.4s ease' }} />
                {/* 노라의 두 손 (함께 떨어질 때 가까운 손은 내 손과 함께 남는다) */}
                {[0, 1].map((far) => {
                  if (far === 0 && falling && together) return null;
                  return (
                    <motion.div key={far} className="absolute" style={{ width: 0, height: 0, opacity: far ? 0.82 : 1 }} initial={false}
                      animate={gone ? { x: (far ? herFarX : herX) + S * 0.16, y: S * 0.95, rotate: 46, opacity: 0 } : { x: far ? herFarX : herX, y: 0, rotate: far ? 15 : 9 }}
                      transition={gone ? { duration: far ? 0.95 : 1.25, ease: 'easeIn', delay: far ? 0 : 0.35 } : { type: 'spring', stiffness: 160, damping: 13 }}>
                      <motion.div animate={gone ? {} : slip} transition={{ ...slipT, delay: far ? 1.3 : 0 }}>
                        <motion.div animate={gone ? {} : shiver} transition={shiverT}>
                          <motion.div key={far ? 'far' : `near-${squeezeKey}`} initial={{ scale: far || squeezeKey === 0 ? 1 : 0.92 }} animate={{ scale: 1 }} transition={{ duration: 0.5 }}>
                            <Hand who="f" kind={gone ? 'open' : 'grab'} flip w={far ? fw * 0.86 : fw} lit={lit} />
                          </motion.div>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* 어깨와 외투의 어둠: 팔뚝이 바다 위에 떠 보이지 않도록, 손 아래를 몸의 그림자로 채운다 */}
              <span className="absolute rounded-[50%]" style={{ left: -S * 0.36, top: S * 0.07, width: S * 1.32, height: S * 1.5, background: 'radial-gradient(closest-side, rgba(2,4,8,.98) 74%, rgba(2,4,8,0) 100%)' }} />
              {!gone && !falling && <span className="absolute rounded-[50%]" style={{ left: herX - S * 0.22, top: S * 0.05, width: S * 0.9, height: S * 1.3, background: 'radial-gradient(closest-side, rgba(2,4,8,.97) 74%, rgba(2,4,8,0) 100%)' }} />}
              {/* 함께 떨어질 때: 노라의 손은 내 손 아래에 그대로 쥐여 있다 */}
              {falling && together && (
                <motion.div className="absolute" style={{ width: 0, height: 0 }} initial={{ x: herX, y: 0, rotate: 9 }} animate={{ x: herX - S * 0.05, y: S * 0.1, rotate: 2 }} transition={{ duration: 0.6 }}>
                  <Hand who="f" kind="grab" flip w={fw} lit={lit} />
                </motion.div>
              )}
              {/* 내 왼손 */}
              <motion.div className="absolute" style={{ width: 0, height: 0 }} initial={false}
                animate={falling ? { x: S * 0.16, y: S * 0.14, rotate: 4 } : { x: S * 0.17, y: 0, rotate: 20 }} transition={falling ? { duration: 0.5 } : { duration: 0.4 }}>
                <motion.div animate={reduce || falling ? {} : { x: [0, 0.7, -0.6, 0], y: [0, 0.6, -0.5, 0] }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}>
                  <Hand who="m" kind={falling ? 'open' : 'grab'} flip w={hw} lit={lit} />
                </motion.div>
              </motion.div>
              {/* 내 오른손: 손을 잡으면 노라의 손등 위로 건너간다 */}
              <motion.div className="absolute" style={{ width: 0, height: 0 }} initial={false}
                animate={falling ? (together ? { x: herX - S * 0.085, y: S * 0.07, rotate: -32 } : { x: S * 0.56, y: S * 0.16, rotate: -6 }) : myR}
                transition={falling ? { duration: 0.5 } : { type: 'spring', stiffness: 90, damping: 14 }}>
                <motion.div animate={reduce || falling ? {} : { x: [0, -0.7, 0.6, 0], y: [0, -0.5, 0.6, 0] }} transition={{ duration: 0.36, repeat: Infinity, ease: 'linear' }}>
                  <motion.div key={`sq-${squeezeKey}`} initial={{ scale: squeezeKey === 0 ? 1 : 0.9 }} animate={{ scale: 1 }} transition={{ duration: 0.55 }}>
                    <Hand who="m" kind={falling && !together ? 'open' : reaching ? 'reach' : 'grab'} flip={false} w={hw} lit={lit} />
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>

          {/* 입김 */}
          {!reduce && !falling && [0, 1].map((i) => (
            <motion.span key={i} className="absolute rounded-full" style={{ left: '38%', top: '58%', width: S * 0.3, height: S * 0.3, background: 'radial-gradient(circle, rgba(205,220,240,.5), rgba(205,220,240,0) 68%)', filter: 'blur(6px)' }}
              animate={{ opacity: [0, 0.2, 0], x: [0, -S * 0.12], y: [0, -S * 0.22], scale: [0.5, 1.7] }} transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.1, delay: i * 1.9, ease: 'easeOut' }} />
          ))}
        </motion.div>
      </motion.div>
      {/* 떨어지는 순간의 흐림 */}
      {falling && !reduce && <motion.div className="absolute inset-0 bg-[#02050b]" initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ duration: 0.6, ease: 'easeIn' }} />}
    </div>
  );
}
