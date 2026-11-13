'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { playStamp, playAbacus, playTick } from '@/lib/synth';

/**
 * 오리 사무장: 돈 쓰기 단계의 안내자. 고지식하고 뻔뻔한 신사 말투로 지출마다 한마디 한다.
 * 낮 단계에서만 쓴다. 밤 장면에는 나오지 않는다(없다는 것 자체가 분위기를 바꾼다).
 * 좁은 화면에서는 자리가 없어 숨긴다.
 */
const POSES = ['idle', 'greet', 'receive', 'ledger', 'stamp', 'calc', 'watch', 'point', 'refuse', 'shrug', 'bow', 'draw', 'aim', 'fire', 'smoke', 'think', 'palms', 'hips'] as const;
export type PurserPose = (typeof POSES)[number];
/** 한 장짜리 그림이 있는 포즈 (stamp, calc, watch 는 여러 컷이 이어진다) */
/** 장부 쓰기(ledger)는 두 컷이 번갈아 나와 깃펜이 움직이고, 생각(think)·두 손 벌림(palms)·허리에 손(hips)은 팔이 넓어 폭이 800 인 캔버스를 쓴다 */
const WIDE_POSES = ['think', 'palms', 'hips'] as const;
const STILL_POSES = POSES.filter((p) => p !== 'stamp' && p !== 'calc' && p !== 'watch' && p !== 'ledger' && !(WIDE_POSES as readonly string[]).includes(p));

/**
 * 회중시계 컷: 가슴 주머니에서 시계를 꺼내(0) 뚜껑을 열어 들여다보고(1) 보란 듯이 들어 올린다(2).
 * 중간 컷은 광류로 이었다 (tools/build_purser_watch.py). 마지막 컷에서 멈춰 대사가 끝날 때까지 시계를 쳐든다.
 */
const WATCH_FILES = ['0', '01_a', '01_b', '1', '12_a', '12_b', '2'] as const;
const WATCH_STEPS: [number, number][] = [
  [0, 0], [1, 110], [2, 220], [3, 330],
  [3, 1000], [4, 1100], [5, 1200], [6, 1300],
];
const WATCH_TICKS = [330, 1300]; // 뚜껑이 열리는 순간, 쳐드는 순간

/**
 * 주판 계산 컷: 근엄하게 훑어보다(0) 중얼거리며 튕기고(1) 흡족하게 웃는다(2).
 * 컷 사이는 광류로 만든 중간 컷 두 장씩으로 이어 부드럽게 움직인다 (tools/build_purser_calc.py).
 * 순서: 0 → 1 → 0 → 1 → 2 (손가락이 오가다 흡족한 표정으로 멈춘다)
 */
const CALC_FILES = ['0', '01_a', '01_b', '1', '12_a', '12_b', '2'] as const;
const CALC_STEPS: [number, number][] = [ // [컷 번호, 나타나는 시각 ms]
  [0, 0], [1, 90], [2, 180], [3, 270],
  [3, 540], [2, 620], [1, 700], [0, 780],
  [0, 900], [1, 980], [2, 1060], [3, 1140],
  [3, 1420], [4, 1500], [5, 1580], [6, 1660],
];
const CALC_CLICKS = [270, 780, 1140, 1660]; // 알이 부딪히는 순간(소리)

/** 도장 찍기 애니메이션 컷 (순서대로: 들고 → 더 높이 → 장부로 내림 → 찍음) */
const STAMP_FRAMES = [0, 1, 2, 3] as const;
const STAMP_AT = [0, 150, 310, 470]; // 각 컷이 나타나는 시각(ms)

/** 번개 맞은 모습: 하얗게 번쩍이다 엑스선처럼 반전돼 덜덜 떨고, 점점 가라앉는다. A/B 는 같은 연출이라 이름만 달리해 다시 재생하려는 것 */
const SHOCK_FRAMES = `0%{filter:brightness(3.4) contrast(1.3) drop-shadow(0 0 26px #ffe45c);transform:translate(0,0)}
6%{filter:invert(1) hue-rotate(180deg) brightness(1.3);transform:translate(-7px,2px) rotate(-1.2deg)}
12%{filter:brightness(2.8) drop-shadow(0 0 30px #fff27a);transform:translate(7px,-3px) rotate(1.2deg)}
18%{filter:invert(1) hue-rotate(180deg) brightness(1.4);transform:translate(-6px,-2px)}
26%{filter:brightness(2.2) drop-shadow(0 0 22px #ffe45c);transform:translate(5px,3px) rotate(-1deg)}
36%{filter:invert(.85) hue-rotate(180deg);transform:translate(-4px,1px)}
48%{filter:brightness(1.6) drop-shadow(0 0 14px #ffd84a);transform:translate(3px,-2px)}
62%{filter:brightness(1.25) sepia(.35);transform:translate(-2px,1px)}
100%{filter:none;transform:none}`;
/**
 * 장부 쓰기: 깃펜 든 네 컷(1 펜을 대기 직전, 2 닿음, 4 글씨를 이어 씀, 3 펜을 높이 듦)과, 컷 사이를 광류로 이은 중간 컷 두 장씩(12a/12b, 24a/24b, 41a/41b).
 * 네 컷은 머리·몸·다리가 모두 같고 팔·펜·책만 다르다. 컷 사이를 겹쳐 흐리면 깜빡여 보이므로, 겹치지 않고 중간 컷으로 딱딱 이어 붙인다.
 * 펜을 높이 드는 큰 동작(3)은 사이를 이을 만큼 닮은 컷이 없어 그대로 바꾼다.
 */
const WRITE_STEPS = [1, 2, 4, 2, 4, 1, 2, 4, 2, 1, 3]; // 쓰는 순서. 마지막(3)에서 펜을 높이 들고 오래 멈춘다
const WRITE_HOLD = [200, 170, 150, 150, 150, 200, 170, 150, 150, 240, 1500]; // 각 컷에서 머무는 ms
const WRITE_MID_MS = 50; // 중간 컷 한 장이 보이는 시간
const WRITE_BETWEEN: Record<string, string[]> = { '1>2': ['12a', '12b'], '2>1': ['12b', '12a'], '2>4': ['24a', '24b'], '4>2': ['24b', '24a'], '4>1': ['41a', '41b'], '1>4': ['41b', '41a'] };
const WRITE_FRAMES = ['1', '2', '3', '4', '12a', '12b', '24a', '24b', '41a', '41b'];
const WRITE_SEQ: [string, number][] = (() => {
  const seq: [string, number][] = [];
  WRITE_STEPS.forEach((k, i) => {
    seq.push([String(k), WRITE_HOLD[i]]);
    const next = WRITE_STEPS[(i + 1) % WRITE_STEPS.length];
    (WRITE_BETWEEN[`${k}>${next}`] ?? []).forEach((m) => seq.push([m, WRITE_MID_MS]));
  });
  return seq;
})();
const WRITE_TOTAL = WRITE_SEQ.reduce((a, [, ms]) => a + ms, 0);
const WRITE_CSS = WRITE_FRAMES.map((f) => {
  let t = 0;
  const stops = WRITE_SEQ.map(([k, ms]) => { const st = `${((t / WRITE_TOTAL) * 100).toFixed(3)}%{opacity:${k === f ? 1 : 0}}`; t += ms; return st; });
  return `@keyframes duckWrite_${f}{${stops.join('')}100%{opacity:${WRITE_SEQ[0][0] === f ? 1 : 0}}}`;
}).join(' ');

