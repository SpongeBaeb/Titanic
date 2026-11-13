/**
 * 1912년 4월 14일 밤, 타이타닉호(북위 41.7°, 서경 50°)에서 북쪽을 올려다본 하늘.
 * Q5 갑판에서 '별자리 도감'을 고르면 이 하늘이 펼쳐진다.
 *
 * 만든 방법: 실제 별의 적경·적위(J2000, 1912년과의 세차 차이는 1° 남짓이라 무시)로
 * 위도 41.73°, 지방항성시 10.8시(배 시간 오후 9시 무렵)의 고도·방위를 구하고,
 * 북쪽(고도 46°)을 가운데로 하는 입체 투영으로 갑판 그림 좌표(1376x768, 수평선 y=463.6)에 옮겼다.
 * 계산 스크립트: tools/q5_north_sky.py (같은 값을 다시 만들 수 있다. 은하수 곡선 맞춤도 이 값에서 나왔다)
 *
 * 그날 밤의 사실 (출처는 마지막장면_결과_연출_기획.md 와 고증_결과.md 참고)
 *  - 달이 없었다 (그믐 직전 9%, 새벽에야 떠오름). 바다는 잔잔하고 하늘은 유난히 맑아 별이 가득했다.
 *  - 북두칠성은 북극성 위로 높이(고도 60~75°) 거꾸로 걸려 있고, 손잡이는 동쪽(오른쪽)을 향한다.
 *  - 카시오페이아는 북극성 아래, 북쪽 수평선 가까이(고도 11~22°) 낮게 떠 있다.
 *  - 은하수는 머리 위가 아니라, 북동쪽 수평선에서 카시오페이아를 지나 북서쪽(페르세우스·마차부)으로 낮게 걸쳐 있다.
 *
 * x, y: 그림 좌표 · m: 겉보기 등급(작을수록 밝다) · bv: 색지수(작으면 푸르스름, 크면 주황빛)
 */
export interface SkyStar { n: string; g: string; x: number; y: number; m: number; bv: number }

export const NORTH_SKY: SkyStar[] = [
  { n: 'Dubhe', g: 'UMa', x: 729, y: 123, m: 1.79, bv: 1.07 },
  { n: 'Merak', g: 'UMa', x: 730, y: 96, m: 2.37, bv: -0.02 },
  { n: 'Phecda', g: 'UMa', x: 769, y: 89, m: 2.44, bv: 0.04 },
  { n: 'Megrez', g: 'UMa', x: 778, y: 110, m: 3.31, bv: 0.08 },
  { n: 'Alioth', g: 'UMa', x: 804, y: 117, m: 1.77, bv: -0.02 },
  { n: 'Mizar', g: 'UMa', x: 825, y: 125, m: 2.27, bv: 0.02 },
  { n: 'Alcor', g: 'UMa', x: 827.5, y: 123.5, m: 4.01, bv: 0.16 }, // 미자르 옆의 작은 별 (옛 시력 검사 별)
  { n: 'Alkaid', g: 'UMa', x: 858, y: 115, m: 1.86, bv: -0.10 },
  { n: 'Polaris', g: 'UMi', x: 717, y: 258, m: 1.98, bv: 0.60 },
  { n: 'Yildun', g: 'UMi', x: 736, y: 259, m: 4.36, bv: 0.02 },
  { n: 'epsUMi', g: 'UMi', x: 757, y: 256, m: 4.21, bv: 0.89 },
  { n: 'zetUMi', g: 'UMi', x: 775, y: 240, m: 4.29, bv: 0.04 },
  { n: 'Kochab', g: 'UMi', x: 785, y: 219, m: 2.08, bv: 1.47 },
  { n: 'Pherkad', g: 'UMi', x: 799, y: 224, m: 3.05, bv: 0.05 },
  { n: 'etaUMi', g: 'UMi', x: 786, y: 247, m: 4.95, bv: 0.37 },
  { n: 'Caph', g: 'Cas', x: 668, y: 396, m: 2.27, bv: 0.34 },
  { n: 'Schedar', g: 'Cas', x: 642, y: 399, m: 2.24, bv: 1.17 },
  { n: 'gamCas', g: 'Cas', x: 644, y: 375, m: 2.47, bv: -0.15 },
  { n: 'Ruchbah', g: 'Cas', x: 628, y: 366, m: 2.68, bv: 0.13 },
  { n: 'Segin', g: 'Cas', x: 628, y: 342, m: 3.38, bv: -0.15 },
  { n: 'Alderamin', g: 'Cep', x: 771, y: 378, m: 2.45, bv: 0.22 },
  { n: 'Alfirk', g: 'Cep', x: 752, y: 343, m: 3.23, bv: -0.22 },
  { n: 'Errai', g: 'Cep', x: 707, y: 313, m: 3.21, bv: 1.03 },
  { n: 'iotCep', g: 'Cep', x: 719, y: 370, m: 3.52, bv: 1.05 },
  { n: 'zetCep', g: 'Cep', x: 745, y: 409, m: 3.35, bv: 1.57 },
  { n: 'Thuban', g: 'Dra', x: 811, y: 176, m: 3.65, bv: -0.05 },
  { n: 'Eltanin', g: 'Dra', x: 901, y: 309, m: 2.23, bv: 1.52 },
  { n: 'Rastaban', g: 'Dra', x: 901, y: 288, m: 2.79, bv: 0.98 },
  { n: 'etaDra', g: 'Dra', x: 855, y: 241, m: 2.73, bv: 0.91 },
  { n: 'zetDra', g: 'Dra', x: 835, y: 266, m: 3.17, bv: -0.12 },
  { n: 'delDra', g: 'Dra', x: 806, y: 318, m: 3.07, bv: 1.00 },
  { n: 'kapDra', g: 'Dra', x: 762, y: 171, m: 3.87, bv: -0.13 },
  { n: 'lamDra', g: 'Dra', x: 738, y: 161, m: 3.84, bv: 1.62 },
  { n: 'Capella', g: 'Aur', x: 506, y: 226, m: 0.08, bv: 0.80 },
  { n: 'Menkalinan', g: 'Aur', x: 510, y: 185, m: 1.90, bv: 0.03 },
  { n: 'Mirfak', g: 'Per', x: 535, y: 324, m: 1.79, bv: 0.48 },
  { n: 'Algol', g: 'Per', x: 495, y: 357, m: 2.12, bv: -0.05 },
  { n: 'Deneb', g: 'Cyg', x: 839, y: 446, m: 1.25, bv: 0.09 },
  { n: 'Vega', g: 'Lyr', x: 952, y: 371, m: 0.03, bv: 0.00 },
  { n: 'Arcturus', g: 'Boo', x: 1011, y: 19, m: -0.05, bv: 1.23 },
  { n: 'Castor', g: 'Gem', x: 503, y: 57, m: 1.58, bv: 0.03 },
  { n: 'Pollux', g: 'Gem', x: 497, y: 31, m: 1.14, bv: 1.00 },
  { n: 'CorCaroli', g: 'CVn', x: 854, y: 38, m: 2.89, bv: -0.12 },
];

