'use client';

import { useEffect, useMemo, useState } from 'react';
import ClassicButton from '@/components/ui/ClassicButton';
import { playThud, playStamp } from '@/lib/synth';
import { playCollapse } from '@/lib/collapse';
import DeathCard from '@/components/ui/DeathCard';
import { restartJourney } from '@/lib/session';

/**
 * 히든 엔딩: 갑판에서 100명을 쓰러뜨리면, 일어난 승객들이 몰려와 때린다.
 * 연출: 화면이 흔들리고(퍽! 쾅!), 승객들의 외침이 말풍선으로 차례로 뜬 뒤, 1인칭으로 털썩 쓰러지고(playCollapse),
 * 비즐리의 기록에서 뽑은 문구(사망 카드)가 나온 다음, 기록 카드가 나온다.
 * 모션 줄이기 설정이면 흔들림과 효과음 없이 문구와 기록 카드만 보여 준다.
 */
const STYLE = `
@keyframes bt-shake { 0%,100% { transform: translate(0,0) } 20% { transform: translate(-7px,4px) } 40% { transform: translate(6px,-5px) } 60% { transform: translate(-5px,-3px) } 80% { transform: translate(4px,5px) } }
@keyframes bt-pop { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.2) rotate(var(--r)) } 45% { opacity: 1; transform: translate(-50%,-50%) scale(1.25) rotate(var(--r)) } 100% { opacity: 0; transform: translate(-50%,-50%) scale(1) rotate(var(--r)) } }
@keyframes bt-bubble { from { opacity: 0; transform: translateY(8px) scale(.9) } to { opacity: 1; transform: translateY(0) scale(1) } }
@keyframes bt-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes bt-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
@media (prefers-reduced-motion: reduce) { .bt-anim { animation: none !important; opacity: 1 !important; transform: none !important } }
`;

const SHOUTS = [
  { t: '이 사람이 밀었어요!', x: 24, y: 34 },
  { t: '줄은 서야지, 줄은!', x: 72, y: 28 },
  { t: '구명정은 모두의 것이오!', x: 30, y: 62 },
  { t: '저 사람 잡아요!', x: 74, y: 60 },
  { t: '내 모자! 내 모자를 밟았소!', x: 50, y: 44 },
];
const IMPACTS = ['퍽!', '쾅!', '악!', '퍼억!', '쿵!', '철썩!', '으악!', '딱!'];
const FALL_AT = 6400; // 맞다가 쓰러지기 시작하는 시각(ms)

