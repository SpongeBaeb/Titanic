'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { probRows, verdictRows } from '@/engine/boarding';
import { playBlip, playTick } from '@/lib/synth';
import { PHOS } from '@/components/result/CardSlot';
import AnalogOverlay from '@/components/ui/AnalogOverlay';
import Typed from '@/components/result/Typed';
import { isNora } from '@/engine/nora';

/**
 * 결과지를 인쇄하기 전의 아날로그 단말기 화면 (인광 초록, 화면 전체).
 * 서버가 준 통계 확률에서 시작해 선택마다 한 줄씩 찍으며, 큰 확률 숫자와 막대가 그 줄을 따라 오르내린다.
 * 그 아래에 이야기 속 판정(탑승, 난간, 헤엄)을 찍고, 끝나면 onDone 으로 인쇄(ResultSheet)에 넘긴다.
 * 인쇄가 시작된 뒤에도 이 화면은 그대로 뒤에 남는다(dim). 이미 본 뒤라면(instant) 처음부터 다 찍힌 모습이다.
 */

const HI = '#d9ffec';
const LO = '#ff9d7a';

interface Props {
  answers: Record<string, unknown>;
  extras: Record<string, unknown>;
  stat: number;
  adjusted: number;
  /** 켜지는 연출을 생략한다 (바로 앞에서 화면 전체의 CRT 켜짐이 나온 경우) */
  noPowerOn?: boolean;
  /** 이미 본 뒤: 연출 없이 다 찍힌 모습 */
  instant?: boolean;
  /** 결과지가 위에 올라온 뒤: 어둡게 물러난다 */
  dim?: boolean;
  /** 이름을 입력했으면 이름과 함께, 건너뛰었으면 이름 없이 부른다 */
  onDone: (name?: string) => void;
}

