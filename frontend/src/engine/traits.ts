import type { Pick } from './types';

/**
 * 성향 육각형: 문항 × 축 점수표(성향_점수표.md v2)를 코드로 옮긴 것이다. (점수 값과 문구는 초안)
 * 고른 선택의 축별 점수를 더하고, "같은 장면들에서 가능한 모든 선택 조합 중 내 합이 상위 몇 %인가"(백분위)로 0~100점을 만든다.
 * 장면 수가 사람마다 다르다(밤 장면 N1~N3는 ?night=1 일 때만)고 해서, 실제로 거친 장면만으로 분포를 만든다.
 */
export const AXES = [
  { id: 'altruism', ko: '이타성' },
  { id: 'leadership', ko: '리더십' },
  { id: 'resolve', ko: '결단력' },
  { id: 'adventure', ko: '모험심' },
  { id: 'conformity', ko: '순응성' },
  { id: 'caution', ko: '신중함' },
] as const;
export type AxisId = (typeof AXES)[number]['id'];

type Scores = [number, number, number, number, number, number]; // 이타·리더·결단·모험·순응·신중

// 장면 id → 선택값(또는 선택지 id) → 축별 점수
const TABLE: Record<string, Record<string, Scores>> = {
  Q5: {
    experience: [0, 0, 0, 2, 0, 0],
    stability: [0, 0, 0, 0, 1, 1],
    change: [0, 0, 1, 3, 0, 0],
  },
  // Q6 갑판에서 실제로 쓰러뜨린 사람 수에 따른 보정 (장면 선택이 아니라 행동): 이타성↓ 순응성↓ 신중함↓
  Q6k: {
    none: [0, 0, 0, 0, 0, 0],
    some: [-1, 0, 0, 0, 0, 0], // 50~79명 (쓰러뜨리기 쉬워서 기준을 높였다)
    many: [-2, 0, 0, 0, -1, -1], // 80명 이상 (100명이면 히든 엔딩)
  },
  Q6: {
    calm_others: [1, 2, 0, 0, 1, 0], // 리더 3 → 2, 순응 +1: 가장 많이 고르는 선택이 리더십 한 축으로만 쏠리지 않게
    check_crew: [0, 0, 1, 0, 0, 3],
    check_escape: [-1, 0, 3, 0, 0, 1],
    follow_crowd: [0, 0, -1, 0, 3, 0],
  },
  N1: {
    wake: [3, 1, 0, 0, 0, 0],
    vest: [0, 0, 2, 0, 0, 1],
    wait: [0, 0, 0, 0, 3, 1],
    bag: [-1, 0, -1, 0, 0, 2],
    crew: [0, 0, 1, 0, 0, 2],
  },
  N2: {
    organize: [1, 3, 0, 0, 0, 0],
    rule: [0, 0, 0, 0, 3, 1],
    child: [3, 0, 0, 0, 1, 0],
    weak: [3, 0, 0, 0, 1, 0],
    seat: [0, 0, 2, 1, 0, 0],
    boat: [0, 0, 2, 1, 0, 1],
    drop: [0, 0, 2, 2, 0, 0],
  },
  N3: {
    hold: [2, 0, 0, 0, 1, 0],
    jump: [0, 0, 2, 3, 0, 0],
    high: [0, 0, 1, 0, 0, 3],
    leadup: [0, 3, 1, 0, 0, 0],
    row: [0, 0, 1, 0, 0, 1],
    back: [2, 0, 0, 0, 0, 1],
    quiet: [0, 0, 0, 0, 1, 1],
    timeout: [0, 0, -1, 0, 1, 1],
  },
  Q7: {
    yield_seat: [3, 0, -1, 0, 1, 0],
    yield_weak: [2, 1, 0, 0, 1, 0], // 리더 2 → 1, 순응 +1
    secure_mine: [1, 1, 2, 0, 0, 0],
    me_first: [-2, 0, 3, 0, 0, 0],
    observe: [0, 0, -2, 0, 2, 2],
  },
  // W1 난간에서 노라와 어떻게 떨어졌나 (구명정에 타지 못한 사람만 거친다). 착한 선택 하나가 이타성에만 몰리지 않게 축을 나눴다
  W1: {
    together: [2, 0, 1, 0, 1, 0], // 손을 잡고 신뢰를 지킨 채 함께 떨어짐
    let_go: [-1, 0, 3, 0, 0, 0], // 손을 잡았다가 뿌리침
    alone: [0, 0, 1, 2, 0, 0], // 손을 잡지 않고 혼자 뛰어듦
    gone: [-1, 0, 0, 0, 0, 2], // 노라가 먼저 손을 놓음
  },
};

