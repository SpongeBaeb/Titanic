'use client';

/**
 * 스산한 밤안개: 크고 흐린 덩어리 몇 장이 서로 다른 속도로 옆으로 흘러가고, 숨 쉬듯 짙어졌다 옅어진다.
 * 그림 없이 CSS 로만 그린다. 바다 바로 위(구명정 뒤)와, 맨 앞에 아주 옅게 한 번 더 깔 수 있다.
 * top/h 는 부모 높이에 대한 %, dx 는 좌우로 흐르는 거리(%)다.
 */
interface Layer { top: number; h: number; left: number; w: number; dx: number; dur: number; delay: number; op: number; tint: string }

const BACK: Layer[] = [
  { top: 8, h: 34, left: -20, w: 90, dx: 28, dur: 38, delay: 0, op: 0.5, tint: '150,172,200' },
  { top: 30, h: 40, left: 30, w: 100, dx: -34, dur: 52, delay: -12, op: 0.42, tint: '130,150,178' },
  { top: 52, h: 36, left: -10, w: 80, dx: 22, dur: 44, delay: -20, op: 0.38, tint: '160,180,205' },
  { top: 64, h: 30, left: 20, w: 90, dx: -26, dur: 60, delay: -30, op: 0.3, tint: '120,140,168' },
];
const FRONT: Layer[] = [
  { top: 44, h: 46, left: -30, w: 110, dx: 36, dur: 70, delay: -8, op: 0.2, tint: '150,170,198' },
  { top: 70, h: 36, left: 10, w: 100, dx: -30, dur: 56, delay: -26, op: 0.16, tint: '140,160,190' },
];

export default function Mist({ front = false, className = '' }: { front?: boolean; className?: string }) {
  const layers = front ? FRONT : BACK;
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <style>{`
        @keyframes q7MistDrift { from { transform: translateX(calc(var(--dx) * -1%)) scaleX(.92); opacity: calc(var(--op) * .55); } 50% { opacity: var(--op); } to { transform: translateX(calc(var(--dx) * 1%)) scaleX(1.12); opacity: calc(var(--op) * .6); } }
        @media (prefers-reduced-motion: reduce) { .q7-mist { animation: none !important; } }
      `}</style>
      {layers.map((l, i) => (
        <div
          key={i}
          className="q7-mist absolute"
          style={{
            top: `${l.top}%`, height: `${l.h}%`, left: `${l.left}%`, width: `${l.w}%`,
            background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(${l.tint},.55) 0%, rgba(${l.tint},.22) 45%, rgba(${l.tint},0) 72%)`,
            filter: 'blur(14px)', mixBlendMode: 'screen', willChange: 'transform, opacity',
            animation: `q7MistDrift ${l.dur}s ease-in-out ${l.delay}s infinite alternate`,
            ['--dx' as string]: l.dx, ['--op' as string]: l.op,
          }}
        />
      ))}
    </div>
  );
}
