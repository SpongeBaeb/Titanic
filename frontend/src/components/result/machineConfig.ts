/**
 * 결과 화면 아래 기계의 부품 위치·크기 (본체 그림 1624x579 기준 좌표).
 * 디버그 패널에서 값을 바꾸면 화면에 바로 반영된다. 모듈 안의 값을 고치고 구독자에게 알리는 방식이다.
 * x, y 는 부품의 가운데 x 와 아랫선 y 이고, w 는 폭이다.
 */
export interface MachinePart { x: number; y: number; w: number; tilt?: number; rotY?: number; rotZ?: number; gap?: number; h?: number; alpha?: number; taper?: number }

export const MACHINE_DEFAULT: Record<string, MachinePart> = {
  lampGreen: { x: 128, y: 292, w: 47 },
  lampAmber: { x: 115, y: 337, w: 51 },
  lcd: { x: 1400, y: 351, w: 167, tilt: 39, rotY: 6, rotZ: -2 },
  lever: { x: 1458, y: 451, w: 110 },
  save: { x: 1343, y: 456, w: 84 },
  bigKeys: { x: 815, y: 342, w: 124, gap: 210 },
  smallKeys: { x: -116, y: 438, w: 87 },
  glow: { x: 256, y: 1, w: 1130, h: 124, alpha: 137, taper: 3 },
};

export const MACHINE_CFG: Record<string, MachinePart> = JSON.parse(JSON.stringify(MACHINE_DEFAULT));

export interface FieldMeta { k: keyof MachinePart; label: string; min: number; max: number; step?: number }
const XY = (xmax = 1624): FieldMeta[] => [
  { k: 'x', label: '가로', min: 0, max: xmax },
  { k: 'y', label: '세로(아랫선)', min: 0, max: 579 },
];
export const MACHINE_META: { id: string; label: string; fields: FieldMeta[] }[] = [
  { id: 'lampGreen', label: '초록 램프 (전원)', fields: [...XY(), { k: 'w', label: '폭', min: 40, max: 220 }] },
  { id: 'lampAmber', label: '호박색 램프 (출력)', fields: [...XY(), { k: 'w', label: '폭', min: 40, max: 220 }] },
  { id: 'lcd', label: '비율 표시창', fields: [...XY(), { k: 'w', label: '폭', min: 60, max: 260 }, { k: 'tilt', label: '눕힘(앞뒤 각도)', min: 0, max: 80 }, { k: 'rotY', label: '좌우 각도', min: -60, max: 60 }, { k: 'rotZ', label: '판 위 회전', min: -45, max: 45 }] },
  { id: 'lever', label: '토글 레버', fields: [...XY(), { k: 'w', label: '폭', min: 50, max: 220 }] },
  { id: 'save', label: '저장 키', fields: [...XY(), { k: 'w', label: '폭', min: 40, max: 200 }] },
  { id: 'bigKeys', label: 'SNS 큰 키 줄 (가운데 x)', fields: [...XY(), { k: 'w', label: '키 폭', min: 60, max: 200 }, { k: 'gap', label: '키 간격', min: 100, max: 320 }] },
  { id: 'smallKeys', label: '링크·보내기 키 (아랫선)', fields: [{ k: 'x', label: '가로 이동', min: -300, max: 300 }, { k: 'y', label: '세로(아랫선)', min: 0, max: 579 }, { k: 'w', label: '폭', min: 40, max: 200 }] },
  { id: 'glow', label: '윗면 화면빛', fields: [{ k: 'x', label: '가로(왼쪽)', min: 0, max: 1624 }, { k: 'y', label: '세로(위쪽)', min: 0, max: 579 }, { k: 'w', label: '폭', min: 100, max: 1624 }, { k: 'h', label: '높이', min: 20, max: 400 }, { k: 'alpha', label: '세기(%)', min: 0, max: 300 }, { k: 'taper', label: '먼 쪽 좁힘(%)', min: 0, max: 15 }] },
];

const listeners = new Set<() => void>();
let version = 0;
export const subscribeMachine = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const machineVersion = () => version;
const emit = () => { version++; listeners.forEach((f) => f()); };

export function setMachine(id: string, k: keyof MachinePart, v: number) {
  MACHINE_CFG[id][k] = v;
  emit();
}
export function resetMachine() {
  for (const id of Object.keys(MACHINE_DEFAULT)) MACHINE_CFG[id] = { ...MACHINE_DEFAULT[id] };
  emit();
}
