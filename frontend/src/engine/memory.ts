// 회차 기억: 이 브라우저에서 끝까지 플레이한 횟수. 저장이 막혀 있어도 "첫 회차"로 정상 동작해야 한다.
const KEY = 'titanic_runs';

export function loadRuns(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw ? Number(JSON.parse(raw).runs) : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** 한 판을 끝냈을 때 호출. 갱신된 완료 횟수를 돌려준다. */
export function completeRun(): number {
  const runs = loadRuns() + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify({ runs }));
  } catch {
    // 저장 불가: 기억 없이 진행
  }
  return runs;
}