const DUCK_SHOCK_CSS = `${WRITE_CSS} @keyframes duckShockA{${SHOCK_FRAMES}} @keyframes duckShockB{${SHOCK_FRAMES}} @keyframes duckShockImg{0%,78%{opacity:1}100%{opacity:0}} @keyframes duckHideA{0%,78%{opacity:0}100%{opacity:1}} @keyframes duckHideB{0%,78%{opacity:0}100%{opacity:1}}`;

/**
 * 말풍선 크기(px): 글자가 읽히도록 크게 잡는다. 그림(spend/purser_bubble.webp, 양피지에 장식 테두리)은 686x648 이라
 * 옆으로 1.4배쯤 늘여 쓴다. 꼬리 끝은 그림 가로의 94%, 세로의 98% 자리다.
 */
const BUBBLE_W = 520;
const BUBBLE_H = 310;
const BUBBLE_TAIL_X = 0.9417;
// 꼬리 끝이 닿을 곳 = 오리 부리 높이, 얼굴 왼쪽 바깥. 오리 키(duckH) 기준: 가로는 몸 중심에서 왼쪽으로, 세로는 머리 꼭대기에서 아래로
const BEAK_X = -85 / 1114; // 얼굴 왼쪽 가장자리 바깥(이미지 x≈242)에서 끝나 얼굴을 가리지 않는다
const BEAK_Y = 0.17;
/** 오리 머리 위에 비워 두는 높이: 말풍선이 커져도 오리 자리는 밀리지 않도록 예전 크기를 그대로 둔다 */
const BUBBLE_RESERVE = Math.round((470 * 596) / 985) - 36;

/**
 * 말풍선 글자를 서서히 띄운다. 거만한 오리라 서두르지 않는다: 한 글자씩 천천히, 쉼표와 마침표와 말줄임표에서는 일부러 뜸을 들인다.
 * 글자는 흐릿하게 떠오르며 또렷해진다. 아직 안 나온 글자도 자리는 잡아 두어 줄이 바뀌며 흔들리지 않는다.
 */
const CHAR_MS = 40;
const PAUSE_ELLIPSIS = 450; // …
const PAUSE_STOP = 240; // . ? !
const PAUSE_COMMA = 130;
const HUSH_MS = 340; // 속삭임 직전의 뜸
/** 괄호 안 글자는 속삭임: 작고 흐리게, 조금 느리게 나온다. 괄호 기호도 함께 속삭임으로 친다 */
const WHISPER_MS = 55;
const WHISPER_STYLE = { fontSize: '0.48em', opacity: 0.55, letterSpacing: '0.04em' } as const;
function whisperFlags(text: string): boolean[] {
  let inside = false;
  return Array.from(text).map((c) => {
    if (c === '(') inside = true;
    const flag = inside;
    if (c === ')') inside = false;
    return flag;
  });
}
/** 대사 안의 '‖'는 한 토막씩 끊어 천천히 말하는 표시: 화면에는 보이지 않고, 그 자리에서 길게 뜸을 들이며 글자도 느려진다 */
const SLOW_MARK = '‖';
const SLOW_CHAR_MS = 115;
const SLOW_PAUSE_MS = 650;
function parseLine(raw: string): { text: string; slow: boolean; pauseAt: Set<number> } {
  const parts = raw.split(SLOW_MARK);
  const pauseAt = new Set<number>();
  let text = '';
  parts.forEach((p, i) => { if (i > 0) pauseAt.add(Array.from(text).length); text += p; });
  return { text, slow: parts.length > 1, pauseAt };
}
function Typed({ text: raw }: { text: string }) {
  const [n, setN] = useState(0);
  const { text } = parseLine(raw);
  const chars = Array.from(text);
  const whisper = whisperFlags(text);
  useEffect(() => {
    const p = parseLine(raw);
    const cs = Array.from(p.text);
    const wf = whisperFlags(p.text);
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(cs.length); return; }
    setN(0);
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      i += 1;
      setN(i);
      if (i >= cs.length) return;
      const c = cs[i - 1];
      // 속삭임이 시작되기 직전에는 목소리를 낮추듯 뜸을 들이고, '‖' 자리에서는 길게 쉰다
      const hush = cs[i] === '(' ? HUSH_MS : 0;
      const gap = p.pauseAt.has(i) ? SLOW_PAUSE_MS : 0;
      const base = c === '…' ? PAUSE_ELLIPSIS : /[.?!]/.test(c) ? PAUSE_STOP : c === ',' ? PAUSE_COMMA : p.slow ? SLOW_CHAR_MS : wf[i - 1] ? WHISPER_MS : CHAR_MS;
      t = setTimeout(step, hush + gap + base);
    };
    t = setTimeout(step, 180);
    return () => clearTimeout(t);
  }, [raw]);
  return (
    <>
      <style>{'@keyframes duckch{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:blur(0)}}'}</style>
      {chars.slice(0, n).map((c, i) => (
        <span key={i} style={{ animation: 'duckch .5s ease-out both', ...(whisper[i] ? WHISPER_STYLE : null) }}>{c}</span>
      ))}
      {/* 아직 안 나온 글자도 같은 크기로 자리를 잡아 둔다 (속삭임이 도착할 때 줄이 흔들리지 않게) */}
      <span className="invisible">{chars.slice(n).map((c, i) => <span key={i} style={whisper[n + i] ? WHISPER_STYLE : undefined}>{c}</span>)}</span>
    </>
  );
}