/**
 * 선택지가 얼마나 흔히 고르는지(가정치, 기본 1). 백분위의 기준을 "모든 선택 조합"이 아니라 "흔한 선택을 하는 사람들"로 잡는다.
 * 이렇게 하지 않으면 대부분이 고르는 착한 선택이 한 축(이타성)만 계속 높여 유형이 한쪽으로 쏠린다.
 * 값은 아직 실제 통계가 아니라 짐작이다. 서버에 선택이 모이면 실제 비율로 바꾼다. 비우면 모든 선택이 같은 비중이 된다.
 */
const PRIOR: Record<string, Record<string, number>> = {
  Q6: { calm_others: 40, check_crew: 25, check_escape: 20, follow_crowd: 15 },
  Q7: { yield_seat: 25, yield_weak: 35, secure_mine: 25, me_first: 5, observe: 10 },
  W1: { together: 60, alone: 20, let_go: 5, gone: 15 },
};

export interface TraitType {
  ko: string;
  en: string;
  desc: string;
  /** 공유 카드 가운데에 크게 들어가는 한 줄 (35자 안쪽) */
  line: string;
  /** 유형 인장 번호 1~15 (public/result/symbol_XX.webp). TYPES 에 적힌 순서와 같다 */
  symbol?: number;
}

// 상위 2개 축 조합 → 15가지 유형 (이름은 작업용 임시명, 설명은 초안)
const TYPES: Record<string, TraitType> = {
  'altruism+leadership': { ko: '진정한 리더', en: 'TRUE LEADER', desc: '사람들을 안심시키고 앞장서서 이끄는 사람. 위기 속에서 질서를 만드는 쪽을 택했습니다.', line: '무너지는 갑판 위에서, 제 목소리로 남의 숨을 붙든 사람.' },
  'adventure+resolve': { ko: '기회주의자', en: 'OPPORTUNIST', desc: '머뭇거리지 않고 틈을 찾아 움직이는 사람. 위험이 곧 기회라고 믿었습니다.', line: '배가 기울자 문이 열렸고, 그는 돌아보지 않고 달렸다.' },
  'caution+conformity': { ko: '조용한 목격자', en: 'SILENT WITNESS', desc: '서두르지 않고 지켜보며 흐름을 따르는 사람. 가장 안전해 보이는 때를 기다렸습니다.', line: '끝까지 눈을 감지 않았다. 아무도 구하지는 못했어도.' },
  'altruism+conformity': { ko: '곁을 지키는 사람', en: 'THE COMPANION', desc: '혼자 앞서가기보다 곁의 사람과 끝까지 함께하는 쪽을 택했습니다.', line: '함께 가라앉는 일이, 혼자 사는 일보다 덜 외로웠다.' },
  'caution+resolve': { ko: '냉정한 전략가', en: 'COLD STRATEGIST', desc: '확인하고 계산한 뒤 단호하게 움직이는 사람. 감정보다 정보를 믿었습니다.', line: '심장은 얼음 위에 두고, 살 길만 헤아렸다.' },
  'leadership+resolve': { ko: '전략적 생존자', en: 'STRATEGIC SURVIVOR', desc: '이끌면서도 자신의 자리를 놓치지 않는 사람. 살아남아야 도울 수 있다고 믿었습니다.', line: '살아남은 손에만 남을 도울 힘이 남는다고 믿었다.' },
  'adventure+conformity': { ko: '아름다운 패배자', en: 'BEAUTIFUL LOSER', desc: '큰 꿈을 품었지만 흐름을 거스르지 못한 사람. 낭만과 순응 사이에 있었습니다.', line: '낭만은 끝내 놓지 않았고, 대신 구명정을 놓쳤다.' },
  'adventure+altruism': { ko: '고귀한 낭만가', en: 'NOBLE ROMANTIC', desc: '새로운 것을 좋아하면서도 남을 먼저 생각한 사람. 이상을 포기하지 않았습니다.', line: '내어 준 자리 위로 별이 먼저 와 앉았다.' },
  'altruism+caution': { ko: '보호자', en: 'PROTECTOR', desc: '조용히 살피며 약한 사람을 챙기는 사람. 위험을 먼저 가늠하고 곁을 지켰습니다.', line: '제 몸이 얼어 가는 줄도 모르고, 남의 어깨에 담요를 얹었다.' },
  'caution+leadership': { ko: '침착한 지휘관', en: 'THE COMMANDER', desc: '흔들리지 않고 상황을 읽으며 사람들을 이끄는 사람. 침착함이 가장 큰 무기였습니다.', line: '모두의 심장이 흔들릴 때, 그의 목소리만 수평이었다.' },
  'conformity+leadership': { ko: '질서의 수호자', en: 'THE ORDERKEEPER', desc: '규칙과 순서를 지키게 하는 사람. 혼란 속에서 질서가 모두를 살린다고 믿었습니다.', line: '아수라장에도 줄은 섰다. 그가 서 있었으므로.' },
  'adventure+caution': { ko: '비극의 예술가', en: 'TRAGIC ARTIST', desc: '위험을 알면서도 끌려가는 사람. 신중함과 호기심이 한꺼번에 있었습니다.', line: '위험인 줄 알았기에 더 아름다워, 그쪽으로 걸어갔다.' },
  'adventure+leadership': { ko: '개척자', en: 'THE PIONEER', desc: '새로운 길을 먼저 열고 사람들을 이끄는 사람. 정해진 길보다 열리는 길을 믿었습니다.', line: '길이 없다면 밟아 만들면 된다며, 얼음 위로 첫발을 뗐다.' },
  'conformity+resolve': { ko: '실용주의자', en: 'THE PRAGMATIST', desc: '남들이 가는 길을 따르되 필요할 때는 단호한 사람. 현실에 맞게 움직였습니다.', line: '낭만은 사치라 불렀고, 살아남기는 가장 현실적인 시였다.' },
  'altruism+resolve': { ko: '용기 있는 희생자', en: 'THE HERO', desc: '남을 위해 결단하는 사람. 자신의 몫을 내놓는 선택도 망설이지 않았습니다.', line: '제 몫의 내일을 건네고, 먼저 어둠에 익숙해졌다.' },
};

