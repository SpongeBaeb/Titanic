'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';

export interface WheelItem {
  id: string;
  name: string;
  img: string;
}

interface Props {
  items: WheelItem[];
  index: number;
  onIndex: (i: number) => void;
  hoveredId: string | null;
  activeEffect: string | null;
  /** 지폐를 놓을 수 있는 자리(가운데 시설)만 등록한다 */
  setRef: (id: string, el: HTMLDivElement | null) => void;
  disabled?: boolean;
  /** 가운데 칸 위에 겹쳐 그릴 것 (기념품 아이템 등) */
  children?: ReactNode;
}

const BASE = 280; // 가운데 시설 그림의 한 변(px)
const OFFSET = [0, 195, 300]; // |d|별 세로 이동(px)
const SCALE = [1, 0.6, 0.38];
const OPACITY = [1, 0.62, 0.22];
const WHEEL_COOLDOWN = 380;

/**
 * 회전식 보관 선반: 시설이 세로로 돌아가고, 가운데 하나만 크게 보인다.
 * 가운데 시설에만 지폐를 놓을 수 있다. 휠, 화살표 키, 위아래 버튼, 옆 시설 클릭으로 돌린다.
 */
export default function FacilityWheel({ items, index, onIndex, hoveredId, activeEffect, setRef, disabled, children }: Props) {
  const n = items.length;
  const box = useRef<HTMLDivElement>(null);
  const lastWheel = useRef(0);
  const prevD = useRef<Record<string, number>>({});
  // 드래그로 돌리기: 손가락/마우스를 따라 움직이다가 놓으면 가까운 칸으로 맞춘다
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ startY: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button > 0) return;
    // 기념품 같은 상호작용 요소를 쥐고 있을 때는 선반이 따라 돌지 않는다
    if ((e.target as HTMLElement).closest?.('[data-no-wheel]')) return;
    drag.current = { startY: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) > 6) {
      d.moved = true;
      // 끌기 시작한 뒤에만 포인터를 붙잡는다(그 전에는 이웃 시설 클릭이 정상 동작해야 한다)
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (d.moved) setDragY(dy);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (d.moved) {
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 0);
      const steps = Math.max(-2, Math.min(2, Math.round(-(e.clientY - d.startY) / OFFSET[1])));
      setDragY(0);
      if (steps !== 0) onIndex((((index + steps) % n) + n) % n);
    }
  };

  const step = (dir: number) => onIndex(((index + dir) % n + n) % n);

  // 최신 index를 쓰는 이벤트 리스너
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (disabled || Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheel.current < WHEEL_COOLDOWN) return;
      lastWheel.current = now;
      stepRef.current(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); stepRef.current(-1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); stepRef.current(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled]);

  const nextD: Record<string, number> = {};
  // 다음 렌더에서 한 바퀴 넘어가는(맨 위에서 맨 아래로 건너뛰는) 항목을 알아내기 위해 기억한다
  useEffect(() => {
    prevD.current = nextD;
  });

  return (
    <div className="pointer-events-auto flex shrink-0 flex-col items-center" style={{ width: 360 }} aria-roledescription="회전 선반">
      <div
        ref={box}
        className="relative cursor-grab touch-none active:cursor-grabbing"
        style={{ width: BASE + 40, height: 540 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* 돌아가는 시설들: 위아래 끝은 흐려진다 */}
        <div
          className="absolute inset-0"
          style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 14%, #000 86%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0, #000 14%, #000 86%, transparent 100%)' }}
        >
          {items.map((it, i) => {
            const d = ((i - index + n + 3) % n) - 3; // -3..3
            nextD[it.id] = d;
            const a = Math.abs(d);
            const visible = a <= 2;
            const wrapped = prevD.current[it.id] !== undefined && Math.abs(d - prevD.current[it.id]) > 3;
            const isFront = d === 0;
            const hovered = hoveredId === it.id;
            const y = Math.sign(d) * (OFFSET[Math.min(a, 2)] ?? 300);
            return (
              <div
                key={it.id}
                ref={isFront ? (el) => setRef(it.id, el) : (el) => setRef(it.id, null)}
                onClick={() => { if (!isFront && visible && !disabled && !justDragged.current) onIndex(i); }}
                role={isFront ? undefined : 'button'}
                aria-label={isFront ? undefined : `${it.name} 시설로 돌리기`}
                className={`absolute left-1/2 top-1/2 flex select-none flex-col items-center ${isFront ? '' : 'cursor-pointer'}`}
                style={{
                  width: BASE,
                  transform: `translate(-50%, calc(-50% + ${y + dragY * 0.9}px)) scale(${visible ? SCALE[a] : 0.3})`,
                  opacity: visible ? OPACITY[a] : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                  zIndex: 10 - a,
                  transition: wrapped || dragY !== 0 ? 'none' : 'transform .5s cubic-bezier(.3,.8,.3,1), opacity .5s',
                  filter: isFront ? undefined : 'saturate(.7)',
                }}
              >
                <div className="relative w-full" style={{ height: BASE }}>
                  {/* 시설 아래 받침대: 시설 모형과 같은 등각 시점(facility_plinth.webp). 모형의 바닥 마름모가 받침대 윗면에 놓인다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/spend/facility_plinth.webp"
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="pointer-events-none absolute z-[5] max-w-none select-none transition-[filter] duration-300"
                    style={{
                      width: '93.6%', left: '3.2%', top: '46.8%',
                      filter: hovered ? 'brightness(1.35) saturate(1.1) drop-shadow(0 0 18px rgba(255,214,120,0.75))' : 'drop-shadow(0 10px 12px rgba(0,0,0,0.6))',
                    }}
                  />
                  <motion.img
                    src={it.img}
                    alt={it.name}
                    draggable={false}
                    className="pointer-events-none relative z-10 h-full w-full object-contain drop-shadow-xl"
                    animate={isFront && activeEffect === it.id && it.id === 'souvenir'
                      ? { scale: [1, 1.15, 0.92, 1.08, 1], rotate: [0, -8, 8, -8, 0] }
                      : {}}
                    transition={{ duration: 0.5 }}
                  />
                  {/* 이름표: 받침대 왼쪽 옆면에 붙은 놋쇠 명판. 옆면의 기울기(등각 약 29도)에 맞춰 비스듬히 붙이고, 면의 한가운데에 맞춘다 */}
                  <div
                    className={`pointer-events-none absolute z-20 whitespace-nowrap px-3 py-0.5 font-display text-[13px] font-semibold tracking-[0.1em] transition-colors duration-300 ${hovered ? 'text-ocean-black' : 'text-bright-brass'}`}
                    style={{
                      left: '26.8%', top: '92.5%', // 왼쪽 옆면의 한가운데(받침대 아랫 꼭짓점에서 왼쪽으로 면 너비의 절반)
                      transform: 'translate(-50%, -50%) skewY(29deg)',
                      borderStyle: 'solid',
                      borderWidth: 8,
                      borderImage: "url('/ui/ui_nameplate.webp') 64 / 8px stretch",
                      backgroundImage: hovered ? 'linear-gradient(180deg,#e1c88e,#b08e52)' : 'linear-gradient(180deg,#0e1f29,#07111a)',
                      backgroundClip: 'padding-box',
                    }}
                  >
                    {it.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 가운데 칸 위에 겹치는 것들 */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: BASE, height: BASE }}>
          {children}
        </div>

        {/* 위아래 버튼 */}
        {(['up', 'down'] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            disabled={disabled}
            onClick={() => step(dir === 'up' ? -1 : 1)}
            aria-label={dir === 'up' ? '이전 시설' : '다음 시설'}
            className={`absolute right-0 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-brass bg-[#07111a]/90 text-bright-brass transition-colors hover:bg-bright-brass hover:text-ocean-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bright-brass disabled:opacity-40 ${dir === 'up' ? 'top-[18%]' : 'bottom-[18%]'}`}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {dir === 'up' ? <path d="M4 13 L10 7 L16 13" /> : <path d="M4 7 L10 13 L16 7" />}
            </svg>
          </button>
        ))}
      </div>

      <div className="mt-1 flex gap-1.5" aria-hidden>
        {items.map((it, i) => (
          <span key={it.id} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-5 bg-bright-brass' : 'w-1.5 bg-white/30'}`} />
        ))}
      </div>
    </div>
  );
}
