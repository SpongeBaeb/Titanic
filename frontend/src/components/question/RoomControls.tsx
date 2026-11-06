'use client';

import { useState } from 'react';
import { create } from 'zustand';
import { motion, useReducedMotion } from 'framer-motion';
import { useBgMap } from './useBgMap';

/**
 * 기관실 배경의 조작 레버와 전구 조명.
 * - RoomLighting: 전구 빛(밝기 3단계, 점멸)과 방 전체의 밝기를 그린다.
 * - RoomControls: 콘솔 앞판에 둥근 푸시 버튼 5개를 얹는다. 눌리면 면이 받침까지 내려앉고,
 *   켜 둔 상태는 버튼 색으로 은은하게 빛난다.
 */

// 전구 위치(배경 그림 좌표)
const BULBS: [number, number][] = [
  [221, 110], [376, 100], [470, 130], [645, 178], [729, 75], [1030, 22], // 천장에 매달린 전구
  [307, 277], [340, 277], [371, 280], [567, 298], [585, 298], [601, 298], [619, 300], // 콘솔 위 전구
  [168, 408], [211, 404], [253, 404], [293, 402], // 왼쪽 상자의 전구
];

export type LightLevel = 0 | 1 | 2; // 어둡게 / 보통 / 밝게

export function RoomLighting({ level, flicker, reduced }: { level: LightLevel; flicker: boolean; reduced: boolean }) {
  const m = useBgMap();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes bulb-flicker {
          0%, 100% { opacity: 1; } 6% { opacity: .15; } 9% { opacity: .9; } 14% { opacity: .1; }
          18% { opacity: .8; } 40% { opacity: 1; } 52% { opacity: .35; } 55% { opacity: 1; }
          78% { opacity: .9; } 82% { opacity: .2; } 86% { opacity: 1; }
        }
      `}</style>
      <div
        className="absolute inset-0"
        style={{ animation: flicker && !reduced ? 'bulb-flicker 2.6s steps(1, end) infinite' : undefined }}
      >
        {/* 밝게: 전구마다 따뜻한 빛번짐을 더한다 */}
        {BULBS.map(([x, y], i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: m.toX(x),
              top: m.toY(y),
              width: 190 * m.s,
              height: 190 * m.s,
              transform: 'translate(-50%,-50%)',
              background: 'radial-gradient(circle, rgba(255,214,140,0.8) 0%, rgba(255,170,70,0.4) 28%, rgba(255,140,40,0) 68%)',
              mixBlendMode: 'screen',
              opacity: level === 2 ? 0.9 : 0,
              transition: 'opacity 0.7s ease',
            }}
          />
        ))}
        {/* 방 전체: 밝게는 따뜻하게, 어둡게는 어둡게 */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 45% 40%, rgba(255,190,110,0.22), rgba(255,150,60,0.08) 60%, rgba(0,0,0,0) 100%)',
            mixBlendMode: 'screen',
            opacity: level === 2 ? 1 : 0,
            transition: 'opacity 0.7s ease',
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'rgb(6,3,2)', opacity: level === 0 ? 0.55 : 0, transition: 'opacity 0.7s ease' }}
        />
      </div>
    </div>
  );
}

export type ControlId = 'light' | 'burst' | 'hold' | 'engine' | 'flicker';

// 콘솔 윗단의 큰 구리 판(전신기 왼쪽, 계기판 사이의 평평한 곳)에 두 줄로 박는다. 배경 그림 좌표.
// 판이 비스듬히 눕혀져 있어 버튼도 위아래로 눌린 타원(원근)으로 그린다.
type Btn = { id: ControlId; label: string; x: number; y: number; rgb: string };
const BUTTONS: Btn[] = [
  { id: 'light', label: '조명', x: 494, y: 366, rgb: '205,191,152' },
  { id: 'burst', label: '증기 분출', x: 521, y: 366, rgb: '110,44,37' },
  { id: 'hold', label: '증기 유지', x: 548, y: 366, rgb: '63,95,78' },
  { id: 'engine', label: '기관 가속', x: 508, y: 391, rgb: '38,33,28' },
  { id: 'flicker', label: '전구 점멸', x: 535, y: 391, rgb: '138,106,44' },
];
// 판 위의 원은 화면에서 기울어진 타원이다: 판이 앞쪽으로 눕고 왼쪽 가장자리가 오른쪽 아래로 비스듬해 약간 전단(skew)되어 보인다
const PLANE = 'rotate(-4deg) skewX(24deg) scaleY(0.82)';

/** 'r,g,b' 문자열의 밝기를 f 배로 */
function shade(rgb: string, f: number) {
  return rgb.split(',').map((v) => Math.min(255, Math.round(+v * f))).join(',');
}

const LEVEL_TEXT = ['어둡게', '보통', '밝게'];

/** 같은 버튼을 '그림 층'과 '누르는 층' 두 곳에 나눠 그리므로, 호버·눌림 상태는 둘이 공유한다 */
type Upd = ControlId | null | ((h: ControlId | null) => ControlId | null);
const useCtl = create<{ hover: ControlId | null; down: ControlId | null; setHover: (u: Upd) => void; setDown: (u: Upd) => void }>((set) => ({
  hover: null,
  down: null,
  setHover: (u) => set((st) => ({ hover: typeof u === 'function' ? u(st.hover) : u })),
  setDown: (u) => set((st) => ({ down: typeof u === 'function' ? u(st.down) : u })),
}));

export default function RoomControls({
  level,
  hold,
  engine,
  flicker,
  onPull,
  confirm,
  mode = 'all',
}: {
  level: LightLevel;
  hold: boolean;
  engine: boolean;
  flicker: boolean;
  onPull: (id: ControlId) => void;
  /** 나이 확정 버튼: 왼쪽 상자 앞면(배경 그림 좌표)에 달린 큰 푸시 버튼 */
  confirm?: { onClick: () => void; disabled: boolean; ready: boolean };
  /** visual: 버튼 그림만(레버 아래, 눌리지 않음) / hit: 투명한 누르는 면과 승선 장치(레버 위) / all: 둘 다 */
  mode?: 'visual' | 'hit' | 'all';
}) {
  const m = useBgMap();
  const reduceMotion = useReducedMotion();
  const { hover, down, setHover, setDown } = useCtl();
  const [capDown, setCapDown] = useState(false); // 승선 버튼 돔이 눌린 상태

  const stateOn = (id: ControlId) => (id === 'hold' ? hold : id === 'engine' ? engine : id === 'flicker' ? flicker : id === 'light' ? level !== 1 : false);
  const stateText = (id: ControlId) =>
    id === 'light' ? LEVEL_TEXT[level] : id === 'burst' ? '누르면 뿜음' : stateOn(id) ? '켜짐' : '꺼짐';

  const d = Math.max(19, 19 * m.s); // 버튼 지름(px)
  const depth = Math.max(3, d * 0.16);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {confirm && mode !== 'visual' && (() => {
        // 승선 버튼: 황동 돔 스위치. 나이를 고르면 화면 아래 밖에서 위이잉 올라오고, 눌러서 다음으로 넘어간다
        const pw = Math.max(126, Math.round(180 * m.s)); // 장치 너비(px)
        const ph = Math.round(pw * 2.027); // 원본 비율 375:760
        const offY = Math.round(ph * 1.3) + 40; // 화면 아래 밖에서 출발
        return (
          <div
            className="pointer-events-none absolute"
            style={{ left: Math.max(m.toX(400), pw / 2 + 12), bottom: -Math.round(ph * 0.46), transform: 'translateX(-50%)', width: pw, height: ph }}
          >
            {/* 장치는 화면 아래 밖에서 올라온다 (오버레이가 화면 밖을 잘라 주므로 따로 가리지 않는다) */}
            <div className="absolute inset-0">
              <motion.div
                className="absolute inset-0"
                initial={false}
                animate={
                  reduceMotion
                    ? { y: confirm.ready ? 0 : offY, opacity: confirm.ready ? 1 : 0 }
                    : confirm.ready
                      ? { y: [offY, ph * 0.5, ph * 0.5, -ph * 0.03, 0], x: [0, -1, 1, 0, 0, -1, 1, -0.6, 0], opacity: 1 }
                      : { y: offY, x: 0, opacity: 1 }
                }
                transition={
                  reduceMotion
                    ? { duration: 0.2 }
                    : confirm.ready
                      ? { y: { duration: 3.6, times: [0, 0.3, 0.48, 0.92, 1], ease: ['easeOut', 'linear', 'easeInOut', 'easeOut'] }, x: { duration: 3.6, times: [0, 0.1, 0.2, 0.3, 0.48, 0.6, 0.75, 0.9, 1], ease: 'linear' } }
                      : { duration: 0 }
                }
                style={{ pointerEvents: confirm.ready ? 'auto' : 'none' }}
                aria-hidden={!confirm.ready}
              >
                {/* 아래에서 쏘는 붉은 빛: 주변 바닥과 상자에 번지는 빛 (장치 뒤) */}
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full"
                  style={{ bottom: '6%', width: '260%', height: '60%', background: 'radial-gradient(ellipse at 50% 100%, rgba(255,50,40,0.95) 0%, rgba(235,30,30,0.5) 40%, rgba(200,20,20,0) 72%)', mixBlendMode: 'screen', filter: 'blur(6px)' }}
                  initial={false}
                  animate={confirm.ready && !reduceMotion ? { opacity: [0, 1, 0.65, 0.95, 0.65] } : { opacity: confirm.ready ? 0.85 : 0 }}
                  transition={confirm.ready && !reduceMotion ? { delay: 3.2, duration: 3, times: [0, 0.15, 0.5, 0.75, 1], repeat: Infinity, repeatType: 'loop' } : { duration: 0.2 }}
                />
                {/* 장치 표면에 닿는 붉은 빛: 장치 모양대로만 칠해, 아래쪽일수록 세게 올려 비춘다 */}
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, rgba(255,55,40,0.95) 0%, rgba(255,55,40,0.7) 30%, rgba(255,55,40,0.25) 60%, rgba(255,55,40,0) 88%)',
                    WebkitMaskImage: 'url(/ui/age_confirm_pedestal.webp)',
                    maskImage: 'url(/ui/age_confirm_pedestal.webp)',
                    WebkitMaskSize: '100% 100%',
                    maskSize: '100% 100%',
                    mixBlendMode: 'screen',
                    zIndex: 1,
                  }}
                  initial={false}
                  animate={confirm.ready && !reduceMotion ? { opacity: [0, 1, 0.7, 0.95, 0.7] } : { opacity: confirm.ready ? 0.85 : 0 }}
                  transition={confirm.ready && !reduceMotion ? { delay: 3.2, duration: 3, times: [0, 0.15, 0.5, 0.75, 1], repeat: Infinity, repeatType: 'loop' } : { duration: 0.2 }}
                />
                <button
                  type="button"
                  onClick={confirm.onClick}
                  disabled={confirm.disabled}
                  onPointerDown={() => setCapDown(true)}
                  onPointerUp={() => setCapDown(false)}
                  onPointerLeave={() => setCapDown(false)}
                  onPointerCancel={() => setCapDown(false)}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setCapDown(true); }}
                  onKeyUp={() => setCapDown(false)}
                  aria-label="이 나이로 승선"
                  title={confirm.disabled ? '먼저 레버를 돌려 나이를 골라 주세요' : '눌러서 승선'}
                  className="group relative block h-full w-full cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:drop-shadow-[0_0_6px_rgba(255,214,140,0.9)]"
                  style={{ transformOrigin: '50% 100%' }}
                >
                  {/* 돔 층: 몸통 아래에 깔려 있어, 누르면 돔만 몸통 속으로 들어간다 */}
                  <img
                    src="/ui/age_confirm_pedestal.webp"
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 block h-full w-full select-none group-hover:brightness-110"
                    style={{
                      clipPath: 'inset(0 0 88% 0)',
                      transform: capDown ? `translateY(${Math.round(ph * 0.03)}px)` : 'translateY(0)',
                      transition: capDown ? 'transform 70ms ease-out' : 'transform 160ms cubic-bezier(.2,1.6,.4,1)',
                    }}
                  />
                  {/* 몸통 층: 눌러도 움직이지 않는다 */}
                  <img
                    src="/ui/age_confirm_pedestal.webp"
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 block h-full w-full select-none group-hover:brightness-110"
                    style={{ clipPath: 'inset(6.8% 0 0 0)', filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.65))' }}
                  />
                </button>
              </motion.div>
            </div>
          </div>
        );
      })()}
      {BUTTONS.map((b) => {
        const on = stateOn(b.id);
        const pressed = down === b.id;
        const lit = on || (b.id === 'light' && level === 2);
        const lamp = lit || (b.id === 'burst' && pressed);
        const cx = m.toX(b.x);
        const cy = m.toY(b.y);
        return (
          <div key={b.id} style={{ opacity: mode === 'hit' ? 0 : 1 }}>
            <button
              type="button"
              aria-label={`${b.label} 버튼 (${stateText(b.id)})`}
              aria-pressed={b.id === 'burst' ? undefined : on}
              className={`${mode === 'visual' ? 'pointer-events-none' : 'pointer-events-auto'} absolute cursor-pointer touch-manipulation select-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bright-brass`}
              tabIndex={mode === 'visual' ? -1 : undefined}
              aria-hidden={mode === 'visual' ? true : undefined}
              style={{ left: cx - d / 2 - 4, top: cy - d / 2 - 4, width: d + 8, height: d + 8, borderRadius: '50%', WebkitTapHighlightColor: 'transparent', background: 'transparent' }}
              onPointerEnter={() => setHover(b.id)}
              onPointerLeave={() => { setHover((h) => (h === b.id ? null : h)); setDown((x) => (x === b.id ? null : x)); }}
              onPointerDown={() => setDown(b.id)}
              onPointerUp={() => setTimeout(() => setDown((x) => (x === b.id ? null : x)), 90)}
              onFocus={() => setHover(b.id)}
              onBlur={() => setHover((h) => (h === b.id ? null : h))}
              onClick={() => onPull(b.id)}
            >
              {/* 접촉 그림자: 버튼이 판 위에 박혀 있는 것처럼 보이게 한다 */}
              <span
                aria-hidden
                className="absolute rounded-full"
                style={{ left: '16%', right: '-14%', bottom: -2, height: '34%', transform: PLANE, background: 'rgba(0,0,0,0.5)', filter: 'blur(2.5px)' }}
              />
              {/* 낡은 황동 테두리: 광택 없이 눌린 듯 어두운 금속 */}
              <span
                aria-hidden
                className="absolute rounded-full"
                style={{
                  inset: 3.5,
                  transform: PLANE,
                  background: 'radial-gradient(circle at 34% 28%, #a98c52 0%, #75592c 52%, #33240f 100%)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(0,0,0,0.6), inset 0 1px 1px rgba(240,215,160,0.22)',
                  filter: 'saturate(0.7)',
                }}
              />
              <span aria-hidden className="absolute rounded-full" style={{ inset: 4.5, transform: PLANE, background: 'rgb(10,6,3)' }} />
              {/* 누르는 면: 무광 베이클라이트 캡. 누르면 테두리 안으로 내려앉는다 */}
              <span
                aria-hidden
                className="absolute rounded-full"
                style={{
                  inset: 4.5,
                  transform: `translateY(${pressed ? 0 : -depth * 0.8}px) scale(${pressed ? 0.97 : 1}) ${PLANE}`,
                  transition: 'transform 0.13s cubic-bezier(.3,1.5,.5,1), filter 0.2s',
                  background: `radial-gradient(circle at 36% 30%, rgb(${shade(b.rgb, 1.28)}) 0%, rgb(${b.rgb}) 58%, rgb(${shade(b.rgb, 0.62)}) 100%)`,
                  boxShadow: pressed
                    ? 'inset 0 -1px 2px rgba(0,0,0,0.55)'
                    : `0 ${depth * 0.8}px ${depth}px rgba(0,0,0,0.6), inset 0 -1px 2px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,240,215,0.12)`,
                  filter: hover === b.id ? 'brightness(1.12)' : 'none',
                }}
              />
              {/* 상태 표시등: 켜 둔 기능만 작은 호박색 램프가 들어온다 */}
              <span
                aria-hidden
                className="absolute rounded-full"
                style={{
                  left: '50%',
                  top: -6,
                  width: 5,
                  height: 5,
                  marginLeft: -2.5,
                  background: lamp ? '#ffb347' : '#2a1d0e',
                  border: '1px solid #4a3414',
                  boxShadow: lamp ? '0 0 6px 2px rgba(255,160,50,0.75)' : 'inset 0 0 1px rgba(0,0,0,0.9)',
                  transition: 'background 0.2s, box-shadow 0.2s',
                }}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
