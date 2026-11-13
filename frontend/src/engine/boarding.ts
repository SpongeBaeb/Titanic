import { submitAnswers } from '@/lib/submit';

/**
 * Q7 뒤의 탑승 판정과 W2(죽음의 방식) 생존 판정.
 * 확률은 서버가 결과 화면에 보여 주는 '보정 확률(adjusted_probability)'을 그대로 쓴다.
 * 서버에 닿지 못하면 같은 규칙(통계 표 + 서버와 같은 보정값)으로 어림해서 쓴다.
 */
type Dict = Record<string, unknown>;

const AGE_BY_GROUP: Record<string, number> = { '0-9': 5, '10-17': 14, '18-29': 24, '30-39': 35, '40-49': 45, '50-59': 55, '60+': 65 };

/** 승객의 나이 (정확한 나이가 있으면 그것, 없으면 구간 대표값) */
export function ageOf(answers: Dict, extras: Dict): number | undefined {
  if (typeof extras.age === 'number') return extras.age;
  const g = answers.ageGroup;
  return typeof g === 'string' ? AGE_BY_GROUP[g] : undefined;
}

/** 11세 이하: 죽는 장면이 없으므로 항상 구명정에 탄다 */
export const isChildAge = (age: number | undefined) => age !== undefined && age <= 11;

// 서버(backend/engine/survival_engine.py)의 보정값과 같다
const RUMOR_MOD: Record<string, number> = { check_escape: 5, check_crew: 2, calm_others: -2, follow_crowd: -5 };
const FINAL_MOD: Record<string, number> = { yield_seat: -15, me_first: 20, secure_mine: 10, yield_weak: -10, observe: 0 };
// 서버에 닿지 않을 때만 쓰는 역사 통계의 대략값(%): 성별 × 객실 분위기
const BASE: Record<string, Record<number, number>> = { female: { 1: 97, 2: 90, 3: 50 }, male: { 1: 35, 2: 15, 3: 14 } };

/** 서버를 쓸 수 없을 때의 어림 확률(%) */
export function estimateAdjusted(answers: Dict, extras: Dict): number {
  const sex = answers.sex === 'female' ? 'female' : 'male';
  const cls = [1, 2, 3].includes(Number(answers.pclass)) ? Number(answers.pclass) : 3;
  const age = ageOf(answers, extras);
  let p = BASE[sex][cls];
  if (age !== undefined && age < 12) p = cls === 3 ? 40 : 92; // 어린이 먼저
  p += RUMOR_MOD[String(answers.rumorAction)] ?? 0;
  p += extras.lifebuoy ? 3 : 0;
  p += FINAL_MOD[String(answers.finalAction)] ?? 0;
  return Math.max(1, Math.min(99, p));
}

export interface Verdict {
  /** 판정에 쓴 확률(%) */
  adjusted: number;
  boarded: boolean;
  source: 'server' | 'estimate';
}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

/** Q7 의 선택까지 반영된 답으로 서버 확률을 받아 구명정에 탔는지 굴린다 */
export async function decideBoarding(answers: Dict, extras: Dict, alreadyBoarded: boolean): Promise<Verdict> {
  let adjusted: number;
  let source: Verdict['source'] = 'server';
  try {
    const res = await withTimeout(submitAnswers(answers, extras), 5000);
    adjusted = res.adjusted_probability;
  } catch {
    adjusted = estimateAdjusted(answers, extras);
    source = 'estimate';
  }
  // 자리를 양보하고 물러섰거나, 가만히 보며 자리가 사라지게 둔 사람은 탈 수 없다 (11세 이하와 이미 탄 사람은 예외)
  const gaveUp = answers.finalAction === 'yield_seat' || answers.finalAction === 'observe' || answers.finalAction === 'yield_weak';
  // 장교의 손을 잡고 끌려 오르거나(장교의 손), 빈자리에 직접 올라탄(빈자리) 사람은 화면에서 이미 올라탔다: 확률로 되돌리지 않는다.
  // 아이를 먼저 태우고 자신은 물러선 사람(아이 선택)도 타지 못한다 (아이를 태운 뒤 올라타면 '내 자리를 확보하고 주변을 돕는다'로 기록된다).
  const climbed = answers.finalAction === 'secure_mine' || answers.finalAction === 'me_first';
  const boarded = alreadyBoarded || isChildAge(ageOf(answers, extras)) || climbed || (!gaveUp && Math.random() * 100 < adjusted);
  return { adjusted, boarded, source };
}

