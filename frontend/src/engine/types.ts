export type AnswerKey =
  | 'embarked' | 'sex' | 'ageGroup' | 'companion' | 'pclass'
  | 'fareIntent' | 'purpose' | 'rumorAction' | 'finalAction'
  // 강아지 시점 분기 (Q2 에서 숨은 강아지를 찍었을 때): 백엔드 점수와 무관하다
  | 'dogLeash' | 'dogScent' | 'dogKennel' | 'dogNight' | 'dogDeck' | 'dogFinal';

export type Flags = Record<string, boolean>;

export type RendererId =
  | 'gender' | 'age' | 'companion' | 'staircase' | 'money' | 'cinematic' | 'night' | 'dog' | 'dogintro' | 'deck' | 'rumor';

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
  /** 충돌 후 경과 분 (시간 자원을 쓰는 장면에서만 의미가 있다) */
  elapsed?: number;
  /** 숫자·목록 같은 부가 기록 (예: 가방에 담은 물건). boolean 플래그로 담기 어려운 것 */
  extras?: Record<string, unknown>;
}

// 문항 본문(제목·선택지)은 data/questions.ts 의 같은 id 를 따른다.
export interface SceneDef {
  id: string;
  renderer: RendererId;
  /** 백엔드 계약 키. 밤 장면(night)은 점수용 답이 없어서 비어 있다 */
  answerKey?: AnswerKey;
  /** renderer 가 'night' 일 때 쓰는 장면 패널 id (demoScenes 의 id) */
  cine?: string;
  /** ?night=1 일 때만 거치는 장면 */
  nightOnly?: boolean;
  /** 앞 선택에 따라 문항 문구를 바꾼다 */
  variant?: (ctx: Ctx) => { title?: string; subtitle?: string; omit?: string[] } | undefined;
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
  /** 문항 화면에 띄우는 작은 시계 (E6: 석양에는 시각만, 밤에는 침몰 표식까지) */
  clock?: { elapsed: number; mark: boolean };
}
