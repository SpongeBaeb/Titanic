'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useQuizStore } from '@/store/quizStore';
import { storyAlive, storyLine } from '@/engine/boarding';
import ResultSheet from '@/components/result/ResultSheet';
import ProbTerminal from '@/components/result/ProbTerminal';
import { isNora, NORA, noraStory } from '@/engine/nora';
import MachineBase, { DeckBack, type KeyId } from '@/components/result/CardSlot';

/**
 * Q7·W2 가 끝난 뒤 결과지로 이어지는 다리.
 * 화면 전체가 초록 아날로그 단말기가 되어 확률이 오르내린 과정을 찍고, 그 화면 위에 결과지가 아래 사출구에서 밀려 올라온다.
 * 단말기 화면은 결과지 뒤에 그대로 남는다. 서버 응답이 아직이면 어두운 화면에서 기다린다.
 * 유형을 모를 때(성향 기록이 없는 경우)는 결과지 없이 바로 넘어간다.
 */

interface Props {
  answers: Record<string, unknown>;
  extras: Record<string, unknown>;
  /** 서버 결과 (오기 전에는 null) */
  stat: number | null;
  adjusted: number | null;
  typeKo?: string;
  typeEn?: string;
  line?: string;
  /** 유형 인장 번호 (1~15) */
  symbol?: number;
  axes?: number[];
  top?: [number, number];
  /** 이미 인쇄한 뒤라면 연출 없이 완성된 모습으로 */
  played?: boolean;
  onSettled?: () => void;
  children?: ReactNode;
  /** 아랫단 키패드: 결과가 다 나온 뒤에 켜진다 */
  /** 용지에 찍을 나의 항해 기록 */
  log?: { label: string; value: string }[];
  machine?: { ratio: string; onKey: (id: KeyId) => void; onToggleRatio: () => void };
  onDone: () => void;
}

export default function LedgerReveal({ answers, extras, stat, adjusted, typeKo, typeEn, line, symbol, axes, top, played, onSettled, children, log, machine, onDone }: Props) {
  const ready = stat !== null && adjusted !== null;
  const hasType = !!(typeKo && typeEn && line);
  const alive = ready ? storyAlive(extras, adjusted) : false;
  // 결과지를 인쇄하기 전에 단말기가 확률이 오르내린 과정을 찍는다 (이미 본 뒤라면 생략)
  const [terminal, setTerminal] = useState(!played);
  // 바로 앞에서 화면 전체의 CRT 켜짐이 나온 판(W2 에서 헤엄이 다했으나 못 닿은 쪽)은 단말기의 켜짐을 생략한다
  // 사용자가 입력한 이름 (결과지에 기재된다). 이미 본 뒤라면 저장된 이름을 쓴다
  const [playerName, setPlayerName] = useState(typeof extras.playerName === 'string' ? extras.playerName : '');
  const crtBefore = extras.w2Survived === false && extras.w2 !== 'sink';

  useEffect(() => {
    if (ready && !hasType) onDone();
  }, [ready, hasType, onDone]);

  const sheetOn = ready && hasType && !terminal;
  const nora = isNora(playerName); // 이스터에그: 이름에 노라를 넣으면 노라의 기록지와 이야기가 나온다
  const story = nora ? noraStory(extras) : null;
  // 노라의 기록을 보는 중에도 내 기록으로 바꿔 볼 수 있다 (바꿀 때는 인쇄 연출 없이 바로 보인다)
  const [view, setView] = useState<'nora' | 'mine'>('nora');
  const [swapped, setSwapped] = useState(false);
  const swap = (v: 'nora' | 'mine') => { setView(v); setSwapped(true); };
  const swapBtn = (label: string, to: 'nora' | 'mine') => (
    <button type="button" onClick={() => swap(to)} className="group mb-6 block text-left font-mono text-[13px] tracking-wide md:text-[15px]" style={{ color: to === 'nora' ? '#ffd9a0' : '#8dffc4' }}>
      <span className="opacity-70">&gt; </span><span className="underline underline-offset-4">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[75] overflow-hidden" style={{ background: '#020403' }}>
      {/* 플래시가 사그라든다: Q7 의 흰 화면에서 이어진다 */}
      {!played && !crtBefore && <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-[90] bg-white" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.9 }} />}

      {!ready && <p className="absolute inset-0 flex animate-pulse items-center justify-center text-center text-xs tracking-widest text-emerald-100/50">명부를 찾는 중…</p>}

      {ready && hasType && (
        <ProbTerminal answers={answers} extras={extras} stat={stat!} adjusted={adjusted!} noPowerOn={crtBefore} instant={played} dim={sheetOn} onDone={(n) => { if (n) { setPlayerName(n); useQuizStore.getState().setExtras({ playerName: n }); } setTerminal(false); }} />
      )}

      {sheetOn && (!nora || view === 'mine') && (
        <ResultSheet key={`mine-${swapped}`} typeKo={typeKo!} typeEn={typeEn!} line={line!} symbol={symbol} axes={axes} top={top} stat={stat!} adjusted={adjusted!} alive={alive} outcomeLine={storyLine(extras)} name={nora ? undefined : playerName} log={log} played={played || swapped} onSettled={onSettled}>
          {nora && swapBtn('노라의 기록 다시 보기', 'nora')}
          {children}
        </ResultSheet>
      )}
      {sheetOn && nora && story && view === 'nora' && (
        <ResultSheet key={`nora-${swapped}`} typeKo={NORA.typeKo} typeEn={NORA.typeEn} line={NORA.line} symbol={NORA.symbol} axes={[...NORA.axes]} top={NORA.top} stat={NORA.stat} adjusted={NORA.adjusted} alive={NORA.alive} outcomeLine={NORA.outcomeLine} name={NORA.typeKo} log={[...NORA.log]} played={played || swapped} onSettled={onSettled}>
          {/* 노라의 이야기: 호박빛 단말기 글씨로 찍힌다 */}
          <div className="mx-auto w-full max-w-[560px] px-2">{swapBtn('나의 기록 보기', 'mine')}</div>
          <div className="mx-auto mb-8 w-full max-w-[560px] px-2 text-left font-mono" style={{ color: '#ffd9a0', textShadow: '0 0 9px rgba(255,190,110,.45)' }}>
            <p className="mb-3 text-[12px] tracking-[0.4em] opacity-80">&gt; {story.title}</p>
            {story.paras.map((t, i) => <p key={i} className="mb-3 break-keep text-[13px] leading-relaxed md:text-[14px]">{t}</p>)}
            <p className="mt-5 border-t border-amber-200/20 pt-3 text-[11px] leading-relaxed opacity-60">&gt; {story.fiction}</p>
          </div>
          {children}
        </ResultSheet>
      )}

      {ready && hasType && <DeckBack settled={!!played} />}
      {ready && hasType && <MachineBase busy={sheetOn && !played} keysOn={!!played} ratio={machine?.ratio ?? '4:5'} onKey={machine?.onKey ?? (() => {})} onToggleRatio={machine?.onToggleRatio ?? (() => {})} />}
    </div>
  );
}
