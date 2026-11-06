'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import ClassicButton from '@/components/ui/ClassicButton';
import Sprig from '@/components/ui/Sprig';
import { ACHIEVEMENTS, ACHIEVEMENT_EVENT, loadAchievements } from '@/engine/achievements';

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

/** 업적 목록을 여는 작은 버튼과 목록 창 */
export function AchievementsButton() {
  const [open, setOpen] = useState(false);
  const have = JSON.parse(useSyncExternalStore(subscribe, snapshot, serverSnapshot)) as Record<string, number>;
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const count = ACHIEVEMENTS.filter((a) => have[a.id]).length;

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
        aria-label={`Accomplishments ${count}/${ACHIEVEMENTS.length}`}
        className="fixed left-4 top-4 z-50 px-4"
      >
        Accomplishments {count}/{ACHIEVEMENTS.length}
      </ClassicButton>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Accomplishments"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] rounded-xl border border-brass/50 bg-ocean-black p-5 text-ivory shadow-[0_10px_40px_rgba(0,0,0,.8)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold tracking-wider">Accomplishments {count}/{ACHIEVEMENTS.length}</h2>
              <button
                ref={closeRef}
                onClick={close}
                className="min-h-11 px-3 rounded-full text-sm text-muted-ivory hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-bright-brass"
                aria-label="닫기"
              >
                닫기
              </button>
            </div>
            <ul className="mt-3 grid gap-2">
              {ACHIEVEMENTS.map((a) => {
                const got = !!have[a.id];
                return (
                  <li key={a.id} className={`rounded-lg border px-4 py-3 ${got ? 'border-bright-brass bg-brass/10' : 'border-white/10 opacity-55'}`}>
                    <div className="flex items-center gap-3">
                      {got && <Sprig flip delay={0.1} className="h-14 w-5 shrink-0 text-bright-brass" />}
                      <div className={`min-w-0 flex-1 ${got ? 'text-center' : ''}`}>
                        <div className="font-bold">{got || !a.hidden ? a.title : '???'}</div>
                        <div className="text-sm text-muted-ivory">{got || !a.hidden ? a.desc : '조건은 비밀입니다.'}</div>
                        {!got && <div className="mt-1 text-xs text-muted-ivory">미획득</div>}
                        {got && <div className="mt-1 text-xs text-muted-ivory">{new Date(have[a.id]).toLocaleDateString('ko-KR')} 달성</div>}
                      </div>
                      {got && <Sprig delay={0.1} className="h-14 w-5 shrink-0 text-bright-brass" />}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-ivory">이 브라우저에만 저장됩니다.</p>
          </div>
        </div>
      )}
    </>
  );
}