// 유형 인장 번호: TYPES 에 적힌 순서(진정한 리더=1 … 용기 있는 희생자=15)
Object.values(TYPES).forEach((t, i) => { t.symbol = i + 1; });

/** 이름(ko)으로 유형을 찾는다 (궁합표에서 쓴다) */
export const typeByKo = (ko: string): TraitType | undefined => Object.values(TYPES).find((t) => t.ko === ko);

export interface CompatEntry { ko: string; why: string }
/**
 * 유형별 궁합. 잘 맞는 유형 둘, 안 맞는 유형 하나, 그리고 이유 한 줄.
 * 두 사람이 같은 위기에서 서로의 선택을 어떻게 받아들였을지를 적었다 (재미로 보는 궁합이며 실제 성격 진단이 아니다).
 */
export const COMPAT: Record<string, { good: [CompatEntry, CompatEntry]; bad: CompatEntry }> = {
  '진정한 리더': { good: [{ ko: '곁을 지키는 사람', why: '앞장서는 목소리 옆에 끝까지 남아 주는 사람' }, { ko: '보호자', why: '당신이 앞을 열면, 뒤를 조용히 챙겨 준다' }], bad: { ko: '기회주의자', why: '남의 숨보다 제 문부터 찾는 쪽과는 방향이 엇갈린다' } },
  '기회주의자': { good: [{ ko: '냉정한 전략가', why: '당신이 틈을 보면, 그는 계산으로 길을 연다' }, { ko: '전략적 생존자', why: '살아남는 일에 서로 군말이 없다' }], bad: { ko: '진정한 리더', why: '모두를 붙들려는 사람 앞에서는 발이 무거워진다' } },
  '조용한 목격자': { good: [{ ko: '질서의 수호자', why: '그가 줄을 세우면, 당신은 조용히 그 줄에 선다' }, { ko: '곁을 지키는 사람', why: '말없이 곁에 있어 주는 일을 서로 알아본다' }], bad: { ko: '개척자', why: '먼저 뛰어드는 사람 곁에서는 숨을 곳이 없다' } },
  '곁을 지키는 사람': { good: [{ ko: '진정한 리더', why: '이끄는 사람 곁에서 가장 든든한 사람' }, { ko: '보호자', why: '서로의 담요가 되어 주는 사이' }], bad: { ko: '냉정한 전략가', why: '함께 가라앉자는 마음과 살 길만 헤아리는 계산이 부딪힌다' } },
  '냉정한 전략가': { good: [{ ko: '전략적 생존자', why: '살아남아야 도울 수 있다는 셈이 서로 맞는다' }, { ko: '침착한 지휘관', why: '정보와 침착함이 만나면 길이 보인다' }], bad: { ko: '곁을 지키는 사람', why: '계산 밖에 있는 마음을 끝내 이해하기 어렵다' } },
  '전략적 생존자': { good: [{ ko: '냉정한 전략가', why: '서로의 판단을 믿고 맡길 수 있다' }, { ko: '기회주의자', why: '열린 틈을 놓치지 않는 두 사람' }], bad: { ko: '용기 있는 희생자', why: '자기 몫을 내놓는 마음을 이해하면서도 말리고 싶다' } },
  '아름다운 패배자': { good: [{ ko: '고귀한 낭만가', why: '낭만을 끝까지 놓지 않는 사람끼리' }, { ko: '비극의 예술가', why: '아름다운 끝을 알아보는 눈이 닮았다' }], bad: { ko: '실용주의자', why: '낭만은 사치라 부르는 사람과는 말이 겉돈다' } },
  '고귀한 낭만가': { good: [{ ko: '아름다운 패배자', why: '이상을 곁에서 함께 지켜 준다' }, { ko: '용기 있는 희생자', why: '남을 위해 내놓는 마음이 서로 통한다' }], bad: { ko: '기회주의자', why: '이상보다 틈을 먼저 보는 사람과는 어긋난다' } },
  '보호자': { good: [{ ko: '곁을 지키는 사람', why: '약한 이를 챙기는 손이 서로 닿는다' }, { ko: '진정한 리더', why: '당신이 살피면, 그가 앞길을 정한다' }], bad: { ko: '비극의 예술가', why: '위험으로 걸어가는 사람을 말려도 소용이 없다' } },
  '침착한 지휘관': { good: [{ ko: '질서의 수호자', why: '한 사람이 정하고 한 사람이 세운다' }, { ko: '냉정한 전략가', why: '흔들리지 않는 두 머리가 같은 방향을 본다' }], bad: { ko: '비극의 예술가', why: '위험을 낭만으로 여기는 마음은 지휘로 붙들 수 없다' } },
  '질서의 수호자': { good: [{ ko: '침착한 지휘관', why: '혼란 속에서 같은 순서를 믿는다' }, { ko: '조용한 목격자', why: '세워 둔 줄을 말없이 따라 준다' }], bad: { ko: '개척자', why: '정해진 길을 벗어나려는 사람은 늘 골칫거리다' } },
  '비극의 예술가': { good: [{ ko: '아름다운 패배자', why: '끝을 아는 채로 함께 걷는 사이' }, { ko: '고귀한 낭만가', why: '위험 속의 아름다움을 함께 바라본다' }], bad: { ko: '보호자', why: '말리는 손길이 오히려 발걸음을 재촉한다' } },
  '개척자': { good: [{ ko: '기회주의자', why: '열리는 길을 먼저 알아보고 함께 달린다' }, { ko: '진정한 리더', why: '앞장서는 사람끼리 서로 길을 내어 준다' }], bad: { ko: '질서의 수호자', why: '정해진 순서를 지키라는 사람과 부딪힌다' } },
  '실용주의자': { good: [{ ko: '전략적 생존자', why: '현실을 같은 눈으로 본다' }, { ko: '질서의 수호자', why: '정해진 순서가 살린다는 데 둘 다 동의한다' }], bad: { ko: '아름다운 패배자', why: '이루지 못할 낭만에 오래 매달리는 모습이 답답하다' } },
  '용기 있는 희생자': { good: [{ ko: '고귀한 낭만가', why: '내어 주는 마음의 값을 아는 사람' }, { ko: '진정한 리더', why: '당신의 결단이 누군가의 길이 되어 준다' }], bad: { ko: '전략적 생존자', why: '왜 먼저 내놓느냐고 끝까지 묻는 사람' } },
};

