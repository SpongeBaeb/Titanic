'use client';

import { useEffect, useState } from 'react';

/**
 * 선택지가 첫 화면 아래로 넘칠 때만, 아래로 내리라는 작은 화살표를 보여 준다.
 * 조금이라도 스크롤하면 사라진다. (모바일·낮은 창에서 선택지가 안 보이는 문제)
 */
export default function ScrollCue() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => {
      const el = document.documentElement;
      setShow(el.scrollHeight > window.innerHeight + 60 && window.scrollY < 40);
    };
    check();
    const t = window.setTimeout(check, 1800); // 선택지가 나타난 뒤 다시 잰다
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center">
      <span className="animate-bounce rounded-full bg-black/45 px-3 py-1 text-sm text-amber-200/90 backdrop-blur-sm">▼ 아래로</span>
    </div>
  );
}
