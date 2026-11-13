'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import TraitHexagon from '@/components/ui/TraitHexagon';
import { slotCenter } from '@/components/result/CardSlot';
import { playBlip, playStamp, playTelegramPrint } from '@/lib/synth';
import { COMPAT, typeByKo, type CompatEntry } from '@/engine/traits';

/**
 * 결과 화면 (결과지 + 자세히 보기를 한 화면으로 합쳤다).
 * 마지막 질문이 끝나면 화면이 아날로그(기계 쪽)로 바뀌고, 전보 용지가 아래 틈에서 한 줄씩 끊어 가며 밀려 올라온다.
 * 용지에는 유형 인장(public/result/symbol_XX.webp, 검은 잉크 그림을 마스크로 쓰고 색을 입힌다)·이름·성향 육각형·확률이 있고,
 * 이야기 속 결과에 따라 SURVIVED / PERISHED 도장이 찍힌다. 용지 양옆으로 잘 맞는 유형(왼쪽)과 안 맞는 유형(오른쪽) 궁합 쪽지가 나온다.
 * 용지 아래로는 나의 항해 기록 등(children)이 이어지고, 화면은 위아래로 넘겨 볼 수 있다.
 * played: 이미 한 번 인쇄한 뒤(승객 보기에서 돌아온 경우, 공유 링크)에는 인쇄·도장 연출 없이 완성된 모습으로 바로 보인다.
 */

const PRINT_STEPS = 9;
const PRINT_DUR = 3.2;
// 종이가 아래 틈에서 한 줄씩 끊어 올라온다: 100% (틈 속) → 0% (다 나옴)
const { PRINT_Y, PRINT_TIMES } = (() => {
  const y: string[] = ['100%'];
  const t: number[] = [0];
  for (let i = 1; i <= PRINT_STEPS; i++) {
    y.push(`${(1 - (i - 1) / PRINT_STEPS) * 100}%`);
    t.push((i - 1 + 0.55) / PRINT_STEPS);
    y.push(`${(1 - i / PRINT_STEPS) * 100}%`);
    t.push(i / PRINT_STEPS);
  }
  return { PRINT_Y: y, PRINT_TIMES: t };
})();

/** 유형 인장 색 (번호 1~15): 잉크병에서 찍은 듯 어두운 색 */
const INK = ['#1f3a5f', '#6b3a12', '#2d4a52', '#5b3a2a', '#23424a', '#1d3d34', '#6a2a3a', '#4a3a6a', '#2f5a3a', '#7a2a1a', '#3a3a52', '#5a2a52', '#7a4a12', '#4a4a4a', '#8a2a14'];

/** 검은 잉크 그림에 색을 입힌다 (그림을 마스크로 쓴다) */
function Ink({ src, color, className = '', style }: { src: string; color: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div aria-hidden className={className} style={{ background: color, WebkitMask: `url('${src}') center / contain no-repeat`, mask: `url('${src}') center / contain no-repeat`, ...style }} />
  );
}