export interface TraitResult {
  /** 축 순서(AXES)대로 0~100 점 (백분위) */
  axes: number[];
  /** 원점수 합 */
  raw: number[];
  /** 상위 2개 축의 index */
  top: [number, number];
  type: TraitType;
  /** 계산에 쓴 장면 수 */
  scenes: number;
}

function percentile(dist: Map<number, number>, total: number, value: number): number {
  let below = 0;
  let equal = 0;
  dist.forEach((c, k) => {
    if (k < value) below += c;
    else if (k === value) equal += c;
  });
  return Math.round(((below + equal / 2) / total) * 100);
}

/** 고른 선택들(picks)로 성향 육각형을 계산한다. 계산에 쓸 장면이 없으면 null */
/** 디버그용: 성향 계산이 아는 모든 장면에 첫 선택을 넣은 기록. 건너뛰기로 결과에 가도 성향 육각형과 결과 연출이 나오게 한다 */
export function samplePicks(): Pick[] {
  return Object.entries(TABLE).filter(([id]) => id !== 'Q6k').map(([scene, opts]) => ({ scene, value: Object.keys(opts)[0] }));
}

export function traitsFromPicks(picks: Pick[], knocked?: number): TraitResult | null {
  // 같은 장면을 여러 번 거친 경우(뒤로 가기) 마지막 선택만 쓴다
  const last = new Map<string, string>();
  for (const p of picks) if (TABLE[p.scene] && TABLE[p.scene][p.value]) last.set(p.scene, p.value);
  // 갑판에서 쓰러뜨린 사람 수(기록이 있을 때만): 말로 고른 선택보다 실제 행동을 반영하는 가상 장면으로 더한다
  if (typeof knocked === 'number' && last.has('Q6')) last.set('Q6k', knocked < 50 ? 'none' : knocked < 80 ? 'some' : 'many');
  const sceneIds = [...last.keys()];
  if (sceneIds.length === 0) return null;

  const raw = [0, 0, 0, 0, 0, 0];
  for (const id of sceneIds) {
    const sc = TABLE[id][last.get(id)!];
    for (let a = 0; a < 6; a++) raw[a] += sc[a];
  }

  // 축마다 "거친 장면들에서 가능한 모든 선택 조합"의 원점수 분포를 합성곱으로 만든다
  const axes = raw.map((r, a) => {
    let dist = new Map<number, number>([[0, 1]]);
    for (const id of sceneIds) {
      const entries = Object.entries(TABLE[id]);
      const wts = entries.map(([opt]) => PRIOR[id]?.[opt] ?? 1);
      const sum = wts.reduce((x, y) => x + y, 0);
      const next = new Map<number, number>();
      dist.forEach((c, k) => {
        entries.forEach(([, o], i) => next.set(k + o[a], (next.get(k + o[a]) ?? 0) + (c * wts[i]) / sum));
      });
      dist = next;
    }
    return percentile(dist, 1, r);
  });

  return finish(axes, raw, sceneIds.length);
}

