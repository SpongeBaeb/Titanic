'use client';

import { SINK_AFTER_MIN, wallClock } from '@/engine/cinematic';
import ClassicButton from '@/components/ui/ClassicButton';
import { restartJourney } from '@/lib/session';

const STYLE = `
@keyframes sp-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes sp-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
@keyframes sp-flick { 0%,100% { opacity: 1 } 41% { opacity: 1 } 42% { opacity: .55 } 44% { opacity: .95 } 46% { opacity: .4 } 48% { opacity: 1 } 83% { opacity: 1 } 84% { opacity: .7 } 86% { opacity: 1 } }
@keyframes sp-breath { 0%,100% { filter: brightness(1) } 50% { filter: brightness(1.18) } }
@media (prefers-reduced-motion: reduce) { .sp-anim { animation: none !important; opacity: 1 !important; transform: none !important } }
`;

// 프레임 이미지(766×1124)의 테두리 두께(이미지 픽셀). 화면에서는 아래 FRAME_W 로 얇게 줄여서 그린다
const SLICE = '163 160 162 160';
const FRAME_W = 'clamp(18px, 7vw, 30px)';

/** 선택 없이 실제 시간이 모두 흐른 경우의 이스터 에그 카드. 무겁고 으스스하게, 그러나 판정하지 않고 사실만 적는다(문구는 초안). */
export default function SpecialCard() {
  const at = wallClock(SINK_AFTER_MIN);
  return (
    <div className="sp-anim relative min-h-screen overflow-hidden bg-black" style={{ animation: 'sp-in 1.2s ease-out both' }}>
      <style>{STYLE}</style>
      {/* 가장자리가 어둠에 잠긴다 */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(14,28,32,.35) 0%, rgba(0,0,0,.8) 70%, #000 100%)' }} />

      <div className="relative flex justify-center px-4 py-8">
        {/* 카드: 밤바다 사진 위에 얇게 줄인 부식 프레임. 프레임은 9분할(border-image)이라 두께만 줄여도 장식이 늘어지지 않는다 */}
        <figure
          className="sp-anim relative w-[min(92vw,430px)] text-center px-4 py-6 shadow-[0_14px_40px_rgba(0,0,0,.8)]"
          style={{
            border: 'solid transparent',
            borderWidth: FRAME_W,
            borderImage: `url('/frame/frame-sunk.webp') ${SLICE} / ${FRAME_W} round`,
            backgroundImage: "linear-gradient(to bottom, rgba(0,4,6,.55) 0%, rgba(0,4,6,.62) 45%, rgba(0,4,6,.86) 100%), url('/bg/card-sea.webp')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundClip: 'padding-box',
            backgroundColor: '#04090b',
            animation: 'sp-in 1.4s ease-out .2s both, sp-breath 7s ease-in-out 1.6s infinite',
          }}
        >
          <div
            className="sp-anim font-display text-[11px] tracking-[0.45em] text-[#8fb0b4]/90"
            style={{ animation: 'sp-flick 6s linear 2s infinite, sp-rise 1.2s ease-out .4s both' }}
          >
            SINS OF OMISSION
          </div>
          <div className="sp-anim mt-1.5 text-sm tracking-[0.3em] text-[#a9bfc1]/90 break-keep" style={{ animation: 'sp-rise 1.2s ease-out .6s both' }}>
            방관자의 죄
          </div>

          <div className="sp-anim mt-5 flex justify-center" style={{ animation: 'sp-in 1.6s ease-out .3s both' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/clock/broken.webp"
              alt={`깨지고 멈춘 선내 시계, ${at}`}
              className="w-full max-w-[220px] drop-shadow-[0_6px_24px_rgba(0,0,0,.9)]"
              style={{ filter: 'saturate(.4) brightness(.66) contrast(1.1) sepia(.12) hue-rotate(150deg)' }}
            />
          </div>
          <div
            className="sp-anim mt-3 font-numeric text-2xl font-bold tracking-[0.2em] text-[#a9bfc1] [font-variant-numeric:lining-nums]"
            style={{ animation: 'sp-flick 9s linear 3s infinite, sp-rise 1.2s ease-out 1s both' }}
          >
            {at}
          </div>

          <p className="sp-anim mt-7 text-[15px] leading-[2] text-[#c3cfcf] break-keep [text-shadow:0_1px_10px_#000]" style={{ animation: 'sp-rise 1.4s ease-out 1.7s both' }}>
            그날 밤 많은 사람이 처음에는 같은 선택을 했습니다.<br />
            승무원이 괜찮다고 했고, 사람들은 객실로 돌아갔습니다.
          </p>
          <p className="sp-anim mt-5 text-[15px] leading-[2] text-[#dbe3e3] break-keep [text-shadow:0_1px_10px_#000]" style={{ animation: 'sp-rise 1.4s ease-out 3s both' }}>
            당신은 아무것도 하지 않았습니다.<br />
            시계는 {at}에 멈췄습니다.
          </p>
        </figure>
      </div>

      <div className="relative flex justify-center pb-10">
        <ClassicButton
          onClick={restartJourney}
          className="sp-anim"
          style={{ animation: 'sp-in 1.2s ease-out 4.6s both' }}
        >
          처음부터 다시
        </ClassicButton>
      </div>
    </div>
  );
}
