import { useQuizStore } from '@/store/quizStore';

/**
 * 디버그 일시정지(quizStore.debugPause)에 맞춰 멈추는 setTimeout.
 * 멈추면 남은 시간을 기억해 두고, 풀면 그 남은 시간만큼만 다시 기다린다. 평소에는 setTimeout 과 같다.
 */
export interface PTimer {
  fn: () => void;
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

const active = new Set<PTimer>();

function arm(t: PTimer) {
  t.startedAt = Date.now();
  t.handle = setTimeout(() => {
    active.delete(t);
    t.handle = null;
    t.fn();
  }, t.remaining);
}

export function pTimeout(fn: () => void, ms: number): PTimer {
  const t: PTimer = { fn, remaining: ms, startedAt: 0, handle: null };
  active.add(t);
  if (!useQuizStore.getState().debugPause) arm(t);
  return t;
}

export function pClear(t: PTimer | null | undefined) {
  if (!t) return;
  if (t.handle) clearTimeout(t.handle);
  t.handle = null;
  active.delete(t);
}

if (typeof window !== 'undefined') {
  useQuizStore.subscribe((s, prev) => {
    if (s.debugPause === prev.debugPause) return;
    for (const t of active) {
      if (s.debugPause) {
        if (t.handle) {
          clearTimeout(t.handle);
          t.handle = null;
          t.remaining = Math.max(0, t.remaining - (Date.now() - t.startedAt));
        }
      } else if (!t.handle) {
        arm(t);
      }
    }
  });
}
