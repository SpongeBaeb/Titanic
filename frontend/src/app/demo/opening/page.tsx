'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import ClassicButton from '@/components/ui/ClassicButton';
import AnalogClock from '@/components/cinematic/AnalogClock';

/**
 * 첫 화면 시안 비교용 데모 (A, B, C). 실제 화면이 아니라 구도와 분위기를 보기 위한 시안이다.
 * 1280x720 기준으로 그려서 칸 폭에 맞춰 줄여 보여 준다.
 */
const W = 1280;
const H = 720;

function ScaledStage({ children }: { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    setScale(el.clientWidth / W);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrap} className="relative w-full overflow-hidden rounded-lg border border-brass/40 bg-black" style={{ aspectRatio: `${W} / ${H}` }}>
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="relative text-ivory">
        {children}
      </div>
    </div>
  );
}

const TITLE = 'THE ATLANTIC AWAITS'.split('');

/** A. 시네마틱 오프닝 */
function StageA() {
  return (
    <ScaledStage>
      <img src="/bg/frames-d/frame_0050.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.25),rgba(2,6,23,0.92))]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85" />
      <div className="absolute inset-x-0 top-[120px] flex flex-col items-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 1 }} className="flex items-center gap-4 font-display text-[15px] tracking-[0.5em] text-bright-brass">
          <span className="h-px w-16 bg-brass" /> APRIL 1912 <span className="h-px w-16 bg-brass" />
        </motion.div>
        <h1 className="mt-6 flex font-display text-[92px] leading-none tracking-[0.12em]" aria-label="THE ATLANTIC AWAITS">
          {TITLE.map((c, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.6 + i * 0.07, duration: 0.7 }} className="inline-block" aria-hidden>
              {c === ' ' ? ' ' : c}
            </motion.span>
          ))}
        </h1>
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4, duration: 1.2 }} className="absolute inset-x-0 top-[360px] text-center font-serif text-[30px] text-ivory/95 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
        당신이라면, 몇 번째 구명정에 탔을까?
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.1, duration: 0.8 }} className="absolute inset-x-0 top-[470px] flex flex-col items-center gap-5">
        <ClassicButton className="!min-h-14 px-14 text-lg">승선하기</ClassicButton>
        <div className="text-[15px] tracking-wider text-slate-300">약 ○분 · 선택 ○개 · 결과는 당신의 인간 유형 <span className="text-slate-500">(값 미정)</span></div>
      </motion.div>
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[12px] tracking-[0.3em] text-slate-400">
        <span>OR SCROLL</span>
        <span className="h-8 w-px bg-gradient-to-b from-slate-400 to-transparent" />
      </div>
      <div className="absolute right-6 top-6 rounded-full border border-white/20 px-4 py-1.5 text-[13px] text-slate-300">소리 켜기</div>
    </ScaledStage>
  );
}

