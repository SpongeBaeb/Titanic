'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { playTick } from '@/lib/synth';

/**
 * 단말기에 글자가 한 자씩 찍히는 연출. delay(초) 뒤에 시작해 글자당 speed(ms)로 나타나며, 찍히는 동안 커서가 붙어 있다.
 * instant 이거나 움직임 줄이기 설정이면 처음부터 다 보인다. 세 글자마다 가벼운 타자음이 난다.
 */
export function typedDuration(text: string, speed = 22) {
  return text.length * speed;
}

export default function Typed({ text, delay = 0, speed = 22, instant = false, sound = true, cursor = true }: { text: string; delay?: number; speed?: number; instant?: boolean; sound?: boolean; cursor?: boolean }) {
  const reduce = useReducedMotion();
  const skip = instant || !!reduce;
  const [n, setN] = useState(skip ? text.length : 0);
  const sounded = useRef(0);
  useEffect(() => {
    if (skip) { setN(text.length); return; }
    setN(0);
    sounded.current = 0;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t0 = setTimeout(() => {
      iv = setInterval(() => {
        setN((c) => {
          const next = Math.min(text.length, c + 1);
          if (sound && next % 3 === 0 && next !== sounded.current) { sounded.current = next; playTick(); }
          if (next >= text.length && iv) clearInterval(iv);
          return next;
        });
      }, speed);
    }, delay * 1000);
    return () => { clearTimeout(t0); if (iv) clearInterval(iv); };
  }, [text, delay, speed, skip, sound]);
  const typing = n < text.length;
  return (
    <>
      <span>{text.slice(0, n)}</span>
      {cursor && typing && n > 0 && <span aria-hidden className="ml-px inline-block h-[1em] w-[0.55em] translate-y-[0.12em] animate-pulse bg-current opacity-80" />}
      {/* 스크린리더에는 처음부터 전체 문장을 준다 */}
      <span className="sr-only">{typing ? text.slice(n) : ''}</span>
    </>
  );
}