export type W2Way = 'swim' | 'jump' | 'sink';

/** W2 에서 고른 방식의 생존 확률(%): 능동적일수록 조금 높고, 서버 확률이 높은 사람이 조금 더 유리하다 */
export function w2Chance(way: W2Way, adjusted: number): number {
  const a = adjusted / 100;
  if (way === 'swim') return 4 + 10 * a;
  if (way === 'jump') return 2 + 6 * a;
  return 1 + 4 * a;
}
export const rollW2 = (way: W2Way, adjusted: number) => Math.random() * 100 < w2Chance(way, adjusted);

/**
 * 도장(SURVIVED/PERISHED, SAVED/LOST)과 공유 카드의 색을 정하는 결과.
 * 탑승 판정이 있었다면 이야기 속 결과(탑승했거나, 물에서 살아 돌아옴)를 따르고,
 * 없으면(공유 링크로 연 화면 등) 예전처럼 보정 확률이 절반 이상인지로 정한다.
 */
export function storyAlive(extras: Dict, adjusted: number | null | undefined): boolean {
  if (typeof extras.boarded === 'boolean') return extras.boarded || extras.w2Survived === true;
  return (adjusted ?? 0) >= 50;
}

/** 도장 아래 작은 글씨: 이야기 속에서 어떻게 됐는지 (판정이 없으면 null) */
export function storyLine(extras: Dict): string | null {
  if (typeof extras.boarded !== 'boolean') return null;
  if (extras.boarded) return extras.pushedIn === true ? '장교의 팔을 밀치고 구명정에 올랐습니다' : extras.childBoarded === true ? '아이를 먼저 태우고 구명정에 올랐습니다' : '구명정에 올랐습니다';
  // 난간에서 노라와 있었던 일(W1)과 편지가 한 줄에 반영된다
  const w1 = (extras.w1 ?? {}) as { letter?: string; outcome?: string };
  const letter = w1.letter === 'given';
  if (extras.w2Survived === true) {
    if (letter) return extras.letterLost === true ? '노라의 편지는 외투와 함께 떠내려갔습니다' : '노라가 어머니께 쓴 편지를 쥔 채 돌아왔습니다';
    return '물에서 살아 돌아왔습니다';
  }
  if (letter) return '노라의 편지는 당신과 함께 가라앉았습니다';
  if (w1.outcome === 'let_go') return '노라는 어머니의 편지를 열지 못한 채 가라앉았습니다';
  if (w1.outcome === 'alone') return '난간에 남은 사람의 이름을 기억합니다';
  if (w1.outcome === 'gone') return '노라는 먼저 손을 놓았습니다';
  return '돌아오지 못했습니다';
}

// ── W2 헤엄: 헤엄칠 때마다 구명정에 닿을 확률을 한 번 굴리고, 굴릴수록 확률이 내려간다 ──
/** 헤엄 규칙의 상수 (여기서만 고친다) */
export const SWIM = {
  base: 2, // 첫 헤엄의 확률(%): base + slope × (보정 확률/100)
  slope: 6,
  decay: 0.8, // 한 번 헤엄칠 때마다 곱해진다
  cost: 12.5, // 한 번 헤엄에 닳는 체력 (가득 = 100, 기본 8번)
  forcedCost: 12, // 난간에서 끝까지 버티다 떨어지면 깎인 채 시작한다
  slipCost: 22, // 난간을 못 붙잡고 떨어지면 더 깎인 채 시작한다
  buoyMul: 0.8, // 구명환: 덜 닳는다
  coatMul: 0.8, // 외투를 벗으면 덜 닳지만 추위가 빨리 온다
  coatCold: 1.7,
  togetherMul: 1.4, // 곁의 승객을 끌고 가면 더 닳는다
  togetherBonus: 1.5, // 대신 그 사람이 끌어올려 준다(%p)
  breathGood: 0.6,
  breathBad: 1.3,
  plankRest: 15, // 부유물을 잡고 쉬면 돌아오는 체력
  shoutCost: 8,
  shoutBonus: 2, // 소리쳐 부르면 다음 한 번(%p)
};