/** 대사가 다 나온 뒤 읽을 시간까지 포함해, 풍선이 떠 있어야 하는 시간(ms). 말줄임표와 마침표의 뜸도 센다 */
export function purserLineMs(raw: string, min = 3600): number {
  const { text, slow, pauseAt } = parseLine(raw);
  const len = Array.from(text).length;
  // 속삭임(괄호)은 앞에서 뜸을 들이고(HUSH_MS) 글자도 더 느리게 나온다. '‖' 대사는 글자가 느리고 토막 사이를 길게 쉰다
  const whisperChars = whisperFlags(text).filter(Boolean).length;
  const pauses = (text.match(/…/g)?.length ?? 0) * PAUSE_ELLIPSIS + (text.match(/[.?!]/g)?.length ?? 0) * PAUSE_STOP + (text.match(/,/g)?.length ?? 0) * PAUSE_COMMA
    + (text.match(/\(/g)?.length ?? 0) * HUSH_MS + whisperChars * (WHISPER_MS - CHAR_MS)
    + (slow ? len * (SLOW_CHAR_MS - CHAR_MS) + pauseAt.size * SLOW_PAUSE_MS : 0);
  return Math.max(min, 180 + len * CHAR_MS + pauses + 1600);
}

/** 지폐를 건넬 때의 대사. 다섯 장을 다 주면 발끈한다 */
const TIP = [
  '이것은 무엇이오? 팁이오? 받겠소. 거절하지 않는다고 했소.',
  '두 장째요. 구걸한 적은 없소. 다만 거절도 않소.',
  '세 장째요. 호의는 받겠소. 동정은 사절이오.',
  '네 장이오. 장부에 "후원"이라 적겠소. …기부는 아니오.',
];
export const purserTip = (n: number): string => (n >= 5 ? '나는 거지가 아니오! 다섯 장이나 받다니, 체면이 서지 않소!' : TIP[Math.min(n - 1, TIP.length - 1)]);
/** 다섯 장을 전부 돌려주며 */
/** 돌려준 뒤에 또 돈을 내밀면: 받지 않고 거절한다 */
const DUCK_REFUSE = [
  '이미 돌려드렸소. 같은 거절을 두 번 하게 하지 마시오.',
  '신사는 한 번 거절한 것을 다시 받지 않소.',
  '…그 손은 집어넣으시오. 내 체면은 한 번이면 충분하오.',
  '아니오. 아니라고 했소. 이 이야기는 끝났소.',
];
export const purserRefuseTip = (n: number): string => DUCK_REFUSE[Math.min(n, DUCK_REFUSE.length) - 1];
export const PURSER_RETURN = '…도로 가져가시오. 오리는 신사요. 이 일은 장부에 적지 않겠소.';

// 빼꼼 오리(spend/purser_peek.webp, 407x1089): 전신이 왼쪽(도박장 쪽)을 보도록 이미 뒤집어 저장했다.
// 몸의 왼쪽 30%를 도박장 틀 뒤에 두고 서 있다가, 틀 뒤로 미끄러져 들어간다. 꼬리 끝은 부리 끝 바로 왼쪽(가로 0.46, 세로 0.15)에 닿는다.
const PEEK_RATIO = 407 / 1089;
const PEEK_HIDE = 0.3;
const PEEK_TIP_X = 0.46;
const PEEK_TIP_Y = 0.15;
// 도박장 틀(CasinoModal 의 data-casino-frame)의 화면 위치. 틀은 화면 높이에 맞춰 줄어들기도 하므로 그려진 것을 직접 잰다
const casinoFrame = () => {
  const f = document.querySelector('[data-casino-frame]')?.getBoundingClientRect();
  if (f && f.width > 0) return { right: f.right, bottom: f.bottom };
  return { right: window.innerWidth / 2 + Math.min(980, window.innerWidth * 0.94) * 0.44, bottom: window.innerHeight - 40 };
};

const PEEK_ID = 'purser-peek';

/**
 * 빼꼼 오리 그림. 도박장 창과 같은 쌓임 맥락(화면 루트)에 두어야 창 뒤(z-105)로 숨는다: 창의 dim 은 z-100, 창은 z-110.
 * 그래서 DuckPurser 안이 아니라 도박장 창 옆에서 따로 그린다. 말풍선(DuckPurser, peek 켜짐)이 이 요소(id)의 위치를 따라간다.
 * 발은 틀 아랫선에 맞춘다: 틀이 가려 주는 높이 안에서만 드나들어, 숨는 모습이 어색하지 않다.
 */
export function PurserPeek({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (() => {
        const fr = casinoFrame();
        const h = Math.min(window.innerHeight * 0.44, 400);
        const w = h * PEEK_RATIO;
        return (
          <div id={PEEK_ID} key="peek" className="pointer-events-none fixed z-[105]"
            style={{ height: h, width: w, left: fr.right - w * PEEK_HIDE, bottom: Math.max(0, window.innerHeight - fr.bottom + 14) }}>
            <motion.div
              className="h-full w-full"
              initial={{ x: '-105%' }}
              animate={{ x: 0 }}
              exit={{ x: '-105%', transition: { duration: 0.5, ease: 'easeIn' } }}
              transition={{ x: { duration: 0.7, ease: 'easeOut' } }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/spend/purser_peek.webp" alt="" aria-hidden draggable={false} className="h-full w-full select-none drop-shadow-[0_8px_14px_rgba(0,0,0,0.55)]" />
            </motion.div>
          </div>
        );
      })()}
    </AnimatePresence>
  );
}

export default function DuckPurser({ line, lineKey, pose = 'idle', onPoke, glow = false, shock = 0, peek = false }: { line: string | null; lineKey: number; pose?: PurserPose; onPoke?: () => void; glow?: boolean; shock?: number; peek?: boolean }) {
  // 말풍선은 body 로 꺼내 띄운다: 이발소 머리카락 오버레이(z-150)가 오리 쪽 쌓임 맥락(z-30)보다 위라서, 안에서는 말풍선이 가려진다.
  // 자리는 오리 위에 비워 둔 칸(anchorRef)의 화면 좌표를 따라간다. 빼꼼 오리(peek)가 나와 있으면 그쪽 부리를 따라간다.
  const anchorRef = useRef<HTMLDivElement>(null);
  // tipDx/tipDy: 꼬리 끝이 닿을 곳 (left 에서 오른쪽으로, 칸 아래(=오리 머리 꼭대기)에서 아래로)
  const [anchor, setAnchor] = useState<{ left: number; top: number; height: number; tipDx: number; tipDy: number } | null>(null);
  useEffect(() => {
    const measure = () => {
      const pr = peek ? document.getElementById(PEEK_ID)?.getBoundingClientRect() : null;
      if (pr && pr.height > 0) {
        setAnchor({ left: pr.left, top: pr.top - BUBBLE_RESERVE, height: BUBBLE_RESERVE, tipDx: pr.width * PEEK_TIP_X, tipDy: pr.height * PEEK_TIP_Y });
        return;
      }
      const r = anchorRef.current?.getBoundingClientRect();
      // 좁은 화면에서 오리가 숨겨지면(display:none) 크기가 0이다: 그때는 말풍선도 띄우지 않는다
      // 오리 키는 아래 버튼 스타일(min(46vh, 440px))과 같다. 부리 위치를 오리 크기에서 계산하는 데 쓴다
      const duckH = Math.min(window.innerHeight * 0.46, 440);
      setAnchor(r && r.height > 0 ? { left: r.left, top: r.top, height: r.height, tipDx: duckH * BEAK_X, tipDy: duckH * BEAK_Y } : null);
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [line, lineKey, peek]);
  // 도장 포즈일 때는 정지 이미지 대신 4컷이 이어져 움직인다. 마지막 컷에서 "쿵" 소리와 함께 멈춘다.
  const [stampFrame, setStampFrame] = useState(0);
  // 가만히 있을 때도 가끔 주판을 튕긴다 (대사가 없는 idle 에서만)
  const [flick, setFlick] = useState(0);
  useEffect(() => {
    if (pose !== 'idle') return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => { t = setTimeout(() => { setFlick((n) => n + 1); next(); }, 9000 + Math.random() * 6000); };
    next();
    return () => clearTimeout(t);
  }, [pose]);
  const [flickOn, setFlickOn] = useState(false);
  const [flickPose, setFlickPose] = useState<PurserPose>('calc');
  useEffect(() => {
    if (!flick) return;
    setFlickPose(Math.random() < 0.5 ? 'watch' : 'calc'); // 주판을 튕기거나, 보란 듯이 시계를 꺼내 본다
    setFlickOn(true);
    const t = setTimeout(() => setFlickOn(false), 2700);
    return () => clearTimeout(t);
  }, [flick]);
  const shown: PurserPose = pose === 'idle' && flickOn ? flickPose : pose;
  const [watchFrame, setWatchFrame] = useState(0);
  useEffect(() => {
    if (shown !== 'watch') return;
    setWatchFrame(0);
    const ts = [
      ...WATCH_STEPS.map(([f, ms]) => setTimeout(() => setWatchFrame(f), ms)),
      ...WATCH_TICKS.map((ms) => setTimeout(() => playTick(), ms)),
    ];
    return () => ts.forEach(clearTimeout);
  }, [shown, lineKey]);
  const [calcFrame, setCalcFrame] = useState(0);
  useEffect(() => {
    if (shown !== 'calc') return;
    setCalcFrame(0);
    const ts = [
      ...CALC_STEPS.map(([f, ms]) => setTimeout(() => setCalcFrame(f), ms)),
      ...CALC_CLICKS.map((ms, i) => setTimeout(() => playAbacus(i === CALC_CLICKS.length - 1), ms)),
    ];
    return () => ts.forEach(clearTimeout);
  }, [shown, lineKey]);
  useEffect(() => {
    if (pose !== 'stamp') return;
    setStampFrame(0);
    const ts = STAMP_AT.map((ms, i) => setTimeout(() => { setStampFrame(i); if (i === STAMP_FRAMES.length - 1) playStamp(); }, ms));
    return () => ts.forEach(clearTimeout);
  }, [pose, lineKey]);

  return (
    <div className="pointer-events-none relative hidden shrink-0 flex-col items-center md:flex">
      {/* 말풍선 자리: 오리 머리 위에 높이를 따로 잡아 둔다. 제목 쪽으로 넘어가 겹치는 일이 없다 */}
      <div ref={anchorRef} className="relative" style={{ width: 0, height: BUBBLE_RESERVE }} />
      {/* 실제 말풍선: body 위 z-[155] (머리카락 오버레이 z-150 위, 가위 커서 z-160 아래) */}
      {anchor && createPortal(
      <div className="pointer-events-none fixed z-[155]" style={{ left: anchor.left, top: anchor.top, width: 0, height: anchor.height }}>
      <AnimatePresence mode="wait">
        {line && (
          <motion.div
            key={lineKey}
            initial={{ opacity: 0, y: 8, scale: 0.92, x: 0 }}
            animate={line.includes('꽥') ? { opacity: 1, y: 0, scale: 1, x: [0, -4, 4, -3, 3, 0] } : { opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute z-40"
            style={{ width: BUBBLE_W, aspectRatio: `${BUBBLE_W} / ${BUBBLE_H}`, left: Math.round(-BUBBLE_W * BUBBLE_TAIL_X + anchor.tipDx), bottom: -Math.round(anchor.tipDy) }}
            role="status"
            aria-live="polite"
          >
            {/* 양피지 말풍선: 장식 테두리가 있는 그림. 꼬리는 오른쪽 아래의 오리를 향한다 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/spend/purser_bubble.webp" alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]" style={{ objectFit: 'fill' }} />
            <p aria-label={parseLine(line).text} className="absolute flex items-center justify-center px-[2%] text-center font-sans text-[22px] font-semibold leading-snug text-[#2a1c0e]" style={{ left: '13%', right: '13%', top: '16%', height: '58%' }}>
              <span aria-hidden><Typed text={line} /></span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      </div>,
      document.body,
      )}

      {/* 빼꼼 오리: 도박장 창이 오리를 가릴 때, 창 오른쪽 가장자리 뒤에서 고개를 내밀고 말한다 (창 뒤 dim z-100 위, 창 z-110 아래, 말풍선 z-155 아래) */}
      {/* 포즈 이미지는 모두 같은 크기·위치의 캔버스라 바꿔도 흔들리지 않는다. 겹쳐 두고 투명도로 전환한다 */}
      <button
        type="button"
        data-duck
        onClick={onPoke}
        aria-label="오리 사무장에게 말 걸기"
        className="pointer-events-auto relative z-10 cursor-pointer drop-shadow-[0_14px_16px_rgba(0,0,0,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bright-brass"
        style={{
          aspectRatio: '655 / 1114', height: 'min(46vh, 440px)', filter: glow ? 'drop-shadow(0 0 18px rgba(251,191,36,0.85))' : undefined, transform: glow ? 'scale(1.04)' : undefined, transition: 'transform 150ms, filter 150ms',
          // 번개를 맞으면 A/B 이름을 번갈아 바꿔 같은 연출이 처음부터 다시 돈다 (끝나면 위의 glow 스타일로 돌아간다)
          ...(shock > 0 ? { animation: `${shock % 2 ? 'duckShockA' : 'duckShockB'} 1.3s ease-out` } : null),
        }}
      >
        <style>{DUCK_SHOCK_CSS}</style>
        {/* 감전: 번개 맞은 그림(purser_shock)이 잠깐 나타나고, 평소 포즈는 그동안 가려진다. 번개를 맞을 때마다 처음부터 다시 */}
        {shock > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={shock}
            src="/spend/purser_shock.webp"
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-0 z-20 block max-w-none -translate-x-1/2"
            style={{ height: '100%', width: 'auto', animation: 'duckShockImg 1.25s linear both' }}
          />
        )}
        <div className="absolute inset-0" style={shock > 0 ? { animation: `${shock % 2 ? 'duckHideA' : 'duckHideB'} 1.25s linear both` } : undefined}>
        {STILL_POSES.map((p) => (
          <img
            key={p}
            src={`/spend/purser_${p}.webp`}
            alt={p === shown ? '오리 사무장' : ''}
            aria-hidden={p !== shown}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain transition-opacity duration-200"
            style={{ opacity: p === shown ? 1 : 0 }}
          />
        ))}
        {/* 장부 쓰기: 깃펜을 든 네 컷과 중간 컷이 박자에 맞춰 이어진다 */}
        {WRITE_FRAMES.map((f) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`write-${f}`}
            src={`/spend/purser_write_${f}.webp?v=3`} // 그림을 바꿀 때마다 숫자를 올려 브라우저에 남은 예전 그림을 쓰지 않게 한다
            alt={f === '1' && shown === 'ledger' ? '오리 사무장' : ''}
            aria-hidden={!(f === '1' && shown === 'ledger')}
            draggable={false}
            decoding="sync"
            className="absolute left-1/2 top-0 block max-w-none -translate-x-1/2"
            style={{ height: '100%', width: 'auto', willChange: 'opacity', ...(shown === 'ledger' ? { animation: `duckWrite_${f} ${WRITE_TOTAL}ms step-end infinite` } : { opacity: 0 }) }}
          />
        ))}
        {WIDE_POSES.map((p) => (
          <img
            key={p}
            src={`/spend/purser_${p}.webp`}
            alt={p === shown ? '오리 사무장' : ''}
            aria-hidden={p !== shown}
            draggable={false}
            className="absolute left-1/2 top-0 block max-w-none -translate-x-1/2 transition-opacity duration-200"
            style={{ height: '100%', width: 'auto', opacity: p === shown ? 1 : 0 }}
          />
        ))}
        {/* 주판 컷: 중간 컷이 있어서 바로 바꿔도 부드럽다. 컷이 바뀔 때 겹쳐 흐려지면 오히려 깜빡이므로 전환 시간을 두지 않는다 */}
        {CALC_FILES.map((f, i) => (
          <img
            key={`calc-${f}`}
            src={`/spend/purser_calc_${f}.webp`}
            alt={shown === 'calc' && calcFrame === i ? '오리 사무장' : ''}
            aria-hidden={!(shown === 'calc' && calcFrame === i)}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ opacity: shown === 'calc' && calcFrame === i ? 1 : 0, transition: shown === 'calc' ? 'none' : 'opacity 200ms' }}
          />
        ))}
        {WATCH_FILES.map((f, i) => (
          <img
            key={`watch-${f}`}
            src={`/spend/purser_watch_${f}.webp`}
            alt={shown === 'watch' && watchFrame === i ? '오리 사무장' : ''}
            aria-hidden={!(shown === 'watch' && watchFrame === i)}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ opacity: shown === 'watch' && watchFrame === i ? 1 : 0, transition: shown === 'watch' ? 'none' : 'opacity 200ms' }}
          />
        ))}
        {STAMP_FRAMES.map((i) => (
          <img
            key={`stamp-${i}`}
            src={`/spend/purser_stamp_${i}.webp`}
            alt={pose === 'stamp' && stampFrame === i ? '오리 사무장' : ''}
            aria-hidden={!(pose === 'stamp' && stampFrame === i)}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ opacity: pose === 'stamp' && stampFrame === i ? 1 : 0 }}
          />
        ))}
        </div>
      </button>
    </div>
  );
}

