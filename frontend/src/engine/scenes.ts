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
  Q5: { id: 'Q5', renderer: 'cinematic', answerKey: 'purpose', next: 'Q6', prev: 'Q4', chapter: 1, gradient: 'default' },
  Q6: {
    id: 'Q6', renderer: 'cinematic', answerKey: 'rumorAction', next: 'Q7', prev: 'Q5', chapter: 2,
    gradient: 'rumor', bgOpacity: 0.8, redPulse: true,
  },
  Q7: {
    id: 'Q7', renderer: 'cinematic', answerKey: 'finalAction', next: RESULT, prev: 'Q6', chapter: 2,
    gradient: 'lifeboat', ripple: true,
  },
};

/** 개발용 바로가기 목록 (장면 id 순서) */
export const sceneIds = Object.keys(scenes);
