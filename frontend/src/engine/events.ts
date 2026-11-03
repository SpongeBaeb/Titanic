// 선택 기록 훅. 서버 전송은 아직 연결하지 않았고(선택통계 3단계), 구독자만 받는다.
export interface PickEvent {
  /** 이 판의 회차 (1부터). 통계는 1회차만 집계한다 */
  run: number;
  scene: string;
  value: string;
  /** 장면에 들어온 뒤 선택까지 걸린 시간(ms) */
  ms: number;
}

type Listener = (e: PickEvent) => void;
const listeners = new Set<Listener>();

export function onPick(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitPick(e: PickEvent) {
  if (process.env.NODE_ENV === 'development') console.debug('[pick]', e);
  listeners.forEach((fn) => fn(e));
}
