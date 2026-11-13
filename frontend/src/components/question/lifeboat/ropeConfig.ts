/**
 * 구명정 줄의 네 점(배경판 1376x768 좌표)과 두 가닥의 간격·굵기. 디버그 패널에서 값을 바꾸면 화면에 바로 반영된다.
 * 모듈 안의 값을 직접 고치는 방식이라(렌더 밖) LifeboatStage 와 DeckBridge 가 매 프레임 읽는다.
 */
export interface Pt { x: number; y: number }
export interface RopeCfg { pulleyA: Pt; pulleyB: Pt; hookS: Pt; hookB: Pt }

export const ROPE_DEFAULT: RopeCfg = {
  pulleyA: { x: 592, y: 69 },
  pulleyB: { x: 980, y: 125 },
  hookS: { x: 395, y: 429 },
  hookB: { x: 1130, y: 240 },
};

/** 구명정이 매달려 흔들리는 중심: 두 도르래 사이, 위쪽 */
export const PIVOT: Pt = { x: 780, y: 70 };

export const ROPE_CFG: RopeCfg = JSON.parse(JSON.stringify(ROPE_DEFAULT));

/** 선미 줄(왼쪽)과 이물 줄(오른쪽)을 이루는 두 가닥 사이의 간격을 각각, 그리고 가닥 하나의 굵기(배경판 px) */
export type RopeLook = { gapS: number; gapB: number; width: number };
export const ROPE_LOOK: RopeLook = { gapS: 22, gapB: 5.5, width: 6 };
const LOOK_DEFAULT: RopeLook = { gapS: 22, gapB: 5.5, width: 6 };

export function setRopePoint(key: keyof RopeCfg, axis: 'x' | 'y', v: number) {
  ROPE_CFG[key][axis] = v;
}

export function setRopeLook(key: keyof RopeLook, v: number) {
  ROPE_LOOK[key] = v;
}

export function resetRope() {
  for (const k of Object.keys(ROPE_DEFAULT) as (keyof RopeCfg)[]) ROPE_CFG[k] = { ...ROPE_DEFAULT[k] };
  ROPE_LOOK.gapS = LOOK_DEFAULT.gapS;
  ROPE_LOOK.gapB = LOOK_DEFAULT.gapB;
  ROPE_LOOK.width = LOOK_DEFAULT.width;
}

/** 구명정이 도르래에 매달려 흔들리는 각도(도): 4.8초쯤 한 번 오가고 작은 흔들림이 겹친다. 줄과 늘어진 밧줄이 같은 값을 쓴다 */
export function boatSwayDeg(s: number) {
  return 1.3 * Math.sin((2 * Math.PI * s) / 4.8) + 0.35 * Math.sin((2 * Math.PI * s) / 2.1 + 1);
}