/** 시설별 첫 대사. 같은 시설을 또 쓰면 REPEAT 대사가 나온다. */
const FIRST: Record<string, string[]> = {
  pool: [
    '수영장이오. 오리가 운영한다고 놀라지 마시오. 물은 내 전문이오.',
    '물은 정직하오. 들어가면 젖고, 나오면 춥소.',
    '깊은 곳은 허리까지요. …이 배에서는 물이 얕은 편이 좋소.',
    '헤엄은 배워 두어서 나쁠 것 없소. 아니, 아주 좋소.',
  ],
  barber: [
    '배 위의 이발소라 파도가 잔잔할 때 가는 걸 추천하오.',
    '머리는 깎되 부리는 건드리지 마시오. 지난번 이발사는 아직 병가 중이오.',
    '가위가 손에 들려도 머리카락까지만이오. 그 이상은 장부에 적겠소.',
    '깎은 머리는 도로 붙지 않소. 신중하시오.',
  ],
  massage: [
    '당시대, 아니 현시대 최고 기술이오. 고문기구가 아니니 안심하시오.',
    '전기요법이오. 찌릿하면 정상이오. 아프면 손을 드시오 (묶여 있지만)',
    '오리 전기구이라고 했소? 장난이 지나치오.',
    '고문기구가 아니라 했소. 비명은 감탄사로 분류하겠소.',
  ],
  telegraph: [
    '무선 전신이오. 경보 전보는 대개 읽히기도 전에 쌓이는 법이오.',
    '소식은 빠르오. 읽는 사람이 느릴 뿐이오.',
    '점과 선이 전부요. 그 점과 선에 목숨이 달릴 때도 있소.',
    '뭐라고 보내고 싶소? 어머니께 안부는 어떻소?',
  ],
  bath: [
    '목욕탕이오. 깃털은 방수니 걱정 마시오. 손님 양복은 모르겠소.',
    '거품은 터지기 마련이오. 기대는 터지지 않게 하시오.',
    '뜨거운 물은 근심을 풀어 주오. …일부만.',
  ],
  souvenir: [
    '기념품이오. 정가요. 흥정하시면 부리로 답하겠소.',
    '기념품이오. 개인적으로는 사치품 소비를 잘 하지는 않소.',
    '칼도 있소. 다루는 법을 모르면 손대지 않는 걸 추천하오.',
  ],
  // 권하지는 않지만 내심 원하는 오리: 말리는 척하다가 속내가 새어 나온다
  gamble: [
    '도박이라. 나는 권하지 않소. 다만 …한 번쯤 보고 싶긴 하오.',
    '권하지 않소. ‖절대. ‖진심이오.', // ‖: 한 토막씩 천천히 끊어서 말한다
    '도박은 몸에 해롭소. 장부에는 이로우오. 이기든 지든 적을 것이 생기니까.',
    '카드 섞는 소리가 좋소. …아니오, 아무것도 아니오.',
  ],
};
/** 도박장에서 돈을 잃고 다시 찾아왔을 때만 끼어드는 대사: 권한 적 없다고 발뺌한다 */
const GAMBLE_AFTER_LOSS = '돈을 잃은 뒤 다시 오면 왜 이쪽을 보는 것이오. 나는 권한 적 없소.';
const lastIntro: Record<string, number> = {};
const REPEAT = ['또 오셨소. 단골 우대는 없소. 인사만 있소.', '세 번째요. 장부에 굵게, 밑줄도 치겠소.', '이쯤이면 이 선박의 주주요. 배당은 없소.'];