/** B. 승선권 중심 */
function StageB() {
  return (
    <ScaledStage>
      <img src="/bg/TitanicBoarding.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-slate-950/80" />
      <div className="absolute inset-x-0 top-[56px] text-center">
        <div className="font-display text-[15px] tracking-[0.5em] text-bright-brass">RMS TITANIC · SOUTHAMPTON</div>
        <h1 className="mt-4 font-display text-[54px] tracking-[0.1em]">당신의 승선권</h1>
        <p className="mt-2 font-serif text-[22px] text-slate-200">이름도 직업도 없는 한 장의 표. 이 표로 당신이 누구인지 밝혀집니다.</p>
      </div>
      <motion.img
        src="/ticketS.webp"
        alt="승선권"
        draggable={false}
        animate={{ y: [0, -8, 0], rotate: [-3, -2, -3] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="absolute left-1/2 top-[250px] w-[620px] -translate-x-1/2 drop-shadow-[0_30px_30px_rgba(0,0,0,0.7)]"
      />
      <div className="absolute inset-x-0 bottom-[52px] flex flex-col items-center gap-3">
        <div className="flex flex-col items-center text-[18px] tracking-[0.2em] text-bright-brass">
          <span>아래로 끌어 승선권을 찢으세요</span>
          <span className="mt-2 h-10 w-px bg-gradient-to-b from-bright-brass to-transparent" />
        </div>
        <div className="text-[14px] text-slate-400">또는 <span className="underline">버튼으로 시작</span></div>
      </div>
    </ScaledStage>
  );
}

/** C. 시계 카운트다운 */
function StageC() {
  return (
    <ScaledStage>
      <img src="/bg/frames-d/frame_0120.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.6),rgba(0,0,0,0.97))]" />
      <div className="absolute inset-y-0 left-0 flex w-[600px] items-center justify-center">
        <div className="drop-shadow-[0_0_40px_rgba(184,154,91,0.25)]">
          <AnalogClock elapsed={0} size={420} sinkMark={false} />
        </div>
      </div>
      <div className="absolute left-[600px] top-[150px] w-[580px]">
        <div className="font-display text-[15px] tracking-[0.5em] text-bright-brass">14 APRIL 1912 · 23:40</div>
        <h1 className="mt-5 font-display text-[60px] leading-tight tracking-[0.06em]">배가 빙산을<br />만나기 직전</h1>
        <p className="mt-6 font-serif text-[24px] leading-relaxed text-slate-200">
          시계는 멈추지 않습니다.<br />이 밤, 당신은 무엇을 선택했을까요.
        </p>
        <div className="mt-10 flex items-center gap-6">
          <ClassicButton className="!min-h-14 px-14 text-lg">승선하기</ClassicButton>
          <span className="text-[14px] tracking-wider text-slate-400">약 ○분 · 선택 ○개 <span className="text-slate-500">(값 미정)</span></span>
        </div>
      </div>
    </ScaledStage>
  );
}

const VARIANTS = [
  { id: 'A', name: '시네마틱 오프닝', note: '영상처럼 제목이 나타나고, 훅 질문과 바로 시작 버튼. 분위기가 가장 강함', Stage: StageA },
  { id: 'B', name: '승선권 중심', note: '첫 화면이 곧 승선권. 찢기 인터랙션이 중심. 신선하지만 영화 느낌은 약함', Stage: StageB },
  { id: 'C', name: '시계 카운트다운', note: '23:40의 시계가 중심. 긴장감 최고, 비극을 처음부터 보여 줌', Stage: StageC },
] as const;

export default function OpeningCompare() {
  const [mode, setMode] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [replay, setReplay] = useState(0);
  const shown = mode === 'all' ? VARIANTS : VARIANTS.filter((v) => v.id === mode);
  return (
    <main className="min-h-screen bg-ocean-black px-6 py-8 text-ivory">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-xl tracking-wider">첫 화면 시안 비교</h1>
          <div className="ml-auto flex flex-wrap gap-2" role="tablist" aria-label="시안 보기">
            {(['all', 'A', 'B', 'C'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setReplay((n) => n + 1); }}
                className={`min-h-10 rounded-[3px] border px-5 text-sm font-semibold tracking-wider transition-colors ${mode === m ? 'border-bright-brass bg-brass/30 text-bright-brass' : 'border-white/20 text-slate-300 hover:border-brass'}`}
              >
                {m === 'all' ? '한눈에 비교' : `${m}만 크게`}
              </button>
            ))}
            <button onClick={() => setReplay((n) => n + 1)} className="min-h-10 rounded-[3px] border border-white/20 px-5 text-sm text-slate-300 hover:border-brass">연출 다시 보기</button>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-400">시안입니다. 실제 화면이 아니며, 소요 시간과 선택 수는 아직 정해지지 않은 자리표시입니다.</p>
        <div key={replay} className={`mt-6 grid gap-6 ${mode === 'all' ? 'lg:grid-cols-3' : 'grid-cols-1 max-w-[1100px] mx-auto'}`}>
          {shown.map(({ id, name, note, Stage }) => (
            <section key={id} aria-label={`${id} ${name}`}>
              <div className="mb-2 flex items-baseline gap-3">
                <span className="font-display text-3xl text-bright-brass">{id}</span>
                <span className="text-lg font-bold">{name}</span>
              </div>
              <Stage />
              <p className="mt-2 text-sm text-slate-300">{note}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
