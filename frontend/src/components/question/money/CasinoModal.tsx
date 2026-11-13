'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Do_Hyeon } from 'next/font/google';
import { FireworkShow, type ShellKind } from '@/components/question/deck/fireworks';
import { playFireworkBurst, playGunshot, playRatchet, playStamp, playTick } from '@/lib/synth';

/** 네온관 글씨: 굵기가 고른 고딕 (유리관을 구부린 듯한 획) */
const neonFont = Do_Hyeon({ weight: '400', subsets: ['latin'], preload: false, display: 'swap' });

/**
 * 선상 도박장 (Q4 돈 쓰기 화면의 '선상 도박'): 1912년 대서양 정기선의 흡연실 내기를 벨 에포크 카지노처럼 꾸몄다.
 * 놀이: 타이타닉호의 하루 항해 거리(480~550해리)를 맞힌다. 범위를 좁게 잡을수록 확률은 낮고 배당은 크다.
 *
 * 화면 구성 (위에서 아래로)
 *  - 전구가 줄지어 깜빡이는 간판, 붉은 벨벳과 금빛 빛살
 *  - 보유 지폐 / 이번 배당 / 연승, 세 개의 큰 계기
 *  - 넓은 항로 눈금 (10해리마다 숫자), 고른 범위 띠, 꽂힌 칼, 큰 숫자 표
 *  - 카지노 칩 모양의 범위 선택 세 개
 *  - 금빛으로 빛나는 베팅 버튼 (그만두기는 작게)
 *  - 결과: 화면을 가로지르는 띠. 이기면 폭죽 (deck/fireworks), 지면 "한 번만 더" 가 유혹한다
 */

export const GAMBLE_TIERS = [
  { id: 'safe', name: '안전', tol: 11, net: 2, odds: '32%', chip: ['#1b2f7a', '#7fa4ff'], img: '/spend/chip_blue.webp', ink: '#ffffff', zone: 'rgba(90,140,255,0.36)' },
  { id: 'mid', name: '보통', tol: 8, net: 3, odds: '24%', chip: ['#8a6a12', '#ffd75a'], img: '/spend/chip_gold.webp', ink: '#3a2200', zone: 'rgba(255,210,80,0.42)' },
  { id: 'risky', name: '위험', tol: 2, net: 12, odds: '7%', chip: ['#8c1420', '#ff5a68'], img: '/spend/chip_red.webp', ink: '#ffffff', zone: 'rgba(255,70,90,0.5)' },
] as const;
/** 불즈아이: 배가 칼끝 ±1해리 안에 멈추면 받는 돈이 두 배 */
export const BULLSEYE_TOL = 1;
export const BULLSEYE_MULT = 2;
export type GambleTierId = (typeof GAMBLE_TIERS)[number]['id'];
/** 결과 공개 연출: 배가 정답 주변을 오가며 점점 좁혀 든다 */
export const REVEAL_MS = 5200;
const REVEAL_TIMES = [0, 0.28, 0.5, 0.7, 0.86, 1];
const LO = 480;
const HI = 550;
const SPAN = HI - LO;
const SWORD_W = 52;
/** 항로 눈금 상자 높이(px, h-24). 점선 항로는 그 한가운데: 칼끝(그림의 회전 중심)이 여기에 꽂힌다 */
const TRACK_H = 96;
const pct = (d: number) => ((d - LO) / SPAN) * 100;

/** 오리배 그림은 왼쪽을 본다. 오른쪽으로 갈 때만 뒤집는다 */
function shipFlipKeys(path: number[]) {
  const n = Math.min(path.length, REVEAL_TIMES.length);
  if (n < 2) return { vals: [1, 1], times: [0, 1] };
  const dir = (i: number) => (path[i] >= path[i - 1] ? -1 : 1);
  const vals: number[] = []; const times: number[] = [];
  for (let i = 1; i < n; i++) {
    const a = REVEAL_TIMES[i - 1]; const b = REVEAL_TIMES[i]; const d = (b - a) * 0.04;
    vals.push(dir(i), dir(i)); times.push(i === 1 ? 0 : a + d, i === n - 1 ? 1 : b - d);
  }
  return { vals, times };
}

/** 둥근 사각형 둘레 위의 점들 (inset: 바깥 가장자리에서 들어온 거리, r: 바깥 모서리 반지름, gap: 점 간격) */
function roundedRectPoints(w: number, h: number, r: number, inset: number, gap: number) {
  const x0 = inset; const y0 = inset; const x1 = w - inset; const y1 = h - inset;
  const rr = Math.max(0, r - inset);
  const sw = x1 - x0 - 2 * rr; const sh = y1 - y0 - 2 * rr; const arc = (Math.PI / 2) * rr;
  const P = 2 * sw + 2 * sh + 4 * arc;
  if (P <= 0) return [];
  const n = Math.max(8, Math.round(P / gap));
  const at = (s: number) => {
    // 위쪽 직선(왼→오)에서 시작해 시계 방향
    const segs: [number, (u: number) => { x: number; y: number }][] = [
      [sw, (u) => ({ x: x0 + rr + u, y: y0 })],
      [arc, (u) => { const a = -Math.PI / 2 + u / rr; return { x: x1 - rr + rr * Math.cos(a), y: y0 + rr + rr * Math.sin(a) }; }],
      [sh, (u) => ({ x: x1, y: y0 + rr + u })],
      [arc, (u) => { const a = u / rr; return { x: x1 - rr + rr * Math.cos(a), y: y1 - rr + rr * Math.sin(a) }; }],
      [sw, (u) => ({ x: x1 - rr - u, y: y1 })],
      [arc, (u) => { const a = Math.PI / 2 + u / rr; return { x: x0 + rr + rr * Math.cos(a), y: y1 - rr + rr * Math.sin(a) }; }],
      [sh, (u) => ({ x: x0, y: y1 - rr - u })],
      [arc, (u) => { const a = Math.PI + u / rr; return { x: x0 + rr + rr * Math.cos(a), y: y0 + rr + rr * Math.sin(a) }; }],
    ];
    for (const [len, f] of segs) { if (s <= len) return f(s); s -= len; }
    return { x: x0 + rr, y: y0 };
  };
  return Array.from({ length: n }, (_, i) => at((i / n) * P));
}

export type BulbMode = 'idle' | 'fast' | 'dark';
const FRAME_R = 46; // 탁자 바깥 테(레일) 모서리 반지름
const RAIL = 26; // 레일 두께: 전구는 이 한가운데를 따라 늘어선다

/** 탁자 레일을 따라 늘어선 전구 (위에서 본 진짜 전구 그림). 둥근 모서리도 그대로 따라 돈다.
 *  idle: 천천히 물결처럼 / fast: 빠르게 달린다 / dark: 꺼졌다가 하나씩 다시 켜진다 */
function BulbRail({ mode }: { mode: BulbMode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const m = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    m();
    const ro = new ResizeObserver(m); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pts = useMemo(() => (size ? roundedRectPoints(size.w, size.h, FRAME_R, RAIL / 2, 42) : []), [size]);
  const dur = mode === 'fast' ? 0.55 : 1.8;
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-30">
      {pts.map((p, i) => (
        <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y, width: 30, height: 30 }}>
          {/* 켜진 빛: 전구 아래 번지는 노란 빛과 유리 속 필라멘트 빛 */}
          <span className={`casino-glow absolute -inset-[9px] rounded-full ${mode === 'dark' ? 'casino-glow-dark' : ''}`}
            style={{ animationDuration: mode === 'dark' ? '2.2s' : `${dur}s`, animationDelay: mode === 'dark' ? `${(i / pts.length) * 1.4}s` : `${-((i % 5) / 5) * dur}s` }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spend/casino_bulb.webp" alt="" draggable={false} className="relative h-full w-full" />
          <span className={`casino-core absolute inset-[22%] rounded-full ${mode === 'dark' ? 'casino-glow-dark' : ''}`}
            style={{ animationDuration: mode === 'dark' ? '2.2s' : `${dur}s`, animationDelay: mode === 'dark' ? `${(i / pts.length) * 1.4}s` : `${-((i % 5) / 5) * dur}s` }} />
        </span>
      ))}
    </div>
  );
}

