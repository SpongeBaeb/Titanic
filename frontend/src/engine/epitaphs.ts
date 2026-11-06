/**
 * 사망 카드 문구. 모두 로런스 비즐리(1912년 침몰의 생존자)의 책 『타이타닉호의 침몰』 본문에서 가져온 문장이다.
 * 원문은 퍼블릭 도메인(Project Gutenberg #6675)이며, 영어 문장은 본문을 그대로 옮겼다. 번역은 이 프로젝트의 것이다.
 * 출처를 확인하지 못한 말(예: 에드워드 스미스 선장의 1907년 발언)은 넣지 않는다.
 *
 * 매번 다른 문구가 나오도록, 한 번 본 문구는 이 브라우저에 기록해 두고 모두 본 뒤에야 다시 돌려 쓴다.
 */
export interface Epitaph {
  id: string;
  en: string;
  ko: string;
  /** 어느 부분인지 (출처 표시용) */
  where: string;
}

export const EPITAPH_SOURCE = '로런스 비즐리, 『타이타닉호의 침몰』(1912)';

export const EPITAPHS: Epitaph[] = [
  { id: 'improbability', where: '1장', en: 'The improbability of such a thing ever happening was what staggered humanity.', ko: '그런 일이 일어날 가능성이 거의 없다는 사실이, 오히려 인류를 아연케 했다.' },
  { id: 'lights', where: '6장', en: 'The simple statement that the lights kept on to the last is really their epitaph…', ko: '불이 마지막까지 꺼지지 않고 켜져 있었다는 단순한 사실, 그것이 곧 그들의 묘비명이다.' },
  { id: 'cannot-sink', where: '6장 (한 승객의 말을 옮긴 것)', en: 'This ship cannot sink; it is only a question of waiting until another ship comes up and takes us off.', ko: '"이 배는 가라앉을 수 없소. 다른 배가 와서 우리를 데려갈 때까지 기다리기만 하면 되오."' },
  { id: 'half-full', where: '6장', en: 'It is a pitiful thing to recall the effects of sending down the first boats half full.', ko: '처음 내려간 구명정들이 반쯤 빈 채였다는 것을 떠올리면, 가슴이 아프다.' },
  { id: 'duty', where: '6장', en: 'But this courage is required of every engineer and it is not called by that name: it is called "duty."', ko: '그러나 이런 용기는 모든 기관사에게 요구되는 것이며, 그것은 용기라 불리지 않고 "의무"라 불린다.' },
  { id: 'engines', where: '6장', en: 'To stand by his engines to the last possible moment is his duty.', ko: '마지막 순간까지 기관 곁을 지키는 것, 그것이 그의 의무다.' },
  { id: 'cold-lonely', where: '6장', en: '…the sea and the night both seemed very cold and lonely; and here was the ship, so firm and well lighted and warm.', ko: '…바다와 밤은 몹시 차갑고 외롭게 느껴졌고, 배는 그토록 단단하고 환하고 따뜻했다.' },
  { id: 'cries', where: '서문', en: 'the cries that came to us afloat on the sea from those sinking in the ice-cold water', ko: '얼음처럼 차가운 물속에서 가라앉는 이들이, 바다 위에 떠 있던 우리에게 보낸 외침' },
  { id: 'calm-sea', where: '2장', en: 'The sea was calm,—so calm, indeed, that very few were absent from meals:', ko: '바다는 잔잔했다. 너무나 잔잔해서, 식사 자리를 비운 사람이 거의 없을 정도였다.' },
  { id: 'band', where: '1장', en: 'while the band grouped outside the gymnasium doors played with such supreme courage in face of the water which rose foot by foot before their eyes', ko: '악단은 체육관 문 앞에 모여, 눈앞에서 한 뼘씩 차오르는 물 앞에서도 더없이 용감하게 연주했다.' },
];

const KEY = 'titanic_epitaphs_seen';

function loadSeen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * 아직 보지 않은 문구 중에서 하나를 무작위로 고른다. 모두 보았으면 기록을 비우고 다시 시작한다
 * (이때 바로 직전에 본 문구는 한 번 건너뛴다). 저장이 막혀 있어도 직전 문구와는 겹치지 않게 고른다.
 */
let lastShown = '';

/** 보여 줄 문구를 고르기만 한다(기록하지 않는다). 렌더링 중에 불러도 안전하다 */
export function pickEpitaph(pool: Epitaph[] = EPITAPHS): Epitaph {
  const seen = loadSeen().filter((id) => pool.some((e) => e.id === id));
  let fresh = pool.filter((e) => !seen.includes(e.id));
  if (fresh.length === 0) {
    fresh = pool.filter((e) => e.id !== lastShown);
    if (fresh.length === 0) fresh = pool;
  }
  return fresh[Math.floor(Math.random() * fresh.length)];
}

/** 실제로 보여 준 문구를 기록한다. 모두 보았다면 기록을 비우고 이 문구부터 다시 시작한다 */
export function markEpitaphSeen(id: string, pool: Epitaph[] = EPITAPHS) {
  lastShown = id;
  let seen = loadSeen().filter((x) => pool.some((e) => e.id === x));
  if (pool.every((e) => seen.includes(e.id))) seen = [];
  if (!seen.includes(id)) seen.push(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    /* 저장이 막혀 있어도 동작한다 */
  }
}

/** 한 번에 고르고 기록한다 (테스트와 단순한 사용처용) */
export function nextEpitaph(pool: Epitaph[] = EPITAPHS): Epitaph {
  const pick = pickEpitaph(pool);
  markEpitaphSeen(pick.id, pool);
  return pick;
}
