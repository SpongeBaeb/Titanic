/**
 * 느린 기기 알아채기: 처음 몇 초의 프레임 간격을 재서, 화면이 버거워 보이면 한 번 알려 준다.
 * 캔버스 장면(W1, W2)이 이 신호를 받아 해상도와 효과를 스스로 낮춘다.
 * 탭이 가려졌다 돌아올 때의 긴 간격은 세지 않는다.
 */
export function createFrameBudget(onSlow: () => void, opts: { warmup?: number; window?: number; slowMs?: number } = {}) {
  const warmup = opts.warmup ?? 1.2, span = opts.window ?? 2.5, slowMs = opts.slowMs ?? 27;
  let t = 0, sum = 0, n = 0, done = false;
  /** 프레임마다 부른다. rawDt: 직전 프레임부터 걸린 시간(초), 잘라 내지 않은 값 */
  return (rawDt: number) => {
    if (done || rawDt <= 0 || rawDt > 0.25) return;
    t += rawDt;
    if (t < warmup) return;
    sum += rawDt; n++;
    if (t >= warmup + span) {
      done = true;
      if (n > 10 && (sum / n) * 1000 > slowMs) onSlow();
    }
  };
}
