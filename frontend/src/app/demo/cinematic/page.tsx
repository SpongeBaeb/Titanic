'use client';

import { useState, useSyncExternalStore } from 'react';
import { notFound } from 'next/navigation';
import CinematicPanel from '@/components/cinematic/CinematicPanel';
import { demoScenes } from '@/engine/demoScenes';
import { loadRuns, completeRun } from '@/engine/memory';
import { emitPick } from '@/engine/events';
import { soundManager } from '@/lib/sound';
import type { CineOption } from '@/engine/cinematic';
import { SINK_AFTER_MIN } from '@/engine/cinematic';
import type { Ctx, Flags, Pick } from '@/engine/types';

// 개발 전용 데모 (운영 빌드에서는 404). 문구는 초안.
export default function CinematicDemo() {
  if (process.env.NODE_ENV !== 'development') notFound();

  const [idx, setIdx] = useState(0);
  const [flags, setFlags] = useState<Flags>({});
  const [picks, setPicks] = useState<Pick[]>([]);
  const [spent, setSpent] = useState(0);
  const [, forceRender] = useState(0);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [done, setDone] = useState(false);
  const [muted, setMuted] = useState(true);
  // 앞부분(Q2 동행, Q4 가방)에서 골랐다고 가정하는 값 — 밤 장면의 반향이 어떻게 달라지는지 비교용
  const [companion, setCompanion] = useState('family');
  const [bagItems, setBagItems] = useState<string[]>(['shop2', 'shop4']);

  // 저장된 회차는 클라이언트에서만 읽는다 (서버 렌더는 1회차로 고정해 어긋나지 않게)
  const storedRuns = useSyncExternalStore(() => () => {}, () => loadRuns(), () => 0);
  const run = storedRuns + 1;

  const ctx: Ctx = { answers: { companion }, flags, picks, run, elapsed: demoScenes[idx].at + spent, extras: { bagItems } };
  const scene = demoScenes[idx];

  const onChoose = (o: CineOption, ms: number) => {
    emitPick({ run, scene: scene.id, value: o.id, ms });
    setFlags((f) => ({ ...f, ...(o.sets ?? {}) }));
    setPicks((p) => [...p, { scene: scene.id, value: o.id }]);
    setSpent((n) => n + (o.timeCost ?? 0));
    if (idx + 1 < demoScenes.length) setIdx(idx + 1);
    else { setDone(true); completeRun(); forceRender((n) => n + 1); }
  };

  const restart = () => { setIdx(0); setFlags({}); setPicks([]); setSpent(0); setDone(false); };

  return (
    <main className="min-h-screen bg-ocean-black text-ivory px-3 py-5">
      <div className="max-w-[960px] mx-auto mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-ivory">
        <span>장면 패널 데모 (개발 전용) · {run}번째 밤</span>
        <button
          onClick={() => { soundManager.setMute(!muted); setMuted(!muted); }}
          className="min-h-11 px-3 rounded border border-white/20 text-ivory"
        >
          소리 {muted ? '켜기' : '끄기'}
        </button>
        <label className="flex items-center gap-2 min-h-11">
          <input type="checkbox" checked={!timerEnabled} onChange={(e) => setTimerEnabled(!e.target.checked)} />
          제한시간 끄기
        </label>
      </div>

      <div className="max-w-[960px] mx-auto mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-ivory">
        <span className="text-ivory">앞부분 선택 가정</span>
        <label className="flex items-center gap-2 min-h-11">동행
          <select
            value={companion}
            onChange={(e) => setCompanion(e.target.value)}
            disabled={picks.length > 0 && !done}
            className="bg-deep-navy text-ivory border border-white/20 rounded px-2 py-1"
          >
            <option value="alone">혼자</option>
            <option value="partner">연인/배우자</option>
            <option value="friends">친구/형제자매</option>
            <option value="family">가족</option>
          </select>
        </label>
        <span className="flex flex-wrap items-center gap-x-3">가방에 담은 기념품
          {([['shop1', '칼'], ['shop2', '찻잔'], ['shop3', '모자 리본'], ['shop4', '열쇠고리']] as const).map(([id, name]) => (
            <label key={id} className="flex items-center gap-1 min-h-11">
              <input
                type="checkbox"
                checked={bagItems.includes(id)}
                disabled={picks.length > 0 && !done}
                onChange={(e) => setBagItems((l) => (e.target.checked ? [...l, id] : l.filter((x) => x !== id)))}
              />
              {name}
            </label>
          ))}
        </span>
        <span className="text-xs">(시작 후에는 잠김)</span>
      </div>

      {done ? (
        <div className="max-w-[960px] mx-auto rounded-xl border border-white/10 p-6">
          <h2 className="font-title text-xl font-bold">당신의 밤</h2>
          <ul className="mt-3 grid gap-1 text-[15px] leading-relaxed">
            {picks.map((p) => <li key={p.scene}>· {p.scene}: {p.value}</li>)}
          </ul>
          <p className="mt-3 text-[15px]">
            {demoScenes[demoScenes.length - 1].at + spent >= SINK_AFTER_MIN
              ? '결정을 마치기 전에 배가 가라앉았습니다.'
              : `침몰 ${SINK_AFTER_MIN - (demoScenes[demoScenes.length - 1].at + spent)}분 전, 당신은 마지막 선택을 마쳤습니다.`}
          </p>
          <p className="mt-3 text-muted-ivory text-sm">선택에 쓴 시간: {spent}분 · 기억한 사건: {Object.keys(flags).join(', ') || '없음'}</p>
          <button onClick={restart} className="mt-4 min-h-11 px-5 rounded-full bg-brass text-ocean-black font-bold">다른 선택으로 다시 ({run}번째 밤)</button>
        </div>
      ) : (
        <CinematicPanel elapsed={scene.at + spent}
          nextElapsed={(o) => { const next = demoScenes[idx + 1]; return next ? next.at + spent + (o.timeCost ?? 0) : undefined; }} key={`${scene.id}-${run}-${picks.length}`} scene={scene} ctx={ctx} timerEnabled={timerEnabled} onChoose={onChoose} />
      )}
    </main>
  );
}
