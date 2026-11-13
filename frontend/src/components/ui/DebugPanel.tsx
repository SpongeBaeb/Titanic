'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuizStore } from '@/store/quizStore';
import { scenes, sceneIds, PROLOGUE, RESULT, CHAPTERS } from '@/engine/scenes';
import { samplePicks } from '@/engine/traits';
import { ResultFx } from '@/components/question/money/CasinoModal';
import { MACHINE_CFG, MACHINE_META, setMachine, resetMachine } from '@/components/result/machineConfig';
import { ROPE_CFG, ROPE_LOOK, setRopePoint, setRopeLook, resetRope, type RopeCfg } from '@/components/question/lifeboat/ropeConfig';

/**
 * 개발 서버 전용 디버그 패널: 어느 화면에서든 다른 장면으로 건너뛰고, 건너뛴 장면이 제대로 보이도록 답·분기 값을 채운다.
 * - 백틱(`) 키로 열고 닫는다. Alt+P 는 제한 시간(Q7 02:05 등)을 멈춘다. 알트+← / 알트+→ 로 앞뒤 장면 이동 (입력창에 글자를 치는 중에는 동작하지 않는다)
 * - 프리셋은 "이동할 때 함께 적용"이다. 눌러 두면 이후 이동에 계속 쓰인다.
 */

type Dict = Record<string, unknown>;

const PRESETS: { id: string; label: string; answers: Dict; extras: Dict; flags: Record<string, boolean> }[] = [
  { id: 'keep', label: '그대로', answers: {}, extras: {}, flags: {} },
  {
    id: 'woman2', label: '30대 여성 · 2등석',
    answers: { embarked: 'S', sex: 'female', ageGroup: '30-39', companion: 'alone', pclass: 2, fareIntent: 'balance', purpose: 'stability', rumorAction: 'check_crew', finalAction: 'yield_seat' },
    extras: { age: 34 }, flags: {},
  },
  {
    id: 'man3', label: '20대 남성 · 3등석',
    answers: { embarked: 'Q', sex: 'male', ageGroup: '18-29', companion: 'friends', pclass: 3, fareIntent: 'save', purpose: 'change', rumorAction: 'follow_crowd', finalAction: 'me_first' },
    extras: { age: 24 }, flags: {},
  },
  {
    id: 'child', label: '어린이(8세) · 3등석',
    answers: { embarked: 'S', sex: 'female', ageGroup: '0-9', companion: 'family', pclass: 3, fareIntent: 'save', purpose: 'change', rumorAction: 'check_crew', finalAction: 'yield_weak' },
    extras: { age: 8 }, flags: {},
  },
  {
    id: 'elder1', label: '60대 남성 · 1등석',
    answers: { embarked: 'C', sex: 'male', ageGroup: '60+', companion: 'partner', pclass: 1, fareIntent: 'luxury', purpose: 'experience', rumorAction: 'calm_others', finalAction: 'yield_seat' },
    extras: { age: 63 }, flags: {},
  },
];

const ROPE_ROWS: { key: keyof RopeCfg; label: string }[] = [
  { key: 'pulleyA', label: '왼쪽 도르래 (선미 줄 위)' },
  { key: 'hookS', label: '선미 고리 (왼쪽 줄 아래)' },
  { key: 'pulleyB', label: '오른쪽 도르래 (이물 줄 위)' },
  { key: 'hookB', label: '이물 고리 (오른쪽 줄 아래)' },
];

type Tri = 'unset' | 'true' | 'false';
const triToVal = (t: Tri) => (t === 'unset' ? undefined : t === 'true');

