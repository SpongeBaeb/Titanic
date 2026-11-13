'use client';

import type { ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * 배경 사진 속에 구명정이 있는 장면에서 화면이 물결에 흔들리듯 천천히 흔들린다.
 * 사진마다 흔들림(각도, 위아래 폭, 한 번 오가는 시간)을 적어 둔다. 사진이 바뀌어도 감싸는 요소는 그대로라서 장면 전환이 끊기지 않는다.
 * 모션 줄이기 설정이면 흔들리지 않는다.
 */
const BG_SWAY: Record<string, { deg: number; dy: number; s: number }> = {
  // B1 은 바다와 배를 따로 그린 두 겹 배경(BoatSeaBg)이라 배만 흔들린다. 여기에는 두지 않는다
  // W3: 물에 떠 있는 시점. 멀리 다가오는 구명정이 파도에 오르내리는 것처럼 느리고 작게
  '/bg/w3_live.webp': { deg: 0.7, dy: 5, s: 6.8 },
};

const CSS = `
@keyframes bgSway {
  0% { transform: rotate(calc(var(--deg) * -1)) translateY(calc(var(--dy) * -1)) scale(1.08); }
  50% { transform: rotate(var(--deg)) translateY(var(--dy)) scale(1.08); }
  100% { transform: rotate(calc(var(--deg) * -1)) translateY(calc(var(--dy) * -1)) scale(1.08); }
}
`;

export default function BgSway({ url, children }: { url: string | null; children: ReactNode }) {
  const reduce = useReducedMotion();
  const sway = url ? BG_SWAY[url] : undefined;
  const on = !!sway && !reduce;
  return (
    <div
      className="absolute inset-0"
      style={on ? ({ '--deg': `${sway!.deg}deg`, '--dy': `${sway!.dy}px`, animation: `bgSway ${sway!.s}s ease-in-out infinite` } as React.CSSProperties) : undefined}
    >
      <style>{CSS}</style>
      {children}
    </div>
  );
}