/** 선반을 돌려 시설이 가운데에 올 때 하는 대사 (시설별 첫 대사를 그대로 쓴다) */
/** 시설이 가운데에 올 때의 포즈 */
export const purserIntroPose = (id: string): PurserPose => (id === 'gamble' ? 'refuse' : id === 'souvenir' ? 'palms' : 'point');
/** 시설별 소개 대사를 무작위로 고른다. 같은 시설을 연달아 볼 때 직전과 같은 줄은 피한다 */
export function purserIntro(id: string, lostGamble = false, child = false): string {
  let pool = FIRST[id];
  if (!pool) return '살펴보시오. 선택은 손님의 몫이오.';
  // 아이에게는 칼 대신 사탕이 나오므로 칼 이야기를 사탕 이야기로 바꾼다
  if (id === 'souvenir' && child) pool = [...pool.filter((l) => !l.includes('칼')), '사탕도 있소. 먹고 나면 이는 닦으시오.'];
  // 도박장에서 돈을 잃은 손님이 다시 이 시설을 보면, 사무장이 먼저 발뺌한다
  if (id === 'gamble' && lostGamble && Math.random() < 0.6) return GAMBLE_AFTER_LOSS;
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && i === lastIntro[id]) i = (i + 1) % pool.length;
  lastIntro[id] = i;
  return pool[i];
}

