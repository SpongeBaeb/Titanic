'use client';

import { useEffect, useState } from 'react';
import { bagItemNames, SINK_AFTER_MIN, wallClock } from '@/engine/cinematic';
import type { Flags } from '@/engine/types';

interface Props {
  flags: Flags;
  extras?: Record<string, unknown>;
  /** 마지막 선택을 마친 시점의 충돌 후 경과 분 */
  endElapsed: number;
}

/** 선택이 남긴 흔적을 전보 문체로 요약한다. 전보는 게임용 허구이며 실제 기록이 아니다. */
export function telegramLines(flags: Flags, extras: Record<string, unknown> | undefined): string[] {
  const lines: string[] = [];
  lines.push(flags.boat ? '구명정에 올랐음' : '끝까지 갑판에 남았음');
  if (flags.helpedChild) lines.push('이웃집 아이를 먼저 태웠음');
  else if (flags.neighbor) lines.push('이웃을 깨웠으나 곁에 두지 못했음');
  if (flags.led) lines.push('줄을 정리하며 사람들을 안내했음');
  if (flags.helpedOther) lines.push('곁의 약한 사람을 앞으로 보냈음');
  if (flags.vest) lines.push('구명조끼를 입고 곧장 나섰음');
  if (flags.waited) lines.push('움직이기 전에 기다렸음');
  if (flags.droppedBag) lines.push('가방을 버리고 뛰었음');
  else if (flags.bag) lines.push('짐을 챙겼음');
  if (flags.crewTip) lines.push('선원에게 구명정 위치를 물었음');
  if (flags.together) lines.push('곁의 사람 손을 잡고 끝까지 함께했음');
  if (flags.leadUp) lines.push('사람들을 이끌어 높은 갑판으로 향했음');
  if (flags.highGround) lines.push('가장 높은 곳에서 상황을 살폈음');
  if (flags.jumped) lines.push('물에 뛰어들 준비를 했음');
  if (flags.rowed) lines.push('배에서 멀어지도록 노를 저었음');
  if (flags.lookedBack) lines.push('물에 빠진 사람이 있는지 살폈음');
  if (flags.watched) lines.push('가라앉는 배를 끝까지 지켜보았음');
  if (flags.hesitated) lines.push('결정하지 못한 순간이 있었음');
  const items = bagItemNames(extras);
  if (items.length) lines.push(`가방에 ${items.join(', ')} 있었음`);
  return lines;
}

export default function TelegramCard({ flags, extras, endElapsed }: Props) {
  const lines = telegramLines(flags, extras);
  const full = lines.join(' STOP ') + ' STOP';
  const [shown, setShown] = useState(0);

  // 전신기처럼 한 글자씩 찍힌다
  useEffect(() => {
    if (shown >= full.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), 28);
    return () => clearTimeout(id);
  }, [shown, full.length]);

  const left = Math.max(0, Math.round(SINK_AFTER_MIN - endElapsed));

  return (
    <figure
      className="relative mx-auto max-w-[520px] rotate-[-1deg] bg-[#EADFC6] text-[#2b2418] shadow-[0_10px_40px_rgba(0,0,0,.6)] p-5 [background-image:repeating-linear-gradient(0deg,transparent_0_27px,rgba(80,60,30,.08)_27px_28px)]"
      aria-label="당신의 밤을 요약한 전보 (게임용 허구)"
    >
      <div className="flex items-baseline justify-between border-b border-[#2b2418]/40 pb-2 font-display text-xs tracking-[0.2em]">
        <span>MARCONIGRAM</span>
        <span>R.M.S. TITANIC</span>
      </div>
      <div className="mt-2 text-xs tracking-wide text-[#5a4a30]">
        15 APR · {wallClock(endElapsed)} · {left > 0 ? `침몰 ${left}분 전` : '침몰 시각 경과'}
      </div>
      <p className="mt-3 font-mono text-[15px] leading-[1.9] break-keep min-h-[8em]">
        {full.slice(0, shown)}
        <span className="inline-block w-[0.5ch] animate-pulse">▌</span>
      </p>
      <figcaption className="mt-3 text-right text-xs text-[#5a4a30]">※ 게임 속 허구의 전보입니다</figcaption>
    </figure>
  );
}
