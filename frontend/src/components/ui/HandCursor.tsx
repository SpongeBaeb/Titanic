'use client';

import { useEffect, useRef } from 'react';
import { useAnimationFrame } from 'framer-motion';
import { useQuizStore } from '@/store/quizStore';

/**
 * 마우스 대신 보이는 양손(내 눈으로 내려다본 손등). 누르면(grab) 두 손이 모이며 주먹을 쥔다.
 * 그림은 public/ui/hand_{open,grab}_{r,f}.webp (r 은 남성, f 는 여성). 손등이 보이고 엄지가 오른쪽이라 실제로는 '왼손'이다(팔이 왼쪽 아래에서 올라온다). 그래서 왼손은 그대로, 오른손을 뒤집어 쓴다. 같은 시트의 reach, lift 도 있다(hands_sheet.webp).
 * 웹캠 손동작 인식 단계에서는 x, y 를 각 손의 위치로 따로 받는다.
 */
/** 손 그림 세트: 남성(m)과 여성(f). 크기는 그림 원본 폭·높이에 배율을 곱한다. 여성의 손은 조금 작게 쓴다 */
const SETS = {
  m: { open: { src: '/ui/hand_open_r.webp', w: 377 * 0.27, h: 475 * 0.27 }, grab: { src: '/ui/hand_grab_r.webp', w: 484 * 0.27, h: 430 * 0.27 } },
  f: { open: { src: '/ui/hand_open_f.webp', w: 439 * 0.24, h: 485 * 0.24 }, grab: { src: '/ui/hand_grab_f.webp', w: 483 * 0.24, h: 427 * 0.24 } },
} as const;
type HandSet = (typeof SETS)['m'] | (typeof SETS)['f'];

/* eslint-disable @next/next/no-img-element */
/** 잘린 손목이 보이지 않게, 팔이 들어오는 아래(왼쪽 아래)쪽을 어둠 속으로 지운다 */
const FADE_OPEN = 'linear-gradient(to top, transparent 0%, #000 24%)';
const FADE_GRAB = 'linear-gradient(to top right, transparent 10%, #000 46%)';

function Hand({ grab, flip, set }: { grab: boolean; flip: boolean; set: HandSet }) {
  const sz = grab ? set.grab : set.open;
  const fade = grab ? FADE_GRAB : FADE_OPEN;
  return (
    <img
      src={sz.src}
      alt=""
      draggable={false}
      width={sz.w}
      height={sz.h}
      style={{ width: sz.w, height: sz.h, maxWidth: 'none', transform: flip ? 'scaleX(-1)' : undefined, WebkitMaskImage: fade, maskImage: fade, filter: 'drop-shadow(0 5px 6px rgba(0,0,0,.6)) brightness(1.08)' }}
    />
  );
}

/**
 * 두 손은 각자 따로 움직인다: 포인터를 곧바로 따라붙지 않고 손마다 다른 속도로 늦게 따라오며(왼손이 조금 빠르고 오른손이 조금 느리다),
 * 가만히 있어도 미세하게 떨린다(서로 다른 주기의 작은 흔들림을 겹친다). 쥐고 있는 동안에는 떨림이 조금 커진다.
 * 위치는 매 프레임 직접 계산해 DOM 에 쓴다(렌더 없음).
 */
const HANDS = [
  { flip: false, follow: 0.2, lagMs: 0, tremor: { fx: 7.3, fy: 5.1, px: 0.3, py: 1.7 } },
  { flip: true, follow: 0.11, lagMs: 50, tremor: { fx: 6.1, fy: 8.3, px: 2.2, py: 0.4 } },
] as const;

/** 밧줄을 쥔 주먹 그림(ui/hand_rope_{m,f}.webp): 손등 시점, 손목이 위, 엄지가 왼쪽 아래인 오른손. 세로 밧줄을 쥘 때는 약 108도 돌려 마디가 줄과 나란히 서게 쓰고, 왼손은 좌우를 뒤집어 반대로 돌려 쓴다 */
const ROPE_FIST = { w: 70, h: 87 };
const ROPE_TURN = 108; // 오른손 그림(손목이 위)을 시계 방향으로 돌린 각도. 왼손은 반대쪽
const ROPE_SHIFT = 13; // 팔 쪽으로 비켜 놓는 거리(px)
const FADE_ROPE = 'linear-gradient(to bottom, transparent 0%, #000 28%)';
export interface RopeHands { left: { x: number; y: number }; right: { x: number; y: number } }

