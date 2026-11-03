export type AnswerKey =
  | 'embarked' | 'sex' | 'ageGroup' | 'companion' | 'pclass'
  | 'fareIntent' | 'purpose' | 'rumorAction' | 'finalAction';

export type Flags = Record<string, true>;

export type RendererId =
  | 'gender' | 'age' | 'companion' | 'staircase' | 'money' | 'cinematic';

export type Gradient = 'intro' | 'default' | 'rumor' | 'lifeboat';

export interface Pick {
  scene: string;
  value: string;
}

export interface Ctx {
  answers: Partial<Record<AnswerKey, unknown>>;
  flags: Flags;
  picks: Pick[];
  /** 이 판의 회차 (1부터) */
  run: number;
}

// 문항 본문(제목·선택지)은 data/questions.ts 의 같은 id 를 따른다.
export interface SceneDef {
  id: string;
  renderer: RendererId;
  answerKey: AnswerKey;
  next: string | ((ctx: Ctx) => string);
  prev: string;
  /** 장면 진입 전에 미리 받아 둘 이미지 (배경·선택지 배경 제외) */
  assets?: string[];
  /** 선택지의 bgImage 도 미리 받는다 */
  preloadOptionBg?: boolean;
  /** 답한 직후 카메라 플래시 연출 후 이동 */
  flashOnAnswer?: boolean;
  fastEnter?: boolean;
  fastExit?: boolean;
  /** 진행 표시용 챕터 번호 (CHAPTERS 의 index) */
  chapter: number;
  gradient: Gradient;
  bgOpacity?: number;
  ripple?: boolean;
  redPulse?: boolean;
}
