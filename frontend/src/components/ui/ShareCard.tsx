'use client';

import { forwardRef } from 'react';
import TraitHexagon from '@/components/ui/TraitHexagon';
import type { TraitResult } from '@/engine/traits';

export type CardRatio = '4:5' | '9:16';

interface ShareCardProps {
  traits: TraitResult;
  statistical: number;
  adjusted: number;
  ratio: CardRatio;
}

/**
 * 공유 전용 카드: 화면을 그대로 찍지 않고, SNS 비율(피드 4:5 = 1080x1350, 스토리 9:16 = 1080x1920)에 맞춰 따로 짠다.
 * 화면 밖에 숨겨 두었다가 이미지로 뽑는다. 생존 확률이 절반 이상이면 따뜻한 호박색, 아니면 차가운 청회색 스킨.
 * 개인 정보는 넣지 않는다 (유형, 점수, 확률뿐).
 */
const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard({ traits, statistical, adjusted, ratio }, ref) {
  const alive = adjusted >= 50;
  const H = ratio === '4:5' ? 1350 : 1920;
  const accent = alive ? '#fbbf24' : '#7dd3fc';
  const accentDim = alive ? 'rgba(251,191,36,0.55)' : 'rgba(125,211,252,0.5)';
  const bg = alive
    ? 'radial-gradient(ellipse at 50% 18%, #3a2508 0%, #140c03 55%, #050302 100%)'
    : 'radial-gradient(ellipse at 50% 18%, #11283f 0%, #08121e 55%, #02060c 100%)';
  const len = traits.type.ko.replace(/\s/g, '').length;
  // 이름이 한 줄에 들어가도록 글자 수에 맞춰 크기를 정한다 (가로 약 900px)
  const nameSize = Math.min(190, Math.floor(900 / (len + 0.5)));
  const tag = `#나는${traits.type.ko.replace(/\s/g, '')}`;
  const host = typeof window !== 'undefined' ? window.location.host : '';

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: H,
        background: bg,
        color: '#fef3c7',
        padding: ratio === '4:5' ? '72px 84px 64px' : '120px 84px 110px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 테두리 */}
      <div style={{ position: 'absolute', inset: 28, border: `2px solid ${accentDim}`, borderRadius: 28, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 40, border: `1px solid ${accentDim}`, borderRadius: 20, opacity: 0.5, pointerEvents: 'none' }} />

      <div>
        <p style={{ fontSize: 30, letterSpacing: '0.34em', color: 'rgba(226,232,240,0.7)' }}>1912년 4월 14일 밤, 당신은</p>
        <p className="font-sans" style={{ marginTop: ratio === '4:5' ? 22 : 34, fontSize: 30, letterSpacing: '0.4em', color: accentDim, textTransform: 'uppercase' }}>{traits.type.en}</p>
        <h2 className="font-title" style={{ marginTop: 8, fontSize: nameSize, lineHeight: 1.12, fontWeight: 700, color: accent, textShadow: `0 0 40px ${accentDim}` }}>
          {traits.type.ko}
        </h2>
        <p className="break-keep font-serif" style={{ margin: ratio === '4:5' ? '24px auto 0' : '34px auto 0', maxWidth: 840, fontSize: ratio === '4:5' ? 40 : 46, lineHeight: 1.45, color: '#f1e8d6' }}>
          “{traits.type.line}”
        </p>
      </div>

      <div style={{ width: ratio === '4:5' ? 400 : 620, margin: ratio === '4:5' ? '0' : '20px 0' }}>
        <TraitHexagon values={traits.axes} top={traits.top} duration={0.01} delay={0} />
      </div>

      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 44 }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 24, letterSpacing: '0.2em', color: 'rgba(148,163,184,0.9)' }}>타고난 생존 확률</p>
            <p className="font-numeric" style={{ fontSize: ratio === '4:5' ? 60 : 76, lineHeight: 1.1, color: 'rgba(203,213,225,0.9)' }}>{statistical}%</p>
          </div>
          <span style={{ fontSize: 56, color: 'rgba(148,163,184,0.6)', paddingBottom: 14 }}>→</span>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 24, letterSpacing: '0.2em', color: 'rgba(148,163,184,0.9)' }}>그날 밤의 선택 이후</p>
            <p className="font-numeric" style={{ fontSize: ratio === '4:5' ? 118 : 150, lineHeight: 1, color: '#fff7e0', textShadow: `0 0 36px ${accentDim}` }}>{adjusted}%</p>
          </div>
        </div>
        <div
          className="font-display"
          style={{
            display: 'inline-block',
            marginTop: ratio === '4:5' ? 22 : 30,
            padding: '6px 32px',
            border: `5px double ${accent}`,
            borderRadius: 12,
            color: accent,
            fontSize: ratio === '4:5' ? 38 : 44,
            fontWeight: 900,
            letterSpacing: '0.3em',
            transform: 'rotate(-6deg)',
          }}
        >
          {alive ? 'SURVIVED' : 'PERISHED'}
        </div>
        <p style={{ marginTop: ratio === '4:5' ? 26 : 60, fontSize: 34, letterSpacing: '0.06em', color: accent }}>{tag} #타이타닉성향</p>
        <p style={{ marginTop: 16, fontSize: 24, color: 'rgba(148,163,184,0.8)' }}>너는 그날 밤 어떤 사람이었을까? {host && `· ${host}`}</p>
        <p style={{ marginTop: 10, fontSize: 20, color: 'rgba(100,116,139,0.9)' }}>재미로 보는 성향 테스트입니다. 실제 성격을 진단하지 않습니다.</p>
      </div>
    </div>
  );
});

export default ShareCard;
