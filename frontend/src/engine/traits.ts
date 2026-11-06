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
  Q6: {
    calm_others: [1, 3, 0, 0, 0, 0],
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
    yield_seat: [3, 0, -1, 0, 0, 0],
    yield_weak: [2, 2, 0, 0, 0, 0],
    secure_mine: [1, 1, 2, 0, 0, 0],
    me_first: [-2, 0, 3, 0, 0, 0],
    observe: [0, 0, -2, 0, 2, 2],
  },
};

export interface TraitType {
  ko: string;
  en: string;
  desc: string;
  /** 공유 카드 가운데에 크게 들어가는 한 줄 (35자 안쪽) */
  line: string;
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
export function traitsFromPicks(picks: Pick[]): TraitResult | null {
  // 같은 장면을 여러 번 거친 경우(뒤로 가기) 마지막 선택만 쓴다
  const last = new Map<string, string>();
  for (const p of picks) if (TABLE[p.scene] && TABLE[p.scene][p.value]) last.set(p.scene, p.value);
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
    let total = 1;
    for (const id of sceneIds) {
      const opts = Object.values(TABLE[id]);
      const next = new Map<number, number>();
      dist.forEach((c, k) => {
        for (const o of opts) next.set(k + o[a], (next.get(k + o[a]) ?? 0) + c);
      });
      dist = next;
      total *= opts.length;
    }
    return percentile(dist, total, r);
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
