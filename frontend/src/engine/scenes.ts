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

export const CHAPTERS = ['탑승', '항해', '그날 밤'] as const;

export const scenes: Record<string, SceneDef> = {
  Q0: { id: 'Q0', renderer: 'gender', answerKey: 'sex', next: 'Q1', prev: PROLOGUE, chapter: 0, gradient: 'intro' },
  Q1: {
    id: 'Q1', renderer: 'age', answerKey: 'ageGroup', next: 'Q2', prev: 'Q0', chapter: 0, gradient: 'intro',
    assets: ['/telegraph/base.webp', '/telegraph/rbase.webp', '/telegraph/lever.webp', '/telegraph/arrow.webp'],
    preloadOptionBg: true,
  },
  Q2: {
    id: 'Q2', renderer: 'companion', answerKey: 'companion', next: 'Q3', prev: 'Q1', chapter: 0, gradient: 'default',
    assets: ['/lens.webp'], preloadOptionBg: true, flashOnAnswer: true, fastExit: true,
  },
  Q3: {
    id: 'Q3', renderer: 'staircase', answerKey: 'pclass', next: 'Q4', prev: 'Q2', chapter: 0, gradient: 'default',
    // 선택지(1·2·3등석 분위기)에 호버할 때 쓰는 배경
    assets: ['/bg/1.webp', '/bg/2.webp', '/bg/3.webp'], fastEnter: true,
  },
  Q4: { id: 'Q4', renderer: 'money', answerKey: 'fareIntent', next: 'Q5', prev: 'Q3', chapter: 1, gradient: 'default', assets: MONEY_ASSETS },
  // 시계는 석양(Q5)에서 처음 소개되고(시각만, 초안: 21:00), 밤(Q6)에 같은 시계에 침몰 표식이 붙는다
  Q5: { id: 'Q5', renderer: 'cinematic', answerKey: 'purpose', next: 'Q6', prev: 'Q4', chapter: 1, gradient: 'default', clock: { elapsed: -160, mark: false } },
  Q6: {
    id: 'Q6', renderer: 'cinematic', answerKey: 'rumorAction', next: (ctx) => (ctx.extras?.night ? 'N1' : 'Q7'), prev: 'Q5', chapter: 2,
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
