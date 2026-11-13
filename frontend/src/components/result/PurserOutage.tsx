'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'framer-motion';
import ClassicButton from '@/components/ui/ClassicButton';
import { playThunder } from '@/lib/synth';

/**
 * 결과를 서버에서 받지 못했을 때의 화면: 끊어진 전신선 앞의 오리 사무장.
 * 다시 연결하기를 누르면 사무장이 전선 양 끝을 쥐고 잇다가, 실패하면 감전되고 장부에 그 횟수가 쌓인다.
 * 말풍선은 연출이고, 실제로 무슨 일인지는 아래의 안내문(message)으로 그대로 알려 준다.
 */
const CSS = `
@keyframes outageShake{0%,100%{transform:translate(0,0)}10%{transform:translate(-7px,3px)}20%{transform:translate(6px,-4px)}30%{transform:translate(-6px,-2px)}40%{transform:translate(7px,4px)}50%{transform:translate(-4px,2px)}60%{transform:translate(4px,-3px)}70%{transform:translate(-3px,1px)}80%{transform:translate(2px,-1px)}}
@keyframes outageShock{0%,82%{opacity:1}100%{opacity:0}}
@keyframes outageAfter{0%,82%{opacity:0}100%{opacity:1}}
@keyframes outageFlash{0%{opacity:.85}12%{opacity:.1}24%{opacity:.6}40%,100%{opacity:0}}
@keyframes outageSway{0%,100%{transform:rotate(-.18deg)}50%{transform:rotate(.18deg)}}
@keyframes outageRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
`;

type Pose = 'palms' | 'think' | 'ledger' | 'refuse' | 'watch_2' | 'hips' | 'bow' | 'shrug';
const POSES: Pose[] = ['palms', 'think', 'ledger', 'refuse', 'watch_2', 'hips', 'bow', 'shrug'];
const ZAP_MS = 1300;
/** 전선을 잇는 동작을 보여 주는 시간. 서버가 꺼져 있으면 요청은 바로 실패하므로 이만큼 먼저 보여 주고 요청한다 */
const SPLICE_MS = 1700;

/** 실패한 횟수별 대사. 다 쓰면 마지막 줄이 횟수만 바뀌며 이어진다 */
function failLine(tries: number): { pose: Pose; text: string } {
  if (tries <= 0) return { pose: 'palms', text: '전신이 끊겼소. 손님의 기록이 이쪽으로 건너오지 못하고 있소.' };
  if (tries === 1) return { pose: 'think', text: '전선을 직접 잡아 보았소. 살아 있더이다. 권하지는 않겠소.' };
  if (tries === 2) return { pose: 'ledger', text: '한 번 더 잡았소. 장부에 적어 두겠소.' };
  if (tries === 3) return { pose: 'refuse', text: '세 번째요. 전선 수리는 사무장의 업무가 아니오.' };
  if (tries === 4) return { pose: 'shrug', text: '아무래도 새로운 일자리를 알아봐야겠소.' };
  if (tries === 5) return { pose: 'think', text: '다른 배에 자리가 있는지 전보를 쳐 보겠소. …아, 전신이 끊겼지.' };
  if (tries === 6) return { pose: 'watch_2', text: '손님, 시계라도 보며 잠시 기다려 보시겠소.' };
  return { pose: 'hips', text: `감전 ${tries}회. 오늘 밤 근무 일지가 참 풍성하오.` };
}

/** 전선을 잇는 동안의 대사 (failed: 지금까지 감전된 횟수) */
function spliceLine(failed: number): string {
  if (failed <= 0) return '양 끝을 맞춰 보겠소. 물러서 계시오.';
  if (failed === 1) return '다시 잡겠소. 이 장갑은 고무가 아니오.';
  return '부리를 앙다무는 중이니 말 걸지 마시오.';
}

type P = [number, number];