export default function DebugPanel() {
  const currentStep = useQuizStore((s) => s.currentStep);
  const answers = useQuizStore((s) => s.answers);
  const extras = useQuizStore((s) => s.extras);
  const flags = useQuizStore((s) => s.flags);
  const showDebug = useQuizStore((s) => s.showDebug);
  const toggleDebug = useQuizStore((s) => s.toggleDebug);
  const debugPause = useQuizStore((s) => s.debugPause);
  const setDebugPause = useQuizStore((s) => s.setDebugPause);

  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState('keep');
  const [boarded, setBoarded] = useState<Tri>('unset');
  const [w2Survived, setW2Survived] = useState<Tri>('unset');
  const [w2Way, setW2Way] = useState<'' | 'swim' | 'jump' | 'sink'>('');
  const [showState, setShowState] = useState(false);
  const [showRope, setShowRope] = useState(false);
  const [showMachine, setShowMachine] = useState(false);
  const [fx, setFx] = useState<null | { kind: 'exact' | 'near' | 'lose' | 'win' | 'broke'; n: number }>(null);
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);

  /** 앞뒤 이동 순서: 프롤로그 → 장면들(정의 순서) → 결과 */
  const order = useMemo(() => [PROLOGUE, ...sceneIds, RESULT], []);
  const index = order.indexOf(currentStep);

  const go = (id: string) => {
    const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[0];
    const st = useQuizStore.getState();
    const nextAnswers = { ...st.answers, ...(preset === 'keep' ? {} : p.answers) } as Dict;
    const nextExtras: Dict = { ...st.extras, ...(preset === 'keep' ? {} : p.extras) };
    const b = triToVal(boarded);
    if (b !== undefined) nextExtras.boarded = b; else if (boarded === 'unset' && preset !== 'keep') delete nextExtras.boarded;
    const s2 = triToVal(w2Survived);
    if (s2 !== undefined) nextExtras.w2Survived = s2;
    if (w2Way) nextExtras.w2 = w2Way;
    const nextFlags = { ...st.flags, ...(preset === 'keep' ? {} : p.flags) };
    if (b !== undefined) nextFlags.boat = b;
    // 건너뛰기로 들어가면 거친 장면이 없어 선택 기록이 비는데, 결과의 성향 육각형과 아날로그 장부 연출은 이 기록이 있어야 나온다.
    // 기록이 비어 있으면 채운 답에서 장면별 선택을 만들어 넣는다
    const have = new Set(st.picks.map((x) => x.scene));
    const nextPicks = [...st.picks, ...samplePicks().filter((x) => !have.has(x.scene))];
    useQuizStore.setState({ answers: nextAnswers as never, extras: nextExtras, flags: nextFlags, picks: nextPicks as never });
    // 지난 결과 주소(?result=...)가 남아 있으면 결과 장면이 '공유 링크'로 열려 확률 단말기와 인쇄 연출이 건너뛰어진다
    try { window.history.replaceState(window.history.state, '', window.location.pathname); } catch { /* 무시 */ }
    useQuizStore.getState().nextStep(id);
  };
  // 결과 연출(확률 계산 단말기 -> 결과지 인쇄 -> 키 켜짐)을 처음부터 다시 본다.
  // 같은 장면으로 이동하면 다시 열리지 않으므로 다른 장면을 거쳐 들어간다. 위의 답·탑승·헤엄 선택이 그대로 반영된다
  const replayResult = () => {
    const st = useQuizStore.getState();
    if (!st.answers.finalAction) {
      const p = PRESETS.find((x) => x.id !== 'keep') ?? PRESETS[0];
      useQuizStore.setState({ answers: { ...p.answers, ...st.answers } as never });
    }
    go('Q5');
    setOpen(false);
    window.setTimeout(() => go(RESULT), 400);
  };
  const step = (d: number) => {
    const i = index < 0 ? 0 : Math.min(order.length - 1, Math.max(0, index + d));
    go(order[i]);
  };

  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const on = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.key === '`') { setOpen((o) => !o); return; }
      if (e.altKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); useQuizStore.getState().setDebugPause(!useQuizStore.getState().debugPause); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const byChapter = useMemo(() => {
    const g: Record<number, string[]> = {};
    for (const id of sceneIds) {
      const c = scenes[id]?.chapter ?? 0;
      (g[c] ??= []).push(id);
    }
    return g;
  }, []);

  const pill = 'rounded border px-2 py-1 text-[11px] font-bold transition-colors';
  const btn = (active: boolean) => `${pill} ${active ? 'border-amber-300 bg-amber-300/25 text-amber-100' : 'border-slate-600/70 bg-slate-800/70 text-slate-200 hover:bg-slate-700'}`;
  const tri = (label: string, v: Tri, set: (t: Tri) => void) => (
    <div className="flex items-center gap-1">
      <span className="w-20 shrink-0 text-[11px] text-slate-400">{label}</span>
      {(['unset', 'true', 'false'] as Tri[]).map((t) => (
        <button key={t} onClick={() => set(t)} className={btn(v === t)}>{t === 'unset' ? '-' : t === 'true' ? '예' : '아니오'}</button>
      ))}
    </div>
  );

  return (
    <div className="fixed bottom-3 left-3 z-[99999] font-sans" data-debug-panel>
      {!open ? (
        <button onClick={() => setOpen(true)} title="디버그 패널 (`)" className="rounded-full border border-slate-600/70 bg-slate-950/80 px-3 py-1.5 text-[11px] font-bold text-slate-300 backdrop-blur hover:text-amber-200">
          DBG · {currentStep}{debugPause ? ' · 정지' : ''}
        </button>
      ) : (
        <div className="max-h-[85vh] w-[330px] overflow-y-auto rounded-lg border border-slate-600/70 bg-slate-950/92 p-3 text-slate-200 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold text-amber-200">디버그 · 지금 <span className="text-white">{currentStep}</span></div>
            <button onClick={() => setOpen(false)} className={btn(false)}>닫기 (`)</button>
          </div>

          <div className="mb-3 flex items-center gap-1">
            <button onClick={() => step(-1)} className={btn(false)}>이전</button>
            <button onClick={() => step(1)} className={btn(false)}>다음</button>
            <span className="ml-1 text-[10px] text-slate-500">Alt+←/→</span>
            <button onClick={() => go(currentStep)} className={`${btn(false)} ml-auto`} title="같은 장면을 처음부터 다시">↻ 다시</button>
          </div>

          <div className="mb-1 text-[11px] font-bold text-slate-400">이동할 때 채워 넣을 값</div>
          <div className="mb-2 flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => setPreset(p.id)} className={btn(preset === p.id)}>{p.label}</button>
            ))}
          </div>
          <div className="mb-3 space-y-1">
            {tri('구명정 탑승', boarded, setBoarded)}
            {tri('헤엄 생존', w2Survived, setW2Survived)}
            <div className="flex items-center gap-1">
              <span className="w-20 shrink-0 text-[11px] text-slate-400">W2 방식</span>
              {(['', 'swim', 'jump', 'sink'] as const).map((w) => (
                <button key={w || 'none'} onClick={() => setW2Way(w)} className={btn(w2Way === w)}>{w === '' ? '-' : w === 'swim' ? '헤엄' : w === 'jump' ? '뛰어듦' : '가라앉음'}</button>
              ))}
            </div>
          </div>

          <div className="mb-1 text-[11px] font-bold text-slate-400">장면으로 이동</div>
          <div className="mb-1">
            <button onClick={() => go(PROLOGUE)} className={btn(currentStep === PROLOGUE)}>PROLOGUE</button>
          </div>
          {Object.keys(byChapter).map((c) => (
            <div key={c} className="mb-2">
              <div className="mb-1 text-[10px] tracking-widest text-slate-500">{CHAPTERS[Number(c)] ?? `챕터 ${c}`}</div>
              <div className="flex flex-wrap gap-1">
                {byChapter[Number(c)].map((id) => (
                  <button key={id} onClick={() => go(id)} className={btn(currentStep === id)}>{id}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="mb-3 flex flex-wrap gap-1">
            <button onClick={() => go(RESULT)} className={`${btn(currentStep === RESULT)} border-red-400/60`}>RESULT</button>
            <button onClick={replayResult} className={`${btn(false)} border-emerald-300/60`}>결과 연출 처음부터 (확률 계산 → 인쇄)</button>
          </div>

          {currentStep === 'W2' && (
            <button onClick={() => { (window as unknown as { __swimReach?: () => void }).__swimReach?.(); setOpen(false); }} className={`${btn(false)} mb-2 mr-1 border-amber-300/60`}>구명정 도착 연출 보기</button>
          )}
          <button onClick={() => setShowRope((v) => !v)} className={`${btn(showRope)} mb-2`}>밧줄 위치 조정 {showRope ? '접기' : '열기'}</button>
          {showRope && (
            <div className="mb-3 space-y-1.5 rounded border border-slate-700/70 bg-black/40 p-2">
              <div className="text-[10px] text-slate-400">배경판 좌표(1376x768). Q7 에서는 바로 반영되고, WB 는 장면을 다시 열면 반영된다.</div>
              {ROPE_ROWS.map(({ key, label }) => (
                <div key={key} className="space-y-0.5">
                  <div className="text-[11px] text-slate-300">{label} ({ROPE_CFG[key].x}, {ROPE_CFG[key].y})</div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 text-[10px] text-slate-500">x</span>
                    <input type="range" min={0} max={1376} value={ROPE_CFG[key].x} onChange={(e) => { setRopePoint(key, 'x', Number(e.target.value)); bump(); }} className="h-1 flex-1" />
                    <input type="number" value={ROPE_CFG[key].x} onChange={(e) => { setRopePoint(key, 'x', Number(e.target.value)); bump(); }} className="w-14 rounded bg-slate-800 px-1 text-[11px]" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 text-[10px] text-slate-500">y</span>
                    <input type="range" min={0} max={768} value={ROPE_CFG[key].y} onChange={(e) => { setRopePoint(key, 'y', Number(e.target.value)); bump(); }} className="h-1 flex-1" />
                    <input type="number" value={ROPE_CFG[key].y} onChange={(e) => { setRopePoint(key, 'y', Number(e.target.value)); bump(); }} className="w-14 rounded bg-slate-800 px-1 text-[11px]" />
                  </div>
                </div>
              ))}
              {([['gapS', '선미 줄 가닥 간격', 0, 60], ['gapB', '이물 줄 가닥 간격', 0, 60], ['width', '가닥 굵기', 2, 20]] as const).map(([k, label, lo, hi]) => (
                <div key={k} className="flex items-center gap-1">
                  <span className="w-24 shrink-0 text-[11px] text-slate-300">{label}</span>
                  <input type="range" min={lo} max={hi} step={0.5} value={ROPE_LOOK[k]} onChange={(e) => { setRopeLook(k, Number(e.target.value)); bump(); }} className="h-1 flex-1" />
                  <input type="number" step={0.5} value={ROPE_LOOK[k]} onChange={(e) => { setRopeLook(k, Number(e.target.value)); bump(); }} className="w-14 rounded bg-slate-800 px-1 text-[11px]" />
                </div>
              ))}
              <div className="flex gap-1">
                <button onClick={() => { resetRope(); bump(); }} className={btn(false)}>처음 값</button>
                <button onClick={() => { void navigator.clipboard?.writeText(JSON.stringify({ ...ROPE_CFG, look: ROPE_LOOK })); }} className={btn(false)}>값 복사</button>
              </div>
              <pre className="overflow-auto rounded bg-black/60 p-1.5 text-[10px] leading-4 text-slate-300">{JSON.stringify({ ...ROPE_CFG, look: ROPE_LOOK })}</pre>
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-slate-400">도박장 결과 연출 미리보기</span>
            {([['exact', '불즈아이'], ['near', '아까워라'], ['lose', '꽝'], ['win', '적중'], ['broke', '빈털터리']] as const).map(([k, label]) => (
              <button key={k} onClick={() => { setFx((c) => ({ kind: k, n: (c?.n ?? 0) + 1 })); setOpen(false); }} className={`${btn(false)} border-amber-300/50`}>{label}</button>
            ))}
          </div>
          <button onClick={() => setShowMachine((v) => !v)} className={`${btn(showMachine)} mb-2 ml-1`}>기계 부품 위치 조정 {showMachine ? '접기' : '열기'}</button>
          {showMachine && (
            <div className="mb-3 space-y-2 rounded border border-slate-700/70 bg-black/40 p-2">
              <div className="text-[10px] text-slate-400">결과 화면 아래 기계 그림(1624x579) 좌표. 가로·세로는 부품의 가운데 x 와 아랫선 y 이고, 결과 화면이 열려 있으면 바로 반영된다. 위의 &quot;결과 연출 처음부터&quot;로 화면을 열어 둔 채 조절한다.</div>
              {MACHINE_META.map((part) => (
                <div key={part.id} className="space-y-0.5">
                  <div className="text-[11px] text-slate-200">{part.label}</div>
                  {part.fields.map((f) => {
                    const v = (MACHINE_CFG[part.id][f.k] as number | undefined) ?? 0;
                    return (
                      <div key={f.k} className="flex items-center gap-1">
                        <span className="w-16 shrink-0 text-[10px] text-slate-500">{f.label}</span>
                        <input type="range" min={f.min} max={f.max} step={f.step ?? 1} value={v} onChange={(e) => { setMachine(part.id, f.k, Number(e.target.value)); bump(); }} className="h-1 flex-1" />
                        <input type="number" value={v} onChange={(e) => { setMachine(part.id, f.k, Number(e.target.value)); bump(); }} className="w-14 rounded bg-slate-800 px-1 text-[11px]" />
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="flex gap-1">
                <button onClick={() => { resetMachine(); bump(); }} className={btn(false)}>처음 값</button>
                <button onClick={() => { void navigator.clipboard?.writeText(JSON.stringify(MACHINE_CFG)); }} className={btn(false)}>값 복사</button>
              </div>
              <pre className="overflow-auto rounded bg-black/60 p-1.5 text-[10px] leading-4 text-slate-300">{JSON.stringify(MACHINE_CFG)}</pre>
            </div>
          )}

          <label className="mb-1 flex items-center gap-2 text-[11px] text-amber-200">
            <input type="checkbox" checked={debugPause} onChange={(e) => setDebugPause(e.target.checked)} />
            제한 시간 일시정지 (Alt+P) — Q7 남은 시간, W1 대사·침묵 시간 등
          </label>
          <label className="mb-2 flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={showDebug} onChange={toggleDebug} />
            장면 편집용 디버그 표시 (showDebug)
          </label>

          <button onClick={() => setShowState((v) => !v)} className={btn(showState)}>현재 상태 {showState ? '숨기기' : '보기'}</button>
          {showState && (
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/60 p-2 text-[10px] leading-4 text-slate-300">
              {JSON.stringify({ answers, extras, flags }, null, 1)}
            </pre>
          )}
        </div>
      )}
      {fx && (
        <ResultFx key={fx.n} target={120} err={fx.kind === 'near' ? 3 : 0} streak={2} nearMiss={fx.kind === 'near'} broke={fx.kind === 'broke'} canAgain={fx.kind !== 'broke'} nextPayout={3}
          result={fx.kind === 'exact' ? 'exact' : fx.kind === 'win' ? 'win' : 'lose'} gain={fx.kind === 'exact' ? 12 : fx.kind === 'win' ? 6 : -3}
          onAgain={() => setFx(null)} onClose={() => setFx(null)} />
      )}
    </div>
  );
}
