import type { SceneDef } from './types';

export const PROLOGUE = 'PROLOGUE';
export const RESULT = 'RESULT';

const MONEY_ASSETS = [
  '/spend/target.webp', '/spend/bucket.webp', '/spend/titanic_duck.webp',
  '/spend/label.webp', '/spend/my_bag.webp', '/spend/my_bag_open.webp',
  '/spend/bill.webp', '/spend/duckhead.webp', '/spend/duckbody.webp',
  '/spend/duckbody_thumbsup.webp', '/spend/icon_pool.webp', '/spend/icon_massage.webp',
  '/spend/icon_souvenir.webp', '/spend/icon_gamble.webp', '/spend/icon_bath.webp',
  '/spend/icon_barber.webp', '/spend/icon_telegraph.webp',
];

// ── 강아지 분기 문구 도우미: 앞에서 고른 행동을 뒤 장면의 이야기가 이어받는다 ──
type DogAnswers = Partial<Record<string, unknown>>;
/** 톰(소년 선원)과 가까워졌는가 */
export const tomBond = (a: DogAnswers) => a.dogScent === 'trust' || a.dogScent === 'bite';
/** 늙은 개 '캡틴'과 가까워졌는가 */
export const captainBond = (a: DogAnswers) => a.dogKennel === 'befriend' || a.dogKennel === 'share';

function dogKennelIntro(scent?: string): string {
  const tom =
    scent === 'trust'
      ? '소년의 이름은 톰. 그는 매일 아침 당신을 갑판으로 산책시키고, 빗장 틈에 간식을 숨겨 둡니다.'
      : scent === 'bite'
        ? '소년의 이름은 톰. "깡 있는 녀석이네"라며 웃던 그는 매일 아침 당신을 갑판으로 산책시킵니다.'
        : '소년의 이름은 톰. 투덜대며 빗장을 걸었지만, 매일 밤 몰래 간식을 밀어 넣어 줍니다.';
  return `${tom} 주인은 하루에 한 번 개집에 들러 당신의 이름을 불러 줍니다. 그러나 사흘째 밤, 맞은편 칸의 늙은 에어데일 '캡틴'이 당신을 빤히 바라봅니다. "작은 친구, 바닥 아래가 이상하지 않나? 오늘따라 이 쇳덩이가 낮게 울어."`;
}
function dogJoltText(cap: boolean): string {
  return cap
    ? "쿵. 모든 것이 멈춥니다. 캡틴이 먼저 일어나 창살 사이로 코를 킁킁거립니다. \"물 냄새다. 서둘러야 해.\" 발목에 차가운 물이 닿고 개들이 하나둘 울기 시작합니다. 톰은 아직 오지 않았습니다."
    : "쿵. 모든 것이 멈춥니다. 발목에 차가운 물이 닿고 개집의 개들이 한꺼번에 울기 시작합니다. 어둠 속에서 캡틴의 낮은 목소리가 들립니다. \"…이제 알겠지?\" 톰은 아직 오지 않았습니다.";
}
function dogDeckText(a: DogAnswers): string {
  const out =
    a.dogNight === 'bark'
      ? '당신의 울음에 톰이 달려와 빗장을 부쉈고, 개들이 한꺼번에 갑판으로 쏟아져 나왔습니다.'
      : a.dogNight === 'scratch'
        ? '당신은 끈을 끌어당겨 스스로 문을 열고, 물이 차오르는 계단을 앞발로 기어올랐습니다.'
        : '한참 뒤에야 톰이 물을 헤치고 달려와 문을 열어 주었습니다. 너무 늦지는 않았습니다.';
  return `${out} 갑판은 발소리의 강물입니다. 긴 치맛자락과 구두가 쉴 새 없이 스쳐 가고, 구명정 쪽 어딘가에서 희미한 라벤더 향이 흘러옵니다. 당신은 어느 쪽으로 갑니까?`;
}
function dogFinalText(a: DogAnswers): string {
  const base = '갑판 끝, 구명정이 어둠 속으로 내려가고 있습니다. 바닥에는 당신의 끊어진 줄이 떨어져 있습니다.';
  if (a.dogDeck === 'tom')
    return `${base} 톰이 당신을 안아 구명정 가장자리에 서 있는 낯선 부인에게 내밉니다. "한 자리밖에 없어요. 이 아이만이라도!" 톰의 팔이 떨립니다. 그는 구명정에 탈 수 없습니다.`;
  if (a.dogDeck === 'captain')
    return `${base} 뒤에서 캡틴의 무거운 숨소리가 따라옵니다. 구명정 쪽에서 라벤더 향이 가까워지지만, 이 큰 몸은 구명정에 오르지 못한다는 것을 둘 다 알고 있습니다.`;
  return `${base} 구명정 가장자리에서 라벤더 향이 짙어집니다. 주인의 외투입니다. 주인은 인파에 밀려 당신을 보지 못하고 있습니다. 구명정은 곧 내려갑니다.`;
}