/** 이발소: 오리를 가리던 머리카락을 잘라 앞이 보이게 되었을 때 */
export const PURSER_HAIR_CLEAR = '…앞이 보이오. 감사하오, 손님. 입에 좀 들어간 것 같소.';

/** 지폐가 한 장도 남지 않았는데 시설을 둘러볼 때 */
const BROKE = [
  '지갑이 비었소. 구경은 무료요. …아직은.',
  '돈이 없는데 둘러보면 마음만 비싸지오.',
  '그 시설은 지폐 없이는 열리지 않소. 나도 규칙은 지키오.',
  '빈 주머니로 오는 손님은 오랜만이오. …나도 그랬던 것 같소.',
  '구경만 하시오. 나는 그것도 장부에 적겠소.',
];
let lastBroke = -1;
/** 도박장에서 가진 지폐를 모두 잃고 나왔을 때 한마디. 탓하지 않고 장부 말투로 돌려 말한다 */
const BUSTED: readonly (readonly [string, PurserPose, number])[] = [
  ['권하지 않았소. 말리지도 않았소. 오리는 중립이오.', 'shrug', 4800],
  ['전부 잃으셨소? 장부에는 한 줄로 끝나오. 사람 일이 대개 그렇소.', 'ledger', 5200],
  ['나갈 때 지갑이 더 가벼운 손님은 처음이… 아니오. 매일 밤이오.', 'think', 5200],
  ['하우스는 언제나 이기오. 나는 하우스가 아니오. 오리요.', 'hips', 4800],
];
const BUSTED_WITH_BAG = ['가방에 넣어 둔 돈은 무사하오. 사람은 가끔 옳은 일을 먼저 하오.', 'bow', 5200] as const;
let lastBusted = -1;
/** hasBag: 가방에 따로 챙겨 둔 지폐가 남아 있는가 */
export function purserBusted(hasBag: boolean): readonly [string, PurserPose, number] {
  if (hasBag) return BUSTED_WITH_BAG;
  let i = Math.floor(Math.random() * BUSTED.length);
  if (i === lastBusted) i = (i + 1) % BUSTED.length;
  lastBusted = i;
  return BUSTED[i];
}

export function purserBroke(): string {
  let i = Math.floor(Math.random() * BROKE.length);
  if (i === lastBroke) i = (i + 1) % BROKE.length;
  lastBroke = i;
  return BROKE[i];
}

/** 오리를 눌렀을 때 나오는 아무 말 대사와 포즈 */
const POKE = [
  '나를 찌르지 마시오. 제복이 구겨지면 내 위엄도 구겨지오.',
  '질문은 환영하오. 대답은 유료요.',
  '시간은 금이오. 나는 오리라 그 금을 빵으로 환산하오.',
  '나는 근무 중이오. 빵 부스러기는 퇴근 후에 받겠소.',
  '물에 뜨는 건 오리의 특기요. 손님의 특기는 모르겠소.',
  '꽥꽥 소리가 들렸다면 환청이오. 나는 한 번만 우오.',
  '시계를 보는 것이 아니오. 손님이 늦었음을 확인하는 것이오.',
  '이 시계는 정확하오. 틀린 쪽은 대개 손님이오.',
  '손님의 시간은 내가 맡아 두겠소. 이자는 별도요.',
  '이 배에서 가장 유능한 승무원이 누구냐고? 질문이 이미 무례하오.',
  '이 배는 가라앉지 않소. 내가 보증하오. 서면은 곤란하오.',
  '그 손가락은 어디서 소독했소?',
  '팁은 받지 않소. 다만 거절도 하지 않소.',
  '꽥. ...실례했소. 직업병이오.',
  '장부에 적어 두겠소. 당신이 나를 불렀다고.',
  '구명정 이야기라면 나중에 합시다. 아직 이르오.',
  '오리라서 놀랐소? 나는 당신이 처음 나타났을 때가 더 놀라웠소.',
];
const POKE_POSES: PurserPose[] = ['idle', 'shrug', 'refuse', 'point', 'ledger', 'greet', 'calc', 'calc', 'hips', 'palms', 'think'];

