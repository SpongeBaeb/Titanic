import type { ButtonHTMLAttributes } from 'react';

/**
 * 1912년 여객선의 황동 명판 같은 버튼. 어두운 남색 바탕에 황동 이중 테두리, 세리프 대문자.
 * 마우스를 올리면(또는 키보드로 초점이 오면) 황동으로 채워지고 글자가 짙게 바뀐다.
 */
export default function ClassicButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] border border-brass px-7 font-display text-sm font-semibold uppercase tracking-[0.18em] text-bright-brass transition-all duration-300 bg-[linear-gradient(180deg,#0e1f29_0%,#07111a_100%)] shadow-[inset_0_0_0_3px_#07111a,inset_0_0_0_4px_rgba(184,154,91,0.6),0_2px_8px_rgba(0,0,0,0.6)] hover:text-ocean-black hover:bg-[linear-gradient(180deg,#e1c88e_0%,#b08e52_100%)] hover:shadow-[inset_0_0_0_3px_#d3b676,inset_0_0_0_4px_rgba(7,17,26,0.5),0_2px_10px_rgba(0,0,0,0.6)] focus-visible:text-ocean-black focus-visible:bg-[linear-gradient(180deg,#e1c88e_0%,#b08e52_100%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bright-brass active:translate-y-px active:brightness-95 motion-reduce:transition-none ${className}`}
    >
      {children}
    </button>
  );
}