/** 나이 설정 화면의 증기 피스톤 머리를 그대로 쓴 −/+ 단추. 꾹 누르면 다라락 빨라진다 */
function PistonKey({ kind, disabled, onPress, size = 58 }: { kind: 'minus' | 'plus'; disabled: boolean; onPress: () => void; size?: number }) {
  const [down, setDown] = useState(false);
  const [bump, setBump] = useState(0);
  const onPressRef = useRef(onPress); onPressRef.current = onPress;
  const disabledRef = useRef(disabled); disabledRef.current = disabled;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const end = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } setDown(false); };
  const start = () => {
    if (disabled) { setBump((n) => n + 1); playRatchet(); return; }
    setDown(true); playRatchet(); onPress();
    let n = 0;
    const tick = () => {
      if (disabledRef.current) { end(); return; }
      n += 1; playRatchet(); onPressRef.current();
      timer.current = setTimeout(tick, n < 4 ? 140 : n < 10 ? 90 : 60);
    };
    timer.current = setTimeout(tick, 420);
  };
  useEffect(() => {
    const up = () => end();
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (timer.current) clearTimeout(timer.current); };
  }, []);
  return (
    <motion.button
      key={bump}
      type="button"
      aria-label={kind === 'minus' ? '한 장 덜 걸기' : '한 장 더 걸기'}
      aria-disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); start(); }}
      onPointerLeave={end}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) start(); } }}
      onKeyUp={end}
      className="relative block shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      style={{ width: size, height: size * 1.033, filter: disabled ? 'brightness(0.55) saturate(0.6)' : 'drop-shadow(0 6px 8px rgba(0,0,0,0.55))' }}
      animate={bump ? { y: [0, 3, 0], x: [0, -2, 2, 0] } : undefined}
      transition={{ duration: 0.2 }}
      whileTap={disabled ? undefined : { y: 3 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/ui/age_piston_${kind}_${down ? 'down' : 'up'}.webp`} alt="" draggable={false} className="pointer-events-none block h-full w-full select-none" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/ui/age_piston_${kind}_down.webp`} alt="" aria-hidden className="pointer-events-none absolute h-0 w-0 opacity-0" />
    </motion.button>
  );
}

/** 네온 간판 글씨: 글자마다 유리관. 한 글자는 접촉이 나빠 가끔 파르르 꺼졌다 켜진다 */
function NeonText({ text, flicker = -1, tone = 'pink', className = '' }: { text: string; flicker?: number; tone?: 'pink' | 'gold' | 'red'; className?: string }) {
  return (
    <span className={`${neonFont.className} neon-${tone} ${className}`}>
      {[...text].map((ch, i) => (
        <span key={i} className={i === flicker ? 'neon-flicker' : ''}>{ch === ' ' ? ' ' : ch}</span>
      ))}
    </span>
  );
}

/** 숫자가 다르륵 올라간다 (지폐 세는 소리와 함께) */
function CountUp({ to, ms = 1100, delay = 250, sound = true }: { to: number; ms?: number; delay?: number; sound?: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; let lastShown = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const u = Math.max(0, Math.min(1, (now - t0) / ms));
      const e = 1 - Math.pow(1 - u, 3);
      const n = Math.round(e * to);
      if (n !== lastShown) { lastShown = n; setV(n); if (sound) playTick(); }
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, delay, sound]);
  return <>{v}</>;
}

/** 쫀득하게 눌리는 버튼: 누르면 아래 두께가 사라지며 푹 꺼지고, 떼면 살짝 튀어 올랐다 자리 잡는다(스프링) */
const SQUISH = {
  whileHover: { scale: 1.05, y: -2 },
  whileTap: { scale: 0.9, y: 5, boxShadow: '0 1px 0 #5a3204, 0 0 14px 3px rgba(255,200,80,0.5)' },
  transition: { type: 'spring' as const, stiffness: 650, damping: 13, mass: 0.6 },
};
const GOLD_BTN = 'rounded-full border-2 border-amber-100 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 font-serif font-black text-[#3a1a00] disabled:opacity-40';
const GOLD_DEPTH = '0 7px 0 #5a3204, 0 9px 18px rgba(0,0,0,0.5), 0 0 26px 6px rgba(255,200,80,0.55)';

/** 고무 오리 삑 소리 (작은 합성음) */
function squeak() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const c = new Ctx(); const t = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1700, t + 0.08); o.frequency.exponentialRampToValueAtTime(1100, t + 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.26);
    setTimeout(() => c.close(), 400);
  } catch { /* 소리를 못 내도 괜찮다 */ }
}

/** 흔들이 고무 오리 관객: 평소에도 머리가 흔들리고, 누르면 삑 하며 머리가 크게 휘청인다.
 *  결과 공개 중에는 초조하게 빨리 흔들고, 이기면 펄쩍 뛰고, 지면 고개를 떨군다 */
