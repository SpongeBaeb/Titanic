/**
 * 난간 장면(W1)의 넓은 컷을 그리는 캔버스 엔진.
 *
 * 배는 받은 옆모습 그림을 쓴다(public/sink). 그림을 네 장으로 나눠 두었다:
 *  - ship_off: 불 꺼진 배 (바탕)
 *  - ship_light: 켜진 그림에서 꺼진 그림을 뺀 "불빛 지도". 더해서 그리므로 구역마다 밝기를 따로 줄 수 있다
 *    (깜빡임, 전압이 떨어져 붉어지는 불, 뱃머리부터 번지는 정전)
 *  - ship_glow: 불빛 지도를 흐린 번짐
 *  - ship_light_sea: 물속에서 아직 켜져 있는 현창의 청록빛
 *
 * 단위는 미터다. 배는 실제 길이(269m)이고 사람은 1.7m 라, 사람은 점으로 보인다(가까운 장면은 1인칭 컷 RailPov 가 맡는다).
 * 세계 좌표: 수면이 y=0, 위쪽이 음수. 배는 수면의 한 점(PIV)을 축으로 뱃머리부터 가라앉으며 선미가 들린다.
 * 마지막 단계에서 배는 셋째와 넷째 굴뚝 사이에서 두 동강 난다: 뱃머리 쪽은 따로 가라앉고, 선미는 수면으로 떨어졌다가 다시 솟는다.
 *
 * 그리는 순서: 밤하늘 → 배(물속 부분까지) → 불빛 → 연기 → 사람들 → 수면 반사(화면을 띠로 잘라 뒤집어 흔든다)
 *  → 물속 불빛 → 물보라 → 비네트와 필름 입자.
 */

export type Mood = 'afraid' | 'sob' | 'calm';
export interface SternSceneOptions {
  /** 개발용: true 인 동안 시간이 흐르지 않는다 (디버그 일시정지) */
  isPaused?: () => boolean;
  reduce: boolean;
  onRocket?: () => void;
  onBlackout?: () => void;
  onGroan?: () => void;
  /** 배가 두 동강 나는 순간 */
  onBreak?: () => void;
  onSplash?: () => void;
}
export interface SternScene {
  /** 단계(0~4): 기울기와 물 높이가 따라간다. 이 단계를 넓은 컷으로 보여 줄 시간(초)을 돌려준다 */
  setBeat(i: number): number;
  setHand(v: boolean): void;
  setMood(m: Mood): void;
  /** 화면이 한 번 흔들린다 (모진 말) */
  kick(): void;
  /** 곁의 승객이 난간을 놓는다 */
  herLetGo(): void;
  /** 내가 떨어진다. 수면에 닿을 때까지의 시간(초)을 돌려준다 */
  fall(together: boolean): number;
  destroy(): void;
}

type V = { x: number; y: number };
const TAU = Math.PI * 2;
const SHIP_L = 269;
const PIV = { x: 150, y: 0 };
const TH = [6, 12, 19, 28, 47];
const SINK = [2, 5, 8, 11, 20];
/** 배 그림이 놓이는 자리(배 좌표, 미터): 그림 속 수면선이 y=0, 뱃머리 끝이 x=0 */
const IMG = { x: -8.73, y: -58.1, w: 281.6, h: 70.53 };
const DECK_Y = -16.4;
const RAIL_Y = -17.5;
const ME_X = 258;
const HER_X = 259;
const POOP_X0 = 233;
/** 굴뚝 꼭대기(배 좌표) */
const FUNNELS = [77.9, 112.3, 147.4];
const FUNNEL_TOP = -42.6;
/** 배가 갈라지는 자리와, 찢어진 단면의 들쭉날쭉한 선 */
const BREAK_X = 165;
const JAG: [number, number][] = [[166, -80], [166, -24], [163.4, -20.5], [167.2, -16.5], [164, -12], [168, -7.5], [163.2, -2.5], [166.6, 3.5], [163.8, 8.5], [165.4, 20]];
const G = 9.8;
/** 카메라가 보는 점이 놓이는 화면 높이 비율 (아래쪽은 대화 상자의 자리) */
const AY = 0.36;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const add = (a: V, b: V, s = 1): V => ({ x: a.x + b.x * s, y: a.y + b.y * s });
const mix = (a: V, b: V, t: number): V => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Smoke { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; pale: number }
interface Crowd { x: number; ph: number; h: number; loseBeat: number; delay: number; state: 0 | 1 | 2 | 3; wx: number; wy: number; vx: number; vy: number; rot: number; vr: number; t0: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; kind: 0 | 1 | 2 }
interface Faller { x: number; y: number; vx: number; vy: number; rot: number; vr: number; her: boolean; wet: boolean }
type Shot = 'stern' | 'wide' | 'follow';