/** 궁합 쪽지: 아래 사출구에서 퐁 튀어나와 제 자리로 날아와 앉는다 (instant 면 처음부터 제자리) */
export function CompatSlip({ kind, entry, delay, instant = false }: { kind: 'good' | 'bad'; entry: CompatEntry; delay: number; instant?: boolean }) {
  const t = typeByKo(entry.ko);
  const sym = t?.symbol ?? 16;
  const good = kind === 'good';
  const ref = useRef<HTMLDivElement>(null);
  // 제자리에서 사출구까지의 거리: 처음 놓인 위치를 재어 그 점에서 출발시킨다
  const [from, setFrom] = useState<{ x: number; y: number } | null>(instant ? { x: 0, y: 0 } : null);
  useLayoutEffect(() => {
    if (from || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const s = slotCenter();
    setFrom({ x: s.x - (r.left + r.width / 2), y: s.y - (r.top + r.height / 2) });
  }, [from]);
  useEffect(() => {
    if (instant || !from) return;
    const id = setTimeout(() => playBlip(true), delay * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!from]);
  const rest = good ? -1.2 : 1.2;
  return (
    <motion.div
      key={from ? 'go' : 'measure'}
      ref={ref}
      initial={instant ? false : { opacity: 0, x: from?.x ?? 0, y: from?.y ?? 0, scale: 0.3, rotate: good ? -28 : 28 }}
      animate={from ? { opacity: 1, x: 0, y: 0, scale: 1, rotate: rest } : undefined}
      transition={instant ? { duration: 0 } : { delay, type: 'spring', stiffness: 150, damping: 9, mass: 0.9, opacity: { delay, duration: 0.12 } }}
      className="relative z-[84] flex w-full items-center gap-[4%] font-serif text-[#2c2115]"
      style={{ aspectRatio: '1656 / 530', backgroundImage: "url('/ui/machine/tagcard.webp')", backgroundSize: '100% 100%', padding: '9% 9% 6% 8%', filter: 'drop-shadow(0 10px 14px rgba(0,0,0,.6))' }}
    >
      <Ink src={`/result/symbol_${String(sym).padStart(2, '0')}.webp`} color={INK[(sym - 1) % INK.length]} className="shrink-0" style={{ aspectRatio: '1', width: '19%' }} />
      <div className="min-w-0 text-left">
        <p className="text-[10px] font-bold tracking-[0.18em]" style={{ color: good ? '#2d6a45' : '#8a2a1a' }}>{good ? '잘 맞는 유형' : '안 맞는 유형'}</p>
        <p className="text-base font-black leading-tight">{entry.ko}</p>
        <p className="mt-0.5 break-keep text-[11px] leading-snug text-[#5c4326]">{entry.why}</p>
      </div>
    </motion.div>
  );
}

interface Props {
  typeKo: string;
  typeEn: string;
  line: string;
  symbol?: number;
  /** 성향 육각형 (축 순서대로 0~100)과 강조할 두 축 */
  axes?: number[];
  top?: [number, number];
  stat: number;
  adjusted: number;
  alive: boolean;
  /** 이야기 속 결과 한 줄 (예: 구명정에 탔다) */
  outcomeLine?: string | null;
  /** 나의 항해 기록: 용지 아래쪽에 전보 문구처럼 찍힌다 */
  log?: { label: string; value: string }[];
  /** 사용자가 입력한 이름 */
  name?: string;
  /** 이미 인쇄한 뒤라면 연출 없이 완성된 모습으로 보인다 */
  played?: boolean;
  /** 도장까지 다 찍혀 연출이 끝났을 때 (이후 다시 열면 played 로 보인다) */
  onSettled?: () => void;
  /** 용지 아래에 이어지는 내용 (항해 기록, 닮은 승객 보기, 새 여정 등) */
  children?: ReactNode;
}

export default function ResultSheet({ typeKo, typeEn, line, symbol = 16, axes, top, stat, adjusted, alive, outcomeLine, log, name, played = false, onSettled, children }: Props) {
  const reduce = useReducedMotion();
  // 처음 열 때의 값으로 정한다: 인쇄가 끝나 played 가 바뀌어도 이미 보이는 화면이 다시 연출되거나 바뀌지 않는다
  const [instant] = useState(played || !!reduce);
  const [stamped, setStamped] = useState(instant);
  const [slips, setSlips] = useState(instant);
  const [rest, setRest] = useState(instant);
  const scroller = useRef<HTMLDivElement>(null);
  // 뒤의 아날로그 화면이 같이 스크롤되도록 스크롤 양을 바깥에 알린다
  useEffect(() => () => { document.documentElement.style.removeProperty('--sheet-scroll'); }, []);
  const compat = COMPAT[typeKo];
  const ink = INK[(symbol - 1) % INK.length];
  const stampInk = alive ? '#1d5a38' : '#8a1f1a';

  useEffect(() => {
    if (instant) { if (!played) onSettled?.(); return; } // 움직임을 줄인 설정: 연출 없이 바로 완성된 모습이라 곧바로 끝난 것으로 본다
    const ts: ReturnType<typeof setTimeout>[] = [];
    if (!reduce) playTelegramPrint(PRINT_STEPS, PRINT_DUR);
    ts.push(setTimeout(() => { setStamped(true); playStamp(); }, (reduce ? 0.4 : PRINT_DUR + 0.9) * 1000));
    ts.push(setTimeout(() => setSlips(true), (reduce ? 0.8 : PRINT_DUR + 1.7) * 1000));
    ts.push(setTimeout(() => { setRest(true); onSettled?.(); }, (reduce ? 1.2 : PRINT_DUR + 2.6) * 1000));
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lineDelay = (i: number) => (instant ? 0 : PRINT_DUR * (0.5 + i * 0.07));
  const fade = (i: number) => (instant ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: lineDelay(i), duration: 0.25 } });
  const H = 'min(125vh, 960px)'; // 용지 높이: 육각형까지 들어가므로 화면보다 길고, 화면은 위아래로 넘겨 본다

  return (
    // 단말기 화면 위에 그대로 올라온다: 배경도, 주사선·잡음·깜빡임 덮개도 없다
    <div ref={scroller} onScroll={(e) => document.documentElement.style.setProperty('--sheet-scroll', `${e.currentTarget.scrollTop}px`)} className="fixed inset-0 z-[76] overflow-y-auto overflow-x-hidden" style={{ paddingBottom: 'var(--machine-h, 300px)' }}>
      <div className="relative z-[77] mx-auto flex min-h-full w-full max-w-6xl flex-col items-center px-3 pb-56 pt-10 md:pt-14">
        <div className="flex w-full items-start justify-center gap-5 md:gap-8">
          {/* 왼쪽: 잘 맞는 유형 */}
          <div className="hidden w-[min(24vw,290px)] shrink-0 flex-col gap-3 self-start sticky top-[12vh] pt-[2vh] md:flex">
            {slips && compat && compat.good.map((g, i) => <CompatSlip key={g.ko} kind="good" entry={g} delay={instant ? 0 : i * 0.3} instant={instant} />)}
          </div>

          {/* 가운데: 결과지가 아래 틈에서 밀려 올라온다 */}
          <div className="relative shrink-0 overflow-hidden" style={{ height: H, aspectRatio: '510 / 1035' }}>
            <motion.div
              id="result-paper"
              className="absolute inset-0"
              initial={{ y: instant ? '0%' : '100%' }}
              animate={{ y: instant ? '0%' : PRINT_Y }}
              transition={instant ? { duration: 0 } : { duration: PRINT_DUR, times: PRINT_TIMES, ease: 'easeOut' }}
            >
              <div
                className="relative h-full w-full text-center"
                style={{
                  containerType: 'inline-size',
                  backgroundImage: "url('/ui/age_telegram_paper.webp')",
                  backgroundSize: '100% 100%',
                  backgroundRepeat: 'no-repeat',
                  padding: '13% 10% 12%',
                  filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.55))',
                  color: '#2a1708',
                }}
              >
                <motion.div {...fade(0)} className="font-display font-semibold leading-snug tracking-[0.18em] text-[#5a4524]" style={{ fontSize: '3.2cqw' }}>WHITE STAR LINE<br />PASSENGER RECORD</motion.div>
                <div className="mx-auto my-[2cqw] h-px w-3/4 bg-[#5a4524]/50" />
                {name && (
                  <motion.p {...fade(0)} className="flex items-baseline justify-center gap-[2cqw] text-[#2a1708]" style={{ marginTop: '-0.6cqw', marginBottom: '1cqw' }}>
                    <span className="font-mono tracking-[0.18em] text-[#6a5128]" style={{ fontSize: '2.3cqw' }}>탑승객</span>
                    <span className="font-title font-bold" style={{ fontSize: `${Math.min(5, 36 / Math.max(4, name.length * 1.1))}cqw` }}>{name}</span>
                  </motion.p>
                )}

                <motion.div {...fade(1)} className="mx-auto" style={{ width: '28cqw' }}>
                  <Ink src={`/result/symbol_${String(symbol).padStart(2, '0')}.webp`} color={ink} className="aspect-square w-full" />
                </motion.div>
                <motion.p {...fade(2)} className="font-mono tracking-[0.2em] text-[#4a3a1c]" style={{ fontSize: '2.6cqw', marginTop: '0.6cqw' }}>{symbol > 15 ? 'SPECIAL RECORD' : `No. ${String(symbol).padStart(2, '0')} / 15`}</motion.p>

                <motion.p {...fade(3)} className="font-sans uppercase tracking-[0.3em] text-[#6a5128]" style={{ fontSize: '2.5cqw', marginTop: '2cqw' }}>{typeEn}</motion.p>
                <motion.h2 {...fade(3)} className="font-title font-bold leading-tight" style={{ fontSize: `${Math.min(9, 54 / Math.max(4, typeKo.replace(/\s/g, '').length))}cqw`, marginTop: '0.4cqw' }}>{typeKo}</motion.h2>
                <motion.p {...fade(4)} className="mx-auto break-keep font-serif italic leading-snug text-[#3a2a14]" style={{ fontSize: '3.3cqw', marginTop: '1.6cqw', maxWidth: '90%' }}>“{line}”</motion.p>

                {axes && top && (
                  <motion.div {...fade(5)} className="mx-auto" style={{ width: log && log.length ? '74%' : '88%', marginTop: '0.4cqw' }}>
                    <TraitHexagon values={axes} top={top} tone="paper" duration={instant ? 0.01 : 1.6} delay={instant ? 0 : PRINT_DUR * 0.8} />
                  </motion.div>
                )}

                <div className="mx-auto my-[1.6cqw] h-px w-3/4 bg-[#5a4524]/50" />
                <motion.div {...fade(6)} className="flex items-end justify-center gap-[4cqw]">
                  <div className="text-left">
                    <p className="font-mono tracking-[0.1em] text-[#5a4524]" style={{ fontSize: '2.2cqw' }}>타고난 확률</p>
                    <p className="font-numeric font-bold" style={{ fontSize: '6.4cqw', lineHeight: 1.1 }}>{stat}%</p>
                  </div>
                  <span className="pb-[0.8cqw] text-[#5a4524]" style={{ fontSize: '5.4cqw' }}>→</span>
                  <div className="text-left">
                    <p className="font-mono tracking-[0.1em] text-[#5a4524]" style={{ fontSize: '2.2cqw' }}>그날 밤 이후</p>
                    <p className="font-numeric font-black" style={{ fontSize: '9cqw', lineHeight: 1 }}>{adjusted}%</p>
                  </div>
                </motion.div>
                {outcomeLine && <motion.p {...fade(7)} className="font-mono tracking-[0.06em] text-[#4a3a1c]" style={{ fontSize: '2.5cqw', marginTop: '1.4cqw' }}>{outcomeLine}</motion.p>}
                {/* 나의 항해 기록: 전보 용지에 찍힌 항목. 오른쪽 아래의 도장 자리를 비워 둔다 */}
                {log && log.length > 0 && (
                  <motion.div {...fade(8)} className="text-left font-mono text-[#3a2c14]" style={{ width: '66%', marginTop: '2cqw', fontSize: '2.5cqw', lineHeight: 1.4 }}>
                    <p className="tracking-[0.2em] text-[#5a4524]" style={{ fontSize: '2.5cqw', borderBottom: '1px solid rgba(90,69,36,.45)', paddingBottom: '0.5cqw', marginBottom: '0.8cqw' }}>나의 항해 기록</p>
                    {log.map((r) => (
                      <p key={r.label} className="flex gap-[1.4cqw]"><span className="shrink-0 text-[#6a5128]" style={{ width: '10cqw' }}>{r.label}</span><span className="min-w-0 break-keep">{r.value}</span></p>
                    ))}
                  </motion.div>
                )}

                {/* 판정 도장: 이야기 속 결과에 따라 찍힌다 */}
                <AnimatePresence>
                  {stamped && (
                    <motion.div
                      className="pointer-events-none absolute"
                      style={{ right: '4%', bottom: '7%', width: '34cqw', aspectRatio: '1' }}
                      initial={instant ? { scale: 1, opacity: 0.93, rotate: -12 } : { scale: 2.6, opacity: 0, rotate: -30 }}
                      animate={{ scale: 1, opacity: 0.93, rotate: -12 }}
                      transition={{ duration: instant ? 0 : 0.3, ease: 'easeIn' }}
                    >
                      <Ink src={`/result/stamp_${alive ? 'survived' : 'perished'}.webp`} color={stampInk} className="absolute inset-0" />
                      <div className="absolute inset-x-0 flex flex-col items-center justify-center font-display font-black" style={{ top: '38%', height: '24%', color: stampInk }}>
                        <span style={{ fontSize: '4.4cqw', letterSpacing: '0.14em', lineHeight: 1 }}>{alive ? 'SURVIVED' : 'PERISHED'}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* 오른쪽: 안 맞는 유형 */}
          <div className="hidden w-[min(24vw,290px)] shrink-0 flex-col gap-3 self-start sticky top-[12vh] pt-[2vh] md:flex">
            {slips && compat && <CompatSlip kind="bad" entry={compat.bad} delay={instant ? 0 : 0.15} instant={instant} />}
          </div>
        </div>

        {/* 좁은 화면: 궁합 쪽지는 용지 아래로 내려온다 */}
        {slips && compat && (
          <div className="mt-6 flex w-full max-w-md flex-col gap-3 md:hidden">
            {compat.good.map((g, i) => <CompatSlip key={g.ko} kind="good" entry={g} delay={instant ? 0 : i * 0.3} instant={instant} />)}
            <CompatSlip kind="bad" entry={compat.bad} delay={instant ? 0 : 0.6} instant={instant} />
          </div>
        )}

        {/* 용지 아래: 항해 기록, 닮은 승객, 새 여정 등 */}
        {rest && children && (
          <motion.div initial={instant ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mt-10 w-full max-w-xl">
            {children}
          </motion.div>
        )}
      </div>

    </div>
  );
}