// ── 눈치 ──────────────────────────────────────────────────────────
// 오리는 아무것도 모르는 척하지만, 처음부터 어렴풋이 이상함을 느끼고, 항해를 거듭할수록 낌새를 챈다.
// 회차(run)가 오를수록 눈치 채는 대사가 늘고 또렷해진다. 1회차에도 가볍게 흘리는 말이 두 줄 섞여 있다.
const HINT_FIRST = [
  '오늘 밤은 어쩐지 바다가 너무 조용하오. …평소에도 조용했던가?',
  '선원들이 구명정 도르래에 기름을 치고 있더이다. 점검일이겠지. 아마도.',
  '구두는 편한 걸 신으셨소? …그냥 묻는 것이오.',
];
/** 2회차 이상: 어디서 본 듯한 느낌 */
const HINT_DEJAVU = [
  '어디서 본 얼굴이오. …아니오, 오늘 처음 근무요. 그럴 리 없소.',
  '방금 이 대화, 해 본 것 같지 않소?',
  '당신 지출 습관, 어디서 본 것 같소. 장부에는 없는데 말이오.',
];
/** 3회차 이상: 의심 */
const HINT_SUSPECT = [
  '나는 오리지만 기억력은 좋소. 당신 얼굴은 분명 어딘가에서…',
  '이번엔 다른 걸 사 보시오. 같은 영수증은 지겹소.',
  '당신은 이 배의 결말을 아는 얼굴이오. …나도 눈치는 있소.',
];
/** 5회차 이상: 알고 있다는 것을 숨기지 않는다 */
const HINT_KNOWING = [
  '내 장부에 당신 이름이 여러 줄 적혀 있소. 쓴 기억은 없는데 말이오.',
  '구명정 이야기, 이제 나중으로 미루지 않겠소. …나도 이유는 모르오.',
  '당신은 알고 있소. 나도 알 것 같소. 서로 모르는 척합시다.',
];
/** 숨은 독백: 5회차 이후, 지금까지(전 회차 포함) 모든 시설을 이용해 본 손님이 오리를 6번 누르면 한꺼번에 이어서 나온다.
 *  집요하게 묻던 손님에게 오리가 처음으로 되묻는다. 타임머신을 직접 입에 올린다. */
export const MONOLOGUE: { line: string; pose: PurserPose }[] = [
  { pose: 'hips', line: '…집요하게 질문하시니, 이제 내 차례요. ‖나도 하나만 물읍시다.' },
  { pose: 'think', line: '당신은 ‖어떻게 선별되었소? 이 배에 삼천 명이 있는데, 어째서 당신만 같은 밤을 되풀이하오.' },
  { pose: 'ledger', line: '장부 귀퉁이에 낯선 단어가 적혀 있소. ‖타임머신. 쓴 기억은 없소. 그게 무엇이오?' },
  { pose: 'watch', line: '시간을 거슬러 오는 기계라 했소? 그렇다면 당신은 손님이 아니라 관객이오. …나는 무대 장치고.' },
  { pose: 'think', line: '누가 당신을 이 배에 태웠소? 그리고 누가 나를… ‖아니오. 나는 사무장이오. 그것으로 충분하오.' },
  { pose: 'bow', line: '당신이 돌아가면 나는 어디로 가오? 장부는 남소? …그리고 하나 더, 왜 하필 오리인 것이오?' },
];
const SECRET_NEED = 6;
let secretPokes = 0;
let secretDone = false;

