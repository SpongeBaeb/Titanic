/**
 * 승객 정보: 지금까지의 답에서 "이 승객이 누구인가"를 한 곳에서 만든다 (선택지_개정안.md).
 * 모든 장면이 같은 값으로 글과 잠금을 고르므로, 장면마다 흩어진 조건문이 생기지 않는다.
 * 객실 등급(pclass)은 여기서 숫자로만 다루고, 화면의 어떤 글에도 등급 이름을 쓰지 않는다 (등급은 결과 화면에서 처음 밝힌다).
 */
export type Port = 'S' | 'C' | 'Q'; // 사우샘프턴, 셰르부르, 퀸스타운
export type Sex = 'male' | 'female';
/** 아기 0~5 · 꼬마 손님 6~11 · 작은 손님 12~15 · 젊은이 16~17 · 어른 18~59 · 노년 60+ */
export type Band = 'baby' | 'kid' | 'small' | 'young' | 'adult' | 'old';

export interface Persona {
  port: Port;
  sex: Sex | null;
  /** 정확한 나이. 기록이 없으면 고른 구간의 대표값 */
  age: number | null;
  band: Band | null;
  companion: string | null;
  /** 객실 분위기(1, 2, 3). 글에 등급 이름으로 쓰지 않는다 */
  cabin: 1 | 2 | 3 | null;
  /** Q6 에서 고른 행동(calm_others, check_crew, check_escape, follow_crowd). 아직 고르지 않았으면 null */
  rumor?: string | null;
}

const BAND_OF_GROUP: Record<string, number> = { '0-9': 7, '10-17': 14, '18-29': 24, '30-39': 35, '40-49': 45, '50-59': 55, '60+': 65 };

export function bandOf(age: number): Band {
  if (age <= 5) return 'baby';
  if (age <= 11) return 'kid';
  if (age <= 15) return 'small';
  if (age <= 17) return 'young';
  if (age <= 59) return 'adult';
  return 'old';
}

export function buildPersona(answers: Record<string, unknown> | undefined, extras: Record<string, unknown> | undefined): Persona {
  const a = answers ?? {};
  const e = extras ?? {};
  const ageGroup = typeof a.ageGroup === 'string' ? a.ageGroup : null;
  const age = typeof e.age === 'number' ? e.age : ageGroup && BAND_OF_GROUP[ageGroup] != null ? BAND_OF_GROUP[ageGroup] : null;
  const port: Port = a.embarked === 'C' || a.embarked === 'Q' ? a.embarked : 'S';
  const pc = Number(a.pclass);
  return {
    port,
    sex: a.sex === 'male' || a.sex === 'female' ? a.sex : null,
    age,
    band: age === null ? null : bandOf(age),
    companion: typeof a.companion === 'string' ? a.companion : null,
    cabin: pc === 1 || pc === 2 || pc === 3 ? pc : null,
    rumor: typeof a.rumorAction === 'string' ? a.rumorAction : null,
  };
}

/** 글에서 그 나이의 승객을 부르는 말 */
export function callName(p: Persona): string {
  switch (p.band) {
    case 'baby': return '아기';
    case 'kid': return '꼬마 손님';
    case 'small': return '작은 손님';
    case 'young': return '젊은이';
    case 'old': return p.sex === 'female' ? '노부인' : '노신사';
    default: return '손님';
  }
}
