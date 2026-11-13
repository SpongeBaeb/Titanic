// 업적: 이 브라우저(localStorage)에만 저장된다. 서버로 보내는 값이나 점수와는 무관하다.
const KEY = 'titanic_achievements';
export const ACHIEVEMENT_EVENT = 'titanic:achievement';

export type AchievementCategory = 'voyage' | 'passenger' | 'ship' | 'deck' | 'dog';

/** 목록에서 묶어 보여 주는 분류 (이 순서대로 나온다) */
export const ACHIEVEMENT_CATEGORIES: { id: AchievementCategory; label: string; blurb: string }[] = [
  { id: 'voyage', label: '항해', blurb: '몇 번이나 이 밤을 건넜는가' },
  { id: 'passenger', label: '승객', blurb: '누구로 배에 올랐는가' },
  { id: 'ship', label: '선내', blurb: '배 안에서 한 일들' },
  { id: 'deck', label: '부두와 갑판', blurb: '눈여겨본 것들' },
  { id: 'dog', label: '작은 승객', blurb: '강아지의 밤' },
];

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  category: AchievementCategory;
  /** 얻기 전에 보여 주는 힌트 (답을 직접 말하지 않는다) */
  hint: string;
  /** 얻기 전에는 이름과 조건을 보여 주지 않는다 */
  hidden?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-voyage', category: 'voyage', title: '첫 항해', desc: '결과 화면까지 한 번 끝까지 마쳤습니다.', hint: '일단 끝까지 가 보세요.' },
  { id: 'second-night', category: 'voyage', title: '두 번째 밤', desc: '두 번째로 타이타닉호에 올랐습니다.', hint: '같은 배에 한 번 더 오르면 어떨까요.' },
  { id: 'five-nights', category: 'voyage', title: '다섯 번의 밤', desc: '다섯 번 끝까지 마쳤습니다.', hint: '다섯 손가락을 다 접을 때까지.' },
  { id: 'sins-of-omission', category: 'voyage', title: '방관자의 죄', desc: '밤이 끝날 때까지 아무것도 선택하지 않았습니다.', hint: '가만히 있는 것도 하나의 선택일까요?', hidden: true },
  { id: 'youngest-passenger', category: 'passenger', title: '가장 어린 승객', desc: '타이타닉의 최연소 승객, 생후 2개월 밀비나 딘과 같은 0세를 골랐습니다. 그 아이는 살아남아 97세까지 살았습니다.', hint: '가장 어린 승객은 아직 걷지도 못했습니다.', hidden: true },
  { id: 'oldest-passenger', category: 'passenger', title: '가장 나이 많은 승객', desc: '타이타닉의 최고령 승객, 3등석의 요한 스벤손(74세)과 같거나 더 많은 나이를 골랐습니다.', hint: '가장 연륜 있는 승객의 나이를 넘겨 보세요.', hidden: true },
  { id: 'dont-touch', category: 'ship', title: "Please, Don't Touch Anything", desc: '기관실 제어판의 버튼을 모두 누르고, 레버를 돌려 모든 나이를 한 번씩 골라 보았습니다.', hint: '기관실의 장치는 하나도 빠짐없이 만져 보고 싶어집니다.', hidden: true },
  { id: 'duck-gun', category: 'ship', title: '사무장의 마지막 계산', desc: '기념품 가게의 칼로 오리 사무장을 두 번 위협했습니다. 이 계산은 영수증에 적히지 않았습니다.', hint: '사무장 앞에서 날붙이를 들면 안 됩니다. 두 번은 더더욱.', hidden: true },
  { id: 'duck-beggar', category: 'ship', title: '나는 거지가 아니오리', desc: '여유자금 다섯 장을 모두 오리 사무장에게 건넸습니다. 사무장은 발끈하며 돈을 전부 돌려주었습니다.', hint: '오리 사무장에게 건넬 수 있는 것은 말만이 아닙니다.', hidden: true },
  { id: 'serious-talk', category: 'ship', title: '오리무중', desc: '되풀이되는 밤 끝에 오리 사무장이 처음으로 손님에게 되물었습니다. 그는 대답을 기다리지 않았습니다. 장부의 한 줄은 아직 비어 있습니다. 그런데, 진짜로 어떻게 선별되셨나요?', hint: '사무장에게도 묻고 싶은 것이 있습니다. 이 배의 모든 곳을 다녀 본 사람에게만.', hidden: true },
  { id: 'house-always-wins', category: 'ship', title: '하우스는 언제나 이긴다', desc: '선상 도박장에서 가진 지폐를 모두 잃었습니다. 그 시절 대서양 정기선에는 승객을 노리는 전문 도박꾼들이 이름을 바꿔 타곤 했고, 선사는 카드 놀이를 조심하라는 경고문을 걸었습니다.', hint: '도박장에서 끝까지 가 보세요. 정말로 끝까지.', hidden: true },
  { id: 'hot-streak', category: 'ship', title: '오늘 밤은 내 거다', desc: '선상 도박장에서 5연승을 거뒀습니다. 운이 영원히 따라 주는 것처럼 느껴질 때가 가장 위험한 때입니다.', hint: '도박장에서 운이 붙는 순간이 있습니다. 그 흐름을 끊지 말고 이어 가 보세요.', hidden: true },
  { id: 'parlour-suite', category: 'ship', title: '파를러 스위트', desc: '선상 도박으로 모은 지폐 870장을 내고 스위트룸으로 옮겼습니다. 1912년 타이타닉의 파를러 스위트는 편도 약 870파운드였고, 삼등석 승객 100명이 넘게 탈 수 있는 값이었습니다.', hint: '도박으로 큰돈을 모으면 사무장이 방을 바꿔 줍니다.' },
  { id: 'suite-bust', category: 'ship', title: '스위트룸의 마지막 밤', desc: '스위트룸으로 옮긴 뒤 선상 도박장에서 남은 지폐를 모두 잃었습니다. 방은 남았지만 그 밤이 지나면 남는 건 방뿐입니다.', hint: '큰방을 얻은 뒤에도 도박장은 열려 있습니다.', hidden: true },
  { id: 'slipped-hand', category: 'deck', title: '미끄러진 손', desc: '기운 갑판에서 난간을 붙잡지 못하고 바다로 떨어졌습니다.', hint: '기운 갑판에서는 손이 늘 제때 닿지는 않습니다.', hidden: true },
  { id: 'one-grab', category: 'deck', title: '한 번에', desc: '기운 갑판에서 한 번도 놓치지 않고 난간을 붙잡았습니다.', hint: '미끄러지는 갑판에서 한 번도 손을 헛짚지 마세요.' },
  { id: 'one-more', category: 'deck', title: '한 번만 더', desc: '검은 바다에서 헤엄을 다섯 번 넘게 골랐습니다.', hint: '불빛이 멀어도 팔을 멈추지 마세요.' },
  { id: 'last-arm', category: 'deck', title: '마지막 팔', desc: '체력이 다할 때까지 헤엄쳤습니다.', hint: '팔이 올라가지 않을 때까지.' },
  { id: 'driftwood', category: 'deck', title: '나뭇조각 하나', desc: '떠다니는 나뭇조각을 잡고 숨을 돌렸습니다.', hint: '바다에는 사람만 떠 있지 않습니다.' },
  { id: 'meant-to-be', category: 'deck', title: '될 놈 될', desc: '확률이 3% 이하일 때 구명정에 닿았습니다.', hint: '가능성이 거의 없을 때에도 닿는 사람이 있습니다.', hidden: true },
  { id: 'sos', category: 'ship', title: '아직은 이른 신호', desc: '전신기로 SOS(··· −−− ···)를 보냈습니다. 그날 밤 타이타닉의 통신사들도 CQD와 함께 SOS를 보냈습니다. SOS가 국제 조난 신호로 정해진 지 몇 해 되지 않은 때였습니다.', hint: '짧게 셋, 길게 셋, 다시 짧게 셋. 가장 유명한 신호를 두드려 보세요.', hidden: true },
  { id: 'child-lifted', category: 'deck', title: '두 손으로', desc: '갑판의 아이를 두 손으로 번쩍 들어 구명정에 태웠습니다. 그날 밤 구명정에 먼저 오른 승객의 대다수는 여자와 아이였습니다.', hint: '아이는 혼자 오를 수 없습니다. 안아 올려야 합니다.' },
  { id: 'friendly-fire', category: 'deck', title: '선내 수칙 제1조', desc: '들어 올린 아이를 구명정이 아닌 바다에 내려놓았습니다. 화이트 스타 라인은 이 일을 사고로 분류하지 않았습니다.', hint: '아이를 들었다면, 어디에 내려놓을지는 두 손이 정합니다.', hidden: true },
  { id: 'pushed-in', category: 'deck', title: '밀치고 오른 사람', desc: '"여자와 아이부터입니다"라는 장교의 팔을 밀치고 구명정에 올랐습니다. 그날 밤 규칙은 모든 구명정에서 같지 않았지만, 아이가 보는 앞이었습니다.', hint: '장교가 막아도 포기하지 않는다면.', hidden: true },
  { id: 'let-go-hand', category: 'deck', title: '놓은 손', desc: '난간에서 곁의 승객의 손을 놓고 혼자 떨어졌습니다. 잡고 있던 손이 따뜻했다는 것을 떨어지는 동안 알았습니다.', hint: '손을 잡았다면, 놓는 쪽도 나입니다.' },
  { id: 'fell-together', category: 'deck', title: '함께 떨어진 사람', desc: '곁의 승객과 손을 잡은 채 함께 난간에서 떨어졌습니다.', hint: '손을 잡고, 끝까지 놓지 않으면.' },
  { id: 'white-lie', category: 'deck', title: '하얀 거짓말을 믿습니까?', desc: '거짓말로 곁의 승객을 안심시킨 뒤, 그 사람과 함께 마지막까지 갔습니다.', hint: '편한 말 한마디가 끝까지 이어질 수 있을까요?', hidden: true },
  { id: 'bit-tongue', category: 'deck', title: '참았던 말', desc: '곁의 승객에게 참았던 말이 터져 나왔습니다.', hint: '모든 질문에 곱게 대답할 수는 없습니다.' },
  { id: 'last-word', category: 'deck', title: '그 말이 마지막이었다', desc: '모진 말이 쌓이자, 곁의 승객이 먼저 난간에서 손을 놓았습니다.', hint: '말은 한 번이면 충분했을지 모릅니다.', hidden: true },
  { id: 'never-liverpool', category: 'deck', title: '선미의 LIVERPOOL', desc: '타이타닉호의 선미에 적힌 "LIVERPOOL"을 사진에 담았습니다. 건조는 벨파스트 조선소에서 했지만, 등록항은 선주 화이트 스타 라인의 본거지인 리버풀이었습니다.', hint: '배 뒤쪽에 적힌 글자를 사진에 담아 보세요.', hidden: true },
  { id: 'angry-mob', category: 'deck', title: '성난 승객들', desc: '소문이 도는 갑판에서 100명을 쓰러뜨렸습니다. 쓰러진 사람들은 그냥 일어나지 않았습니다.', hint: '급한 마음에 길을 만들다 보면, 너무 많이 만든 길에는 대가가 따릅니다.', hidden: true },
  { id: 'watchtower', category: 'deck', title: '망루의 시간', desc: '난간에서 37초 동안 바다만 바라보았습니다. 같은 시간에, 누군가는 빙산을 보았습니다.', hint: '난간에서 바다를 오래, 아주 오래 바라보세요.', hidden: true },
  { id: 'good-dog', category: 'dog', title: '좋은 아이', desc: '부두 구석에 숨은 강아지를 찾아, 작은 승객의 눈으로 타이타닉호에 올랐습니다.', hint: '부두 한구석에서 무언가가 숨을 죽이고 있습니다.', hidden: true },
  { id: 'dog-all-endings', category: 'dog', title: '일곱 번의 밤, 한 마리의 개', desc: '강아지가 맞이할 수 있는 일곱 가지 결말을 모두 보았습니다.', hint: '작은 승객의 밤은 한 가지가 아닙니다.', hidden: true },
  { id: 'dog-miracle', category: 'dog', title: '멈춘 구명정', desc: '강아지의 외침이 구명정을 멈춰 세웠습니다. 기록에는 없는 결말입니다.', hint: '외침이 닿는다면 구명정도 멈출지 모릅니다.', hidden: true },
  { id: 'be-right-back', category: 'ship', title: '둘러보고 올게요', desc: '거대한 홀에서 세 갈래 길을 모두 들여다보았습니다. 같은 배 안에서도 그 세 곳은 전혀 다른 세상이었습니다.', hint: '고르기 전에, 문을 하나씩 열어 보세요.' },
  { id: 'hidden-ducks', category: 'ship', title: '여기에도 오리', desc: '세 방에 숨어 있던 오리를 모두 찾아냈습니다. 은빛 도자기, 깎아 만든 나무, 양철 장난감. 같은 오리여도 어느 방에 있느냐에 따라 모양이 달랐습니다.', hint: '숨는 것을 좋아하는 오리들이 있다.', hidden: true },
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

