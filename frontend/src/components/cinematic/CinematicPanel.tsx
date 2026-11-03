'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { CineOption, CineScene } from '@/engine/cinematic';
import { SINK_AFTER_MIN, TAG_LABEL, companionPhoto, formatRemaining, wallClock } from '@/engine/cinematic';
import type { Ctx } from '@/engine/types';
import AnalogClock from './AnalogClock';
import { playThud, playTick } from '@/lib/synth';

interface Props {
  scene: CineScene;
  ctx: Ctx;
  /** 이 장면에 들어올 때 충돌 후 경과 분 (장면 시각 + 앞선 선택의 소모 시간) */
  elapsed: number;
  /** false 이면 제한시간 없이 진행 (접근성) */
  /** 다음 장면에 들어갈 때의 경과 분 (이 선택의 소모 시간 포함). 없으면 선택의 소모 시간만 흐른다 */
  nextElapsed?: (option: CineOption) => number | undefined;
  timerEnabled: boolean;
  onChoose: (option: CineOption, ms: number) => void;
}

const CHARS_PER_TICK = 2;
const TICK_MS = 22;
const LAMPS = 10; // 선내 전등 개수 (남은 시간 표시)

// 시계 클로즈업에서 분침이 도는 시간: 흐르는 시간이 길수록 조금 더 오래
const sweepMs = (minutes: number) => Math.min(3200, 1400 + minutes * 30);

const STYLE = `
@keyframes cine-push { from { transform: scale(1); } to { transform: scale(1.06); } }
@keyframes cine-fl { 0%{opacity:0} 8%{opacity:.35} 11%{opacity:0} 46%{opacity:0} 49%{opacity:.5} 52%{opacity:0} 100%{opacity:0} }
@keyframes cine-shake { 0%,100%{transform:translate(0,0)} 15%{transform:translate(-6px,3px)} 30%{transform:translate(5px,-4px)} 45%{transform:translate(-4px,-2px)} 60%{transform:translate(4px,3px)} 80%{transform:translate(-2px,1px)} }
@keyframes cine-flash { 0%{opacity:0} 10%{opacity:.85} 100%{opacity:0} }
@keyframes cine-dim { 0%{opacity:0} 25%{opacity:.7} 100%{opacity:0} }
@keyframes cine-timer { from { transform: scaleX(1) } to { transform: scaleX(0) } }
`;