/** 이어 그리는 별자리 (나타나는 순서대로): 북두칠성 → 작은곰(북극성) → 카시오페이아 → 케페우스 */
export const CONSTELLATIONS: { id: string; name: string; at: number; lines: [string, string][] }[] = [
  { id: 'UMa', name: '북두칠성', at: 1.8, lines: [['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'], ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid']] },
  { id: 'UMi', name: '작은곰자리', at: 2.9, lines: [['Polaris', 'Yildun'], ['Yildun', 'epsUMi'], ['epsUMi', 'zetUMi'], ['zetUMi', 'Kochab'], ['Kochab', 'Pherkad'], ['Pherkad', 'etaUMi'], ['etaUMi', 'zetUMi']] },
  { id: 'Cas', name: '카시오페이아', at: 4.0, lines: [['Caph', 'Schedar'], ['Schedar', 'gamCas'], ['gamCas', 'Ruchbah'], ['Ruchbah', 'Segin']] },
  { id: 'Cep', name: '케페우스', at: 4.8, lines: [['Alderamin', 'Alfirk'], ['Alfirk', 'Errai'], ['Errai', 'iotCep'], ['iotCep', 'zetCep'], ['zetCep', 'Alderamin'], ['iotCep', 'Alfirk']] },
];

/** 북두칠성 국자 끝 두 별(메라크→두베)을 다섯 배 늘이면 북극성: 별을 찾는 안내선 */
export const POINTER: [string, string] = ['Merak', 'Polaris'];

/** 색지수(B-V) → 별빛 색 (대략) */
export function starColor(bv: number): [number, number, number] {
  const t = Math.max(-0.3, Math.min(1.7, bv));
  if (t < 0) return [190, 210, 255];
  if (t < 0.4) return [225 + t * 60, 232, 255 - t * 40];
  if (t < 0.9) return [255, 242 - (t - 0.4) * 40, 230 - (t - 0.4) * 110];
  return [255, 222 - (t - 0.9) * 60, 175 - (t - 0.9) * 70];
}

export const starByName: Record<string, SkyStar> = Object.fromEntries(NORTH_SKY.map((s) => [s.n, s]));