export default function ProbTerminal({ answers, extras, stat, adjusted, noPowerOn, instant, dim, onDone }: Props) {
  const reduce = useReducedMotion();
  const rows = useMemo(() => probRows(answers, extras, stat, adjusted), [answers, extras, stat, adjusted]);
  const verdicts = useMemo(() => verdictRows(extras), [extras]);
  // 찍힌 줄 수: 0 = 머리말, 1 = 기준 줄, 2.. = 요인 줄, 그 뒤 최종 줄과 판정 줄
  const total = 2 + rows.length + 1 + verdicts.length;
  const [shown, setShown] = useState(instant ? total + 1 : 0);
  const [value, setValue] = useState(instant ? adjusted : stat);
  // 방금 찍힌 줄이 요인 줄이면 그 방향(오름/내림)으로 숫자가 물든다. 다음 줄이 찍힐 때까지 유지된다
  const active = rows[shown - 3];
  const dir: 'up' | 'down' | null = active ? (active.delta > 0 ? 'up' : 'down') : null;
  const cur = useRef(stat);
  const finished = useRef(!!instant);
  // 줄이 다 찍히면 이름을 묻고(ask), 입력을 받으면 확인 문구를 찍은 뒤(confirm) 인쇄로 넘어간다
  const [phase, setPhase] = useState<'run' | 'ask' | 'confirm'>('run');
  const [name, setName] = useState('');
  const done = (n?: string) => { if (!finished.current) { finished.current = true; onDone(n); } };
  const submit = () => {
    if (phase !== 'ask') return;
    const n = name.trim();
    setName(n);
    setPhase('confirm');
    // 이스터에그: 노라를 입력하면 명부에 없는 이름이라는 안내와 기록 조회가 더 길게 찍힌다
    setTimeout(() => done(n || undefined), reduce ? (isNora(n) ? 1800 : 700) : isNora(n) ? 7200 : 1600);
  };

  // 한 줄씩 찍는다
  useEffect(() => {
    if (instant) return;
    if (shown >= total) {
      const t = setTimeout(() => setPhase((p) => (p === 'run' ? 'ask' : p)), reduce ? 300 : 900);
      return () => clearTimeout(t);
    }
    const first = shown === 0 ? (noPowerOn || reduce ? 300 : 900) : 0;
    const t = setTimeout(() => setShown((n) => n + 1), first + (reduce ? 260 : shown < 2 ? 700 : 1050));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, total, reduce, noPowerOn, instant]);

  // 요인 줄이 찍히면 큰 숫자가 그 값으로 굴러간다
  useEffect(() => {
    if (instant) return;
    const i = shown - 3; // 방금 찍힌 요인 줄
    if (i < 0 || i >= rows.length) { if (shown > 0) playTick(); return; }
    const from = cur.current;
    const to = rows[i].after;
    cur.current = to;
    playBlip(rows[i].delta > 0);
    if (reduce) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 500);
      setValue(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, rows, reduce, instant]);

  const tone = dir === 'up' ? HI : dir === 'down' ? LO : PHOS;
  const fmt = (n: number) => n.toFixed(1);
  // 움직임 줄이기: 굴리지 않고 그 줄의 값을 바로 보인다
  const big = instant ? adjusted : shown < 2 ? stat : reduce ? (rows[Math.min(shown - 3, rows.length - 1)]?.after ?? stat) : value;

  return (
    <motion.div
      className="fixed inset-0 z-[75] overflow-hidden font-mono"
      style={{ background: 'radial-gradient(ellipse at 50% 42%, #0e1f18 0%, #07100c 62%, #020403 100%)', color: PHOS, textShadow: '0 0 9px rgba(120,255,190,.5)', paddingBottom: 'var(--machine-h, 300px)' }}
      initial={noPowerOn || reduce || instant ? { opacity: 0 } : { scaleY: 0.006, opacity: 1, filter: 'brightness(3) blur(0px)' }}
      animate={{ scaleY: 1, opacity: 1, filter: dim ? 'brightness(.55) blur(1px)' : 'brightness(1) blur(0px)', x: 0 }}
      transition={{ scaleY: { duration: 0.5, ease: [0.2, 0.9, 0.2, 1] }, filter: { duration: dim ? 1.2 : 0.8 }, opacity: { duration: 0.4 } }}
    >
      <div className="mx-auto flex h-full w-full max-w-[860px] flex-col justify-center px-6 transition-opacity duration-1000 md:px-10" style={{ opacity: dim ? 0.32 : 1, transform: 'translateY(calc(var(--sheet-scroll, 0px) * -1))', willChange: 'transform' }}>
        {/* 큰 확률 숫자와 막대 */}
        <div className="mb-5 text-center">
          <p className="text-[11px] tracking-[0.5em] opacity-70 md:text-xs">SURVIVAL PROBABILITY</p>
          <p className="font-bold tabular-nums transition-colors duration-200" style={{ color: tone, fontSize: 'clamp(56px, 12vw, 128px)', lineHeight: 1.05 }}>
            {dir === 'up' ? '▲ ' : dir === 'down' ? '▼ ' : ''}{fmt(big)}<span style={{ fontSize: '0.4em' }}> %</span>
          </p>
          <div className="mx-auto mt-3 h-4 w-full max-w-[560px] border" style={{ borderColor: 'rgba(141,255,196,.5)' }}>
            <div className="h-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, big))}%`, background: tone, boxShadow: `0 0 12px ${tone}` }} />
          </div>
        </div>

        <div className="space-y-1.5 text-[13px] leading-relaxed md:text-[15px]">
          {shown >= 1 && <p className="opacity-70"><Typed text="> 승객 명부 조회 … 기록 대조 … 완료" speed={16} instant={instant} /></p>}
          {shown >= 2 && <Row label="기준: 1912년 승객 통계 (성별·객실·나이)" right={`${fmt(stat)} %`} instant={instant} />}
          {rows.map((r, i) => shown >= 3 + i && (
            <Row key={r.label} color={r.delta > 0 ? HI : LO} instant={instant}
              label={`${r.delta > 0 ? '▲' : '▼'} ${r.label}`}
              right={`${r.delta > 0 ? '+' : '−'}${fmt(Math.abs(r.delta)).padStart(5, ' ')}  →  ${fmt(r.after).padStart(5, ' ')} %`} />
          ))}
          {shown >= 3 + rows.length && (
            <>
              <p aria-hidden className="overflow-hidden whitespace-nowrap opacity-50">────────────────────────────────────────────────────────────</p>
              <Row label="최종 생존 확률" right={`${fmt(adjusted)} %`} bold instant={instant} />
            </>
          )}
          {verdicts.map((v, i) => shown >= 4 + rows.length + i && (
            <Row key={v.label} label={`> ${v.label}`} right={v.value} color={v.good ? HI : LO} instant={instant} />
          ))}
          {phase !== 'run' && !instant && (
            <div className="pt-3">
              <p className="opacity-85"><Typed text="> 승객 성명을 입력하십시오. (결과지에 기재됩니다)" speed={26} /></p>
              {phase === 'ask' ? (
                <form className="mt-1 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                  <span className="opacity-70">&gt;</span>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 12))}
                    maxLength={12}
                    placeholder="이름"
                    aria-label="승객 성명"
                    className="w-[16ch] border-b border-emerald-300/50 bg-transparent px-1 text-inherit outline-none placeholder:text-emerald-200/30"
                    style={{ caretColor: PHOS, textShadow: 'inherit' }}
                  />
                  <button type="submit" className="rounded border border-emerald-200/40 px-3 py-0.5 text-[12px] tracking-widest text-emerald-100/80 hover:bg-emerald-900/30">확인</button>
                  <span className="text-[11px] opacity-50">비워 두고 Enter 로 건너뛰기</span>
                </form>
              ) : (
                isNora(name) ? (
                  // 이스터에그: 명부에 없는 이름. 화면이 한 번 흔들리고 기록이 호박빛으로 바뀐다
                  <div className="mt-1 space-y-1" style={{ color: '#ffd9a0', textShadow: '0 0 9px rgba(255,190,110,.55)' }}>
                    <motion.p animate={reduce ? undefined : { opacity: [1, 0.2, 1, 0.5, 1] }} transition={{ duration: 0.9, delay: 0.1 }}><Typed text="> 성명 접수: 노라." speed={32} /></motion.p>
                    <p><Typed text="> 승객 명부 대조 … 일치하는 기록 없음." delay={1.3} speed={30} /></p>
                    <p><Typed text="> 다른 기록을 찾았습니다. 퀸스타운 승선, 3등석, 스물네 살." delay={3.0} speed={30} /></p>
                    <p><Typed text="> 난간에서 당신 곁에 있던 사람의 기록을 인쇄합니다 …" delay={5.0} speed={30} /></p>
                  </div>
                ) : (
                  <p className="mt-1 opacity-85"><Typed text={name ? `> 성명 접수: ${name}. 기록을 인쇄합니다 …` : '> 성명 생략. 기록을 인쇄합니다 …'} speed={32} /></p>
                )
              )}
            </div>
          )}
          {phase === 'run' && shown < total && <span className="inline-block h-4 w-2.5 animate-pulse" style={{ background: PHOS }} />}
        </div>
      </div>

      {/* 아날로그 화면의 지직거림: 잡음, 위아래로 오가는 흰 번짐, 미세한 깜빡임, 주사선. 결과지는 이 위(더 높은 층)에 있어 영향을 받지 않는다 */}
      <AnalogOverlay delay={instant ? 0 : 0.1} duration={instant ? 0.6 : 1.2} z={5} />

      {!instant && !dim && (
        <button type="button" onClick={() => done()} className="absolute right-4 rounded border border-emerald-200/30 px-3 py-1 text-[11px] tracking-widest text-emerald-100/60 hover:bg-emerald-900/30" style={{ bottom: 'calc(var(--machine-h, 300px) + 14px)' }}>
          건너뛰기
        </button>
      )}
    </motion.div>
  );
}

function Row({ label, right, color, bold, instant }: { label: string; right: string; color?: string; bold?: boolean; instant?: boolean }) {
  // 왼쪽 문구가 한 자씩 찍힌 뒤 오른쪽 값이 나타난다
  const speed = 15;
  return (
    <p className={`flex items-baseline justify-between gap-3 ${bold ? 'text-[17px] font-bold md:text-[19px]' : ''}`} style={{ color }}>
      <span className="min-w-0 break-keep"><Typed text={label} speed={speed} instant={instant} /></span>
      <motion.span className="shrink-0 whitespace-pre tabular-nums" initial={instant ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: instant ? 0 : (label.length * speed) / 1000, duration: 0.15 }}>{right}</motion.span>
    </p>
  );
}