function RopeFist({ at, flip, female }: { at: { x: number; y: number }; flip: boolean; female: boolean }) {
  return (
    <img
      src={female ? '/ui/hand_rope_f.webp' : '/ui/hand_rope_m.webp'}
      alt=""
      draggable={false}
      width={ROPE_FIST.w}
      height={ROPE_FIST.h}
      className="absolute"
      style={{
        left: 0, top: 0, width: ROPE_FIST.w, height: ROPE_FIST.h, maxWidth: 'none', willChange: 'transform',
        // 세로 밧줄을 쥔 주먹: 마디가 줄과 나란히 세로로 서고, 팔은 아래 옆에서 올라온다. 주먹은 줄이 마디 아래로 지나가도록 팔 반대쪽으로 조금 비켜 놓는다
        transform: `translate(${(at.x + (flip ? -ROPE_SHIFT : ROPE_SHIFT) - ROPE_FIST.w / 2).toFixed(1)}px, ${(at.y - ROPE_FIST.h * 0.5).toFixed(1)}px) rotate(${flip ? -ROPE_TURN : ROPE_TURN}deg) scale(${flip ? -1 : 1}, 1)`,
        WebkitMaskImage: FADE_ROPE, maskImage: FADE_ROPE, filter: 'drop-shadow(0 5px 6px rgba(0,0,0,.65)) brightness(1.05)',
      }}
    />
  );
}

export default function HandCursor({ x, y, grab, rope = null, visible = true }: { x: number; y: number; grab: boolean; rope?: RopeHands | null; visible?: boolean }) {
  const female = useQuizStore((st) => st.answers.sex === 'female');
  const set: HandSet = female ? SETS.f : SETS.m;
  const refs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const live = useRef({ x, y, grab, set, pos: [{ x, y, init: false }, { x, y, init: false }], k: 0 });
  useEffect(() => { live.current.x = x; live.current.y = y; live.current.grab = grab; live.current.set = set; });

  useAnimationFrame((t) => {
    const st = live.current;
    const s = t / 1000;
    // 쥐는 정도(0~1)를 부드럽게 따라가 손이 모이고 내려가는 것도 한 번에 바뀌지 않게 한다
    st.k += ((st.grab ? 1 : 0) - st.k) * 0.25;
    const open = st.set.open;
    const gr = st.set.grab;
    const w = open.w + (gr.w - open.w) * st.k;
    const gap = 62 + 6 * st.k;
    const dy = 8 * st.k;
    HANDS.forEach((h, i) => {
      const el = refs.current[i];
      if (!el) return;
      const p = st.pos[i];
      const tx = st.x + (h.flip ? gap : -gap) - w / 2;
      const ty = st.y - 30 + dy;
      if (!p.init) { p.x = tx; p.y = ty; p.init = true; }
      p.x += (tx - p.x) * h.follow;
      p.y += (ty - p.y) * h.follow;
      const amp = 1 + 0.9 * st.k;
      const nx = (Math.sin(s * h.tremor.fx + h.tremor.px) + 0.5 * Math.sin(s * h.tremor.fx * 2.3)) * 0.8 * amp;
      const ny = (Math.sin(s * h.tremor.fy + h.tremor.py) + 0.5 * Math.sin(s * h.tremor.fy * 2.1)) * 0.8 * amp;
      const rot = (h.flip ? 2 : -2) * (1 - st.k) + (h.flip ? -4 : 4) * st.k + nx * 0.5;
      el.style.transform = `translate(${(p.x + nx).toFixed(2)}px, ${(p.y + ny).toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`;
    });
  });

  if (!visible) return null;
  if (rope) {
    // 밧줄을 쥐고 당기는 동안: 쥔 주먹 두 개가 밧줄을 훑는다 (왼손은 그림을 뒤집어 쓴다)
    return (
      <div aria-hidden className="pointer-events-none fixed left-0 top-0 z-[9990]">
        <RopeFist at={rope.left} flip female={female} />
        <RopeFist at={rope.right} flip={false} female={female} />
      </div>
    );
  }
  return (
    <div aria-hidden className="pointer-events-none fixed left-0 top-0 z-[9990]">
      {HANDS.map((h, i) => (
        <div key={i} ref={(el) => { refs.current[i] = el; }} className="absolute" style={{ left: 0, top: 0, willChange: 'transform' }}>
          <Hand grab={grab} flip={h.flip} set={set} />
        </div>
      ))}
    </div>
  );
}
