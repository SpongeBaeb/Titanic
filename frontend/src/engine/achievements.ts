// 업적: 이 브라우저(localStorage)에만 저장된다. 서버로 보내는 값이나 점수와는 무관하다.
const KEY = 'titanic_achievements';
export const ACHIEVEMENT_EVENT = 'titanic:achievement';

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  /** 얻기 전에는 이름과 조건을 보여 주지 않는다 */
  hidden?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-voyage', title: '첫 항해', desc: '결과 화면까지 한 번 끝까지 마쳤습니다.' },
  { id: 'second-night', title: '두 번째 밤', desc: '두 번째로 타이타닉호에 올랐습니다.' },
  { id: 'five-nights', title: '다섯 번의 밤', desc: '다섯 번 끝까지 마쳤습니다.' },
  { id: 'sins-of-omission', title: '방관자의 죄', desc: '밤이 끝날 때까지 아무것도 선택하지 않았습니다.', hidden: true },
  { id: 'good-dog', title: '좋은 아이', desc: '부두 구석에 숨은 강아지를 찾아, 작은 승객의 눈으로 타이타닉호에 올랐습니다.', hidden: true },
  { id: 'dog-all-endings', title: '일곱 번의 밤, 한 마리의 개', desc: '강아지가 맞이할 수 있는 일곱 가지 결말을 모두 보았습니다.', hidden: true },
  { id: 'dog-miracle', title: '멈춘 구명정', desc: '강아지의 외침이 구명정을 멈춰 세웠습니다. 기록에는 없는 결말입니다.', hidden: true },
  { id: 'watchtower', title: '망루의 시간', desc: '난간에서 37초 동안 바다만 바라보았습니다. 같은 시간에, 누군가는 빙산을 보았습니다.', hidden: true },
  { id: 'duck-gun', title: '사무장의 마지막 계산', desc: '기념품 가게의 칼로 오리 사무장을 두 번 위협했습니다. 이 계산은 영수증에 적히지 않았습니다.', hidden: true },
  { id: 'youngest-passenger', title: '가장 어린 승객', desc: '타이타닉의 최연소 승객, 생후 2개월 밀비나 딘과 같은 0세를 골랐습니다. 그 아이는 살아남아 97세까지 살았습니다.', hidden: true },
  { id: 'oldest-passenger', title: '가장 나이 많은 승객', desc: '타이타닉의 최고령 승객, 3등석의 요한 스벤손(74세)과 같거나 더 많은 나이를 골랐습니다.', hidden: true },
  { id: 'dont-touch', title: "Please, Don't Touch Anything", desc: '기관실 제어판의 버튼을 모두 누르고, 레버를 돌려 모든 나이를 한 번씩 골라 보았습니다.', hidden: true },
];

export function loadAchievements(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** 처음 얻은 업적이면 저장하고 팝업 이벤트를 보낸다. 저장이 막혀 있어도 팝업은 띄운다 */
export function unlock(id: string): boolean {
  if (!ACHIEVEMENTS.some((a) => a.id === id)) return false;
  const have = loadAchievements();
  if (have[id]) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...have, [id]: Date.now() }));
  } catch {
    // 저장 불가: 이번 접속에서만 알린다
  }
  window.dispatchEvent(new CustomEvent(ACHIEVEMENT_EVENT, { detail: { id } }));
  return true;
}

/** 한 판을 끝까지 마쳤을 때 (completeRun 이 돌려준 누적 횟수) */
export function onRunCompleted(runs: number) {
  if (runs >= 1) unlock('first-voyage');
  if (runs >= 5) unlock('five-nights');
}

/** 프롤로그에서 항해를 시작할 때 (runIndex = 이번이 몇 번째 판인지) */
export function onRunStarted(runIndex: number) {
  if (runIndex >= 2) unlock('second-night');
}

// 강아지 분기의 결말을 본 기록 (이 브라우저에만 저장). 일곱 가지를 모두 보면 업적
const DOG_ENDINGS_KEY = 'titanic_dog_endings';
export const DOG_ENDING_KEYS = ['reunion', 'miracle', 'unheard', 'stranger', 'withTom', 'withCaptain', 'guilt'] as const;

export function loadSeenDogEndings(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DOG_ENDINGS_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 본 결말을 기록하고, 일곱 가지를 다 보았으면 업적을 준다. 지금까지 본 결말 수를 돌려준다 */
export function onDogEnding(key: string): number {
  const seen = new Set(loadSeenDogEndings());
  seen.add(key);
  try {
    localStorage.setItem(DOG_ENDINGS_KEY, JSON.stringify([...seen]));
  } catch {
    // 저장 불가: 이번 접속에서만 센다
  }
  if (DOG_ENDING_KEYS.every((k) => seen.has(k))) unlock('dog-all-endings');
  return seen.size;
}