/** k 번 헤엄친 뒤 다음 헤엄이 구명정에 닿을 확률(%) */
export function swimChance(adjusted: number, k: number, bonus = 0): number {
  const a = Math.max(0, Math.min(100, adjusted)) / 100;
  return Math.max(0.2, (SWIM.base + SWIM.slope * a) * Math.pow(SWIM.decay, k) + bonus);
}

interface W1Result { holds?: number; lies?: number; truths?: number; curses?: number; outcome?: string; how?: string }

/** 난간 장면의 행동과 떨어진 방식에 따른 헤엄의 출발 조건 */
export function swimStart(extras: Dict): { stamina: number; bonus: number; costMul: number; together: boolean } {
  const w1 = (extras.w1 ?? {}) as W1Result;
  const slipped = (extras.grip as { fail?: boolean } | undefined)?.fail === true;
  const together = w1.outcome === 'together';
  let bonus = 0;
  if (w1.holds) bonus += 0.5;
  if (w1.lies) bonus += 0.3;
  if (w1.curses) bonus -= 0.5;
  if (w1.truths) bonus -= 0.3;
  if (together) bonus += SWIM.togetherBonus;
  let stamina = 100;
  if (slipped) stamina -= SWIM.slipCost;
  else if (w1.how !== 'jump') stamina -= SWIM.forcedCost;
  const costMul = (extras.lifebuoy ? SWIM.buoyMul : 1) * (together ? SWIM.togetherMul : 1);
  return { stamina, bonus, costMul, together };
}

// ── 결과 단말기: 통계 확률에서 최종 확률까지 오르내린 과정을 줄 단위로 나눈다 ──
export interface ProbRow { label: string; delta: number; after: number }
const RUMOR_LABEL: Record<string, string> = { check_escape: '구명조끼와 탈출 경로를 확인함', check_crew: '선원에게 상황을 확인함', calm_others: '사람들을 진정시킴', follow_crowd: '사람들을 따라감' };
const FINAL_LABEL: Record<string, string> = { yield_seat: '자리를 양보함', me_first: '먼저 올라탐', secure_mine: '내 자리를 확보함', yield_weak: '아이를 먼저 태움', observe: '상황을 지켜봄' };
const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * 서버가 준 통계 확률(stat)에서 최종 확률(adjusted)까지의 단계.
 * 선택별 증감은 서버와 같은 보정값 표로 계산하고, 실제 최종 값과의 차이는 마지막 줄 '그 밖의 영향'으로 맞춘다 (합계는 늘 adjusted).
 */
export function probRows(answers: Dict, extras: Dict, stat: number, adjusted: number): ProbRow[] {
  const rows: ProbRow[] = [];
  let cur = stat;
  const push = (label: string, delta: number) => {
    if (Math.abs(delta) < 0.05) return;
    cur = r1(cur + delta);
    rows.push({ label, delta: r1(delta), after: cur });
  };
  const rumor = String(answers.rumorAction);
  if (rumor in RUMOR_MOD) push(`소문 속에서: ${RUMOR_LABEL[rumor]}`, RUMOR_MOD[rumor]);
  if (extras.lifebuoy) push('구명환을 챙김', 3);
  const fin = String(answers.finalAction);
  if (fin in FINAL_MOD) push(`구명정 앞에서: ${FINAL_LABEL[fin]}`, FINAL_MOD[fin]);
  push('그 밖의 영향', adjusted - cur);
  if (rows.length) rows[rows.length - 1].after = r1(adjusted);
  return rows;
}

/** 단말기의 확률 줄 아래에 찍는 이야기 속 판정들 */
export function verdictRows(extras: Dict): { label: string; value: string; good: boolean }[] {
  const out: { label: string; value: string; good: boolean }[] = [];
  if (typeof extras.boarded !== 'boolean') return out;
  out.push({ label: '구명정 탑승 판정', value: extras.boarded ? '탑승' : '미탑승', good: extras.boarded });
  const grip = extras.grip as { fail?: boolean } | undefined;
  if (grip) out.push({ label: '기운 갑판의 난간', value: grip.fail ? '놓침' : '붙잡음', good: !grip.fail });
  if (!extras.boarded && typeof extras.w2Survived === 'boolean') {
    out.push({ label: '바다에서', value: extras.w2Survived ? '구명정에 닿음' : '닿지 못함', good: extras.w2Survived });
  }
  return out;
}