export default function BeatenEnding() {
  const reduce = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const [phase, setPhase] = useState<'beat' | 'epitaph' | 'card'>(reduce ? 'epitaph' : 'beat');
  const card = phase === 'card';
  const [hits, setHits] = useState<{ id: number; w: string; x: number; y: number; r: number }[]>([]);

  useEffect(() => {
    if (reduce) return;
    const ts: ReturnType<typeof setTimeout>[] = [];
    let id = 0;
    // 퍽 소리와 글자가 점점 빨라진다
    let at = 500;
    let gap = 520;
    while (at < FALL_AT - 600) {
      const when = at;
      ts.push(setTimeout(() => {
        playThud();
        if (Math.random() < 0.4) setTimeout(playStamp, 90);
        const n = ++id;
        setHits((h) => [...h.slice(-5), { id: n, w: IMPACTS[Math.floor(Math.random() * IMPACTS.length)], x: 12 + Math.random() * 76, y: 18 + Math.random() * 64, r: Math.round((Math.random() - 0.5) * 36) }]);
      }, when));
      at += gap;
      gap = Math.max(170, gap * 0.86);
    }
    ts.push(setTimeout(() => { playCollapse().then(() => setPhase('epitaph')); }, FALL_AT));
    return () => ts.forEach(clearTimeout);
  }, [reduce]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <style>{STYLE}</style>
      {/* 장면: 갑판이 흔들리고, 가장자리가 붉게 물든다 */}
      {phase === 'beat' && (
        <div className="bt-anim absolute inset-0" style={{ animation: 'bt-shake .32s linear infinite, bt-in .4s ease-out both' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bg/rumor_q6.webp" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: 'brightness(.55) saturate(1.2) contrast(1.1)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 55%, rgba(120,10,10,0) 20%, rgba(90,0,0,.55) 70%, rgba(20,0,0,.92) 100%)' }} />

          {SHOUTS.map((s, i) => (
            <div
              key={s.t}
              className="bt-anim absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${s.x}%`, top: `${s.y}%`, animation: `bt-bubble .35s ease-out ${(0.9 + i * 1.1).toFixed(2)}s both` }}
            >
              <span className="relative block rounded-[22px] border-[3px] border-[#1b1b1b] bg-[#f7f4ea] px-4 py-2 text-center font-sans text-[clamp(14px,2.4vw,22px)] font-bold text-[#1b1b1b] shadow-[0_6px_14px_rgba(0,0,0,.6)]">
                {s.t}
              </span>
            </div>
          ))}

          {hits.map((h) => (
            <div
              key={h.id}
              className="bt-anim pointer-events-none absolute font-display text-[clamp(40px,9vw,96px)] font-black text-[#ffe14d]"
              style={{ left: `${h.x}%`, top: `${h.y}%`, ['--r' as string]: `${h.r}deg`, animation: 'bt-pop .6s ease-out both', textShadow: '4px 4px 0 #b3001b, -2px -2px 0 #1b1b1b, 2px -2px 0 #1b1b1b, -2px 2px 0 #1b1b1b' } as React.CSSProperties}
            >
              {h.w}
            </div>
          ))}
        </div>
      )}

      {/* 쓰러진 뒤: 비즐리의 기록에서 뽑은 문구 (끝나면 기록 카드) */}
      {phase === 'epitaph' && <DeathCard soft onDone={() => setPhase('card')} />}

      {/* 기록 카드 */}
      {card && (
        <div className="bt-anim relative flex min-h-screen flex-col items-center justify-center px-5 py-10" style={{ animation: 'bt-in 1.2s ease-out both' }}>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(70,8,8,.5) 0%, rgba(0,0,0,.92) 70%, #000 100%)' }} />
          <div className="relative w-[min(92vw,430px)] border border-[#8a2b2b]/60 bg-black/60 px-6 py-8 text-center shadow-[0_14px_40px_rgba(0,0,0,.8)]">
            <div className="bt-anim font-display text-[11px] tracking-[0.45em] text-[#d98a8a]" style={{ animation: 'bt-rise 1s ease-out .3s both' }}>ANGRY MOB</div>
            <div className="bt-anim mt-1.5 text-lg tracking-[0.3em] text-[#e6b0b0] break-keep" style={{ animation: 'bt-rise 1s ease-out .5s both' }}>성난 승객들</div>
            <div className="bt-anim mt-6 font-numeric text-6xl font-bold text-[#f3d0d0]" style={{ animation: 'bt-rise 1s ease-out .9s both' }}>100</div>
            <div className="bt-anim text-xs tracking-[0.3em] text-[#d98a8a]/80" style={{ animation: 'bt-rise 1s ease-out 1.1s both' }}>쓰러뜨린 사람</div>
            <p className="bt-anim mt-7 text-[15px] leading-[2] text-[#e4d3d3] break-keep" style={{ animation: 'bt-rise 1.2s ease-out 1.6s both' }}>
              쓰러진 사람들은 그냥 일어나지 않았습니다.<br />
              구명정이 내려가기 한참 전에, 당신의 밤은 갑판 위에서 끝났습니다.
            </p>
            <p className="bt-anim mt-4 text-[13px] leading-[1.9] text-[#b89c9c] break-keep" style={{ animation: 'bt-rise 1.2s ease-out 2.8s both' }}>
              다행히 이 이야기는 기록에 없습니다.
            </p>
          </div>
          <ClassicButton onClick={restartJourney} className="bt-anim relative mt-8" style={{ animation: 'bt-in 1s ease-out 3.6s both' }}>
            처음부터 다시
          </ClassicButton>
        </div>
      )}
    </div>
  );
}