export const CHAPTERS = ['탑승', '항해', '그날 밤'] as const;

export const scenes: Record<string, SceneDef> = {
  Q0: { id: 'Q0', renderer: 'gender', answerKey: 'sex', next: 'Q1', prev: PROLOGUE, chapter: 0, gradient: 'intro' },
  Q1: {
    id: 'Q1', renderer: 'age', answerKey: 'ageGroup', next: 'Q2', prev: 'Q0', chapter: 0, gradient: 'intro',
    assets: ['/telegraph/base.webp', '/telegraph/rbase.webp', '/telegraph/lever.webp', '/telegraph/arrow.webp'],
    preloadOptionBg: true,
  },
  Q2: {
    id: 'Q2', renderer: 'companion', answerKey: 'companion',
    // 부두 구석에 숨은 강아지를 찍으면 강아지 시점 분기로 간다
    next: (ctx) => (ctx.answers.companion === 'dog' ? 'DQ0' : 'Q3'), prev: 'Q1', chapter: 0, gradient: 'default',
    assets: ['/lens.webp'], preloadOptionBg: true, flashOnAnswer: true, fastExit: true,
  },
  // ── 강아지 시점 분기: Q2 에서 숨은 강아지를 찍은 경우에만 거친다. 백엔드 점수 없이 자체 결과 카드로 끝난다 ──
  // 시작: 트랩 위에서 목줄이 툭 끊어진다 (선택 없는 연출 장면)
  DQ0: { id: 'DQ0', renderer: 'dogintro', answerKey: 'dogLeash', next: 'DQ1', prev: 'Q2', chapter: 0, gradient: 'default', bgOpacity: 0.9, assets: ['/dog/tom.webp', '/dog/captain.webp'] },
  // 기: 끊어진 줄, 홀로 남은 트랩 → 승: 개집의 날들과 늙은 개 '캡틴' → 전: 침몰하는 밤의 개집, 갑판 → 결: 구명정 곁의 선택
  DQ1: { id: 'DQ1', renderer: 'dog', answerKey: 'dogScent', next: 'DQ2', prev: 'DQ0', chapter: 0, gradient: 'default', bgOpacity: 0.9 },
  DQ2: { id: 'DQ2', renderer: 'dog', answerKey: 'dogKennel', next: 'DQ3', prev: 'DQ1', chapter: 1, gradient: 'default', bgOpacity: 0.85,
    variant: ({ answers }) => ({ subtitle: dogKennelIntro(answers.dogScent as string | undefined) }) },
  DQ3: { id: 'DQ3', renderer: 'dog', answerKey: 'dogNight', next: 'DQ4', prev: 'DQ2', chapter: 2, gradient: 'default', bgOpacity: 0.9,
    variant: ({ answers }) => ({ subtitle: dogJoltText(captainBond(answers)) }) },
  DQ4: { id: 'DQ4', renderer: 'dog', answerKey: 'dogDeck', next: 'DQ5', prev: 'DQ3', chapter: 2, gradient: 'rumor', bgOpacity: 0.85,
    assets: ['/bg/dog_q5_tom.webp', '/bg/dog_q5_captain.webp', '/bg/dog_q4.webp'],
    variant: ({ answers }) => {
      const omit: string[] = [];
      if (!captainBond(answers)) omit.push('captain');
      if (!tomBond(answers) && answers.dogNight !== 'bark') omit.push('tom');
      return { subtitle: dogDeckText(answers), omit };
    } },
  DQ5: { id: 'DQ5', renderer: 'dog', answerKey: 'dogFinal', next: RESULT, prev: 'DQ4', chapter: 2, gradient: 'lifeboat', bgOpacity: 0.9,
    // 결말 카드의 그림도 미리 받아 둔다
    assets: ['/bg/dog_end_miracle.webp', '/bg/dog_end_captainsaved.webp', '/bg/dog_end_stranger.webp', '/bg/dog_end_tom.webp', '/bg/dog_end_guilt.webp', '/bg/dog_end_reunion.webp', '/bg/dog_end_captain.webp', '/bg/dog_end_unheard.webp'],
    variant: ({ answers }) => {
      const route = answers.dogDeck as string | undefined;
      // 앞에서 고른 길에 따라 마지막에 서 있는 곳과 보기가 달라진다
      const keep = route === 'tom' ? ['accept', 'return'] : route === 'captain' ? ['turn', 'abandon'] : ['leap', 'call'];
      return { subtitle: dogFinalText(answers), omit: ['leap', 'call', 'accept', 'return', 'turn', 'abandon'].filter((v) => !keep.includes(v)) };
    } },
  Q3: {
    id: 'Q3', renderer: 'staircase', answerKey: 'pclass', next: 'Q4', prev: 'Q2', chapter: 0, gradient: 'default',
    // 선택지(1·2·3등석 분위기)에 호버할 때 쓰는 배경
    assets: ['/bg/1.webp', '/bg/2.webp', '/bg/3.webp'], fastEnter: true,
  },
  Q4: { id: 'Q4', renderer: 'money', answerKey: 'fareIntent', next: 'Q5', prev: 'Q3', chapter: 1, gradient: 'default', assets: MONEY_ASSETS },
  // 시계는 석양(Q5)에서 처음 소개되고(시각만, 초안: 21:00), 밤(Q6)에 같은 시계에 침몰 표식이 붙는다
  Q5: { id: 'Q5', renderer: 'deck', answerKey: 'purpose', next: 'Q6', prev: 'Q4', chapter: 1, gradient: 'default', clock: { elapsed: -160, mark: false },
    // 갑판 장면: 배경과 앞쪽 레이어, 고래 그림을 미리 받아 둔다
    assets: ['/bg/deck_q5.webp', '/bg/deck_q5_fg.webp', '/q5/whale_breach.webp', '/q5/whale_tail.webp'], fastEnter: true },
  Q6: {
    id: 'Q6', renderer: 'rumor', answerKey: 'rumorAction', next: (ctx) => (ctx.extras?.night ? 'N1' : 'Q7'), prev: 'Q5', chapter: 2,
    gradient: 'rumor', bgOpacity: 0.8, redPulse: true, clock: { elapsed: 5, mark: true },
  },
  // 밤 장면: ?night=1 로 들어온 경우에만 Q6 뒤에 끼어든다 (문구는 초안, 역사 검토 전)
  N1: { id: 'N1', renderer: 'night', cine: 'N1', next: 'N2', prev: 'Q6', chapter: 2, gradient: 'rumor', nightOnly: true },
  N2: { id: 'N2', renderer: 'night', cine: 'N2', next: 'N3', prev: 'N1', chapter: 2, gradient: 'rumor', nightOnly: true },
  N3: { id: 'N3', renderer: 'night', cine: 'N3', next: 'Q7', prev: 'N2', chapter: 2, gradient: 'rumor', nightOnly: true },
  Q7: {
    id: 'Q7', renderer: 'cinematic', answerKey: 'finalAction', next: RESULT, prev: 'Q6', chapter: 2,
    gradient: 'lifeboat', ripple: true,
    // 이미 구명정에 탔다면 같은 질문이 "구명정 위에서" 벌어지는 일로 바뀐다 (문구 초안)
    variant: ({ flags }) => flags.boat
      ? {
          title: '구명정 위에서 한 사람을 발견했습니다.',
          subtitle: '노 젓는 소리가 멎고, 어둠 속에서 물에 떠 있는 사람이 뱃전을 붙잡습니다. 구명정에는 이제 한 자리만 남았습니다. 그 순간, 당신은 어떻게 행동합니까?',
          omit: ['me_first'],
        }
      : undefined,
  },
};

/** 개발용 바로가기 목록 (장면 id 순서) */
export const sceneIds = Object.keys(scenes);
