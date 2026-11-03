import React from 'react';

interface ProbabilityNumberProps {
  value: number;
  size?: 'xl' | 'lg';
  tone?: 'ivory' | 'survive' | 'danger';
  className?: string;
}

const SIZE_STYLE: Record<NonNullable<ProbabilityNumberProps['size']>, string> = {
  xl: 'clamp(4.5rem, 22vw, 7rem)',
  lg: '2.75rem',
};

const TONE_CLASS: Record<NonNullable<ProbabilityNumberProps['tone']>, string> = {
  ivory: 'text-ivory',
  survive: 'text-survive',
  danger: 'text-danger-text',
};

// 확률 숫자 전용: Playfair 700 + 라이닝 숫자, % 는 숫자의 0.42배 (DESIGN_RULES.md §1.1~1.2)
export function ProbabilityNumber({ value, size = 'xl', tone = 'ivory', className = '' }: ProbabilityNumberProps) {
  return (
    <span
      className={`font-numeric font-bold leading-none tracking-[-0.03em] whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}
      style={{
        fontSize: SIZE_STYLE[size],
        fontVariantNumeric: 'lining-nums',
        textShadow: '0 2px 28px rgba(0, 0, 0, 0.65)',
      }}
    >
      {value}
      <span
        className={`ml-[0.08em] font-semibold tracking-normal ${tone === 'ivory' ? 'text-bright-brass' : ''}`}
        style={{ fontSize: '0.42em' }}
      >
        %
      </span>
    </span>
  );
}