// 좌표는 사무장 칸(800×1114) 기준. 주먹 자리는 purser_splice 그림에서 잰 값이다
/** 왼쪽 전선의 끊어진 끝: 오른쪽 전선(HANG_END)과 대칭인 손 높이. 천장에서 곧게 늘어지고 흔들리지 않는다 */
const LEFT_END: P = [58, 601];
const HANG_L = `M96 -2500 C74 -700 60 250 ${LEFT_END[0]} ${LEFT_END[1]}`;
/** 천장에서 늘어진 전선 */
const HANG_END: P = [742, 601];
const HANG = `M700 -2500 C760 -700 770 250 ${HANG_END[0]} ${HANG_END[1]}`;
// 팔 그림은 몸통과 같은 크기(434×1114)이고 사무장 칸 가운데에 놓인다 (왼쪽 여백 183). 팔꿈치를 축으로 돈다
const ARM_LEFT = 183;
const ELBOW_L: P = [ARM_LEFT + 28, 435];
const ELBOW_R: P = [ARM_LEFT + 405, 435];
const FIST_L: P = [292, 564];
const FIST_R: P = [511, 531];

function rotated(p: P, pivot: P, deg: number): P {
  const r = (deg * Math.PI) / 180;
  const dx = p[0] - pivot[0]; const dy = p[1] - pivot[1];
  return [pivot[0] + dx * Math.cos(r) - dy * Math.sin(r), pivot[1] + dx * Math.sin(r) + dy * Math.cos(r)];
}

/** 0 팔을 벌림 ~ 1 양손을 모아 전선 끝을 맞댐. 모으고, 맞댄 채 버티다가, 튕기듯 물러난다 */
function reachAt(t: number): number {
  const u = t - Math.floor(t);
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (u < 0.42) return ease(u / 0.42);
  if (u < 0.74) return 1 - 0.05 * Math.abs(Math.sin(u * 70));
  return 1 - ease((u - 0.74) / 0.26);
}

const CYCLE_MS = 1150;
/** 감전 그림에서 벌린 두 손의 자리 */
const ZAP_HAND_L: P = [58, 585];
const ZAP_HAND_R: P = [742, 585];

