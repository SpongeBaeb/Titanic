'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import ClassicButton from '@/components/ui/ClassicButton';
import Sprig from '@/components/ui/Sprig';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_EVENT, loadAchievements, debugSetAchievement, debugSetAll } from '@/engine/achievements';

// 저장소 값을 문자열로 구독해서 새 업적이 생기면 목록이 바로 갱신되게 한다
const subscribe = (cb: () => void) => {
  window.addEventListener(ACHIEVEMENT_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(ACHIEVEMENT_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
};
const snapshot = () => JSON.stringify(loadAchievements());
const serverSnapshot = () => '{}';

const STYLE = `
@keyframes ach-in { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: translateY(0) } }
@media (prefers-reduced-motion: reduce) { .ach-toast { animation: none !important } }
`;

/** 업적을 얻으면 화면 위쪽에 팝업이 잠깐 뜬다. 여러 개면 차례로 뜬다. */
export function AchievementToast() {
  const [queue, setQueue] = useState<string[]>([]);
  const current = queue[0];
  const def = ACHIEVEMENTS.find((a) => a.id === current);

  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) setQueue((q) => [...q, id]);
    };
    window.addEventListener(ACHIEVEMENT_EVENT, on);
    return () => window.removeEventListener(ACHIEVEMENT_EVENT, on);
  }, []);

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setQueue((q) => q.slice(1)), 4200);
    return () => clearTimeout(id);
  }, [current]);

  if (!def) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[10001] flex justify-center px-4" role="status" aria-live="polite">
      <style>{STYLE}</style>
      <button
        key={def.id}
        onClick={() => setQueue((q) => q.slice(1))}
        className="ach-toast pointer-events-auto flex items-center gap-3 rounded-xl border border-bright-brass bg-ocean-black/95 px-4 py-3 text-left shadow-[0_8px_30px_rgba(0,0,0,.7)]"
        style={{ animation: 'ach-in .5s ease-out' }}
      >
        <Sprig flip delay={0.15} className="h-16 w-6 shrink-0 text-bright-brass" />
        <span className="text-center">
          <span className="block text-xs tracking-[0.2em] text-bright-brass">ACCOMPLISHMENT</span>
          <span className="block text-base font-bold text-ivory">{def.title}</span>
          <span className="block text-sm text-muted-ivory">{def.desc}</span>
        </span>
        <Sprig delay={0.15} className="h-16 w-6 shrink-0 text-bright-brass" />
      </button>
    </div>
  );
}

/** 업적 목록을 여는 작은 버튼과 목록 창: 분류별로 묶어 2열로 보여 준다 */
const DEBUG = process.env.NODE_ENV !== 'production'; // 개발 중에만 해금/해제 버튼을 보여 준다

export function AchievementsButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const have = JSON.parse(useSyncExternalStore(subscribe, snapshot, serverSnapshot)) as Record<string, number>;
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const count = ACHIEVEMENTS.filter((a) => have[a.id]).length;
  const total = ACHIEVEMENTS.length;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      <ClassicButton
        onClick={() => setOpen(true)}
        aria-label={`Accomplishments ${count}/${total}`}
        className={compact ? 'fixed right-16 top-3 z-50 px-3 text-xs' : 'fixed left-4 top-4 z-50 px-4'}
      >
        Accomplishments {count}/{total}
      </ClassicButton>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-3 py-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Accomplishments"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-[780px] flex-col rounded-xl border border-brass/50 bg-ocean-black text-ivory shadow-[0_10px_40px_rgba(0,0,0,.8)]"
          >
            {/* 머리: 제목, 진행 막대, 닫기 */}
            <div className="shrink-0 border-b border-white/10 px-5 pb-3 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold tracking-wider">Accomplishments <span className="text-bright-brass">{count}/{total}</span></h2>
                <button
                  ref={closeRef}
                  onClick={close}
                  className="min-h-11 rounded-full px-3 text-sm text-muted-ivory hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-bright-brass"
                  aria-label="닫기"
                >
                  닫기
                </button>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div className="h-full rounded-full bg-bright-brass transition-all duration-500" style={{ width: `${(count / total) * 100}%` }} />
              </div>
              {DEBUG && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-bold text-red-300">DEBUG</span>
                  <button onClick={() => debugSetAll(true)} className="rounded border border-white/20 px-2 py-0.5 hover:bg-white/10">전체 해금</button>
                  <button onClick={() => debugSetAll(false)} className="rounded border border-white/20 px-2 py-0.5 hover:bg-white/10">전체 초기화</button>
                </div>
              )}
            </div>

            {/* 본문: 분류별 묶음 */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {ACHIEVEMENT_CATEGORIES.map((c) => {
                const list = ACHIEVEMENTS.filter((a) => a.category === c.id);
                if (!list.length) return null;
                const got = list.filter((a) => have[a.id]).length;
                return (
                  <section key={c.id} aria-label={c.label}>
                    <div className="mb-2 flex items-baseline gap-2 border-b border-brass/30 pb-1">
                      <h3 className="font-display text-sm font-bold tracking-widest text-bright-brass">{c.label}</h3>
                      <span className="text-xs text-muted-ivory">{c.blurb}</span>
                      <span className="ml-auto text-xs text-muted-ivory">{got}/{list.length}</span>
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {list.map((a) => {
                        const has = !!have[a.id];
                        const showReal = has || !a.hidden; // 숨은 업적은 얻기 전까지 이름과 조건을 가린다
                        return (
                          <li key={a.id} className={`flex flex-col rounded-lg border px-3 py-2.5 ${has ? 'border-bright-brass bg-brass/10' : 'border-white/10 bg-white/[0.03]'}`}>
                            <div className="flex items-start gap-2">
                              <span aria-hidden className={`mt-0.5 shrink-0 text-base leading-none ${has ? 'text-bright-brass' : 'text-white/25'}`}>{has ? '★' : '☆'}</span>
                              <div className="min-w-0 flex-1">
                                <div className={`text-sm font-bold ${has ? 'text-ivory' : 'text-ivory/70'}`}>{showReal ? a.title : '???'}</div>
                                <div className="mt-0.5 text-xs leading-relaxed text-muted-ivory">
                                  {showReal ? a.desc : null}
                                  {!has && (
                                    <span className={`block ${showReal ? 'mt-1' : ''} text-bright-brass/80`}>힌트 · {a.hint}</span>
                                  )}
                                </div>
                                {has && <div className="mt-1 text-[11px] text-muted-ivory/70">{new Date(have[a.id]).toLocaleDateString('ko-KR')} 달성</div>}
                              </div>
                            </div>
                            {DEBUG && (
                              <button
                                onClick={() => debugSetAchievement(a.id, !has)}
                                className="mt-2 self-end rounded border border-red-400/40 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-500/15"
                              >
                                {has ? '해제' : '해금'}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
              <p className="text-xs text-muted-ivory">이 브라우저에만 저장됩니다.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
