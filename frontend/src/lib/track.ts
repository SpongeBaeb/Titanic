import { API_BASE } from '@/lib/api';
import { onPick } from '@/engine/events';

/**
 * 장면 도달 기록: 어느 장면에서 사람들이 떠나는지 보기 위한 익명 기록.
 * - 누구인지는 보내지 않는다. sid 는 탭마다 새로 만드는 무작위 값이다.
 * - 장면에 들어온 것(enter, 장면마다 한 번)과 고른 것(pick, 걸린 시간 포함)만 보낸다.
 * - 조금씩 모아 한 번에 보내고, 탭이 닫히거나 가려질 때 남은 것을 보낸다. 실패해도 게임에는 영향이 없다.
 * 서버: POST /api/track, 집계: GET /api/admin/funnel
 */
interface Ev { kind: 'enter' | 'pick'; scene: string; run: number; value?: string; ms?: number }

const SID_KEY = 'titanic.sid.v1';
const SEEN_KEY = 'titanic.seen.v1';
let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function sid(): string {
  try {
    let v = window.sessionStorage.getItem(SID_KEY);
    if (!v) {
      v = (window.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
      window.sessionStorage.setItem(SID_KEY, v);
    }
    return v;
  } catch {
    return 'nostore';
  }
}

/** 새로고침으로 같은 장면에 다시 들어와도 한 번만 센다 */
function firstTime(key: string): boolean {
  try {
    const seen: string[] = JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? '[]');
    if (seen.includes(key)) return false;
    seen.push(key);
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    return true;
  } catch {
    return true;
  }
}

function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const body = JSON.stringify({ sid: sid(), events: queue });
  queue = [];
  try {
    // 탭이 닫히는 중에도 나가도록 keepalive 로 보낸다
    void fetch(`${API_BASE}/api/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    /* 무시 */
  }
}

function push(e: Ev) {
  queue.push(e);
  if (queue.length >= 8) { flush(); return; }
  if (!timer) timer = setTimeout(flush, 4000);
}

export function trackEnter(scene: string, run: number) {
  if (typeof window === 'undefined') return;
  if (!firstTime(`${run}:${scene}`)) return;
  push({ kind: 'enter', scene, run });
}

/** 한 번만 부른다: 선택 기록을 받아 보내고, 탭이 가려지거나 닫힐 때 남은 것을 보낸다 */
export function startTracking() {
  if (started || typeof window === 'undefined') return;
  started = true;
  onPick((e) => push({ kind: 'pick', scene: e.scene, run: e.run, value: e.value, ms: Math.round(e.ms) }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}
