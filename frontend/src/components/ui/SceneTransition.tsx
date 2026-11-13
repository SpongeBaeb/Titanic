'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * 장면 사이의 로딩 화면: 놋쇠 둥근 창(포트홀)이 조리개처럼 닫히며 앞 장면을 덮고,
 * 어둠 속 둥근 창 안에서 작은 배가 물결을 건너는 동안 다음 장면을 불러온 뒤, 다시 열리며 새 장면을 보여 준다.
 * 덮개는 완전히 불투명해서 장면이 바뀌는 순간의 빈 배경이 보이지 않는다.
 */

export interface TransitionInfo {
  /** 장 이름 (탑승, 항해, 그날 밤, 기록) */
  chapter: string;
  /** 날짜와 장소 한 줄 */
  when: string;
  /** 0~1: 항해 진행 (점선 항로 위 배의 위치) */
  progress: number;
}

const INK = '#05070d';

/** 둥근 창 안의 그림: 별, 물결, 건너가는 배 */
function Porthole({ size = 168 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="st-glass" cx="50%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#1b2a4a" />
            <stop offset="70%" stopColor="#0a1226" />
            <stop offset="100%" stopColor="#050811" />
          </radialGradient>
          <linearGradient id="st-brass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7e2a4" />
            <stop offset="35%" stopColor="#b9862f" />
            <stop offset="60%" stopColor="#ffe9b0" />
            <stop offset="100%" stopColor="#6e4a14" />
          </linearGradient>
          <clipPath id="st-clip"><circle cx="100" cy="100" r="78" /></clipPath>
        </defs>
        <circle cx="100" cy="100" r="78" fill="url(#st-glass)" />
        <g clipPath="url(#st-clip)">
          {/* 별 */}
          {[[46, 52, 1.2], [70, 38, 0.9], [118, 44, 1.4], [150, 66, 1], [92, 62, 0.8], [136, 30, 0.9], [58, 80, 0.7], [164, 92, 0.8]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#e8eeff" className="st-twinkle" style={{ animationDelay: `${i * 0.37}s` }} />
          ))}
          {/* 배: 물결 위를 왼쪽에서 오른쪽으로 건넌다 */}
          <g className="st-ship">
            <g className="st-bob">
              <path d="M-26 118 L22 118 L16 128 L-20 128 Z" fill="#0c0f16" stroke="#d9b066" strokeWidth="0.8" />
              <rect x="-18" y="110" width="34" height="8" fill="#10141d" stroke="#d9b066" strokeWidth="0.6" />
              {[-12, -3, 6, 15].map((x) => <rect key={x} x={x - 2} y="99" width="4" height="11" fill="#c7963c" />)}
              {[-14, -8, -2, 4, 10].map((x) => <circle key={x} cx={x} cy="114" r="0.9" fill="#ffd27a" />)}
            </g>
          </g>
          {/* 물결 (두 겹이 서로 반대로 흐른다) */}
          <path className="st-wave1" d="M-40 130 Q-25 124 -10 130 T20 130 T50 130 T80 130 T110 130 T140 130 T170 130 T200 130 T230 130 T260 130 V200 H-40 Z" fill="#0d2238" />
          <path className="st-wave2" d="M-40 138 Q-25 133 -10 138 T20 138 T50 138 T80 138 T110 138 T140 138 T170 138 T200 138 T230 138 T260 138 V200 H-40 Z" fill="#081627" opacity="0.95" />
        </g>
        {/* 놋쇠 테와 볼트 */}
        <circle cx="100" cy="100" r="84" fill="none" stroke="url(#st-brass)" strokeWidth="12" />
        <circle cx="100" cy="100" r="78" fill="none" stroke="#3a2608" strokeWidth="1.5" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <circle key={i} cx={100 + Math.cos(a) * 84} cy={100 + Math.sin(a) * 84} r="3" fill="#f3d48a" stroke="#5a3a0e" strokeWidth="0.8" />;
        })}
        {/* 유리의 반사광 */}
        <path d="M52 64 A60 60 0 0 1 104 34" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** 로딩 내용 (처음 들어올 때의 로딩 화면에서도 쓴다) */
export function TransitionCard({ info }: { info: TransitionInfo }) {
  return (
    <div className="flex flex-col items-center text-center">
      <style>{`
        @keyframes stShip { from { transform: translateX(10px) } to { transform: translateX(190px) } }
        @keyframes stBob { 0%,100% { transform: translateY(0) rotate(-1.2deg) } 50% { transform: translateY(2px) rotate(1.2deg) } }
        @keyframes stWave1 { from { transform: translateX(0) } to { transform: translateX(-60px) } }
        @keyframes stWave2 { from { transform: translateX(-60px) } to { transform: translateX(0) } }
        @keyframes stTwinkle { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
        .st-ship { animation: stShip 3.6s linear infinite; }
        .st-bob { animation: stBob 1.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .st-wave1 { animation: stWave1 2.2s linear infinite; }
        .st-wave2 { animation: stWave2 3.1s linear infinite; }
        .st-twinkle { animation: stTwinkle 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .st-ship, .st-bob, .st-wave1, .st-wave2, .st-twinkle { animation: none } }
      `}</style>
      <Porthole />
      <div className="mt-6 font-serif text-xs font-bold tracking-[0.5em] text-amber-300/80">{info.chapter}</div>
      <div className="mt-2 font-serif text-lg text-amber-50/90 md:text-xl">{info.when}</div>
      {/* 항로: 점선 위의 작은 배가 지금까지 온 만큼 나아가 있다 */}
      <div className="relative mt-6 h-4 w-56">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2" style={{ background: 'repeating-linear-gradient(90deg, rgba(232,196,119,0.55) 0 6px, transparent 6px 12px)' }} />
        <div className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-amber-300" style={{ width: `${info.progress * 100}%` }} />
        <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200 shadow-[0_0_10px_rgba(255,210,120,0.9)]" style={{ left: `${info.progress * 100}%` }} />
        <div className="absolute -left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-amber-300/70" />
        <div className="absolute -right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-amber-300/70" />
      </div>
      <div className="mt-2 flex w-56 justify-between text-[10px] tracking-widest text-amber-200/45"><span>SOUTHAMPTON</span><span>NEW YORK</span></div>
    </div>
  );
}

/** 조리개처럼 닫히고 열리는 덮개 */
export default function SceneTransition({ info }: { info: TransitionInfo | null }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {info && (
        <motion.div key="scene-transition" className="pointer-events-auto fixed inset-0 z-[9999] overflow-hidden" aria-live="polite" aria-label="다음 장면을 불러오는 중">
          {reduce ? (
            <motion.div className="absolute inset-0" style={{ background: INK }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} />
          ) : (
            // 둥근 구멍 바깥을 거대한 그림자로 칠해, 구멍이 작아지면 화면이 어둠에 덮인다. 구멍의 테는 놋쇠 빛
            <motion.div
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{ x: '-50%', y: '-50%', boxShadow: `0 0 0 250vmax ${INK}`, border: '4px solid rgba(214,168,84,0.85)' }}
              initial={{ width: '260vmax', height: '260vmax' }}
              animate={{ width: '0vmax', height: '0vmax', borderWidth: 0 }}
              exit={{ width: '260vmax', height: '260vmax', borderWidth: 4, transition: { duration: 0.6, ease: [0.2, 0.7, 0.2, 1] } }}
              transition={{ duration: 0.42, ease: [0.7, 0, 0.84, 0] }}
            />
          )}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: reduce ? 0 : 0.3, duration: 0.3 } }}
            exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.2 } }}
          >
            <TransitionCard info={info} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