// 전 회차를 통틀어 이용해 본 시설 (브라우저에 저장)
const FAC_KEY = 'titanic.duck.facilities';
const ALL_FAC = ['gamble', 'barber', 'massage', 'telegraph', 'bath', 'pool', 'souvenir'];
function usedFacilities(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FAC_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function purserMarkFacility(id: string) {
  try {
    const cur = usedFacilities();
    if (ALL_FAC.includes(id) && !cur.includes(id)) localStorage.setItem(FAC_KEY, JSON.stringify([...cur, id]));
  } catch {
    /* 저장이 막혀 있으면 이번 회차만 센다 */
  }
}
function allFacilitiesUsed(): boolean {
  const cur = usedFacilities();
  return ALL_FAC.every((f) => cur.includes(f));
}
/** 독백을 끝까지 듣지 못하고 끊겼을 때: 다음에 오리를 누르면 바로 다시 시작한다 */
export function purserMonologueReset() {
  secretDone = false;
  secretPokes = SECRET_NEED - 1;
}
/** 숨은 독백을 암시하는 일반 대사 (3회차 이상에서 가끔) */
const HINT_SECRET = [
  '…가끔 나도 묻고 싶은 것이 있소. 아직은 때가 아니오.',
  '이 배의 구석구석을 다 다녀 본 손님이라면, 내 질문을 받을 자격이 있소. …있는 것 같소.',
  '질문은 손님이 하는 것이 순서요. 내가 묻는 날이 오면, 그날은 각오하시오.',
  '자꾸 찌르면 나도 한마디 하겠소. …이미 꽤 참았소.',
  '장부에 질문 한 줄을 비워 두었소. 아직 채우지 않았소. 채울 날이 올 것 같아서.',
];
let lastPoke = '';

function pickPoke(run: number): string {
  // 회차가 높을수록 눈치 대사를 더 자주 고른다
  const tiers: string[][] = [];
  if (run >= 5) tiers.push(HINT_KNOWING);
  if (run >= 3) tiers.push(HINT_SUSPECT);
  if (run >= 2) tiers.push(HINT_DEJAVU);
  if (run >= 3) tiers.push(HINT_SECRET); // 가장 드물게
  const hintChance = run >= 2 ? Math.min(0.75, 0.35 + (run - 2) * 0.12) : 0.18;
  let pool: string[];
  if (tiers.length && Math.random() < hintChance) {
    // 높은 회차의 대사일수록 가중치를 준다
    const t = tiers[Math.floor(Math.random() * Math.random() * tiers.length)];
    pool = t;
  } else if (run === 1 && Math.random() < 0.18) {
    pool = HINT_FIRST;
  } else {
    pool = POKE;
  }
  let line = pool[Math.floor(Math.random() * pool.length)];
  if (line === lastPoke) line = pool[(pool.indexOf(line) + 1) % pool.length];
  return line;
}

/** run: 지금이 몇 번째 항해인가(1부터) */
export function purserPoke(run = 1): { line: string; pose: PurserPose; follow?: { line: string; pose: PurserPose }[] } {
  if (!secretDone && run >= 5 && allFacilitiesUsed()) {
    secretPokes += 1;
    if (secretPokes >= SECRET_NEED) {
      secretDone = true;
      lastPoke = MONOLOGUE[0].line;
      return { ...MONOLOGUE[0], follow: MONOLOGUE.slice(1) };
    }
  }
  const line = pickPoke(run);
  lastPoke = line;
  // 시간 이야기를 할 때는 회중시계를 꺼내 들고 한다
  if (/시계|시간/.test(line)) return { line, pose: 'watch' };
  return { line, pose: POKE_POSES[Math.floor(Math.random() * POKE_POSES.length)] };
}

export const PURSER_GREETING = '말하는 오리라 놀랐소? 나에게는 당신의 존재가 더 놀랍소. 나는 사무장이오. 존칭을 쓰시오.';
/** 세 방에 숨은 오리를 모두 찾은 손님을 처음 만날 때 한 번만 하는 말: 오리 사무장은 자기가 왜 오리인지 모르므로 호기심으로만 언급한다 */
export const PURSER_DUCKS = '오리들을 모두 찾다니 대단하오. 눈썰미가 좋은 거요, 아니면 업적창을 먼저 눌러 본 거요?';
/** 첫 인사: 회차가 오를수록 이미 아는 사이처럼 변한다 */
export function purserGreeting(run = 1): string {
  if (run >= 5) return '내 장부에 당신 이름이 여러 줄 적혀 있소. 쓴 기억은 없는데 말이오.';
  if (run >= 4) return '당신, 매번 같은 표정으로 오시오. 이 배의 결말을 아는 사람처럼.';
  if (run === 3) return '세 번째 아니오? 아니오, 세 번째일 리가 없소. 나는 오늘 처음 근무요.';
  if (run === 2) return '또 오셨소? 처음 뵙는 얼굴인데 어째서 이렇게 낯익소.';
  return PURSER_GREETING;
}
/** 가방(저축)에 넣을 때: 산 것이 아니라 아낀 것이므로 구매 대사를 쓰지 않는다 */
// 오리는 도파민을 좇는 쪽이라, 아낀 돈 앞에서 아쉬운 기색을 숨기지 못한다
const BAG = [
  '가방에 넣으셨소. 현명하오. (…보기와는 다르군)',
  '또 넣으셨소. …타이타닉보다는 은행이 어울리겠소.',
  '그 가방, 도둑맞지 않길 바라겠소.',
];
export const PURSER_LAST_BAG = '마지막 한 장까지 가방에 들어갔소. 영수증은 필요 없겠소.';
export const PURSER_LAST = '계산이 끝났소. 후회는 영수증에 포함되지 않소.';
/** 마지막 지출 뒤의 대사: 1회차에도 가볍게 일러 두고, 회차가 오를수록 이번 밤이 다르게 끝나길 바란다 */
export function purserLast(run = 1, bag = false): string {
  if (run >= 3) return bag ? '가방은 단단히 챙기시오. 이번 밤은 다르게 끝나길 바라오.' : '또 같은 계산이오. 이번 밤은 다르게 끝나길 바라오.';
  if (run === 2) return bag ? '이번에도 가방이오? …그래도 좋소. 단단히 챙기시오.' : '계산이 끝났소. 이번에도 같은 가방이오? …그래도 좋소.';
  return bag ? '가방은 단단히 챙겨 두시오. 쓸 일이 없기를 바랄 뿐이오.' : '계산이 끝났소. 오늘 밤은 일찍 쉬지 마시오. 내 직감일 뿐이오.';
}

/** 시설 선반을 쉬지 않고 계속 돌릴 때: 돌린 횟수가 이 값에 닿으면 소개 대신 한마디를 한다.
 *  장부에 적고(강박), 세다가 포기하고, 결국 제자리로 돌아온다는 말로 끝난다(체념). 마지막 줄 뒤로는 말이 없다 */
const WHEEL_LINES: { at: number; line: string; pose: PurserPose }[] = [
  { at: 5, line: '…선택지가 많다는 건 행운이기도 불행이기도 하오.', pose: 'palms' },
  { at: 10, line: '열 번째요. 장부에 "망설임"이라 적었소. 항목이 점점 길어지고 있소.', pose: 'ledger' },
  { at: 16, line: '…한 바퀴 돌면 제자리요. 이 선반도, 이 밤도.', pose: 'think' },
  { at: 24, line: '몇 번째인지 세다가 그만뒀소. 장부가 모자라오.', pose: 'calc' },
  { at: 36, line: '얼마든지 돌려 보시오. 이런 걸로 화내는 시기는 지났소.', pose: 'palms' },
];
/** spins: 방금까지 이어서 돌린 횟수(이번 포함). 정해진 횟수가 아니면 null */
export function purserWheelLine(spins: number): { line: string; pose: PurserPose } | null {
  const hit = WHEEL_LINES.find((w) => w.at === spins);
  return hit ? { line: hit.line, pose: hit.pose } : null;
}

/** 지폐를 쓴 순간의 대사. 시설 소개는 이미 선반을 돌릴 때 했으므로 첫 이용은 짧은 확인만 한다. */
const ACK = ['받았소. 장부에 적겠소.', '확인했소. 영수증은 없소.', '거래 성립이오. 환불은 없소.', '도장 쾅. 이제 물릴 수 없소. 오리는 번복을 모르오.', '꽥, 아니 좋소. 거래 성립이오.', '내 계산에 틀림은 없소. 틀린 것은 대개 손님이오.'];
/** 아이가 사탕을 건넸을 때 (n번째). 근무 중이라며 사양하는 척하다가 단 것 앞에서 무너진다 */
const CANDY = [
  '…이것은 무엇이오? 사탕이오? 근무 중에는 받지 않소. (…고맙소)',
  '두 개째요. 달다는 건 알고 있소. …알면서 먹는 것이오.',
  '세 개째요. 장부에 "단 것"이라 적었소. 항목이 아니라 취향이오.',
  '또 주시오? 오리는 신사요. …신사는 단 것을 거절하지 않소.',
];
export const purserCandy = (n: number): string => CANDY[Math.min(n, CANDY.length) - 1];

/** 시설을 처음 쓴 순간 하는 짧은 기능 설명: 지금 무엇이 생겼는지 알려 준다 */
const FUNC: Record<string, string> = {
  pool: '화면 아래로 물이 차오르오. 물건을 떨어뜨리면 물보라가 튀오.',
  barber: '가위가 손에 들리오. 늘어진 머리카락 좀 잘라 주시오. (이건 도대체 누구의…)',
  massage: '손끝에 전기가 흐르게 되오. 눌러 보시오, 너무 놀라진 말고.',
  telegraph: '전신기가 나오오. 점과 선으로 신호를 보낼 수 있소. 당신의 전보를 읽어 보진 않겠소.',
  bath: '거품이 피어오르오. 하나 남은 방울을 터뜨릴 수 있겠소?',
  souvenir: '기념품이 쏟아지오. 집어서 가져가 보시오. (할 수 있다면)',
  gamble: '배의 해리를 맞히면 지폐가 불어나고, 틀리면 사라지오. …당첨의 기분이 나쁘지 않소. 권하는 건 아니오.',
};
export function purserLine(facilityId: string, timesBefore: number): string {
  if (facilityId === 'mybag') return BAG[Math.min(timesBefore, BAG.length - 1)];
  if (timesBefore > 0) return REPEAT[Math.min(timesBefore - 1, REPEAT.length - 1)];
  return FUNC[facilityId] ?? ACK[Math.floor(Math.random() * ACK.length)];
}