function BobbleDuck({ side, mood, delay = 0 }: { side: 'left' | 'right'; mood: 'idle' | 'tense' | 'win' | 'lose'; delay?: number }) {
  const [poke, setPoke] = useState(0);
  const head = mood === 'lose'
    ? { rotate: 28, y: 10, transition: { type: 'spring' as const, stiffness: 120, damping: 8 } }
    : mood === 'win'
      ? { rotate: [0, -24, 24, -24, 0], transition: { duration: 0.5, repeat: Infinity, delay } }
      : { rotate: mood === 'tense' ? [-10, 10, -10] : [-7, 9, -7], transition: { duration: mood === 'tense' ? 0.32 : 1.1, repeat: Infinity, ease: 'easeInOut' as const, delay } };
  return (
    <motion.div
      className="pointer-events-auto absolute bottom-[-18px] z-40 flex w-40 cursor-pointer flex-col items-center md:w-48"
      style={{ [side]: '-3%', filter: 'drop-shadow(3px 6px 8px rgba(0,0,0,0.55))', scaleX: side === 'right' ? -1 : 1 } as React.CSSProperties}
      animate={mood === 'win' ? { y: [0, -26, 0] } : { y: 0 }}
      transition={mood === 'win' ? { duration: 0.5, repeat: Infinity, delay } : { duration: 0.3 }}
      onClick={() => { setPoke((n) => n + 1); squeak(); }}
      role="button"
      aria-label="고무 오리"
    >
      {/* 머리 + 용수철 목: 용수철 위에서 흔들린다. 누를 때마다 크게 휘청였다가 제자리로.
          기울이는 중심은 몸 윗선(용수철 아래 28px 지점, 몸에 가려지는 부분 위): 용수철 맨 아래를 중심으로 돌리면 몸 밖으로 삐져나와 떨어져 보인다 */}
      <motion.div key={`poke-${poke}`} className="relative z-0 -mb-7 flex origin-[50%_calc(100%-1.75rem)] flex-col items-center md:-mb-8 md:origin-[50%_calc(100%-2rem)]"
        initial={poke ? { rotate: 0, y: 0 } : false}
        // y: 몸이 찌그러질 때(아래 몸 scaleY 키프레임, 같은 시간) 윗선이 내려가는 만큼 머리+용수철도 같이 내려가고 올라와, 용수철 아래가 몸에서 떨어지지 않는다
        animate={poke ? { rotate: [0, 40, -32, 22, -14, 8, 0], y: [0, 14, -7, 0] } : undefined}
        transition={{ rotate: { duration: 0.9, ease: 'easeOut' }, y: { duration: 0.45 } }}>
        <motion.div className="flex origin-[50%_calc(100%-1.75rem)] flex-col items-center md:origin-[50%_calc(100%-2rem)]" animate={head}>
          <motion.div className="relative z-10 -mb-5 h-32 w-32 md:h-36 md:w-36"
            initial={false}
            // 머리 y는 아래 용수철 scaleY와 같은 키프레임·시간으로 맞춘다: 용수철 윗단 이동량 = (1-scaleY)×높이(48px). 튕길 때도 머리가 용수철에서 떨어지지 않는다
            // % 단위: 머리 높이 대비 용수철 높이 비(48/128 ≈ 56/144)라 화면 크기가 달라도 용수철 윗단을 따라간다. 평소 흔들림도 용수철과 같은 키프레임·시간
            animate={poke ? { y: ['0%', '-26%', '15%', '-9.4%', '3.75%', '0%'] }
              : mood === 'lose' ? { y: '11.25%' }
                : { y: ['0%', mood === 'tense' ? '7.5%' : '3.75%', '0%'] }}
            transition={poke ? { duration: 0.8, ease: 'easeOut' }
              : mood === 'lose' ? { duration: 0.4 }
                : { duration: mood === 'tense' ? 0.32 : 1.1, repeat: Infinity, ease: 'easeInOut', delay }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/spend/duckhead.webp" alt="" className="h-full w-full object-contain" draggable={false} />
          </motion.div>
          {/* 용수철: 평소에도 살짝 출렁이고, 누르면 늘었다 줄었다 */}
          <motion.div className="h-12 w-9 origin-bottom md:h-14 md:w-10"
            initial={false}
            animate={poke ? { scaleY: [1, 1.7, 0.6, 1.25, 0.9, 1] } : mood === 'lose' ? { scaleY: 0.7 } : { scaleY: [1, mood === 'tense' ? 0.8 : 0.9, 1] }}
            transition={poke ? { duration: 0.8, ease: 'easeOut' } : mood === 'lose' ? { duration: 0.4 } : { duration: mood === 'tense' ? 0.32 : 1.1, repeat: Infinity, ease: 'easeInOut', delay }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/spend/duck_spring.webp" alt="" className="h-full w-full object-fill" draggable={false} />
          </motion.div>
        </motion.div>
      </motion.div>
      {/* 몸: 누르면 찌그러졌다 튀어 오른다 */}
      <motion.div key={`body-${poke}`} initial={poke ? { scaleY: 1 } : false} animate={poke ? { scaleY: [1, 0.88, 1.06, 1], scaleX: [1, 1.12, 0.96, 1] } : undefined}
        transition={{ duration: 0.45 }} className="relative z-10 origin-bottom">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={side === 'right' ? '/spend/duckbody_thumbsup.webp' : '/spend/duckbody.webp'} alt="" className="w-36 object-contain md:w-40" draggable={false} />
      </motion.div>
    </motion.div>
  );
}

/** 이겼을 때 화면 가득 터지는 폭죽 (Q5 갑판과 같은 엔진) */
function CasinoFireworks({ net, exact }: { net: number; exact: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = window.innerWidth; const H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    // 화면 크기에 맞춘 배율: 폭죽 엔진은 1376px 너비 그림 기준이다. 엔진 좌표 = 화면 좌표 / s, 그릴 때 s 배로 키운다
    const s = Math.max(0.7, Math.min(1.4, W / 1376));
    const show = new FireworkShow((H * 1.02) / s);
    const kinds: ShellKind[] = ['radial', 'ring', 'radial', 'willow', 'radial'];
    const n = exact ? 10 : Math.min(7, 3 + Math.floor(net / 2));
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < n; i++) {
      // 가운데 결과 띠를 가리지 않도록 양옆과 위쪽에서 터진다
      const left = i % 2 === 0;
      const x = left ? W * (0.08 + Math.random() * 0.24) : W * (0.68 + Math.random() * 0.24);
      const y = H * (0.12 + Math.random() * 0.26);
      const kind: ShellKind = exact && i === n - 1 ? 'big' : kinds[i % kinds.length];
      timers.push(setTimeout(() => show.launch(x / s, y / s, i, kind, (k) => playFireworkBurst(0.15, k === 'big' ? 1.2 : 0.7)), i * (exact ? 340 : 420)));
    }
    if (exact) timers.push(setTimeout(() => show.launch((W * 0.5) / s, (H * 0.16) / s, 0, 'big', () => playFireworkBurst(0.1, 1.4)), n * 340 + 200));
    const toScr = (x: number, y: number) => ({ x: x * s, y: y * s, s });
    let raf = 0; let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      show.update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      show.draw(ctx, toScr, now / 1000);
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, [net, exact]);
  if (typeof document === 'undefined') return null;
  return createPortal(<canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[480] h-full w-full" />, document.body);
}

/** 다시 걸기 버튼 문구: 딴 승객의 속마음. 연승이 쌓일수록 점점 들뜬다 */
const WIN_LINES = ['돈 벌기 이렇게 쉽다니!', '일 안 해도 되겠는데?', '스위트룸으로 바꾸자!', '역시 이 배를 타길 잘했어!'];
/** 잃은 승객의 속마음: 본전 심리 */
const LOSE_LINES = ['어차피 나갈 돈이었어', '한 달만 더 일하면 돼', '엄마, 미안해…','본전만 찾고 일어나자…', '방금은 운이 없었을 뿐이야', '다음엔 진짜 맞춘다'];

/** 그림 도장(당첨·꽝): 위에서 쾅 찍혀 한 번 눌렸다 자리 잡는다 */
/** 불즈아이 도장에 뚫리는 총알 구멍: 쪽지 폭 기준 % 좌표와 크기, 구멍 그림 번호(1~7), 돌림, 나타나는 때(초) */
interface BulletHole { x: number; y: number; size: number; rot: number; n: number; at: number }
const BULLET_HOLES: BulletHole[] = [
  // 검은 글자 위의 구멍은 묻히므로, 첫 방(정중앙)만 글자 사이에 두고 나머지는 종이가 보이는 틈에 놓는다
  { x: 53, y: 47, size: 25, rot: 0, n: 3, at: 0.75 },
  { x: 24, y: 71, size: 24, rot: 0, n: 1, at: 1.0 },
  { x: 80, y: 66, size: 22, rot: 0, n: 6, at: 1.22 },
  { x: 62, y: 21, size: 24, rot: 0, n: 4, at: 1.44 },
  { x: 38, y: 82, size: 20, rot: 0, n: 7, at: 1.62 },
];

function StampImg({ src, width, delay = 0.1, rot = -6, plate = false, holes }: { src: string; width: number; delay?: number; rot?: number; plate?: boolean; holes?: BulletHole[] }) {
  // plate: 검은 도장이 어두운 띠에 묻히지 않도록, 도장 뒤에 낡은 종이 쪽지를 깐다
  // holes: 도장이 찍힌 뒤 탕, 탕 하며 총알 구멍이 하나씩 뚫린다. 구멍 그림의 흰 바탕은 multiply 로 쪽지 색에 녹아든다
  useEffect(() => {
    if (!holes?.length) return;
    const ts = holes.map((h) => setTimeout(() => playGunshot(), (h.at + 0.02) * 1000));
    return () => ts.forEach(clearTimeout);
  }, [holes]);
  // 구멍 가운데는 쪽지를 실제로 뚫어 뒤가 비쳐 보이게 한다: 쪽지 위에 구멍 모양을 mask 로 오려 낸다. 쪽지 폭을 재어 px 로 놓는다
  const plateRef = useRef<HTMLDivElement>(null);
  const [plateW, setPlateW] = useState(0);
  const [shots, setShots] = useState(0);
  useLayoutEffect(() => {
    const el = plateRef.current;
    if (!el) return;
    const set = () => setPlateW(el.offsetWidth);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!holes?.length) return;
    const ts = holes.map((h, i) => setTimeout(() => setShots(i + 1), h.at * 1000));
    return () => ts.forEach(clearTimeout);
  }, [holes]);
  const cut = useMemo(() => {
    if (!holes?.length || !plateW || shots === 0) return undefined;
    const h = plateRef.current?.offsetHeight ?? plateW * 0.5;
    const live = holes.slice(0, shots);
    const px = (hh: BulletHole) => (hh.size / 100) * plateW;
    const images = [...live.map((hh) => `url('/spend/bullet_${hh.n}_hole.webp')`), 'linear-gradient(#000, #000)'].join(', ');
    const sizes = [...live.map((hh) => `${px(hh)}px ${px(hh)}px`), '100% 100%'].join(', ');
    const poses = [...live.map((hh) => `${(hh.x / 100) * plateW - px(hh) / 2}px ${(hh.y / 100) * plateW * (h / plateW) - px(hh) / 2}px`), '0 0'].join(', ');
    return { WebkitMaskImage: images, maskImage: images, WebkitMaskSize: sizes, maskSize: sizes, WebkitMaskPosition: poses, maskPosition: poses, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskComposite: 'xor', maskComposite: 'exclude' } as React.CSSProperties;
  }, [holes, plateW, shots]);

  // 총을 맞을 때마다 쪽지가 움찔한다
  const jolt = useMemo(() => {
    if (!holes?.length) return null;
    const T = holes[holes.length - 1].at + 0.4;
    const times: number[] = [0], x: number[] = [0], y: number[] = [0];
    holes.forEach((h, i) => {
      const dx = (i % 2 ? 1 : -1) * 5, dy = 3;
      times.push(h.at / T, (h.at + 0.04) / T, (h.at + 0.16) / T); x.push(0, dx, 0); y.push(0, dy, 0);
    });
    times.push(1); x.push(0); y.push(0);
    return { T, times, x, y };
  }, [holes]);
  return (
    <motion.div className="pointer-events-none mx-auto block select-none"
      style={{ width: plate ? width * 1.12 : width, maxWidth: '90vw', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}
      initial={{ scale: 2.4, opacity: 0, rotate: rot + 14 }}
      animate={{ scale: [2.4, 0.93, 1], opacity: [0, 1, 0.97], rotate: rot }}
      transition={{ duration: 0.34, delay, times: [0, 0.72, 1], ease: 'easeOut', rotate: { duration: 0.34, delay } }}>
      <motion.div ref={plateRef} className={`relative ${plate ? 'overflow-hidden rounded-[18px] px-[5%] py-[4%]' : ''}`}
        style={plate ? { background: 'radial-gradient(ellipse at 40% 35%, #f1e5c4 0%, #e3d2a6 62%, #c9b27c 100%)', boxShadow: 'inset 0 0 22px rgba(120,84,30,.45)', border: '1px solid rgba(90,64,24,.6)', ...cut } : undefined}
        animate={jolt ? { x: jolt.x, y: jolt.y } : undefined}
        transition={jolt ? { duration: jolt.T, times: jolt.times, ease: 'easeOut' } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" aria-hidden draggable={false} className="block h-auto w-full" />
        {holes?.map((h, i) => (
          <div key={i} className="absolute" style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.size}%`, aspectRatio: '1', marginLeft: `-${h.size / 2}%`, marginTop: `-${h.size / 2}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img src={`/spend/bullet_${h.n}.webp`} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full"
              style={{ mixBlendMode: 'multiply' }}
              initial={{ scale: 1.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: h.at, duration: 0.09, ease: 'easeOut' }} />
            {/* 총구에서 튀는 불꽃 */}
            <motion.span aria-hidden className="absolute -inset-[60%] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,240,200,.95) 0%, rgba(255,170,60,.55) 28%, transparent 62%)', mixBlendMode: 'screen' }}
              initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 1.25] }} transition={{ delay: h.at, duration: 0.2, times: [0, 0.25, 1] }} />
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
/** ×2 도장: 과녁 고리 그림(stamp_target.webp)을 마스크로 쓰고 색을 입힌다. 가운데에 글씨 */
function StampRing({ ink, delay, rot = -12, children, className = '' }: { ink: string; delay: number; rot?: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={`relative h-28 w-28 ${className}`}
      initial={{ scale: 3.2, opacity: 0, rotate: rot + 20 }}
      animate={{ scale: [3.2, 0.92, 1], opacity: [0, 1, 0.96], rotate: rot }}
      transition={{ duration: 0.34, delay, times: [0, 0.72, 1], ease: 'easeOut', rotate: { duration: 0.34, delay } }}>
      <div aria-hidden className="absolute inset-0" style={{ background: ink, WebkitMask: "url('/spend/stamp_target.webp') center / contain no-repeat", mask: "url('/spend/stamp_target.webp') center / contain no-repeat" }} />
      <div className="absolute inset-0 flex items-center justify-center font-serif text-4xl font-black" style={{ color: ink, textShadow: `0 0 1.5px ${ink}` }}>{children}</div>
    </motion.div>
  );
}
function StampDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <filter id="casinoStampWorn" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75" result="holes" />
          <feComposite in="SourceGraphic" in2="holes" operator="in" result="worn" />
          <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="2" seed="3" result="w" />
          <feDisplacementMap in="worn" in2="w" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

/** 당첨·꽝 연출.
 *  당첨: 하얀 섬광 → '적중!' 도장이 쾅 찍히고 뒤로 빛살이 돈다 → 딴 지폐 수가 다르륵 올라간다.
 *  불즈아이: 과녁 고리가 퍼지고 붉은 '×2' 도장이 한 번 더 찍힌다.
 *  꽝: 붉은 번쩍임과 함께 탁자가 흔들리고 '꽝' 도장이 찍히며, 건 지폐가 날아가 버린다.
 *  빈털터리: 그만하기 대신 "내가 뭘 한 거지…" 하나만 남는다 */
/** 디버그 패널의 미리보기에서도 쓴다 */
export function ResultFx(r: {
  result: 'win' | 'lose' | 'exact'; target: number; gain: number; err: number; nearMiss: boolean; streak: number;
  broke: boolean; canAgain: boolean; nextPayout: number; onAgain: () => void; onClose: () => void;
}) {
  const win = r.result !== 'lose';
  const exact = r.result === 'exact';
  const lost = Math.max(1, -r.gain);
  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    ts.push(setTimeout(() => playStamp(), win ? 280 : 300));
    if (exact) ts.push(setTimeout(() => playStamp(), 1250));
    return () => ts.forEach(clearTimeout);
  }, [win, exact]);
  const flying = useMemo(() => Array.from({ length: Math.min(10, lost + 2) }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * (12 + Math.random() * 34), y: 30 + Math.random() * 40, r: (Math.random() - 0.5) * 900, d: 0.35 + i * 0.06,
  })), [lost]);
  return (
    <motion.div className="fixed inset-0 z-[470] flex items-center justify-center overflow-hidden" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <StampDefs />
      {/* 섬광: 당첨은 하얗게, 꽝은 붉게 */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: win ? '#fff8e0' : 'radial-gradient(ellipse at 50% 50%, rgba(120,0,10,0.2) 0%, rgba(160,0,16,0.85) 100%)' }}
        initial={{ opacity: win ? 0.9 : 0 }} animate={{ opacity: win ? 0 : [0, 0, 1, 0.35] }}
        transition={{ duration: win ? 0.6 : 0.9, times: win ? undefined : [0, 0.3, 0.42, 1] }} />
      {/* 꽝: 화면이 잠깐 잿빛으로 가라앉는다 */}
      {!win && <div aria-hidden className="pointer-events-none absolute inset-0 backdrop-grayscale-[0.7]" />}
      {/* 당첨: 뒤에서 도는 금빛 빛살 */}
      {win && (
        <motion.div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2"
          initial={{ scale: 0, rotate: 0, opacity: 0 }} animate={{ scale: 1, rotate: 360, opacity: 1 }}
          transition={{ scale: { duration: 0.5, ease: 'easeOut' }, opacity: { duration: 0.3 }, rotate: { duration: 22, repeat: Infinity, ease: 'linear' } }}
          style={{ background: `repeating-conic-gradient(from 0deg, rgba(255,${exact ? 90 : 200},${exact ? 120 : 80},0.22) 0deg 6deg, transparent 6deg 15deg)`, WebkitMask: 'radial-gradient(circle, #000 0%, transparent 62%)', mask: 'radial-gradient(circle, #000 0%, transparent 62%)' }} />
      )}
      {/* 불즈아이: 과녁 고리가 퍼진다 */}
      {exact && [0, 1, 2].map((i) => (
        <motion.div key={i} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-[10px] border-rose-500"
          style={{ width: '20vmin', height: '20vmin', marginLeft: '-10vmin', marginTop: '-10vmin', boxShadow: '0 0 30px rgba(255,60,90,0.8)' }}
          initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 7, opacity: 0 }}
          transition={{ duration: 1.6, delay: 0.15 + i * 0.35, repeat: Infinity, repeatDelay: 0.6, ease: 'easeOut' }} />
      ))}
      {/* 꽝: 건 지폐가 휙휙 날아가 버린다 */}
      {!win && flying.map((b, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <motion.img key={i} src="/spend/bill.webp" alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-auto -translate-x-1/2"
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
          animate={{ x: [`0vw`, `${b.x * 0.6}vw`, `${b.x}vw`], y: ['0vh', `-${b.y * 0.5}vh`, `${b.y + 40}vh`], rotate: b.r, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.7, delay: b.d, ease: 'easeIn', times: [0, 0.3, 1] }} />
      ))}

      {/* 가운데 띠 */}
      <motion.div className="relative w-full py-7 text-center"
        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        style={{
          background: win
            ? 'linear-gradient(90deg, transparent, rgba(24,10,0,0.92) 14%, rgba(24,10,0,0.92) 86%, transparent)'
            : 'linear-gradient(90deg, transparent, rgba(30,0,4,0.94) 14%, rgba(30,0,4,0.94) 86%, transparent)',
          borderTop: `2px solid ${win ? '#ffd75a' : '#ff5a68'}`, borderBottom: `2px solid ${win ? '#ffd75a' : '#ff5a68'}`,
        }}>
        {win ? (
          <>
            <div className="relative inline-block">
              {exact ? (
                <StampImg src="/spend/stamp_bullseye.webp" width={440} delay={0.12} rot={0} plate holes={BULLET_HOLES} />
              ) : (
                <StampImg src="/spend/stamp_hit.webp" width={430} delay={0.12} rot={-5} />
              )}
              {/* ×2 도장 */}
              {exact && (
                <div className="absolute -right-20 -top-12 md:-right-24"><StampRing ink="#ff4d63" delay={1.15}>×{BULLSEYE_MULT}</StampRing></div>
              )}
            </div>
            <div className="mt-3 text-xl font-bold text-amber-100">
              정답 <span className="font-serif text-3xl text-white">{r.target}</span>해리
              {exact && <span className="ml-2 text-rose-300">· 칼끝 ±{BULLSEYE_TOL}해리 명중!</span>}
            </div>
            <motion.div className={`${neonFont.className} mt-1 text-6xl md:text-7xl`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
              style={{ color: '#d9ffe9', textShadow: '0 0 4px #fff, 0 0 12px #4dffa6, 0 0 30px #00e07a' }}>
              +<CountUp to={r.gain} ms={exact ? 1700 : 1100} />장
            </motion.div>
            {r.streak > 1 && <div className="mt-1 text-lg font-bold text-orange-300">{r.streak}연승 · 다음 판은 장당 +1</div>}
          </>
        ) : (
          <>
            {r.broke ? (
              <StampImg src="/spend/stamp_bankrupt.webp" width={420} delay={0.22} rot={-9} />
            ) : r.nearMiss ? (
              <StampImg src="/spend/stamp_close.webp" width={460} delay={0.22} rot={0} />
            ) : (
              <StampImg src="/spend/stamp_miss.webp" width={380} delay={0.22} rot={-8} />
            )}
            <motion.div className="mt-4 text-xl font-bold text-rose-100" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              정답 <span className="font-serif text-3xl text-white">{r.target}</span>해리
              {r.nearMiss ? ` · 단 ${r.err}해리 차이!` : ''} · 지폐 <span className="font-serif text-3xl text-rose-300">{lost}장</span>이 날아갔습니다
            </motion.div>
            {r.broke && (
              <motion.div className="mt-1 text-lg text-rose-200/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
                주머니가 텅 비었습니다. 오리들이 고개를 돌립니다.
              </motion.div>
            )}
          </>
        )}
        <motion.div className="mt-6 flex justify-center gap-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: win ? 0.9 : 1.0 }}>
          {r.broke ? (
            <motion.button onClick={r.onClose} {...SQUISH} whileTap={{ scale: 0.9, y: 4 }}
              animate={{ rotate: [-1.5, 1.5, -1.5] }} transition={{ rotate: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
              style={{ boxShadow: '0 6px 0 #3a0006, 0 0 24px rgba(255,60,80,0.35)' }}
              className="rounded-full border-2 border-rose-200/70 bg-gradient-to-b from-rose-900 to-[#3a0008] px-10 py-3 font-serif text-2xl font-black text-rose-50">
              내가 뭘 한 거지…
            </motion.button>
          ) : (
            <>
              {r.canAgain && (
                <motion.button onClick={r.onAgain} {...SQUISH} style={{ boxShadow: GOLD_DEPTH }} className={`${GOLD_BTN} px-8 py-2.5 text-xl`}>
                  {win ? (
                    <span className="flex flex-col items-center leading-tight">
                      <span>{WIN_LINES[(Math.max(1, r.streak) - 1) % WIN_LINES.length]}</span>
                      <span className="text-sm font-bold opacity-75">한 판 더 (다음 +{r.nextPayout}장)</span>
                    </span>
                  ) : LOSE_LINES[r.target % LOSE_LINES.length]}
                </motion.button>
              )}
              <motion.button onClick={r.onClose} {...SQUISH} whileTap={{ scale: 0.9, y: 4 }}
                style={{ boxShadow: '0 5px 0 rgba(0,0,0,0.6)' }}
                className="rounded-full border border-white/30 bg-black/50 px-6 py-2.5 text-base font-bold text-white/80 hover:text-white">
                그만하기
              </motion.button>
            </>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export interface CasinoModalProps {
  bills: number;
  state: 'idle' | 'animating' | 'result';
  result: 'win' | 'lose' | 'exact' | null;
  guess: number;
  target: number;
  gain: number;
  streak: number;
  tier: GambleTierId;
  shipPath: number[];
  swordHit: number;
  /** 이겼을 때 폭죽 (key 가 바뀔 때마다 새로 터진다) */
  fireworks: { key: number; net: number; exact: boolean } | null;
  onPick: (distance: number) => void;
  onTier: (t: GambleTierId) => void;
  /** stake: 걸 지폐 수 */
  onBet: (stake: number) => void;
  onAgain: () => void;
  onClose: () => void;
}

export default function CasinoModal(p: CasinoModalProps) {
  const tier = GAMBLE_TIERS.find((t) => t.id === p.tier)!;
  const [stakeRaw, setStake] = useState(1);
  const [draft, setDraft] = useState<string | null>(null); // 장수 입력 칸에 치는 중인 글자 (비웠다가 다시 칠 수 있게)
  const stake = Math.max(1, Math.min(stakeRaw, Math.max(1, p.bills)));
  const payout = (tier.net + p.streak) * stake;
  const flip = shipFlipKeys(p.shipPath);
  const err = Math.abs(p.guess - p.target);
  const nearMiss = p.result === 'lose' && err <= tier.tol * 1.6;
  const [hoverD, setHoverD] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // 베팅 확정: 고른 칩이 항로의 칼 자리로 포물선을 그리며 날아가 떨어진 뒤에 결과 공개가 시작된다
  const [toss, setToss] = useState<{ x0: number; y0: number; x1: number; y1: number; size: number; img: string; key: number } | null>(null);
  const [landed, setLanded] = useState<{ img: string } | null>(null);
  const bet = () => {
    if (!idle || toss || p.bills <= 0) return;
    const chip = chipRefs.current[p.tier]; const tr = trackRef.current;
    if (!chip || !tr) { p.onBet(stake); return; }
    const a = chip.getBoundingClientRect(); const b = tr.getBoundingClientRect();
    const x1 = b.left + (pct(p.guess) / 100) * b.width; const y1 = b.top + b.height * 0.5;
    setToss({ x0: a.left + a.width / 2, y0: a.top + a.height / 2, x1, y1, size: a.width, img: tier.img, key: Date.now() });
    setLanded(null);
    window.setTimeout(() => { setToss(null); setLanded({ img: tier.img }); p.onBet(stake); }, 760);
  };
  const broke = p.state === 'result' && p.result === 'lose' && p.bills <= 0;
  const bulbMode: BulbMode = p.state === 'animating' ? 'fast' : p.state === 'result' ? (p.result === 'lose' ? 'dark' : 'fast') : 'idle';
  // 창이 화면보다 크면 통째로 줄여 맞춘다 (스크롤 막대 없이)
  const fitRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const el = fitRef.current; if (!el) return;
    const measure = () => { const h = el.scrollHeight; setFit(Math.min(1, (window.innerHeight * 0.97) / Math.max(1, h))); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el); window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const toDist = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.round(LO + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * SPAN);
  };
  const idle = p.state === 'idle';

  return (
    <>
      <style>{`
        @keyframes casinoGlow { 0%,100% { opacity:1 } 50% { opacity:.08 } }
        .casino-glow { background: radial-gradient(circle, rgba(255,226,140,.95) 0%, rgba(255,180,70,.55) 38%, rgba(255,150,40,0) 70%); animation: casinoGlow 1.8s ease-in-out infinite; }
        .casino-core { background: radial-gradient(circle, rgba(255,255,235,1) 0%, rgba(255,232,150,.85) 45%, rgba(255,200,90,0) 75%); mix-blend-mode: screen; animation: casinoGlow 1.8s ease-in-out infinite; }
        @keyframes casinoDark { 0%,30% { opacity:0 } 34% { opacity:1 } 36% { opacity:.1 } 40%,100% { opacity:1 } }
        .casino-glow-dark { animation-name: casinoDark !important; animation-iteration-count: 1 !important; animation-fill-mode: both !important; animation-timing-function: linear !important; }
        .neon-pink { color:#ffe9f4; text-shadow: 0 0 2px #fff, 0 0 6px #ff8cc6, 0 0 14px #ff3d97, 0 0 28px #ff1478, 0 0 52px #ff0a6c; }
        .neon-gold { color:#fff6d6; text-shadow: 0 0 2px #fff, 0 0 6px #ffd877, 0 0 14px #ffb020, 0 0 30px #ff9100, 0 0 56px #ff7a00; }
        .neon-red { color:#ffe1e1; text-shadow: 0 0 2px #fff, 0 0 6px #ff7a7a, 0 0 14px #ff2b2b, 0 0 30px #e00000, 0 0 56px #c00000; }
        /* 접촉 불량 글자: 대부분 켜져 있다가 불규칙하게 파르르 꺼진다. 꺼져도 유리관은 어둡게 보인다 */
        @keyframes neonFlicker {
          0% { color:inherit; text-shadow:inherit; opacity:1 }
          31% { color:#4a2232; text-shadow:0 0 1px rgba(0,0,0,.6); }
          32% { color:inherit; text-shadow:inherit; }
          34% { color:#4a2232; text-shadow:0 0 1px rgba(0,0,0,.6); }
          35.5% { color:inherit; text-shadow:inherit; }
          71% { color:#4a2232; text-shadow:0 0 1px rgba(0,0,0,.6); }
          74% { color:inherit; text-shadow:inherit; opacity:.75 }
          75% { opacity:1 }
          88% { color:#4a2232; text-shadow:0 0 1px rgba(0,0,0,.6); }
          88.8% { color:inherit; text-shadow:inherit; }
          100% { color:inherit; text-shadow:inherit; opacity:1 }
        }
        .neon-flicker { animation: neonFlicker 5.3s step-end infinite; }
        @keyframes neonBuzz { 0%,100% { opacity:1 } 50% { opacity:.93 } }
        .neon-buzz { animation: neonBuzz .11s linear infinite; }
        @keyframes casinoShine { 0% { background-position: -150% 0 } 100% { background-position: 250% 0 } }
        .casino-gold { background: linear-gradient(100deg,#8a5a12 0%,#ffe9a0 18%,#c9922e 34%,#fff3c4 50%,#b07a1e 66%,#ffe39a 82%,#8a5a12 100%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: casinoShine 3.2s linear infinite; }
      `}</style>

      {/* 배경: 붉은 벨벳, 금빛 빛살, 가장자리 어둠 */}
      <motion.div className="fixed inset-0 z-[100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background: 'radial-gradient(ellipse at 50% 40%, #5a0a16 0%, #2a0309 45%, #0a0103 80%)' }}>
        <motion.div aria-hidden className="absolute left-1/2 top-[42%] h-[260vmax] w-[260vmax] -translate-x-1/2 -translate-y-1/2"
          animate={{ rotate: 360 }} transition={{ duration: p.state === 'animating' ? 14 : 60, repeat: Infinity, ease: 'linear' }}
          style={{ background: 'repeating-conic-gradient(from 0deg, rgba(255,200,90,0.10) 0deg 3deg, transparent 3deg 9deg)' }} />
        <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(0,0,0,0.75) 100%)' }} />
      </motion.div>

      <motion.div
        role="dialog"
        aria-label="선상 도박장"
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0, x: p.state === 'result' ? (p.result === 'lose' ? [0, -22, 18, -14, 10, -6, 3, 0] : [0, -8, 8, -4, 0]) : 0 }}
        transition={{ x: { duration: p.result === 'lose' ? 0.55 : 0.35, delay: p.result === 'lose' ? 0.28 : 0 } }}
        exit={{ opacity: 0, scale: 0.92, y: 30 }}
        className="fixed left-1/2 top-1/2 z-[110] w-[min(980px,94vw)] -translate-x-1/2 -translate-y-1/2"
      >
       <div ref={fitRef} className="flex flex-col items-center" style={{ transform: `scale(${fit})`, transformOrigin: '50% 50%' }}>
        {/* 간판: 밧줄에 매달려 천천히 흔들리는 나무 간판 (예전 도박장 간판을 크게) */}
        <motion.div className="relative z-20 -mb-4" initial={{ y: -260, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 11, delay: 0.1 }}>
          <motion.div
            className="relative flex h-28 w-[26rem] items-center justify-center md:h-32 md:w-[32rem]"
            animate={{ rotate: p.state === 'animating' ? [3, -3, 3] : [2, -2, 2] }}
            transition={{ duration: p.state === 'animating' ? 1.6 : 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '50% -160px', filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.6))' }}
          >
            {/* 밧줄 */}
            <div className="absolute bottom-[55%] left-[14%] z-[5] h-[180px] w-[3px] bg-gradient-to-b from-[#d8c8a0] to-[#9a8656]" />
            <div className="absolute bottom-[55%] right-[14%] z-[5] h-[180px] w-[3px] bg-gradient-to-b from-[#d8c8a0] to-[#9a8656]" />
            {/* 짙은 호두나무색 나무 판에 네온관을 직접 붙인다 (검은 칠판 없이 나무 자체를 어둡게). 분홍 빛이 나무에 번진다 */}
            <div className="absolute inset-0" style={{ backgroundImage: "url('/spend/label.webp')", backgroundSize: '100% 100%', filter: 'brightness(0.42) saturate(1.15) contrast(1.1)' }} />
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(255,40,130,0.22) 0%, rgba(255,40,130,0) 62%)' }} />
            <h3 className="neon-buzz relative z-10 text-[3.4rem] leading-none tracking-[0.12em] md:text-[4.1rem]" style={{ transform: 'translateY(-2px)' }}>
              <NeonText text="선상 도박장" flicker={3} />
            </h3>
          </motion.div>
        </motion.div>

        {/* 탁자 */}
        <div className="relative w-full">
        {/* 흔들이 고무 오리 관객 두 마리 (탁자 아래 양쪽 모서리) */}
        <BobbleDuck side="left" mood={p.state === 'animating' ? 'tense' : p.state === 'result' ? (p.result === 'lose' ? 'lose' : 'win') : 'idle'} />
        <BobbleDuck side="right" delay={0.35} mood={p.state === 'animating' ? 'tense' : p.state === 'result' ? (p.result === 'lose' ? 'lose' : 'win') : 'idle'} />
        {/* 탁자 뒤로 삐져나온 트럼프 카드 더미 (양쪽 위 모서리) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/spend/casino_cards.webp" alt="" aria-hidden draggable={false}
          className="pointer-events-none absolute -left-24 -top-14 z-0 w-64 md:w-72" style={{ transform: 'rotate(-24deg)', filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.6))' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/spend/casino_cards.webp" alt="" aria-hidden draggable={false}
          className="pointer-events-none absolute -right-24 -top-10 z-0 w-60 md:w-64" style={{ transform: 'rotate(21deg) scaleX(-1)', filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.6)) brightness(0.92)' }} />
        {/* 탁자 바깥 테: 마호가니 레일 위에 금테. 전구는 레일 한가운데를 따라 모서리까지 둥글게 돈다 */}
        <div data-casino-frame className="relative z-10 w-full"
          style={{
            borderRadius: FRAME_R, padding: RAIL,
            background: 'linear-gradient(160deg, #5a2a10 0%, #3a1606 45%, #2a0f04 100%)',
            boxShadow: '0 0 0 3px #e8c477, 0 0 0 5px #4a2f0c, 0 30px 80px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,220,160,0.25), inset 0 -3px 6px rgba(0,0,0,0.6)',
          }}>
        <BulbRail mode={bulbMode} />
        <div className="relative w-full px-5 pb-6 pt-8 md:px-10"
          style={{
            borderRadius: FRAME_R - RAIL,
            background: 'radial-gradient(ellipse at 50% 30%, #1d6b45 0%, #0f4a2e 55%, #072a1a 100%)',
            boxShadow: '0 0 0 3px #b98a35, 0 0 0 5px #4a2f0c, inset 0 0 60px rgba(0,0,0,0.55)',
          }}>
          {/* 문제 */}
          <p className="text-center text-xl font-bold text-amber-50 md:text-2xl" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
            오늘 정오, 이 배는 <span className="text-amber-300">몇 해리</span>를 달렸을까?
          </p>
          <p className="mt-1 text-center text-sm text-emerald-100/80">실제 일일 항해 기록 480~550해리 사이에서 정해진다</p>

          {/* 계기: 보유 지폐 / 이번 배당 / 연승 */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { k: '보유 지폐', v: `${p.bills}장`, c: '#ffe7a3' },
              { k: `맞히면 · 불즈아이 +${payout * BULLSEYE_MULT}`, v: `+${payout}장`, c: '#7dffb8' },
              { k: '연승', v: p.streak > 0 ? `${p.streak}` : '—', c: p.streak > 0 ? '#ffb15a' : '#c9c9c9' },
            ].map((m) => (
              <div key={m.k} className="rounded-xl border border-amber-400/40 bg-black/45 px-3 py-2 text-center shadow-inner">
                <div className="text-xs font-bold tracking-widest text-amber-200/70">{m.k}</div>
                <motion.div key={m.v} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="font-serif text-2xl font-black md:text-3xl" style={{ color: m.c, textShadow: `0 0 14px ${m.c}66` }}>{m.v}</motion.div>
              </div>
            ))}
          </div>

          {/* 항로 눈금 */}
          <div className="relative mx-auto mt-28 w-full select-none">
            {/* 고른 숫자 표 */}
            <div className="pointer-events-none absolute -top-[6.5rem] z-30 -translate-x-1/2" style={{ left: `${pct(p.guess)}%` }}>
              <motion.div key={p.guess} initial={{ y: -8, scale: 1.3 }} animate={{ y: 0, scale: 1 }}
                className="whitespace-nowrap rounded-lg border-2 border-amber-300 bg-gradient-to-b from-amber-200 to-amber-500 px-3 py-0.5 font-serif text-xl font-black text-[#3a1a00] shadow-[0_0_18px_rgba(255,200,80,0.8)]">
                {p.guess}<span className="ml-0.5 text-sm">해리</span>
              </motion.div>
            </div>
            <div
              ref={trackRef}
              className={`relative h-24 w-full overflow-hidden rounded-xl ${idle ? 'cursor-crosshair' : ''}`}
              style={{ background: 'linear-gradient(180deg,#f3e2b8,#d9bf86)', boxShadow: 'inset 0 0 0 3px #7a5420, inset 0 4px 12px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.5)' }}
              onClick={(e) => { if (idle) p.onPick(toDist(e.clientX)); }}
              onMouseMove={(e) => { if (idle) setHoverD(toDist(e.clientX)); }}
              onMouseLeave={() => setHoverD(null)}
            >
              {/* 바다 항로 선 */}
              <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2" style={{ background: 'repeating-linear-gradient(90deg,#5b3a12 0 10px,transparent 10px 18px)' }} />
              {/* 눈금: 5해리마다 짧게, 10해리마다 길게 + 숫자 */}
              {Array.from({ length: SPAN / 5 + 1 }, (_, i) => LO + i * 5).map((d) => (
                <div key={d} className="absolute bottom-0" style={{ left: `${pct(d)}%` }}>
                  <div className="-translate-x-1/2 bg-[#5b3a12]" style={{ width: d % 10 === 0 ? 2 : 1, height: d % 10 === 0 ? 22 : 12 }} />
                </div>
              ))}
              {Array.from({ length: SPAN / 10 + 1 }, (_, i) => LO + i * 10).map((d) => (
                <div key={`l${d}`} className="absolute top-1.5 -translate-x-1/2 font-serif text-sm font-black text-[#4a2c0a]" style={{ left: `${Math.min(97, Math.max(3, pct(d)))}%` }}>{d}</div>
              ))}
              {/* 마우스를 올린 자리 미리보기 */}
              {idle && hoverD !== null && (
                <div className="pointer-events-none absolute bottom-0 top-0" style={{ left: `${pct(hoverD) - (tier.tol / SPAN) * 100}%`, width: `${((tier.tol * 2) / SPAN) * 100}%`, background: 'rgba(0,0,0,0.08)', borderLeft: '1px dashed rgba(0,0,0,0.35)', borderRight: '1px dashed rgba(0,0,0,0.35)' }} />
              )}
              {/* 고른 범위 띠 */}
              <motion.div
                className="pointer-events-none absolute bottom-0 top-0"
                animate={{ left: `${pct(p.guess) - (tier.tol / SPAN) * 100}%`, width: `${((tier.tol * 2) / SPAN) * 100}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{ background: tier.zone, boxShadow: `0 0 18px ${tier.zone}`, borderLeft: '2px solid rgba(0,0,0,0.45)', borderRight: '2px solid rgba(0,0,0,0.45)' }}
              />
              {/* 불즈아이 과녁: 칼끝 ±1해리. 배가 이 안에 멈추면 두 배 */}
              <motion.div className="pointer-events-none absolute top-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 rounded-full"
                animate={{ left: `${pct(p.guess)}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{ width: `${((BULLSEYE_TOL * 2) / SPAN) * 100 * 1.0}%`, aspectRatio: '1', minWidth: 22,
                  background: 'radial-gradient(circle, #d81c2c 0 28%, #fff4dc 29% 52%, #d81c2c 53% 74%, rgba(255,244,220,0.9) 75% 100%)',
                  boxShadow: '0 0 0 1px rgba(60,20,0,0.6), 0 0 10px rgba(255,60,60,0.5)' }} />
              {/* 던진 칩: 칼 자리에 놓여 있다 */}
              {landed && p.state !== 'idle' && (
                <motion.img src={landed.img} alt="" initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}
                  className="pointer-events-none absolute top-1/2 z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${pct(p.guess)}%`, boxShadow: '0 4px 8px rgba(0,0,0,0.55)' }} />
              )}
              {/* 정답 표시 (결과) */}
              {p.state === 'result' && (
                <motion.div initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} className="pointer-events-none absolute bottom-0 top-0 w-1 -translate-x-1/2 bg-white shadow-[0_0_12px_4px_rgba(255,255,255,0.9)]" style={{ left: `${pct(p.target)}%` }} />
              )}
              {/* 배: 정답 주변을 오가며 좁혀 든다 */}
              {p.state !== 'idle' && (
                <motion.div
                  initial={{ left: 0 }}
                  animate={{ left: p.shipPath.map((d) => `${pct(d)}%`), scaleX: flip.vals }}
                  transition={{ left: { duration: REVEAL_MS / 1000, times: REVEAL_TIMES, ease: 'easeInOut' }, scaleX: { duration: REVEAL_MS / 1000, times: flip.times, ease: 'easeInOut' } }}
                  className="pointer-events-none absolute top-1/2 z-20 -ml-8 -translate-y-1/2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/spend/titanic_duck.webp" alt="" className="h-16 w-16 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]" />
                </motion.div>
              )}
            </div>
            {/* 칼: 고른 자리에 꽂힌다 (눈금 상자 밖으로 칼자루가 보이도록 바깥에 둔다) */}
            <div className="pointer-events-none absolute top-0 z-20" style={{ left: `${pct(p.guess)}%`, width: 0, height: 0 }}>
              <motion.div
                key={`sword-${p.guess}-${p.swordHit}`}
                initial={{ y: -150, opacity: 0, rotate: 199 }}
                animate={{ y: TRACK_H / 2, opacity: 1, rotate: [199, 199, 205, 195, 201, 199] }}
                transition={{ y: { duration: 0.16, ease: 'easeIn' }, opacity: { duration: 0.05 }, rotate: { delay: 0.16, duration: 0.45 } }}
                style={{ position: 'absolute', left: -SWORD_W * 0.21, top: -SWORD_W * 1.833 * 0.06, width: SWORD_W, height: SWORD_W * 1.833, transformOrigin: '21% 6%' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/spend/shop1.webp" alt="" className="h-full w-full object-fill drop-shadow-[0_3px_4px_rgba(0,0,0,0.7)]" />
              </motion.div>
            </div>
          </div>
          <p className={`mt-2 text-center text-base font-bold text-amber-200 transition-opacity ${idle ? 'opacity-100' : 'opacity-0'}`}>
            ▲ 항로를 눌러 칼을 꽂으세요 · <span className="text-rose-300">배가 칼끝 ±{BULLSEYE_TOL}해리에 멈추면 불즈아이, 배당 ×{BULLSEYE_MULT}!</span>
          </p>

          {/* 범위 칩 */}
          <div role="radiogroup" aria-label="베팅 범위" className="mt-4 flex justify-center gap-4 md:gap-8">
            {GAMBLE_TIERS.map((t) => {
              const on = t.id === p.tier;
              return (
                <motion.button
                  key={t.id}
                  ref={(el) => { chipRefs.current[t.id] = el; }}
                  role="radio"
                  aria-checked={on}
                  disabled={!idle || !!toss}
                  onClick={() => p.onTier(t.id)}
                  whileHover={idle ? { y: -5, scale: on ? 1.12 : 1 } : undefined}
                  whileTap={idle ? { scale: 0.84, y: 4 } : undefined}
                  animate={{ scale: on ? 1.1 : 0.94, opacity: toss && on ? 0 : 1 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 14, mass: 0.6 }}
                  className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full disabled:cursor-default md:h-32 md:w-32"
                  style={{
                    color: t.ink,
                    boxShadow: on ? `0 0 0 4px #fff3c4, 0 0 26px 8px ${t.chip[1]}aa` : '0 6px 12px rgba(0,0,0,0.55)',
                    filter: on ? 'none' : 'saturate(0.7) brightness(0.8)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.img} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 h-full w-full rounded-full" />
                  {(() => { const sh = t.ink === '#ffffff' ? '0 1px 0 rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6)' : '0 1px 0 rgba(255,240,190,0.7)'; return (<>
                    <span className="relative text-lg font-black" style={{ textShadow: sh }}>{t.name}</span>
                    <span className="relative font-serif text-2xl font-black leading-none" style={{ textShadow: sh }}>+{(t.net + p.streak) * stake}장</span>
                    <span className="relative mt-0.5 text-[11px] font-bold" style={{ textShadow: sh }}>±{t.tol}해리 · {t.odds}</span>
                  </>); })()}
                </motion.button>
              );
            })}
          </div>

          {/* 걸 장수: 지폐를 한 장씩 올려놓는다 */}
          <div className={`mt-5 flex items-center justify-center gap-3 transition-opacity ${idle ? '' : 'pointer-events-none opacity-40'}`}>
            <span className="text-sm font-bold tracking-widest text-amber-200/80">걸 지폐</span>
            <PistonKey kind="minus" disabled={stake <= 1} onPress={() => setStake((v) => Math.max(1, Math.min(v, p.bills) - 1))} />
            <div className="flex h-12 min-w-[150px] items-center justify-center gap-1 rounded-xl border border-amber-400/50 bg-black/45 px-3">
              {/* 걸린 지폐를 겹쳐 보여 준다 */}
              <div className="relative h-8" style={{ width: 62 + (Math.min(stake, 8) - 1) * 9 }}>
                {Array.from({ length: Math.min(stake, 8) }, (_, i) => (
                  <motion.img key={i} src="/spend/bill.webp" alt="" initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                    className="absolute top-0 h-8 w-auto drop-shadow" style={{ left: i * 9, transform: `rotate(${(i % 3 - 1) * 5}deg)` }} />
                ))}
              </div>
              {/* 장수는 직접 입력할 수 있다: 숫자만 받고, 가진 지폐보다 많으면 가진 만큼으로 맞춘다. 엔터를 누르면 바로 베팅 */}
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" aria-label="걸 지폐 장수" maxLength={4}
                value={draft ?? String(stake)}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '');
                  if (digits === '') { setDraft(''); return; }
                  const n = Math.max(1, Math.min(Number(digits), Math.max(1, p.bills)));
                  setDraft(Number(digits) > n || digits.startsWith('0') ? String(n) : digits); // 가진 장수보다 크게 치면 바로 가진 만큼으로 보인다
                  setStake(n);
                }}
                onBlur={() => setDraft(null)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); bet(); } }}
                disabled={!idle}
                className="ml-2 w-14 rounded-md border border-amber-300/30 bg-black/30 text-center font-serif text-2xl font-black text-amber-100 outline-none focus:border-amber-300 focus:bg-black/50"
              />
              <span className="font-serif text-2xl font-black text-amber-100">장</span>
            </div>
            <PistonKey kind="plus" disabled={stake >= p.bills} onPress={() => setStake((v) => Math.min(p.bills, Math.min(v, p.bills) + 1))} />
            <motion.button {...SQUISH} whileTap={{ scale: 0.88, y: 3 }} onClick={() => setStake(p.bills)} disabled={stake >= p.bills}
              style={{ boxShadow: '0 4px 0 #5a0a10' }}
              className="h-10 rounded-full border-2 border-rose-200 bg-rose-800/90 px-4 text-sm font-black tracking-widest text-rose-50 disabled:opacity-30">올인</motion.button>
          </div>

          {/* 버튼 / 진행 중 문구 */}
          <div className="mt-6 flex min-h-[64px] flex-col items-center justify-center gap-2">
            {idle && (
              <>
                <motion.button
                  onClick={bet}
                  disabled={p.bills <= 0 || !!toss}
                  {...SQUISH}
                  style={{ boxShadow: GOLD_DEPTH }}
                  className={`${GOLD_BTN} px-12 py-3 text-2xl`}
                >
                  {toss ? '칩을 던집니다…' : <>베팅! <span className="text-base font-bold">(칩 던지기 · 지폐 {stake}장)</span></>}
                </motion.button>
                <button onClick={p.onClose} className="text-sm text-emerald-100/70 underline-offset-4 hover:text-white hover:underline">그만두고 나가기</button>
              </>
            )}
            {p.state === 'animating' && (
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 0.6, repeat: Infinity }} className="casino-gold font-serif text-3xl font-black">
                과연… 어디에 멈출까?
              </motion.div>
            )}
          </div>
        </div>
        </div>
        </div>
       </div>
      </motion.div>

      {/* 베팅 확정: 칩이 날아간다 (창이 줄어 있어도 위치가 맞도록 화면에 직접 그린다) */}
      {toss && typeof document !== 'undefined' && createPortal(
        <motion.div
          key={toss.key}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[600] rounded-full"
          style={{ width: toss.size, height: toss.size, marginLeft: -toss.size / 2, marginTop: -toss.size / 2,
            backgroundImage: `url('${toss.img}')`, backgroundSize: '100% 100%', boxShadow: '0 10px 18px rgba(0,0,0,0.5)' }}
          initial={{ x: toss.x0, y: toss.y0, scale: 1, rotateX: 0, rotateZ: 0 }}
          animate={{
            x: [toss.x0, (toss.x0 + toss.x1) / 2, toss.x1, toss.x1],
            y: [toss.y0, Math.min(toss.y0, toss.y1) - 170, toss.y1, toss.y1 - 14],
            scale: [1, 0.85, 0.42, 0.42],
            rotateX: [0, 540, 1080, 1080],
            rotateZ: [0, -20, 8, 0],
          }}
          transition={{ duration: 0.76, times: [0, 0.45, 0.86, 1], ease: ['easeOut', 'easeIn', 'easeOut'] }}
        >
        </motion.div>,
        document.body,
      )}

      {/* 결과 연출 */}
      <AnimatePresence>
        {p.state === 'result' && p.result && (
          <ResultFx key={`res-${p.result}-${p.target}-${p.gain}`} result={p.result} target={p.target} gain={p.gain} err={err} nearMiss={nearMiss}
            streak={p.streak} broke={broke} canAgain={p.bills > 0} nextPayout={(tier.net + p.streak) * stake}
            onAgain={p.onAgain} onClose={p.onClose} />
        )}
      </AnimatePresence>

      {p.fireworks && <CasinoFireworks key={p.fireworks.key} net={p.fireworks.net} exact={p.fireworks.exact} />}
    </>
  );
}
