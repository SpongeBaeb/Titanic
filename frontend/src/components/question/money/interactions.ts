/**
 * 돈 쓰기 화면(Q4)의 "시설끼리의 상호작용" 규칙에서 상태와 무관한 부분을 모은 곳.
 * - 오리 사무장이 상호작용마다 하는 말
 * - 모스 입력 기록과 SOS 판정
 * - 수면 감전 번개의 갈라진 길 만들기
 * 화면 상태를 바꾸는 쪽(거품을 터뜨린다, 신호를 쏜다 등)은 MoneyMinigameView 에 있고, 여기 함수와 문구를 가져다 쓴다.
 * 새 상호작용을 넣을 때: 문구는 INTERACTION_LINES 에, 판정 함수는 이 파일에 추가한다.
 */

/** 상호작용마다 오리 사무장이 하는 말 [문장, 포즈, 표시 시간(ms)] */
export const INTERACTION_LINES = {
  bubblePop: ['…비누 거품이 터졌소. 목욕값은 환불되지 않소.', 'shrug', 4200],
  waterZap: ['…물에 번개를 치다니. 감전은 보험 적용이 안 되오.', 'shrug', 4200],
  signalCut: ['…전신 선을 가위로 자르다니. 소식은 도착하지 않을 것이오.', 'refuse', 4200],
  shortCircuit: ['…합선이오! 전신기가 미쳤소. 수신 담당이 무사하길 바라오.', 'point', 5200],
  cupShatter: ['…찻잔이 감전돼 깨졌소. 도자기는 전기에 약하오.', 'shrug', 4200],
  knifeCharged: ['…칼이 번개를 먹었소. 손대지 마시오.', 'refuse', 4200],
  sos: ['…방금 그 신호는 구조 요청이오. 아직은 이르오. 정말로 이르오.', 'point', 5400],
  telegraphColleague: ['…저쪽은 내 동료요. 수신 담당이오… 탈모면 빨리 다음으로 넘어가시오. 곧 열받을 거니까.', 'point', 5400],
} as const;

export type MorseType = 'dot' | 'dash';
export interface MorseMark { type: MorseType; t: number }

/** 가장 유명한 구조 신호: 점 셋, 선 셋, 점 셋 */
export const SOS_PATTERN: MorseType[] = ['dot', 'dot', 'dot', 'dash', 'dash', 'dash', 'dot', 'dot', 'dot'];
/** SOS 로 인정하는 시간 창(ms): 이 안에 아홉 번을 쳐야 한다 */
export const SOS_WINDOW = 6000;
/** 이보다 짧게 누르면 점, 길면 선 (ms) */
export const DOT_MAX_MS = 200;

/** 새 신호를 기록하고 SOS 가 완성됐는지 돌려준다. 완성되면 기록은 비운다 */
export function trackMorse(history: MorseMark[], type: MorseType, now: number): { history: MorseMark[]; sos: boolean } {
  const next = [...history.filter((h) => now - h.t < SOS_WINDOW), { type, t: now }].slice(-SOS_PATTERN.length);
  const sos = next.length === SOS_PATTERN.length && next.every((h, i) => h.type === SOS_PATTERN[i]);
  return { history: sos ? [] : next, sos };
}

/** 수면을 따라 양쪽으로 갈라져 퍼지는 번개의 길 두 갈래 (SVG polyline 점 목록). x: 번개가 닿은 가로 위치, w·h: 물 띠의 크기 */
export function zapPaths(x: number, w: number, h: number): string[] {
  const arm = (dir: number) => {
    let px = x;
    let pts = `${px},${h * 0.35}`;
    while (px > -30 && px < w + 30) {
      px += dir * (22 + Math.random() * 20);
      pts += ` ${px},${h * (0.18 + Math.random() * 0.34)}`;
    }
    return pts;
  };
  return [arm(-1), arm(1)];
}

/** 점이 원(사각형에 내접) 안에 있는가: 거품처럼 둥근 대상을 맞혔는지 */
export function insideCircle(x: number, y: number, r: DOMRect): boolean {
  return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < r.width / 2;
}

/** 점이 사각형(여유 pad 포함) 안에 있는가 */
export function nearRect(x: number, y: number, r: DOMRect | undefined | null, pad = 0): boolean {
  return !!r && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

/**
 * 합선 때 전신기가 혼자 쏟아 내는 신호는 아무 점·선이 아니라, 누구나 아는 유명한 박자다.
 * 점(dot)은 짧은 소리, 선(dash)은 긴 소리. 박자를 바꿔 가며 쓰고, 처음에는 가장 유명한 "We Will Rock You"다.
 * notes: [시각(ms), 종류]
 */
export interface FamousBeat { name: string; hint: string; notes: [number, MorseType][] }

function rep(pattern: [number, MorseType][], times: number, cycleMs: number): [number, MorseType][] {
  return Array.from({ length: times }, (_, k) => pattern.map(([t, kind]) => [t + k * cycleMs, kind] as [number, MorseType])).flat();
}
/** 간격이 점점 좁아지는 박자 (조스) */
function accel(startGap: number, factor: number, count: number): [number, MorseType][] {
  const out: [number, MorseType][] = []; let t = 0; let gap = startGap;
  for (let i = 0; i < count; i++) { out.push([t, i % 2 === 0 ? 'dash' : 'dot']); t += gap; gap = Math.max(110, gap * factor); }
  return out;
}

export const FAMOUS_BEATS: FamousBeat[] = [
  { name: 'We Will Rock You', hint: '쿵 쿵 짝', notes: rep([[0, 'dot'], [330, 'dot'], [660, 'dash']], 4, 1320) },
  { name: '운명 (베토벤 5번 교향곡)', hint: '빠 빠 빠 밤', notes: rep([[0, 'dot'], [190, 'dot'], [380, 'dot'], [620, 'dash']], 2, 1700) },
  { name: 'SOS', hint: '··· −−− ···', notes: [[0, 'dot'], [230, 'dot'], [460, 'dot'], [900, 'dash'], [1450, 'dash'], [2000, 'dash'], [2550, 'dot'], [2780, 'dot'], [3010, 'dot']] },
  { name: 'Shave and a Haircut', hint: '따다다 단 다 … 단단', notes: [[0, 'dot'], [300, 'dot'], [450, 'dot'], [750, 'dash'], [1250, 'dot'], [2350, 'dash'], [2850, 'dash']] },
  { name: '조스 (Jaws)', hint: '두둥 … 두둥 두둥두둥', notes: accel(760, 0.8, 13) },
];

/** i 번째 합선에서 연주할 박자. 시작 시각을 250ms 뒤로 밀고, 끝나는 시각(span)도 함께 돌려준다 */
export function famousBeat(i: number): { name: string; hint: string; notes: [number, MorseType][]; span: number } {
  const b = FAMOUS_BEATS[((i % FAMOUS_BEATS.length) + FAMOUS_BEATS.length) % FAMOUS_BEATS.length];
  const notes = b.notes.map(([t, k]) => [250 + t, k] as [number, MorseType]);
  return { name: b.name, hint: b.hint, notes, span: notes[notes.length - 1][0] };
}
