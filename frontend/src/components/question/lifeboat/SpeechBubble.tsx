'use client';

import { motion } from 'framer-motion';

/**
 * 장교의 말풍선: public/q7/bubble.webp (손으로 그린 흰 사각형, 검은 그림자, 아래로 나온 꼬리)를 쓴다.
 * 그림은 꼬리가 왼쪽 아래라서 좌우를 뒤집어 장교(오른쪽)를 향하게 쓴다. 글자는 뒤집히지 않는다.
 * 부모(구명정에 붙은 층) 안에서 (x, y)%에 꼬리 끝이 오도록 놓이므로 구명정이 흔들리면 같이 흔들린다.
 */
interface Props {
  text: string;
  /** 꼬리 끝(말하는 사람의 얼굴) 위치, 부모 기준 % */
  x: number;
  y: number;
  /** 소리치는 말: 글자를 키우고 살짝 기울인다 */
  shout?: boolean;
  /** 떠는 말: 글자가 가늘게 떨린다 */
  fear?: boolean;
}

/** 그림 안쪽 글자 칸(그림 크기에 대한 비율), 꼬리 끝이 그림 가장자리에서 떨어진 비율 */
const INNER = { l: 0.09, r: 0.06, t: 0.07, b: 0.3 };
const TIP = 0.17;
const ASPECT = 964 / 654;

export default function SpeechBubble({ text, x, y, shout, fear }: Props) {
  const n = text.length;
  const width = n <= 11 ? 'clamp(150px, 17vw, 270px)' : n <= 22 ? 'clamp(180px, 21vw, 330px)' : 'clamp(210px, 26vw, 400px)';
  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute z-40"
      style={{ right: `${100 - x}%`, top: `${y}%`, transformOrigin: `${(1 - TIP) * 100}% 100%`, rotate: shout ? -2 : 0 }}
      initial={{ opacity: 0, scale: 0.6, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 520, damping: 22 }}
    >
      <div className="relative" style={{ width, aspectRatio: `${ASPECT}`, containerType: 'inline-size', transform: `translate(${TIP * 100}%, -100%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/q7/bubble.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full" style={{ transform: 'scaleX(-1)' }} />
        <p
          className="absolute flex items-center justify-center break-keep text-center font-bold leading-snug text-[#15110d]"
          style={{
            left: `${INNER.r * 100}%`, right: `${INNER.l * 100}%`, top: `${INNER.t * 100}%`, bottom: `${INNER.b * 100}%`,
            fontFamily: 'var(--font-serif, serif)', fontSize: shout ? '8.6cqw' : '7.4cqw', letterSpacing: shout ? '-0.02em' : undefined,
          }}
        >
          {fear ? <span className="inline-block animate-pulse">{text}</span> : text}
        </p>
      </div>
    </motion.div>
  );
}
