import type { Ctx, Flags } from './types';

/** 문장 조각. changed 는 "앞 선택 때문에 바뀐 문장"으로 강조 표시한다 */
export interface Segment {
  text: string;
  changed?: boolean;
}

export interface CineOption {
  id: string;
  label: string;
  /** 앞 선택이 만든 선택지 / 이전 회차의 기억 */
  tag?: 'chain' | 'memory';
  sets?: Flags;
  /** 이 선택에 쓰이는 시간(분). 이후 장면의 남은 시간이 그만큼 줄어든다 */
  timeCost?: number;
  /** 충돌 후 이 분까지만 고를 수 있다. 넘으면 비활성(이유를 표시)으로 남는다 */
  until?: number;
  fx?: readonly OptionFx[];
  /** 반향: 승선 때 찍은 동행 사진이 잠깐 떠올랐다 사라진다 */
  echo?: 'photo';
}

/** 선택 직후(기억됨 메모가 떠 있는 동안) 한 번 재생되는 연출 */
export type OptionFx = 'shake' | 'flash' | 'dim';

/** kenburns: 한 방향 느린 접근(흔들림 없음) / water: 어두운 물이 차오름 / flicker: 조명 깜빡임 */
export type CineFx = 'kenburns' | 'water' | 'flicker';

export interface CineScene {
  id: string;
  /** 충돌(23:40) 후 몇 분째에 시작하는 장면인지 (선택 소모 시간은 별도로 더해진다) */
  at: number;
  title: string;
  /** 기본 배경. bgStages 의 이미지가 하나도 없으면 이것을 쓴다 */
  bg: string;
  /** 경과 분에 따라 교차 전환되는 단계별 배경 (파일이 없는 단계는 건너뛴다) */
  bgStages?: { from: number; url: string }[];
  fx: CineFx[];
  story: (ctx: Ctx) => Segment[];
  options: (ctx: Ctx) => CineOption[];
  /** 제한시간(초). 시간이 지나면 timeoutOption 이 선택된다 */
  timer?: { seconds: number; timeoutOption: CineOption };
}

export const TAG_LABEL: Record<NonNullable<CineOption['tag']>, string> = {
  chain: '앞 선택이 만든 선택지',
  memory: '이전 회차의 기억',
};

/** 충돌 시각 23:40, 침몰 약 160분 뒤 = 02:20 (초안 — 역사 검토 때 확정) */
export const COLLISION_MIN_OF_DAY = 23 * 60 + 40;
export const SINK_AFTER_MIN = 160;

export function formatRemaining(elapsed: number): string {
  const m = Math.max(0, Math.round(SINK_AFTER_MIN - elapsed));
  if (m === 0) return '지금';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}시간 ${m % 60}분` : `${m}분`;
}

export function wallClock(elapsed: number): string {
  const t = (COLLISION_MIN_OF_DAY + Math.round(elapsed)) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

const COMPANION_PHOTO: Record<string, string> = {
  alone: '/fellow/1.webp',
  partner: '/fellow/2.webp',
  friends: '/fellow/3.webp',
  family: '/fellow/4.webp',
};

/** 승선 때 찍은 동행 사진(실루엣). 동행을 고르지 않았으면 undefined */
export function companionPhoto(companion: unknown): string | undefined {
  return typeof companion === 'string' ? COMPANION_PHOTO[companion] : undefined;
}

/** Q4 가방에 담은 기념품 id(파일명) → 화면에 쓰는 이름 */
const BAG_ITEM_NAME: Record<string, string> = {
  shop1: '타이타닉 칼',
  shop2: '만찬 찻잔',
  shop3: '모자 리본',
  shop4: '열쇠고리 메달',
};

export function bagItemNames(extras: Record<string, unknown> | undefined): string[] {
  const items = extras?.bagItems;
  return Array.isArray(items) ? items.map((id) => BAG_ITEM_NAME[String(id)] ?? '기념품') : [];
}