// 상위 2개 축: 점수가 같으면 원점수, 그래도 같으면 축 순서(이타 → 리더 → 결단 → 모험 → 순응 → 신중)
function finish(axes: number[], raw: number[], scenes: number): TraitResult {
  const order = [0, 1, 2, 3, 4, 5].sort((x, y) => axes[y] - axes[x] || raw[y] - raw[x] || x - y);
  const top: [number, number] = [order[0], order[1]];
  const key = [AXES[top[0]].id, AXES[top[1]].id].sort().join('+');
  const type = TYPES[key] ?? { ko: '이름 없는 승객', en: 'UNNAMED PASSENGER', desc: '어느 한쪽으로 쏠리지 않은 선택을 했습니다.', line: '누구의 이름으로도 불리지 않은 채, 조용히 파도가 되었다.' };
  return { axes, raw, top, type, scenes };
}

/** 공유 링크에 붙이는 짧은 표기: 6개 점수를 '-'로 이은 것 (예: 3-23-99-83-20-40) */
export function encodeAxes(axes: number[]): string {
  return axes.join('-');
}

/** 공유 링크의 표기에서 육각형을 되살린다. 형식이 맞지 않으면 null */
export function traitsFromAxes(code: string | null | undefined): TraitResult | null {
  if (!code) return null;
  const parts = code.split('-').map((x) => Number(x));
  if (parts.length !== 6 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) return null;
  const axes = parts.map((n) => Math.round(n));
  return finish(axes, axes, 0);
}