export function createSternScene(canvas: HTMLCanvasElement, opts: SternSceneOptions): SternScene {
  const g = canvas.getContext('2d')!;
  const R = rng(1912);
  let W = 1, H = 1, dpr = 1;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ── 미리 만들어 두는 것: 불빛, 별, 은하수, 사람들, 필름 입자 ──
  const load = (src: string) => { const im = new Image(); im.decoding = 'async'; im.src = src; return im; };
  const ready = (im: HTMLImageElement) => im.complete && im.naturalWidth > 0;
  const imOff = load('/sink/ship_off.webp'), imLight = load('/sink/ship_light.webp'), imGlow = load('/sink/ship_glow.webp'), imSea = load('/sink/ship_light_sea.webp');
  const imSky = load('/swim/sea_plate.webp');
  // 전압이 떨어진 불빛: 불빛 지도를 붉게 물들인 것
  let lightDim: HTMLCanvasElement | null = null;

  const stars = Array.from({ length: 900 }, () => ({ x: R(), y: Math.pow(R(), 1.25), s: 0.35 + Math.pow(R(), 6) * 1.9, tw: R() * TAU, sp: 0.6 + R() * 2.4, c: R() }));
  const milky = document.createElement('canvas');
  milky.width = milky.height = 512;
  {
    const m = milky.getContext('2d')!;
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const cx = 40 + t * 432, cy = 256 + Math.sin(t * 5) * 26 + (R() - 0.5) * 30, rr = 50 + R() * 60;
      const gr = m.createRadialGradient(cx, cy, 0, cx, cy, rr);
      gr.addColorStop(0, 'rgba(150,170,220,0.10)');
      gr.addColorStop(1, 'rgba(150,170,220,0)');
      m.fillStyle = gr;
      m.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < 5200; i++) {
      const t = R();
      const spread = (R() + R() + R() - 1.5) * 70;
      m.fillStyle = `rgba(${200 + R() * 55},${210 + R() * 45},255,${0.12 + R() * 0.5})`;
      m.fillRect(40 + t * 432, 256 + Math.sin(t * 5) * 26 + spread, R() < 0.06 ? 1.4 : 0.7, R() < 0.06 ? 1.4 : 0.7);
    }
  }
  const grain = document.createElement('canvas');
  grain.width = grain.height = 160;
  {
    const m = grain.getContext('2d')!;
    const im = m.createImageData(160, 160);
    for (let i = 0; i < im.data.length; i += 4) { const v = R() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    m.putImageData(im, 0, 0);
  }

  const crowd: Crowd[] = [];
  for (let i = 0; i < 84; i++) {
    let x = POOP_X0 + 0.8 + R() * 27;
    if (x > ME_X - 1.7 && x < HER_X + 1.7) x += x < (ME_X + HER_X) / 2 ? -3.6 : 3.6;
    const q = R();
    crowd.push({ x: clamp(x, POOP_X0 + 0.6, 268), ph: R() * TAU, h: 1.5 + R() * 0.32, loseBeat: q < 0.08 ? 1 : q < 0.24 ? 2 : q < 0.5 ? 3 : q < 0.8 ? 4 : 9, delay: 1 + R() * 9, state: 0, wx: 0, wy: 0, vx: 0, vy: 0, rot: 0, vr: 0, t0: 0 });
  }

  // ── 상태 ──
  let t = 0, last: number | null = null, raf = 0, dead = false;
  let beat = 0, beatAt = 0;
  let th = TH[0], sink = SINK[0];
  let hand = false, mood: Mood = 'afraid';
  let shake = 0, rumble = 0;
  let blackoutAt = Infinity, blackoutSaid = false, flash = 0;
  let herGone = false;
  let brownAt = Infinity;
  let broke = false, slapSaid = false;
  const bow = { th: 0, sink: 0, age: 0 };
  const smoke: Smoke[] = [];
  let smokeAcc = 0, foamAcc = 0;
  let meFall: Faller | null = null, herFall: Faller | null = null;
  const herSlide = { on: false, x: HER_X, v: 0 };
  const parts: Part[] = [];
  const rings: { x: number; t0: number; big: boolean; sc: number }[] = [];
  const rocket = { state: 0 as 0 | 1 | 2, x: 0, y: 0, vy: 0, t0: 0 };
  let meteorAt = Infinity;
  const scarf: V[] = Array.from({ length: 7 }, () => ({ x: 0, y: 0 }));
  const scarfPrev: V[] = Array.from({ length: 7 }, () => ({ x: 0, y: 0 }));
  let scarfInit = false;
  let breathMe = 0.6, breathHer = 0;
  const shots: { kind: Shot; until: number }[] = [{ kind: 'wide', until: opts.reduce ? 1.2 : 3.4 }];
  let shot: Shot = 'wide';
  const cam = { x: 150, y: -30, lv: Math.log(300), init: false };

  // ── 좌표 ──
  const rad = () => (th * Math.PI) / 180;
  const s2w = (x: number, y: number): V => {
    const a = rad(), dx = x - PIV.x, dy = y - PIV.y;
    return { x: PIV.x + dx * Math.cos(a) + dy * Math.sin(a), y: sink - dx * Math.sin(a) + dy * Math.cos(a) };
  };
  const power = (sect: number, seed: number): number => {
    if (t >= blackoutAt) {
      const die = blackoutAt + (sect * 0.42) + seed * 0.12;
      if (t > die + 0.09) return 0;
      if (t > die) return 1.7;
      return 0.55 + 0.45 * Math.sin(t * 40 + seed * 50);
    }
    if (beat >= 2) {
      const n = Math.sin(t * 13 + sect) * Math.sin(t * 5.3 + seed * 9) * Math.sin(t * 31);
      const dip = Math.sin(t * 2.1 + sect * 1.7) > 0.93 ? 0.3 : 1;
      return clamp(0.72 + 0.28 * n, 0, 1) * dip;
    }
    return 0.92 + 0.08 * Math.sin(t * 3 + seed * 30);
  };
  const avgPower = () => (t >= blackoutAt + 3.6 ? 0 : t >= blackoutAt ? 1 - (t - blackoutAt) / 3.6 : beat >= 2 ? 0.8 : 1);
  const aspect = () => W / H;
  const shotTarget = (k: Shot): { f: V; vw: number } => {
    const a = aspect();
    if (k === 'follow' && meFall) return { f: { x: meFall.x + (herFall ? 0.5 : 0), y: Math.min(meFall.y, 3) }, vw: Math.max(44, 56 * a) };
    if (k === 'wide') return { f: s2w(beat >= 3 ? 176 : 140, beat >= 4 ? -34 : -22), vw: a < 1 ? 268 : Math.max(310, 200 * a) };
    // 선미 쪽 3분의 1: 대화가 오가는 동안의 기본 컷
    return { f: s2w(218, -30), vw: a < 1 ? 118 : Math.max(150, 104 * a) };
  };
  const cut = (kind: Shot, dur: number) => { shots.push({ kind, until: -dur }); };

  // ── 그리기: 배 ──
  const px = (w: number, z: number) => Math.max(w, 0.8 / z); // 가는 선이 사라지지 않게
  /** 불빛 지도를 여덟 구역으로 잘라, 구역마다 지금의 전력만큼 더해 그린다 */
  const slices = (im: CanvasImageSource, iw: number, ih: number, k: number) => {
    for (let sct = 0; sct < 8; sct++) {
      const p = Math.min(1.3, power(sct, 0.3 + sct * 0.07)) * k;
      if (p < 0.012) continue;
      const sx0 = sct === 0 ? 0 : Math.round((((sct * SHIP_L) / 8 - IMG.x) / IMG.w) * iw);
      const sx1 = sct === 7 ? iw : Math.round(((((sct + 1) * SHIP_L) / 8 - IMG.x) / IMG.w) * iw);
      g.globalAlpha = Math.min(1, p);
      g.drawImage(im, sx0, 0, sx1 - sx0, ih, IMG.x + (sx0 / iw) * IMG.w, IMG.y, ((sx1 - sx0) / iw) * IMG.w, IMG.h);
    }
    g.globalAlpha = 1;
  };
  /** 갈라진 뒤: 선미 쪽(stern) 또는 뱃머리 쪽만 남기는 오림 */
  const clipPiece = (stern: boolean) => {
    const xe = stern ? 300 : -30;
    g.beginPath();
    g.moveTo(xe, -80);
    for (const q of JAG) g.lineTo(q[0], q[1]);
    g.lineTo(xe, 20);
    g.closePath();
    g.clip();
  };
  const shipXf = (thv: number, sinkv: number) => { g.translate(PIV.x, PIV.y + sinkv); g.rotate((-thv * Math.PI) / 180); g.translate(-PIV.x, -PIV.y); };

  // ── 그리기: 사람 ──
  const elbow = (a: V, b: V, l1: number, l2: number, bend: number): V => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = clamp(Math.hypot(dx, dy), 0.02, l1 + l2 - 0.002);
    const a2 = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a2 * a2));
    const ux = dx / Math.hypot(dx, dy || 1e-6), uy = dy / Math.hypot(dx, dy || 1e-6);
    return { x: a.x + ux * a2 - uy * h * bend, y: a.y + uy * a2 + ux * h * bend };
  };
  const seg = (a: V, b: V, w: number) => { g.lineWidth = w; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
  interface Pose { head: V; sh: V; hip: V; knee: V; foot: V; knee2: V; foot2: V; h1: V; h2: V; e1: V; e2: V; k: number }
  const poseOf = (shipX: number, f: number, m: Mood, ph: number, reach: V | null): Pose => {
    const a = rad();
    const u: V = { x: -Math.cos(a), y: Math.sin(a) }; // 갑판의 내리막
    const n: V = { x: -Math.sin(a), y: -Math.cos(a) }; // 갑판에서 바깥
    const sx: V = { x: Math.cos(a), y: -Math.sin(a) }; // 난간을 따라 선미 쪽
    const Hp = s2w(shipX, RAIL_Y);
    const D = add(Hp, n, -1.1);
    const k = smooth(11, 30, th);
    const amp = m === 'afraid' ? 0.011 : m === 'sob' ? 0.009 : 0.003;
    const sv: V = { x: Math.sin(t * 31 + ph) * amp, y: Math.sin(t * 27 + ph * 2) * amp + Math.sin(t * 1.4 + ph) * 0.012 };
    // 서 있는 자세 (갑판이 완만할 때)
    const hipS = add(Hp, { x: -0.25 * f, y: 0.16 });
    const shS = add(hipS, { x: 0.11 * f, y: -0.52 });
    const kneeS = add(hipS, { x: 0.08 * f, y: 0.46 });
    const footS = add(hipS, { x: -0.03 * f, y: 0.93 });
    // 갑판에 엎드려 난간 기둥을 붙잡은 자세 (가팔라졌을 때)
    const shP = add(add(D, u, 0.42), n, 0.25);
    const hipP = add(add(shP, u, 0.55), n, -0.07);
    const kick = Math.sin(t * 4.2 + ph) * 0.09;
    const kneeP = add(add(hipP, u, 0.44), n, 0.12 + kick);
    const footP = add(add(kneeP, u, 0.42), n, -0.12 - kick * 0.6);
    const sh = add(mix(shS, shP, k), sv);
    const hip = add(mix(hipS, hipP, k), sv, 0.5);
    const knee = mix(kneeS, kneeP, k), foot = mix(footS, footP, k);
    const knee2 = add(add(knee, u, -0.1 * k), { x: 0.1 * f * (1 - k), y: 0.02 }), foot2 = add(add(foot, n, 0.14 * k + kick * 0.9 * k), { x: 0.17 * f * (1 - k), y: 0 });
    const headUp: V = mix({ x: 0.07 * f, y: -0.21 }, add({ x: -u.x * 0.2, y: -u.y * 0.2 }, n, 0.13), k);
    const md: V = m === 'afraid' ? { x: 0, y: 0.035 } : m === 'sob' ? { x: 0.03 * f, y: 0.07 } : { x: 0, y: -0.02 };
    const head = add(add(sh, headUp), md);
    const h1 = mix(Hp, add(D, n, 0.52), k);
    const h2 = reach ?? add(h1, sx, 0.27 * f);
    return { head, sh, hip, knee, foot, knee2, foot2, h1, h2, e1: elbow(sh, h1, 0.31, 0.29, -f), e2: elbow(sh, h2, 0.31, 0.29, f * (reach ? -1 : 1)), k };
  };
  const drawBody = (p: Pose, her: boolean, f: number, col: string) => {
    g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
    seg(p.hip, p.knee2, 0.13); seg(p.knee2, p.foot2, 0.1);
    seg(p.sh, p.e2, 0.085); seg(p.e2, p.h2, 0.07);
    if (her) {
      // 긴 치마: 엉덩이에서 발목까지, 자락이 바람에 떤다
      const fl = Math.sin(t * 3.1) * 0.05;
      g.beginPath();
      g.moveTo(p.hip.x - 0.13, p.hip.y); g.lineTo(p.hip.x + 0.13, p.hip.y);
      g.lineTo(p.foot.x + 0.2 + fl, p.foot.y - 0.08); g.lineTo(p.foot2.x - 0.2 + fl, p.foot2.y - 0.08);
      g.closePath(); g.lineWidth = 0.08; g.stroke(); g.fill();
      seg(p.knee, p.foot, 0.085);
    } else {
      seg(p.hip, p.knee, 0.14); seg(p.knee, p.foot, 0.105);
      const hem = mix(p.hip, p.knee, 0.8); // 외투 자락
      seg(p.hip, add(hem, { x: -0.05 * f + Math.sin(t * 2.6) * 0.02, y: 0 }), 0.3);
    }
    seg(p.sh, p.hip, her ? 0.24 : 0.29);
    seg(p.sh, p.e1, 0.09); seg(p.e1, p.h1, 0.075);
    g.beginPath(); g.arc(p.head.x, p.head.y, 0.105, 0, TAU); g.fill();
    seg(p.sh, p.head, 0.09);
    if (her) {
      g.beginPath(); g.arc(p.head.x + 0.085 * -f, p.head.y - 0.06, 0.062, 0, TAU); g.fill(); // 틀어 올린 머리
    } else {
      g.beginPath(); g.ellipse(p.head.x - 0.01 * f, p.head.y - 0.085, 0.125, 0.055, 0, 0, TAU); g.fill(); // 납작모자
      seg({ x: p.head.x + 0.06 * f, y: p.head.y - 0.07 }, { x: p.head.x + 0.19 * f, y: p.head.y - 0.045 }, 0.03);
    }
  };
  const drawFigure = (p: Pose, her: boolean, f: number, lampP: number) => {
    // 불빛이 닿는 가장자리: 등불이 켜져 있으면 따뜻하게, 꺼지면 별빛처럼 차갑게
    const rim = lampP > 0.05 ? `rgba(255,186,116,${0.75 * lampP})` : 'rgba(170,198,245,0.8)';
    g.save(); g.translate(lampP > 0.05 ? -0.022 : -0.008, lampP > 0.05 ? -0.006 : -0.026);
    drawBody(p, her, f, rim);
    g.restore();
    drawBody(p, her, f, '#070a10');
    g.fillStyle = `rgb(${Math.round(lerp(118, 216, lampP))},${Math.round(lerp(128, 180, lampP))},${Math.round(lerp(150, 146, lampP))})`;
    g.beginPath(); g.arc(p.h1.x, p.h1.y, 0.048, 0, TAU); g.fill();
    g.beginPath(); g.arc(p.h2.x, p.h2.y, 0.048, 0, TAU); g.fill();
  };
  const stepScarf = (anchor: V, dt: number) => {
    if (!scarfInit) { for (let i = 0; i < 7; i++) { scarf[i] = { x: anchor.x - i * 0.08, y: anchor.y + i * 0.03 }; scarfPrev[i] = { ...scarf[i] }; } scarfInit = true; }
    scarf[0] = { ...anchor };
    const wind = -2.6 - Math.sin(t * 1.3) * 1.4 - Math.sin(t * 4.7) * 0.6;
    for (let i = 1; i < 7; i++) {
      const p = scarf[i], q = scarfPrev[i];
      const vx = (p.x - q.x) * 0.9, vy = (p.y - q.y) * 0.9;
      scarfPrev[i] = { ...p };
      p.x += vx + wind * dt * dt * 6 + Math.sin(t * 9 + i) * 0.0009;
      p.y += vy + 3.2 * dt * dt * 6 + Math.cos(t * 7 + i * 1.7) * 0.0012;
    }
    for (let it = 0; it < 3; it++) for (let i = 1; i < 7; i++) {
      const a = scarf[i - 1], b = scarf[i];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, k = (d - 0.085) / d;
      b.x -= dx * k; b.y -= dy * k;
    }
  };
  const drawScarf = (lampP: number) => {
    g.strokeStyle = `rgb(${Math.round(lerp(150, 236, lampP))},${Math.round(lerp(160, 214, lampP))},${Math.round(lerp(178, 176, lampP))})`;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 1; i < 7; i++) { g.lineWidth = lerp(0.085, 0.03, i / 6); g.beginPath(); g.moveTo(scarf[i - 1].x, scarf[i - 1].y); g.lineTo(scarf[i].x, scarf[i].y); g.stroke(); }
  };
  const drawFaller = (f: Faller, lampP: number) => {
    if (f.wet) return;
    g.save(); g.translate(f.x, f.y); g.rotate(f.rot);
    const fl = Math.sin(t * 9 + (f.her ? 2 : 0)) * 0.12;
    const body = (col: string) => {
      g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round';
      seg({ x: 0, y: -0.3 }, { x: 0, y: 0.25 }, f.her ? 0.24 : 0.29);
      seg({ x: 0, y: -0.28 }, { x: -0.5, y: -0.55 + fl }, 0.085); seg({ x: 0, y: -0.28 }, { x: 0.5, y: -0.5 - fl }, 0.085);
      if (f.her) { g.beginPath(); g.moveTo(-0.13, 0.2); g.lineTo(0.13, 0.2); g.lineTo(0.42, 1.0 + fl); g.lineTo(-0.36, 1.0 - fl); g.closePath(); g.fill(); }
      else { seg({ x: 0, y: 0.25 }, { x: -0.28, y: 1.0 + fl }, 0.13); seg({ x: 0, y: 0.25 }, { x: 0.3, y: 0.98 - fl }, 0.13); }
      g.beginPath(); g.arc(0, -0.5, 0.105, 0, TAU); g.fill();
    };
    g.save(); g.translate(-0.03, -0.025); body(lampP > 0.05 ? `rgba(255,186,116,${0.8 * lampP})` : 'rgba(180,205,250,0.85)'); g.restore();
    body('#070a10');
    if (f.her) { g.strokeStyle = 'rgba(214,206,186,0.9)'; seg({ x: 0, y: -0.38 }, { x: 0.12 + fl * 0.5, y: -1.1 }, 0.06); }
    g.restore();
  };
  const drawCrowd = (z: number, lampP: number, dt: number) => {
    const a = rad();
    const u: V = { x: -Math.cos(a), y: Math.sin(a) }, n: V = { x: -Math.sin(a), y: -Math.cos(a) };
    const k = smooth(11, 30, th);
    g.lineCap = 'round';
    for (const c of crowd) {
      if (c.state === 3) continue;
      if (c.state === 0 && beat >= c.loseBeat && t > beatAt + c.delay) { c.state = 1; c.vx = 0; }
      let base: V, dir: V;
      if (c.state === 2) {
        c.vy += G * dt; c.wx += c.vx * dt; c.wy += c.vy * dt; c.rot += c.vr * dt;
        if (c.wy > 0) { c.state = 3; splash(c.wx, false, 1); continue; }
        base = { x: c.wx, y: c.wy }; dir = { x: Math.sin(c.rot), y: -Math.cos(c.rot) };
      } else {
        if (c.state === 1) {
          c.vx += Math.max(0.6, G * Math.sin(a) - 1.6) * dt;
          c.x -= c.vx * dt;
          if (c.x < POOP_X0) { const w = s2w(c.x, DECK_Y - 0.4); c.state = 2; c.wx = w.x; c.wy = w.y; c.vy = u.y * c.vx; c.vx = u.x * c.vx; c.vr = (c.ph - 3) * 0.9; c.rot = 0; continue; }
        }
        const D = s2w(c.x, DECK_Y);
        const lie = c.state === 1 ? 1 : k;
        base = add(D, n, lerp(0, 0.16, lie));
        const up: V = { x: Math.sin(c.ph + t * 1.1) * 0.05, y: -1 };
        dir = { x: lerp(up.x, -u.x, lie), y: lerp(up.y, -u.y, lie) };
        const dl = Math.hypot(dir.x, dir.y) || 1; dir.x /= dl; dir.y /= dl;
        if (c.state === 1) base = add(base, u, 0);
      }
      if (c.state === 0 && z > 22) {
        const f = c.ph > Math.PI ? 1 : -1, her = c.ph % 1 > 0.55;
        const p = poseOf(c.x, f, 'afraid', c.ph, null);
        g.save(); g.translate(lampP > 0.05 ? -0.02 : -0.004, lampP > 0.05 ? -0.006 : -0.018);
        drawBody(p, her, f, lampP > 0.05 ? `rgba(255,180,110,${0.4 * lampP})` : 'rgba(140,165,215,0.3)');
        g.restore();
        drawBody(p, her, f, '#05070b');
        continue;
      }
      const top = add(base, dir, c.h * (c.state === 0 ? lerp(1, 0.82, k) : 0.82));
      if (z > 2.4) {
        g.strokeStyle = lampP > 0.05 ? `rgba(255,180,110,${0.35 * lampP})` : 'rgba(140,165,215,0.25)';
        g.lineWidth = 0.22; g.beginPath(); g.moveTo(base.x - 0.03, base.y - 0.01); g.lineTo(lerp(base.x, top.x, 0.8) - 0.03, lerp(base.y, top.y, 0.8) - 0.01); g.stroke();
      }
      g.strokeStyle = '#06080d'; g.fillStyle = '#06080d';
      g.lineWidth = Math.max(0.24, 0.62 / z); g.beginPath(); g.moveTo(base.x, base.y); g.lineTo(lerp(base.x, top.x, 0.8), lerp(base.y, top.y, 0.8)); g.stroke();
      g.beginPath(); g.arc(top.x, top.y, Math.max(0.11, 0.42 / z), 0, TAU); g.fill();
    }
  };

  // ── 물보라와 입자 ──
  function splash(x: number, big: boolean, sc: number) {
    rings.push({ x, t0: t, big, sc });
    const nn = big ? Math.round(70 * Math.min(2, sc)) : 9;
    for (let i = 0; i < nn; i++) {
      const an = -Math.PI / 2 + (R() - 0.5) * (big ? 1.5 : 1.1), sp = (big ? 5 + R() * 11 : 2 + R() * 4) * Math.sqrt(sc);
      parts.push({ x: x + (R() - 0.5) * (big ? 1.4 : 0.5) * sc * sc, y: -0.05, vx: Math.cos(an) * sp * 0.6, vy: Math.sin(an) * sp, life: 0, max: (0.9 + R() * 1.3) * Math.sqrt(sc), size: (big ? 0.07 + R() * 0.16 : 0.08 + R() * 0.1) * sc, kind: 0 });
    }
    if (big) opts.onSplash?.();
  }
  /** 배가 두 동강 난다: 불꽃이 튀고, 먼지와 증기가 솟고, 뱃머리 쪽은 따로 가라앉기 시작한다 */
  function breakShip() {
    broke = true; bow.th = th; bow.sink = sink; bow.age = 0;
    // 갈라지는 순간에는 남은 불도 모두 나간다
    blackoutAt = Math.min(blackoutAt, t - 2.9);
    flash = Math.max(flash, 0.7); shake = 1; rumble = 1.5;
    opts.onBreak?.();
    for (let i = 0; i < 130; i++) {
      const q = s2w(BREAK_X + (R() - 0.5) * 5, -22 + R() * 26);
      const an = -Math.PI / 2 + (R() - 0.5) * 2.6, sp = 4 + R() * 22;
      parts.push({ x: q.x, y: q.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 4, life: 0, max: 1.2 + R() * 2.2, size: 0.3 + R() * 0.45, kind: 2 });
    }
    for (let i = 0; i < 30; i++) {
      const q = s2w(BREAK_X + (R() - 0.5) * 12, -20 + R() * 22);
      smoke.push({ x: q.x, y: q.y, vx: (R() - 0.5) * 12, vy: -(2 + R() * 10), r: 2.5 + R() * 4, life: 0, max: 4 + R() * 5, pale: 1 });
    }
  }
  const breath = (from: V, strength: number) => {
    for (let i = 0; i < 9; i++) parts.push({ x: from.x + (R() - 0.5) * 0.05, y: from.y + (R() - 0.5) * 0.05, vx: -0.3 - R() * 0.5, vy: -0.12 - R() * 0.25, life: 0, max: 1.3 + R() * 0.8, size: 0.05 + R() * 0.04 * strength, kind: 1 });
  };

  // ── 한 프레임 ──
  const frame = (now: number) => {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = last === null || opts.isPaused?.() ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    // 배: 지금 단계의 기울기와 물 높이를 천천히 따라간다. 내가 떨어지기 시작하면 멈춘다
    if (!meFall) {
      let thT = TH[beat], sinkT = SINK[beat], rate = 0.42;
      if (beat === 4) {
        // 마지막 단계: 선미가 더 들리다가 → 배가 갈라지고 → 선미가 수면으로 떨어졌다가 → 하늘로 솟는다
        const tb = t - beatAt;
        if (tb < 1.6) { thT = 31; sinkT = 12; rate = 0.7; }
        else {
          if (!broke) breakShip();
          if (tb < 3.6) { thT = 10; sinkT = 8; rate = 2.2; } else { thT = TH[4]; sinkT = SINK[4]; rate = 0.2; }
        }
      }
      const e = 1 - Math.exp(-dt * (opts.reduce ? 4 : rate));
      th += (thT - th) * e;
      sink += (sinkT - sink) * e;
    }
    if (broke) {
      bow.age += dt;
      bow.th = Math.min(bow.th + dt * (4 + bow.age * 2), 62);
      bow.sink += dt * (2.5 + bow.age * 3.2);
      if (!slapSaid && bow.age > 1.25) {
        // 선미가 수면을 내리친다
        slapSaid = true; shake = Math.max(shake, 0.8);
        for (const x of [172, 196, 224]) {
          const wx = s2w(x, 11).x;
          splash(wx, x === 196, 1.7);
          // 물안개의 벽: 선체 길이만큼 낮게 솟았다가 흩어진다
          for (let i = 0; i < 16; i++) smoke.push({ x: wx + (R() - 0.5) * 26, y: -1 - R() * 3, vx: (R() - 0.5) * 9, vy: -(2 + R() * 8), r: 2.4 + R() * 3.4, life: 0, max: 2.6 + R() * 3, pale: 1 });
        }
      }
    }
    const thDraw = th + Math.sin(t * 0.6) * 0.12;
    const lampP = power(7, 0.37) > 1 ? 1 : clamp(power(7, 0.37), 0, 1);
    if (t >= blackoutAt && !blackoutSaid) { blackoutSaid = true; opts.onBlackout?.(); flash = 1; meteorAt = t + 4.5; }

    // 카메라: 컷 목록을 차례로 쓴다
    while (shots.length && shots[0].until < 0) shots[0].until = t - shots[0].until;
    let hard = false;
    if (shots.length && t >= shots[0].until) { shots.shift(); if (shots.length && shots[0].until < 0) shots[0].until = t - shots[0].until; hard = shots.length > 0 || shot !== 'wide'; }
    const want: Shot = meFall ? 'follow' : shots.length ? shots[0].kind : 'stern';
    const firstPush = shot === 'wide' && want === 'stern' && beat === 0;
    if (want !== shot) { if (!firstPush && want !== 'follow') hard = true; shot = want; }
    const tg = shotTarget(shot);
    const creep = shot === 'follow' || opts.reduce ? 1 : 1 - 0.06 * clamp((t - beatAt) / 7, 0, 1);
    const lvT = Math.log(tg.vw * creep);
    if (!cam.init || (hard && !firstPush)) { cam.x = tg.f.x; cam.y = tg.f.y; cam.lv = lvT; cam.init = true; }
    else {
      const rate = shot === 'follow' ? 4 : beat === 0 && shot === 'stern' && t < 12 ? 0.62 : 2.4;
      const e = 1 - Math.exp(-dt * rate);
      cam.lv += (lvT - cam.lv) * e;
      // 화면에서 같은 빠르기로 움직이도록, 확대율에 맞춰 위치를 따라간다
      cam.x += (tg.f.x - cam.x) * e * (shot === 'follow' ? 1 : 1.25);
      cam.y += (tg.f.y - cam.y) * e * (shot === 'follow' ? 1 : 1.25);
    }
    const z = W / Math.exp(cam.lv);
    shake = Math.max(0, shake - dt * 1.6); rumble = Math.max(0, rumble - dt * 0.7);
    const sAmp = opts.reduce ? 0 : 1.1 + shake * 11 + rumble * 4.5;
    const shx = (Math.sin(t * 1.7) + Math.sin(t * 4.3 + 1) * 0.5 + (shake + rumble > 0.01 ? Math.sin(t * 47) : 0)) * sAmp * 0.6;
    const shy = (Math.sin(t * 2.1 + 2) + Math.sin(t * 3.7) * 0.5 + (shake + rumble > 0.01 ? Math.sin(t * 53 + 1) : 0)) * sAmp * 0.6;
    const ox = W / 2 - cam.x * z + shx, oy = H * AY - cam.y * z + shy;
    const seaSy = oy; // 수면(y=0)의 화면 높이
    const world = () => g.setTransform(z * dpr, 0, 0, z * dpr, ox * dpr, oy * dpr);
    const screen = () => g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ap = avgPower();

    // 1. 밤하늘
    screen();
    const sky = g.createLinearGradient(0, 0, 0, Math.max(H * 0.4, Math.min(H, seaSy)));
    sky.addColorStop(0, '#010208'); sky.addColorStop(0.6, '#040b17'); sky.addColorStop(1, '#0a1a2b');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const starK = 0.5 + 0.5 * (1 - ap);
    {
      const hLine = Math.min(H, Math.max(H * 0.3, seaSy));
      if (ready(imSky)) {
        const sw = imSky.naturalWidth, sh = imSky.naturalHeight * 0.455;
        const sc = Math.max((W + 60) / sw, hLine / sh);
        const dw = sw * sc, dh = sh * sc;
        g.globalAlpha = 0.5 + 0.5 * (1 - ap);
        g.drawImage(imSky, 0, 0, sw, sh, (W - dw) / 2 - (cam.x - 150) * 0.06, hLine - dh, dw, dh);
        g.globalAlpha = 1;
      } else {
        g.save();
        g.globalAlpha = 0.16 + 0.62 * (1 - ap);
        g.translate(W * 0.5, Math.min(H, seaSy) * 0.36); g.rotate(-0.5);
        const ms = Math.max(W, H) * 1.5;
        g.globalCompositeOperation = 'lighter';
        g.drawImage(milky, -ms / 2, -ms / 2, ms, ms);
        g.restore();
      }
    }
    g.globalCompositeOperation = 'lighter';
    const skyH = Math.min(H, Math.max(H * 0.3, seaSy));
    for (const s of stars) {
      const tw = 0.62 + 0.38 * Math.sin(t * s.sp + s.tw);
      const a = clamp((0.25 + s.s * 0.5) * tw * starK * (0.35 + 0.65 * (1 - s.y)), 0, 1);
      const sx = ((s.x * (W + 80) - cam.x * 0.25) % (W + 80) + (W + 80)) % (W + 80) - 40, sy = s.y * skyH;
      g.fillStyle = s.c > 0.85 ? `rgba(255,222,190,${a})` : s.c < 0.15 ? `rgba(170,200,255,${a})` : `rgba(232,238,255,${a})`;
      g.fillRect(sx, sy, s.s, s.s);
      if (s.s > 1.5) { g.fillStyle = `rgba(210,225,255,${a * 0.22})`; g.fillRect(sx - s.s * 1.6, sy + s.s * 0.3, s.s * 4.2, s.s * 0.4); g.fillRect(sx + s.s * 0.3, sy - s.s * 1.6, s.s * 0.4, s.s * 4.2); }
    }
    // 불이 꺼진 뒤의 별똥별 하나
    if (t > meteorAt && t < meteorAt + 0.9) {
      const q = (t - meteorAt) / 0.9, mx = W * (0.72 - q * 0.34), my = skyH * (0.12 + q * 0.2);
      const mg = g.createLinearGradient(mx, my, mx + 90, my - 52);
      mg.addColorStop(0, `rgba(255,255,255,${0.9 * Math.sin(q * Math.PI)})`); mg.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = mg; g.lineWidth = 1.3; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + 90, my - 52); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    // 배의 불빛이 밤안개에 번진다
    const mid = s2w(135, -24);
    const hz = g.createRadialGradient(mid.x * z + ox, mid.y * z + oy, 0, mid.x * z + ox, mid.y * z + oy, 170 * z);
    hz.addColorStop(0, `rgba(255,170,90,${0.26 * ap})`); hz.addColorStop(0.4, `rgba(255,150,80,${0.09 * ap})`); hz.addColorStop(1, 'rgba(255,150,80,0)');
    g.fillStyle = hz; g.fillRect(0, 0, W, H);

    // 조난 신호탄: 장면이 열릴 때 한 발
    world();
    if (rocket.state === 0 && t > 0.5) { const b = s2w(52, -30); rocket.state = 1; rocket.x = b.x; rocket.y = b.y; rocket.vy = -78; rocket.t0 = t; }
    if (rocket.state === 1) {
      rocket.vy += 26 * dt; rocket.y += rocket.vy * dt;
      g.strokeStyle = 'rgba(255,240,220,0.85)'; g.lineWidth = px(0.3, z); g.lineCap = 'round';
      g.beginPath(); g.moveTo(rocket.x, rocket.y); g.lineTo(rocket.x + 0.3, rocket.y + 9); g.stroke();
      if (rocket.vy > -16) {
        rocket.state = 2; flash = Math.max(flash, 0.75); opts.onRocket?.();
        for (let i = 0; i < 64; i++) { const an = R() * TAU, sp = 5 + R() * 19; parts.push({ x: rocket.x, y: rocket.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 3, life: 0, max: 2.2 + R() * 1.8, size: 0.5 + R() * 0.5, kind: 2 }); }
      }
    }

    // 2. 배: 그림. 물속 부분도 그려 두면 수면 아래로 희미하게 비친다
    const pieces = (fn: () => void) => {
      if (!broke) { g.save(); shipXf(thDraw, sink); fn(); g.restore(); return; }
      g.save(); shipXf(thDraw, sink); clipPiece(true); fn(); g.restore();
      g.save(); shipXf(bow.th, bow.sink); clipPiece(false); fn(); g.restore();
    };
    if (ready(imOff)) pieces(() => g.drawImage(imOff, IMG.x, IMG.y, IMG.w, IMG.h));
    if (!lightDim && ready(imLight)) {
      lightDim = document.createElement('canvas');
      lightDim.width = Math.round(imLight.naturalWidth / 2); lightDim.height = Math.round(imLight.naturalHeight / 2);
      const c = lightDim.getContext('2d')!;
      c.drawImage(imLight, 0, 0, lightDim.width, lightDim.height);
      c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(255,120,62)'; c.fillRect(0, 0, lightDim.width, lightDim.height);
    }
    if (ap > 0.004 && ready(imLight)) {
      // 전압이 떨어지면 불빛이 노란빛에서 붉은빛으로 바뀐다
      const brown = clamp((t - brownAt) / 7, 0, 1) * 0.85;
      g.globalCompositeOperation = 'lighter';
      pieces(() => {
        slices(imLight, imLight.naturalWidth, imLight.naturalHeight, 1 - brown);
        if (lightDim && brown > 0.01) slices(lightDim, lightDim.width, lightDim.height, brown);
        if (ready(imGlow)) slices(imGlow, imGlow.naturalWidth, imGlow.naturalHeight, 0.85);
      });
      g.globalCompositeOperation = 'source-over';
    }
    // 굴뚝의 연기: 보일러가 살아 있는 동안 피어오르고, 아래에서 불빛을 받는다
    if (!opts.reduce && beat < 3 && !meFall) {
      smokeAcc += dt * 4.5;
      while (smokeAcc > 1) {
        smokeAcc -= 1;
        const q = s2w(FUNNELS[Math.floor(R() * 3)], FUNNEL_TOP);
        if (q.y < -3 && smoke.length < 70) smoke.push({ x: q.x + (R() - 0.5) * 2, y: q.y, vx: 0.8 + R() * 1.6, vy: -(2.2 + R() * 2.2), r: 2.6 + R() * 2, life: 0, max: 7 + R() * 5, pale: 0 });
      }
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const m = smoke[i];
      m.life += dt;
      if (m.life > m.max) { smoke.splice(i, 1); continue; }
      const q = m.life / m.max;
      m.x += m.vx * dt; m.y += m.vy * dt; m.vy *= 1 - dt * 0.1;
      const rr = m.r * (1 + q * (m.pale ? 2.1 : 3.4));
      const warm = ap * (1 - q) * (1 - m.pale);
      const a = (m.pale ? 0.13 : 0.26) * Math.sin(Math.min(1, q * 1.25) * Math.PI);
      const cr = Math.round(lerp(lerp(24, 150, m.pale), 120, warm)), cg = Math.round(lerp(lerp(28, 160, m.pale), 84, warm)), cb = Math.round(lerp(lerp(38, 178, m.pale), 56, warm));
      const gr = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, rr);
      gr.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      g.fillStyle = gr; g.fillRect(m.x - rr, m.y - rr, rr * 2, rr * 2);
    }
    // 선체가 물에 잠겨 드는 자리: 갑판선이 수면과 만나는 곳에서 물이 허옇게 끓는다
    if (!broke && !opts.reduce) {
      const a = rad();
      const xs = PIV.x + (sink - 17 * Math.cos(a)) / Math.sin(a);
      if (xs > 4 && xs < 236) {
        foamAcc += dt * 34;
        while (foamAcc > 1) {
          foamAcc -= 1;
          const w = s2w(xs, -17);
          parts.push({ x: w.x + (R() - 0.5) * 16, y: -0.05, vx: (R() - 0.5) * 2.4, vy: -(0.5 + R() * 2.6), life: 0, max: 0.6 + R() * 0.9, size: 0.14 + R() * 0.3, kind: 0 });
        }
      }
    }
    g.save();
    g.beginPath(); g.rect(cam.x - W / z, -4000, (W / z) * 2, 4000); g.clip();
    // 3. 사람들과 난간
    drawCrowd(z, lampP, dt);
    if (z > 2.4) {
      const hmM = poseOf(ME_X, 1, 'afraid', 0.7, null), hhM = poseOf(herSlide.x, -1, mood, 2.9, null);
      const holding = hand && !herGone && !meFall;
      const join = holding ? add(mix(hmM.sh, hhM.sh, 0.5), { x: 0, y: 0.2 }) : null;
      const me = poseOf(ME_X, 1, 'afraid', 0.7, join);
      if (!meFall) drawFigure(me, false, 1, lampP);
      if (!herGone && !herFall) {
        const her = poseOf(HER_X, -1, mood, 2.9, join);
        drawFigure(her, true, -1, lampP);
        stepScarf(add(her.sh, { x: 0, y: -0.07 }), dt || 0.016);
        drawScarf(lampP);
        breathHer -= dt;
        if (breathHer <= 0 && z > 30) { breath(add(her.head, { x: -0.12, y: 0.03 }), mood === 'afraid' ? 1.4 : 1); breathHer = mood === 'afraid' ? 0.9 : mood === 'sob' ? 1.2 : 2.3; }
      } else if (herSlide.on) {
        // 손을 놓은 승객: 갑판을 미끄러져 내려간 뒤 떨어진다
        const a = rad();
        herSlide.v += Math.max(1.2, G * Math.sin(a) - 1.2) * dt; herSlide.x -= herSlide.v * dt;
        const p = s2w(herSlide.x, DECK_Y - 0.35);
        if (herSlide.x < POOP_X0) { herSlide.on = false; herFall = { x: p.x, y: p.y, vx: -Math.cos(a) * herSlide.v, vy: Math.sin(a) * herSlide.v, rot: -1.2, vr: -2.2, her: true, wet: false }; }
        else { g.save(); g.translate(p.x, p.y); g.rotate(-a - Math.PI / 2 + Math.sin(t * 7) * 0.15); g.translate(-p.x, -p.y); drawFaller({ x: p.x, y: p.y, vx: 0, vy: 0, rot: 0, vr: 0, her: true, wet: false }, lampP); g.restore(); }
      }
      breathMe -= dt;
      if (!meFall && breathMe <= 0 && z > 30) { breath(add(me.head, { x: 0.12, y: 0.03 }), 1); breathMe = 1.5; }
    }
    for (const f of [meFall, herFall]) {
      if (!f || f.wet) continue;
      f.vy += G * dt; f.vx *= 1 - dt * 0.12; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      if (f.y > 0) { f.wet = true; splash(f.x, true, 1); } else drawFaller(f, lampP);
    }
    g.restore();

    // 입자: 신호탄 불꽃, 입김, 물방울
    g.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life > p.max || (p.kind === 0 && p.y > 0.2 && p.vy > 0)) { parts.splice(i, 1); continue; }
      const q = p.life / p.max;
      if (p.kind === 0) { p.vy += G * dt; g.fillStyle = `rgba(210,230,255,${0.75 * (1 - q)})`; }
      else if (p.kind === 1) { p.vx *= 1 - dt * 0.5; g.fillStyle = `rgba(190,208,235,${0.03 * Math.sin(q * Math.PI)})`; }
      else { p.vy += 5 * dt; p.vx *= 1 - dt * 1.3; p.vy *= 1 - dt * 1.3; g.fillStyle = `rgba(255,${Math.round(250 - q * 60)},${Math.round(235 - q * 120)},${(1 - q) * (0.6 + 0.4 * Math.sin(t * 30 + i))})`; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const r = p.kind === 1 ? p.size * (1 + q * 2.6) : p.kind === 2 ? Math.max(p.size * (1 - q * 0.5), 1 / z) : Math.max(p.size, 0.8 / z);
      g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-over';

    // 4. 수면: 위쪽 화면을 띠로 잘라 뒤집어 비추고, 띠마다 좌우로 흔든다
    screen();
    if (seaSy < H) {
      const top = Math.max(0, seaSy);
      const hgt = 2;
      g.globalAlpha = 0.62;
      for (let d = 0; top + d < H; d += hgt) {
        const dd = top - seaSy + d;
        const srcY = seaSy - 1 - dd * 1.22;
        if (srcY < 1) break;
        const dx = Math.sin(dd * 0.105 + t * 1.6) * (0.5 + dd * 0.014) + Math.sin(dd * 0.33 - t * 2.4) * 0.8;
        g.drawImage(canvas, 0, Math.floor(srcY * dpr), canvas.width, Math.ceil(hgt * dpr), dx, top + d, W, hgt + 0.5);
      }
      g.globalAlpha = 1;
      const sea = g.createLinearGradient(0, seaSy, 0, seaSy + Math.max(220, H * 0.45));
      sea.addColorStop(0, 'rgba(5,16,28,0.38)'); sea.addColorStop(0.35, 'rgba(3,10,19,0.78)'); sea.addColorStop(1, 'rgba(1,4,9,0.985)');
      g.fillStyle = sea; g.fillRect(0, top, W, H - top);
      if (seaSy > 0) {
        g.fillStyle = 'rgba(150,190,220,0.16)'; g.fillRect(0, seaSy - 0.5, W, 1);
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 70; i++) {
          const gy = seaSy + 3 + ((i * 53) % 190) * (1 + (i % 3) * 0.4);
          if (gy > H) continue;
          const gx = ((i * 197 + t * (6 + (i % 5) * 3)) % (W + 60)) - 30;
          const ga = (0.05 + 0.1 * ap) * (0.5 + 0.5 * Math.sin(t * 2 + i));
          g.fillStyle = `rgba(${Math.round(lerp(170, 255, ap))},${Math.round(lerp(200, 205, ap))},${Math.round(lerp(235, 150, ap))},${ga})`;
          g.fillRect(gx, gy, 14 + (i % 4) * 9, 1);
        }
        g.globalCompositeOperation = 'source-over';
      }
      // 5. 물속에서 아직 켜져 있는 불빛
      world();
      if (ap > 0.004 && ready(imSea)) {
        g.globalCompositeOperation = 'lighter';
        for (const [y0, y1, kk] of [[0, 9, 0.62], [9, 24, 0.3], [24, 60, 0.12]] as const) {
          g.save();
          g.beginPath(); g.rect(cam.x - W / z, y0, (W / z) * 2, y1 - y0); g.clip();
          pieces(() => slices(imSea, imSea.naturalWidth, imSea.naturalHeight, kk));
          g.restore();
        }
        g.globalCompositeOperation = 'source-over';
      }
      // 물결 고리
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i], q = (t - r.t0) / (r.big ? 2.6 : 1.4);
        if (q > 1) { rings.splice(i, 1); continue; }
        g.strokeStyle = `rgba(220,235,255,${0.55 * (1 - q)})`; g.lineWidth = px(r.big ? 0.14 : 0.07, z);
        g.beginPath(); g.ellipse(r.x, 0.1, (r.big ? 9 : 2.5) * r.sc * q + 0.3, ((r.big ? 9 : 2.5) * r.sc * q + 0.3) * 0.16, 0, 0, TAU); g.stroke();
      }
      screen();
    }

    // 6. 번쩍임, 비네트, 필름 입자
    if (flash > 0.01) { g.fillStyle = `rgba(235,240,255,${0.16 * flash})`; g.fillRect(0, 0, W, H); flash *= Math.exp(-dt * 3.2); }
    const vg = g.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.28, W / 2, H * 0.42, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.78)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (!opts.reduce) {
      g.globalAlpha = 0.055; g.globalCompositeOperation = 'overlay';
      const gx = Math.floor(R() * 160), gy = Math.floor(R() * 160);
      for (let y = -gy; y < H; y += 160) for (let x = -gx; x < W; x += 160) g.drawImage(grain, x, y);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  };
  raf = requestAnimationFrame(frame);

  return {
    setBeat(i) {
      const b = clamp(i, 0, TH.length - 1);
      if (b === beat) return 0;
      beat = b; beatAt = t;
      rumble = 1;
      opts.onGroan?.();
      if (opts.reduce) return 1.2;
      if (b === 2) { brownAt = t; cut('wide', 4.2); return 4.2; }
      if (b === 3) { blackoutAt = t + 1.6; cut('wide', 7.4); return 7.4; }
      if (b === 4) { cut('wide', 8.6); return 8.6; }
      return 3.4;
    },
    setHand(v) { hand = v; },
    setMood(m) { mood = m; },
    kick() { shake = 1; },
    herLetGo() { if (herGone) return; herGone = true; hand = false; herSlide.on = true; herSlide.x = HER_X; herSlide.v = 0.4; },
    fall(together) {
      if (meFall) return 0;
      shots.length = 0;
      const pm = s2w(ME_X, RAIL_Y);
      meFall = { x: pm.x, y: pm.y - 0.4, vx: 4.6, vy: -2.2, rot: 0, vr: 1.5, her: false, wet: false };
      if (together && !herGone) { const ph = s2w(HER_X, RAIL_Y); herFall = { x: ph.x, y: ph.y - 0.4, vx: 4.9, vy: -2.4, rot: 0, vr: -1.1, her: true, wet: false }; herGone = true; }
      return 0.23 + Math.sqrt(0.05 + (2 * Math.max(1, -pm.y + 0.4)) / G);
    },
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); },
  };
}