/** 전선을 잇는 사무장: 양팔이 팔꿈치를 축으로 모이고, 쥔 전선이 주먹을 그대로 따라온다 */
function SpliceRig({ reduceMotion }: { reduceMotion: boolean }) {
  const rig = useRef<HTMLDivElement>(null);
  const armL = useRef<HTMLImageElement>(null);
  const armR = useRef<HTMLImageElement>(null);
  const wires = useRef<SVGGElement>(null);
  const drive = useRef<SparkDrive>({ x: 0, y: 0, on: false });

  useEffect(() => {
    const groups = wires.current ? Array.from(wires.current.children) : [];
    const setWire = (i: number, d: string) => groups[i]?.querySelectorAll('path').forEach((p) => p.setAttribute('d', d));
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / CYCLE_MS;
      const l = reduceMotion ? 0.8 : reachAt(t);
      const r = reduceMotion ? 0.8 : reachAt(t - 0.05); // 두 손이 똑같이 움직이면 기계처럼 보인다
      const degL = -17 * l;
      const degR = 16 * r;
      if (armL.current) armL.current.style.transform = `rotate(${degL}deg)`;
      if (armR.current) armR.current.style.transform = `rotate(${degR}deg)`;
      // 손을 모을수록 몸을 숙이며 힘을 준다
      if (rig.current) rig.current.style.transform = `translateY(${(l + r) * 1.5}px) rotate(${(l - r) * 3}deg)`;

      const a = rotated(FIST_L, ELBOW_L, degL);
      const b = rotated(FIST_R, ELBOW_R, degR);
      const mid: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const gap = (1 - Math.min(l, r)) * 22 + 3;
      setWire(0, `M96 -2500 C70 -500 ${a[0] - 190} ${a[1] - 240} ${a[0]} ${a[1]}`);
      setWire(1, `M700 -2500 C730 -500 ${b[0] + 190} ${b[1] - 240} ${b[0]} ${b[1]}`);
      setWire(2, `M${a[0]} ${a[1]} L${mid[0] - gap} ${mid[1] + 1}`);
      setWire(3, `M${b[0]} ${b[1]} L${mid[0] + gap} ${mid[1] - 1}`);

      drive.current = { x: mid[0], y: mid[1], on: Math.min(l, r) > 0.9 };
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  const part = 'absolute inset-0 m-auto h-full w-auto max-w-none';
  // 팔꿈치 자리를 그림 크기에 대한 비율로 준다
  const pivot = (x: number) => `${(x / 434) * 100}% ${(435 / 1114) * 100}%`;
  return (
    <div ref={rig} className="absolute inset-0" style={{ transformOrigin: '50% 100%' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/spend/purser_splice_body.webp" alt="오리 사무장" draggable={false} className={part} />
      {/* 전선은 팔 뒤로 지나가 장갑 속으로 들어간다 */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 800 1114">
        <g ref={wires}>
          <g><Wire d="M0 0" /></g>
          <g><Wire d="M0 0" /></g>
          <g><Wire d="M0 0" /></g>
          <g><Wire d="M0 0" /></g>
        </g>
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={armL} src="/spend/purser_splice_arm_l.webp" alt="" aria-hidden draggable={false} className={part} style={{ transformOrigin: pivot(28) }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={armR} src="/spend/purser_splice_arm_r.webp" alt="" aria-hidden draggable={false} className={part} style={{ transformOrigin: pivot(405) }} />
      {!reduceMotion && (
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 800 1114">
          <Sparks drive={drive} size={1.1} />
        </svg>
      )}
    </div>
  );
}

/**
 * 천을 감은 옛 전선. 윗면에 빛을 얹어 둥근 굵기가 보이게 하고, 바닥에 놓인 것에는 그림자를 깐다.
 * tone: 1 이 기본 밝기, 낮을수록 어둡다 (감긴 더미의 아래 바퀴)
 */
function Wire({ d, shadow = false, tone = 1 }: { d: string; shadow?: boolean; tone?: number }) {
  const common = { d, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
  // 검은 피복 전선 (배경 그림의 전선과 같은 색). tone 이 낮을수록 더 어둡다
  const body = `rgb(${Math.round(30 * tone)} ${Math.round(30 * tone)} ${Math.round(34 * tone)})`;
  return (
    <>
      {shadow && <path {...common} stroke="#000" strokeOpacity={0.5} strokeWidth={10} transform="translate(2 10)" />}
      <path {...common} stroke="#050302" strokeWidth={7} />
      <path {...common} stroke={body} strokeWidth={5.2} />
      <path {...common} stroke="#000" strokeOpacity={0.75} strokeWidth={5.2} strokeLinecap="butt" strokeDasharray="1.2 4.6" />
      <path {...common} stroke="#7d8896" strokeOpacity={0.5 * tone} strokeWidth={1.4} transform="translate(-2.5 -4.5)" />
    </>
  );
}

/** 끊어진 전선 끝: 피복 밖으로 구리 가닥이 부채처럼 벌어진다 (deg: 전선이 향하는 방향) */
function Frayed({ at, deg }: { at: P; deg: number }) {
  const strands: [number, number][] = [[-34, 21], [-16, 31], [-3, 26], [12, 33], [29, 23], [41, 15]];
  return (
    <g>
      {strands.map(([off, len]) => {
        const r = ((deg + off) * Math.PI) / 180;
        return <line key={off} x1={at[0]} y1={at[1]} x2={at[0] + Math.cos(r) * len} y2={at[1] + Math.sin(r) * len} stroke="#16161a" strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
      })}
    </g>
  );
}

/** 중점 변위로 만든 불규칙한 방전 길 */
function jag(a: P, b: P, rough: number, depth: number): P[] {
  if (depth === 0) return [a, b];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const off = (Math.random() - 0.5) * len * rough;
  const m: P = [(a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * off, (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * off];
  return [...jag(a, m, rough, depth - 1).slice(0, -1), ...jag(m, b, rough, depth - 1)];
}

type SparkDrive = { x: number; y: number; on: boolean };
const ARCS = 3;
const EMBERS = 12;

/**
 * 방전과 불똥: 푸른 흰빛의 방전이 불규칙하게 뻗었다 사라지기를 빠르게 되풀이하고,
 * 구릿빛 불똥이 튀어 포물선으로 떨어진다. 평소에는 period 마다 잠깐 튀고, drive 를 주면 그 값대로, burst 를 주면 그 시간만 튄다.
 */
function Sparks({ at, drive, size = 1, period = 2600, phase = 0, burst }: {
  at?: P; drive?: RefObject<SparkDrive>; size?: number; period?: number; phase?: number; burst?: number;
}) {
  const root = useRef<SVGGElement>(null);
  const gradient = `spark${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    const g = root.current;
    if (!g) return;
    const glow = g.querySelector('circle');
    const arcs = Array.from(g.querySelectorAll('path'));
    const lines = Array.from(g.querySelectorAll('line'));
    const embers = lines.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, born: -1e9, life: 1 }));
    let next = 0; let lastArc = 0; let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const el = now - t0;
      const d = drive?.current;
      const on = d ? d.on : burst !== undefined ? el < burst : (el + phase) % period < period * 0.17;
      const x = d ? d.x : at?.[0] ?? 0;
      const y = d ? d.y : at?.[1] ?? 0;
      if (on && now - lastArc > 48) {
        lastArc = now;
        for (let i = 0; i < ARCS; i++) {
          const ang = Math.random() * Math.PI * 2;
          const len = size * (28 + Math.random() * 62);
          const pts = jag([x, y], [x + Math.cos(ang) * len, y + Math.sin(ang) * len * 0.8], 0.55, 3);
          const path = `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')}`;
          const show = Math.random() > 0.2 ? '1' : '0';
          [arcs[i * 2], arcs[i * 2 + 1]].forEach((a) => { a.setAttribute('d', path); a.setAttribute('opacity', show); });
        }
        glow?.setAttribute('cx', x.toFixed(1));
        glow?.setAttribute('cy', y.toFixed(1));
        glow?.setAttribute('opacity', (0.45 + Math.random() * 0.5).toFixed(2));
        for (let n = 0; n < 2; n++) {
          const e = embers[next++ % EMBERS];
          const ang = -Math.PI * Math.random();
          const sp = size * (220 + Math.random() * 420);
          Object.assign(e, { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, born: now, life: 320 + Math.random() * 380 });
        }
      }
      if (!on) {
        arcs.forEach((a) => a.setAttribute('opacity', '0'));
        glow?.setAttribute('opacity', '0');
      }
      embers.forEach((e, i) => {
        const age = now - e.born;
        const l = lines[i];
        if (age > e.life) { l.setAttribute('opacity', '0'); return; }
        const s = age / 1000;
        const px = e.x + e.vx * s; const py = e.y + e.vy * s + 900 * s * s;
        const tail = 0.022;
        l.setAttribute('x1', px.toFixed(1));
        l.setAttribute('y1', py.toFixed(1));
        l.setAttribute('x2', (px - e.vx * tail).toFixed(1));
        l.setAttribute('y2', (py - (e.vy + 1800 * s) * tail).toFixed(1));
        l.setAttribute('opacity', (1 - age / e.life).toFixed(2));
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [at, drive, size, period, phase, burst]);

  const nonScaling = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
  return (
    <g ref={root} style={{ mixBlendMode: 'screen' }}>
      <defs>
        <radialGradient id={gradient}>
          <stop offset="8%" stopColor="#fff" />
          <stop offset="32%" stopColor="#a8d2ff" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#5aa0ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r={58 * size} fill={`url(#${gradient})`} opacity={0} />
      {Array.from({ length: ARCS }, (_, i) => (
        <g key={i}>
          <path {...nonScaling} stroke="#7fb8ff" strokeOpacity={0.45} strokeWidth={5} opacity={0} />
          <path {...nonScaling} stroke="#f2f8ff" strokeWidth={1.3} opacity={0} />
        </g>
      ))}
      {Array.from({ length: EMBERS }, (_, i) => (
        <line key={i} stroke="#ffd08a" strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0} />
      ))}
    </g>
  );
}

export default function PurserOutage({ tries, busy, connected, message, onRetry, onRestart }: {
  /** 지금까지 다시 연결을 시도한 횟수 */
  tries: number;
  /** 다시 연결하는 중 */
  busy: boolean;
  /** 결과가 도착해 곧 넘어간다 */
  connected: boolean;
  message: string | null;
  onRetry: () => void;
  onRestart: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [splicing, setSplicing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // 전선을 쥐는 동작부터 보여 주고, 그 끝에 실제로 다시 요청한다
  const startSplice = () => {
    setSplicing(true);
    timer.current = setTimeout(() => {
      setSplicing(false);
      onRetry();
    }, reduceMotion ? 300 : SPLICE_MS);
  };

  // 링크가 잘못된 경우에는 전선 탓이 아니다: 감전시키지 않는다
  const notFound = !!message?.includes('찾을 수 없습니다');
  const working = splicing || busy;
  const splice = working && !connected;
  const zap = tries > 0 && !working && !connected && !notFound;
  // busy 일 때의 tries 에는 아직 결과가 나지 않은 이번 시도가 들어 있다
  const failed = busy || connected ? tries - 1 : tries;

  const { pose, text } = connected
    ? { pose: 'bow' as Pose, text: '이어졌소. 기록을 펴 드리겠소.' }
    : splice
      ? { pose: 'palms' as Pose, text: spliceLine(failed) }
      : notFound
        ? { pose: 'ledger' as Pose, text: '장부를 끝까지 넘겼으나 그런 기록은 없소.' }
        : failLine(tries);

  useEffect(() => {
    [...POSES.map((p) => `/spend/purser_${p}.webp`), '/spend/purser_shock.webp', '/spend/purser_splice_body.webp', '/spend/purser_splice_arm_l.webp', '/spend/purser_splice_arm_r.webp'].forEach((src) => { new Image().src = src; });
  }, []);

  // 실패가 하나 늘 때마다 한 번 친다
  useEffect(() => {
    if (zap && !reduceMotion) playThunder();
  }, [zap, tries, reduceMotion]);

  const animateZap = zap && !reduceMotion;
  const after = animateZap ? { animation: `outageAfter ${ZAP_MS}ms linear both` } : undefined;

  return (
    <div role="alert" className="fixed inset-0 z-20 mx-auto flex w-full flex-col items-center justify-end overflow-y-auto overflow-x-hidden px-4 pb-1 pt-14">
      <style>{CSS}</style>

      {/* 배경: 달빛이 드는 전신실. 전선 끝에 불꽃은 없다 (감전은 사무장이 선을 이은 순간에만 일어난다) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: "url('/spend/outage_room.webp')" }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-black/35" />

      {/* 번쩍임은 다시 시도한 결과가 나올 때마다 처음부터 돈다 */}
      {animateZap && (
        <div key={tries} aria-hidden className="pointer-events-none fixed inset-0 z-50 bg-[#cfe6ff]" style={{ animation: 'outageFlash 700ms linear both' }} />
      )}

      {/*
        말풍선 그림의 꼬리 끝은 가로 94%, 세로 98% 자리다. 사무장을 꼬리 끝 바로 아래에 세워 모자 왼쪽 옆을 가리키게 한다.
        --w: 말풍선 너비, --dh: 사무장 높이. 사무장 칸의 가로는 높이의 0.718배(800:1114)라 그 절반이 .359
      */}
      <div
        className="flex flex-col [--dh:min(32vh,260px)] [--w:min(64vw,250px)] md:[--dh:min(40vh,320px)] md:[--w:400px]"
        // 묶음(말풍선+사무장)을 왼쪽으로 옮겨 사무장 몸통이 화면 가운데, 아래 버튼과 같은 축에 오게 한다
        style={{ width: 'calc(var(--w) * .94 + var(--dh) * .459)', transform: 'translateX(calc(var(--w) * -.47 + var(--dh) * .1295))' }}
      >
        {/* 말풍선 */}
        <div
          key={`${tries}-${busy}-${connected}-${splicing}`}
          className="relative z-10 shrink-0 self-start"
          style={{ width: 'var(--w)', aspectRatio: '1.48', animation: animateZap ? `outageAfter ${ZAP_MS}ms linear both` : 'outageRise 350ms ease-out both' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spend/purser_bubble.webp" alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]" style={{ objectFit: 'fill' }} />
          <p className="absolute flex items-center justify-center break-keep text-center font-sans text-[16px] font-semibold leading-snug text-[#2a1c0e] md:text-[19px]" style={{ left: '13%', right: '13%', top: '16%', height: '58%' }}>
            {text}
          </p>
        </div>

        {/* 사무장과 끊어진 전선 */}
        <div
          key={`duck-${tries}-${busy}`}
          className="relative shrink-0 self-end"
          style={{ height: 'var(--dh)', marginTop: 'calc(var(--dh) * -.05)', aspectRatio: '800 / 1114' }}
        >
          {/* 전선: 두 가닥이 천장에서 늘어진다 (사무장 뒤로 지나간다). 오른쪽만 살짝 흔들린다. 잇는 동안의 줄은 SpliceRig 가 그린다 */}
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 800 1114">
            <ellipse cx={400} cy={1104} rx={160} ry={22} fill="#000" opacity={0.5} style={{ filter: 'blur(5px)' }} />
            {/* 왼쪽 전선: 천장에서 곧게 늘어져 있고 흔들리지 않는다 */}
            {!connected && !splice && (
              <>
                <Wire d={HANG_L} />
                <Frayed at={LEFT_END} deg={100} />
              </>
            )}
            {!connected && !splice && (
              <g style={{ transformBox: 'view-box', transformOrigin: '700px -2500px', animation: reduceMotion || animateZap ? undefined : 'outageSway 4.3s ease-in-out infinite' }}>
                <Wire d={HANG} />
                <Frayed at={HANG_END} deg={100} />
                {/* 위쪽 전선 끝의 상시 불꽃은 껐다 (감전은 사무장이 전선을 이은 순간에만 일어난다) */}
              </g>
            )}
            {!connected && !splice && !reduceMotion && <Sparks at={LEFT_END} size={0.7} period={3400} phase={1400} />}
          </svg>

          {/* 감전될 때는 사무장만 부들부들 떨고, 전선은 가만히 있는다 */}
          <div className="absolute inset-0" style={{ animation: animateZap ? `outageShake ${ZAP_MS * 0.82}ms linear` : undefined }}>
          {splice ? (
            <SpliceRig reduceMotion={!!reduceMotion} />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/spend/purser_${pose}.webp`} alt="오리 사무장" draggable={false} className="absolute inset-0 m-auto h-full w-auto max-w-none" style={after} />
              {animateZap && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/spend/purser_shock.webp" alt="" aria-hidden draggable={false} className="absolute inset-0 m-auto h-full w-auto max-w-none" style={{ animation: `outageShock ${ZAP_MS}ms linear both` }} />
              )}
              {animateZap && (
                <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 800 1114">
                  <Sparks at={ZAP_HAND_L} size={1.5} burst={ZAP_MS * 0.8} />
                  <Sparks at={ZAP_HAND_R} size={1.5} burst={ZAP_MS * 0.8} />
                </svg>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      {/* 실제 안내: 무슨 일이고 무엇을 하면 되는지는 연출과 따로 분명히 적는다 */}
      <p className="mt-2 min-h-[2.75rem] max-w-md break-keep text-center text-sm leading-relaxed text-[#cdbf9c]">{working || connected ? '' : message}</p>
      {failed > 0 && !notFound && (
        <p className="mt-1 font-serif text-xs italic tracking-wide text-brass">장부: 사무장 감전 {failed}회</p>
      )}

      <div className="relative z-10 mb-2 mt-2 flex flex-wrap items-center justify-center gap-3">
        <ClassicButton onClick={startSplice} disabled={working || connected} className="disabled:cursor-default disabled:opacity-60">
          {working || connected ? '잇는 중' : '다시 연결하기'}
        </ClassicButton>
        <button
          onClick={onRestart}
          disabled={working || connected}
          className="rounded border border-slate-600 bg-transparent px-6 py-2 text-sm tracking-widest text-slate-400 transition-colors hover:bg-slate-800 disabled:cursor-default disabled:opacity-60"
        >
          처음부터 다시
        </button>
      </div>
    </div>
  );
}