/** 개발 중 확인용: 업적을 강제로 얻거나 되돌린다 (팝업 없이 목록만 갱신) */
export function debugSetAchievement(id: string, on: boolean) {
  const have = loadAchievements();
  if (on) have[id] = have[id] || Date.now(); else delete have[id];
  try { localStorage.setItem(KEY, JSON.stringify(have)); } catch { /* 저장 불가 */ }
  window.dispatchEvent(new Event('storage'));
}
export function debugSetAll(on: boolean) {
  const have: Record<string, number> = {};
  if (on) ACHIEVEMENTS.forEach((a) => { have[a.id] = Date.now(); });
  try { localStorage.setItem(KEY, JSON.stringify(have)); } catch { /* 저장 불가 */ }
  window.dispatchEvent(new Event('storage'));
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



// 세 방에 숨은 오리를 찾은 기록 (이 브라우저에만 저장). 세 마리를 모두 찾으면 업적, 그다음 오리 사무장을 처음 만날 때 한 번 언급한다
const DUCKS_KEY = 'titanic_hidden_ducks';
const DUCKS_TOLD_KEY = 'titanic_hidden_ducks_told';
export const DUCK_ROOMS = ['1', '2', '3'] as const;

export function loadFoundDucks(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DUCKS_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 찾은 오리를 기록하고, 세 마리를 다 찾았으면 업적을 준다. 지금까지 찾은 수를 돌려준다 */
export function onDuckFound(room: string): number {
  const found = new Set(loadFoundDucks());
  found.add(room);
  try {
    localStorage.setItem(DUCKS_KEY, JSON.stringify([...found]));
  } catch {
    // 저장 불가: 이번 접속에서만 센다
  }
  if (DUCK_ROOMS.every((r) => found.has(r))) unlock('hidden-ducks');
  return found.size;
}

/** 세 마리를 모두 찾았는데 사무장이 아직 그 일을 언급하지 않았는가 */
export function ducksAllFoundUntold(): boolean {
  try {
    return DUCK_ROOMS.every((r) => loadFoundDucks().includes(r)) && !localStorage.getItem(DUCKS_TOLD_KEY);
  } catch {
    return false;
  }
}
export function markDucksTold() {
  try { localStorage.setItem(DUCKS_TOLD_KEY, '1'); } catch { /* 저장 불가 */ }
}