export default function CinematicPanel({ scene, ctx, elapsed, nextElapsed, timerEnabled, onChoose }: Props) {
  const reduce = !!useReducedMotion();
  const segments = useMemo(() => scene.story(ctx), [scene, ctx]);
  const options = useMemo(() => scene.options(ctx), [scene, ctx]);
  const total = useMemo(() => segments.reduce((n, s) => n + s.text.length, 0), [segments]);

  const [shown, setShown] = useState(reduce ? total : 0);
  const [chosen, setChosen] = useState<CineOption | null>(null);
  const [waterUp, setWaterUp] = useState(false);
  const [shownMin, setShownMin] = useState(elapsed);
  const [closeup, setCloseup] = useState(false);
  const [photoOn, setPhotoOn] = useState(false);
  const photoSrc = companionPhoto(ctx.answers.companion);
  const [delta, setDelta] = useState(0);
  // 단계별 배경 중 실제로 불러와지는 것만 쓴다 (없는 이미지는 건너뛴다)
  const [loaded, setLoaded] = useState<string[]>([]);
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const enteredAt = useRef(0);
  const locked = useRef(false);
  const textDone = shown >= total;

  useEffect(() => { enteredAt.current = Date.now(); }, []);
  useEffect(() => () => {
    if (clockTimer.current) clearInterval(clockTimer.current);
    timeouts.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let alive = true;
    (scene.bgStages ?? []).forEach(({ url }) => {
      const img = new Image();
      img.onload = () => { if (alive) setLoaded((l) => (l.includes(url) ? l : [...l, url])); };
      img.src = url;
    });
    return () => { alive = false; };
  }, [scene]);

  // 문장 타이핑 (글을 누르면 건너뜀)
  useEffect(() => {
    if (reduce || textDone) return;
    const id = setInterval(() => setShown((n) => Math.min(total, n + CHARS_PER_TICK)), TICK_MS);
    return () => clearInterval(id);
  }, [reduce, textDone, total]);

  // 차오르는 물 (전환이 걸리도록 한 프레임 뒤에)
  useEffect(() => {
    if (reduce || !scene.fx.includes('water')) return;
    const id = requestAnimationFrame(() => setWaterUp(true));
    return () => cancelAnimationFrame(id);
  }, [reduce, scene]);

  const choose = (option: CineOption) => {
    if (locked.current) return;
    locked.current = true;
    setChosen(option);
    if (option.fx?.includes('shake')) playThud();
    const ms = Date.now() - enteredAt.current;
    const target = nextElapsed?.(option) ?? elapsed + (option.timeCost ?? 0);
    const cost = Math.max(0, target - elapsed);
    setDelta(cost);
    const SWEEP_MS = sweepMs(cost);
    const later = (fn: () => void, delay: number) => { timeouts.current.push(setTimeout(fn, delay)); };

    // 반향(E1): 승선 때 찍은 사진이 시계 클로즈업 앞에 잠깐 떠오른다
    const lead = option.echo === 'photo' && photoSrc && !reduce ? 2100 : 0;
    if (lead) {
      later(() => setPhotoOn(true), 600);
      later(() => setPhotoOn(false), 600 + lead - 500);
    }

    if (cost > 0 && !reduce) {
      // 선택 강조(0.7s) → 시계 클로즈업 → 분침이 흘러 시간이 경과 → 시계가 물러나고 다음 장면
      later(() => setCloseup(true), 700 + lead);
      later(() => {
        const t0 = Date.now();
        let lastTick = Math.floor(elapsed);
        clockTimer.current = setInterval(() => {
          const p = Math.min(1, (Date.now() - t0) / SWEEP_MS);
          const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          const now = elapsed + cost * eased;
          setShownMin(now);
          // 분침이 한 눈금 지날 때마다 틱 (음소거가 기본)
          if (Math.floor(now) !== lastTick) { lastTick = Math.floor(now); if (lastTick % 2 === 0) playTick(); }
          if (p >= 1 && clockTimer.current) clearInterval(clockTimer.current);
        }, 30);
      }, 1050 + lead);
      later(() => setCloseup(false), 1050 + lead + SWEEP_MS + 700);
      later(() => onChoose(option, ms), 1050 + lead + SWEEP_MS + 700 + 400);
    } else {
      if (cost > 0) setShownMin(elapsed + cost);
      later(() => onChoose(option, ms), 500);
    }
  };

  // 제한시간: 선택지가 나타난 뒤부터 센다
  const timer = timerEnabled && !reduce ? scene.timer : undefined;
  useEffect(() => {
    if (!timer || !textDone || chosen) return;
    const id = setTimeout(() => choose(timer.timeoutOption), timer.seconds * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, textDone, chosen]);

  const late = (o: CineOption) => o.until !== undefined && elapsed > o.until;
  const fx = (name: CineScene['fx'][number]) => !reduce && scene.fx.includes(name);
  // 각 문장 조각이 시작되는 글자 위치
  const starts = useMemo(() => segments.map((_, i) => segments.slice(0, i).reduce((n, s) => n + s.text.length, 0)), [segments]);

  return (
    <div className="relative w-full max-w-[960px] mx-auto h-[min(86svh,680px)] overflow-hidden rounded-xl bg-black border border-white/10 isolate">
      <style>{STYLE}</style>

      {/* 배경: 흔들림 없이 한 방향으로만 천천히 다가가고, 침몰 장면은 어두운 물이 차오른다 */}
      <div
        className="absolute inset-0"
        style={{ animation: chosen?.fx?.includes('shake') && !reduce ? 'cine-shake .5s linear 1' : undefined }}
      >
        {(() => {
          const stages = (scene.bgStages ?? []).filter((st) => loaded.includes(st.url));
          const layers = stages.length ? stages : [{ from: 0, url: scene.bg }];
          const active = layers.reduce((a, st, i) => (st.from <= shownMin ? i : a), 0);
          return layers.map((st, i) => (
            <div
              key={st.url}
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2000ms]"
              style={{
                backgroundImage: `url('${st.url}')`,
                opacity: i === active ? 1 : 0,
                animation: fx('kenburns') ? 'cine-push 24s ease-out forwards' : undefined,
              }}
            />
          ));
        })()}
        {fx('water') && (
          <div
            className="absolute inset-x-0 bottom-0 h-[55%]"
            style={{
              background: 'linear-gradient(to bottom, rgba(5,13,20,0) 0%, rgba(5,13,20,.8) 45%, #050d14 100%)',
              transform: waterUp ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 20s linear',
            }}
          />
        )}
      </div>
      {fx('flicker') && (
        <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: 0, animation: 'cine-fl 1.4s steps(1) infinite' }} />
      )}
      {!reduce && chosen?.fx?.includes('flash') && (
        <div className="absolute inset-0 bg-white pointer-events-none z-[4]" style={{ opacity: 0, animation: 'cine-flash 1s ease-out forwards' }} />
      )}
      {!reduce && chosen?.fx?.includes('dim') && (
        <div className="absolute inset-0 bg-black pointer-events-none z-[4]" style={{ opacity: 0, animation: 'cine-dim 1.4s ease-in-out forwards' }} />
      )}
      <div className="absolute inset-0 pointer-events-none z-[2]" style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 38%, rgba(0,0,0,.72) 100%)' }} />
      <div className="absolute inset-x-0 top-0 h-[6%] bg-black z-[6]" />
      <div className="absolute inset-x-0 bottom-0 h-[6%] bg-black z-[6]" />

      {/* 시계 (작게) */}
      <div className="absolute left-4 top-[8%] z-[7] flex items-center gap-3">
        <AnalogClock elapsed={shownMin} size={64} />
        <div>
          <div className="font-display text-xs tracking-[0.2em] text-bright-brass [text-shadow:0_1px_8px_#000]">R.M.S. TITANIC</div>
          <div className="mt-1 text-sm text-danger-text [text-shadow:0_1px_8px_#000]">
            침몰까지 <span className="font-numeric font-bold [font-variant-numeric:lining-nums]">{formatRemaining(shownMin)}</span>
          </div>
          {/* 선내 전등: 시간이 지날수록 하나씩 꺼진다 */}
          <div className="mt-1.5 flex gap-1" aria-hidden>
            {Array.from({ length: LAMPS }, (_, i) => {
              const lit = i < Math.ceil(Math.max(0, SINK_AFTER_MIN - shownMin) / (SINK_AFTER_MIN / LAMPS));
              return <span key={i} className="h-1.5 w-1.5 rounded-full transition-all duration-700" style={{ background: lit ? '#F2C766' : '#3a3a3a', boxShadow: lit ? '0 0 6px 1px rgba(242,199,102,.7)' : 'none' }} />;
            })}
          </div>
        </div>
      </div>

      {/* 반향: 승선 때 찍은 사진 */}
      {photoSrc && (
        <div
          className={`absolute inset-0 z-[8] flex items-center justify-center bg-black/70 pointer-events-none transition-opacity duration-500 ${photoOn ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden
        >
          <figure className="rotate-[-3deg] bg-[#E9DFC8] p-3 pb-8 shadow-[0_10px_40px_rgba(0,0,0,.7)] w-[min(60%,240px)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc} alt="" className="w-full aspect-[4/5] object-contain bg-[#D9CCAE] mix-blend-multiply [filter:sepia(.6)_contrast(.95)]" />
            <figcaption className="mt-2 text-center text-xs text-[#5a4a30] font-display tracking-widest">SOUTHAMPTON · 1912</figcaption>
          </figure>
        </div>
      )}

      {/* 시계 클로즈업: 선택에 쓴 시간이 흐르는 모습 */}
      <div
        className={`absolute inset-0 z-[9] flex flex-col items-center justify-center bg-black/85 transition-opacity duration-300 ${closeup ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!closeup}
      >
        <AnalogClock elapsed={shownMin} size={240} numerals />
        <div className="mt-4 text-center">
          <div className="font-numeric text-3xl font-bold text-ivory [font-variant-numeric:lining-nums]">{wallClock(shownMin)}</div>
          <div className="mt-1 text-sm text-muted-ivory">{delta > 0 ? `${Math.round(delta)}분이 흘렀습니다` : ''}</div>
          <div className="mt-1 text-sm text-danger-text">침몰까지 {formatRemaining(shownMin)}</div>
        </div>
      </div>

      {/* 기억됨 메모 */}
      <div
        className="absolute right-4 top-[9%] z-[7] max-w-[46%] text-right text-sm leading-relaxed text-bright-brass [text-shadow:0_1px_10px_#000] transition-opacity duration-1000"
        style={{ opacity: chosen ? 1 : 0 }}
        aria-live="polite"
      >
        {chosen && <>기억됨 · {chosen.label}</>}
      </div>

      {/* 패널 */}
      <div
        className="absolute inset-x-0 bottom-[6%] z-[5] max-h-[78%] overflow-y-auto px-5 pt-16 pb-4"
        style={{ background: 'linear-gradient(to top, rgba(4,8,10,.95) 0%, rgba(4,8,10,.85) 62%, rgba(4,8,10,0) 100%)' }}
      >
        <div className="font-display text-sm tracking-[0.2em] text-bright-brass uppercase">{scene.title}</div>
        {/* 전체 문장을 투명하게 깔아 높이를 먼저 확보하고, 그 위에 타이핑 글자를 겹친다 (글이 위로 밀려 올라가지 않게) */}
        <p
          className="relative mt-2 max-w-[760px] text-base md:text-[17px] leading-[1.85] text-ivory min-h-[2.4em] [text-shadow:0_1px_10px_rgb(0_0_0/0.85)] cursor-pointer"
          onClick={() => setShown(total)}
        >
          <span className="sr-only">{segments.map((seg) => seg.text).join(' ')}</span>
          <span aria-hidden className="invisible">{segments.map((seg) => seg.text).join(' ')}</span>
          <span aria-hidden className="absolute inset-0">
            {segments.map((seg, i) => {
              const take = Math.max(0, Math.min(seg.text.length, shown - starts[i]));
              if (take === 0) return null;
              return (
                <span key={i} className={seg.changed ? 'text-survive' : undefined}>
                  {seg.text.slice(0, take)}
                  {i < segments.length - 1 && take === seg.text.length ? ' ' : ''}
                </span>
              );
            })}
          </span>
        </p>

        {/* 제한시간 막대와 선택지는 처음부터 자리를 차지하고(보이지만 않음), 글이 끝나면 제자리에서 나타난다 */}
        <div
          className={`mt-3 max-w-[760px] h-[3px] rounded-full bg-white/10 overflow-hidden transition-opacity duration-300 ${timer && textDone && !chosen ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden
        >
          {timer && textDone && !chosen && (
            <div className="h-full bg-danger-text origin-left" style={{ animation: `cine-timer ${timer.seconds}s linear forwards` }} />
          )}
        </div>

        <div
          className={`mt-3 grid gap-2 max-w-[760px] transition-opacity duration-500 ${textDone ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!textDone}
          inert={!textDone || !!chosen}
        >
          {options.map((o) => (
            <button
              key={o.id}
              onClick={() => choose(o)}
              disabled={late(o)}
              tabIndex={textDone ? 0 : -1}
              className={`disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-deep-navy/70 disabled:hover:border-brass/45 flex items-start gap-3 text-left min-h-11 px-4 py-2.5 rounded-xl border text-ivory text-[15px] leading-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-bright-brass transition-all duration-500 ${
                chosen
                  ? chosen.id === o.id ? 'border-bright-brass bg-brass/25' : 'border-brass/20 bg-deep-navy/50 opacity-35'
                  : 'border-brass/45 bg-deep-navy/70 hover:bg-brass/15 hover:border-brass'
              }`}
            >
              {o.tag && (
                <span className={`shrink-0 mt-0.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${o.tag === 'memory' ? 'border-bright-brass text-bright-brass' : 'border-survive text-survive'}`}>
                  {TAG_LABEL[o.tag]}
                </span>
              )}
              <span className="flex-1">{o.label}{late(o) && <span className="block text-xs text-danger-text mt-0.5">시간이 늦었습니다 (마감 {wallClock(o.until!)})</span>}</span>
              {o.timeCost && !late(o) ? <span className="shrink-0 text-xs text-muted-ivory">−{o.timeCost}분</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
