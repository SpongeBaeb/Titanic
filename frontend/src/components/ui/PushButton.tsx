'use client';

import { motion } from 'framer-motion';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * 쫀득하게 눌리는 입체 버튼.
 * 위에 떠 있는 면(front)과 아래에 깔린 어두운 받침(back)으로 두께를 만들고,
 * 누르면 면이 받침까지 내려앉으며 살짝 납작해졌다가, 떼면 스프링으로 한 번 튀어 오른다.
 * (uiverse.io 의 3D 푸시 버튼 구조를 이 게임의 황동판 모양으로 옮긴 것)
 */
export default function PushButton({
  children,
  onClick,
  disabled = false,
  depth = 8,
  plate = '/ui/age_button_plate.webp',
  slice = 56,
  border = 20,
  className = '',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** 눌렸을 때 내려가는 거리(px) = 보이는 두께 */
  depth?: number;
  plate?: string;
  slice?: number;
  border?: number;
  className?: string;
  title?: string;
}) {
  // 눌림 상태를 직접 관리한다: 빠른 클릭이나 터치에도 눌리는 모습이 최소 110ms 는 보이게 한다
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);
  const downAt = useRef(0);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = () => {
    if (disabled) return;
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    downAt.current = performance.now();
    setPressed(true);
  };
  const release = () => {
    const wait = Math.max(0, 110 - (performance.now() - downAt.current));
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => setPressed(false), wait);
  };

  const face: CSSProperties = {
    borderStyle: 'solid',
    borderWidth: border,
    borderImage: `url('${plate}') ${slice} fill / ${border}px stretch`,
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      initial="rest"
      animate={disabled ? 'rest' : pressed ? 'pressed' : hover ? 'hover' : 'rest'}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={() => { setHover(false); if (pressed) release(); }}
      onPointerEnter={() => setHover(true)}
      onPointerCancel={release}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') press(); }}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') release(); }}
      onBlur={release}
      className={`group relative inline-block cursor-pointer select-none touch-manipulation outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bright-brass disabled:cursor-not-allowed ${className}`}
      style={{ paddingBottom: depth, WebkitTapHighlightColor: 'transparent', opacity: disabled ? 0.4 : 1 }}
    >
      {/* 받침: 같은 판을 어둡게 해서 아래쪽에 깔면 두께처럼 보인다 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 block"
        style={{ top: depth, ...face, filter: 'brightness(0.32) saturate(0.8)', boxShadow: '0 10px 14px -6px rgba(0,0,0,0.7)' }}
      />
      {/* 면: 누르면 받침까지 내려앉는다 */}
      <motion.span
        className="relative block"
        style={{ ...face, transformOrigin: '50% 100%' }}
        variants={{
          rest: { y: 0, scaleX: 1, scaleY: 1, filter: 'brightness(1)' },
          hover: { y: -2, scaleX: 1, scaleY: 1, filter: 'brightness(1.12)' },
          pressed: { y: depth, scaleX: 1.015, scaleY: 0.95, filter: 'brightness(0.92)' },
        }}
        transition={{ type: 'spring', stiffness: 520, damping: 16, mass: 0.7 }}
      >
        {children}
      </motion.span>
    </motion.button>
  );
}
