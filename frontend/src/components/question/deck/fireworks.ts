/**
 * Q5 샴페인 연출의 폭죽: 실제 화약 불꽃처럼 보이게 하는 작은 입자 엔진 (2D 캔버스, 'lighter' 합성).
 *
 * 실제 화약 폭죽에서 눈에 띄는 것들을 따라 한다.
 *  - 발사: 포에서 쏘아 올린 알(셸)이 감속하며 오르고, 숯가루 불티가 금빛 꼬리로 흩날린다. 꼭대기에서 터진다.
 *  - 폭발: 한순간 하얀 섬광, 구 모양으로 퍼지는 별(불꽃 알갱이). 공기 저항으로 금방 느려지고 중력으로 처진다.
 *  - 별: 타는 동안 밝다가 끝에서 깜빡이며 사그라든다. 일부는 색이 바뀐다(속심이 다른 별).
 *  - 국화/버들: 숯이 섞인 별은 지나간 자리에 금빛 잔불티를 남긴다. 버들은 오래 타며 길게 늘어진다.
 *  - 딱총(크래클): 별이 다 타는 순간 자잘한 흰 불티로 '타닥' 터진다.
 *  - 연기: 터진 자리마다 화약 연기가 남아 바람에 밀려 퍼진다. 다음 폭발의 빛을 받을 때만 보인다.
 *  - 수면: 바다에 흔들리는 세로 빛줄기로 비친다.
 * 1912년의 불꽃은 숯과 금속 가루의 금빛, 은빛, 스트론튬의 빨강, 바륨의 초록이 주였다. 파랑은 거의 없었다.
 *
 * 좌표는 DeckView 의 그림 좌표(1376x768)다. 화면 좌표는 toScreen 으로 바꿔 그린다.
 */

export type ShellKind = 'radial' | 'ring' | 'willow' | 'big';

type RGB = string; // 'r,g,b'

/** 당시 화약 색: 금(숯), 은(알루미늄·마그네슘), 빨강(스트론튬), 초록(바륨), 주황 */
export const FW_PAL: RGB[] = ['255,196,110', '236,238,255', '255,86,60', '150,255,140', '255,150,70'];
const GOLD: RGB = '255,178,90';
const GLITTER: RGB = '255,214,150';

interface Star {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  col: RGB; col2?: RGB;     // col2: 반쯤 타면 바뀌는 색
  trail: number;            // 초당 남기는 잔불티 수 (0이면 없음)
  trailLife: number;        // 잔불티가 남아 있는 시간
  drag: number;             // 공기 저항 (클수록 빨리 멈춘다)
  crackle: boolean;
  size: number;
  hist: [number, number][];
  acc: number;
}
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; col: RGB; size: number }
interface Smoke { x: number; y: number; r: number; life: number; max: number; img: number; rot: number }
interface Flash { x: number; y: number; life: number; max: number; r: number; col: RGB }
interface Shell { x: number; y: number; vx: number; vy: number; g: number; ty: number; kind: ShellKind; ci: number; onBurst?: (kind: ShellKind) => void }

const G_STAR = 42;     // 별의 중력 (그림 좌표 px/s²)
const G_SPARK = 55;
const MAX_SPARKS = 2600;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** 부드러운 빛 덩이 (색마다 한 번만 만들어 둔다) */
function makeGlow(col: RGB): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(255,255,255,1)`);
  gr.addColorStop(0.12, `rgba(${col},0.85)`);
  gr.addColorStop(0.4, `rgba(${col},0.22)`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/** 화약 연기 덩어리: 겹친 둥근 얼룩으로 뭉게뭉게한 모양 (그림 파일 없이 만든다) */
function makeSmoke(seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  let s = seed * 9301 + 49297;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2; const d = r() * 34;
    const x = 64 + Math.cos(a) * d; const y = 64 + Math.sin(a) * d * 0.8;
    const rad = 14 + r() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(210,190,170,0.09)');
    gr.addColorStop(0.6, 'rgba(190,175,160,0.04)');
    gr.addColorStop(1, 'rgba(190,175,160,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
}

export class FireworkShow {
  private shells: Shell[] = [];
  private stars: Star[] = [];
  private sparks: Spark[] = [];
  private smokes: Smoke[] = [];
  private flashes: Flash[] = [];
  private glow = new Map<RGB, HTMLCanvasElement>();
  private smokeImgs: HTMLCanvasElement[] = [];
  /** 하늘과 바다를 물들이는 밝기 (0~1). DeckView 가 셰이더의 uGlow 로 쓴다 */
  light = 0;
  private flashBoost = 0;

  constructor(private horizonY: number) {
    for (let i = 0; i < 4; i++) this.smokeImgs.push(makeSmoke(i + 1));
  }

  get active() { return this.shells.length + this.stars.length + this.sparks.length > 0; }

  private glowOf(col: RGB) {
    let g = this.glow.get(col);
    if (!g) { g = makeGlow(col); this.glow.set(col, g); }
    return g;
  }

  /** 수평선 아래(배 근처)에서 쏘아 올려 (x, y)에서 터진다. 오르는 시간은 약 0.8초 */
  launch(x: number, y: number, ci: number, kind: ShellKind, onBurst?: (kind: ShellKind) => void) {
    const sx = x + rnd(-30, 30);
    const sy = this.horizonY + 6;
    const h = sy - y; const T = 0.8;
    const g = (2 * h) / (T * T);
    this.shells.push({ x: sx, y: sy, vx: (x - sx) / T, vy: g * T, g, ty: y, kind, ci, onBurst });
  }

  private burst(sh: Shell) {
    const { x, y, kind, ci } = sh;
    const big = kind === 'big';
    const col = FW_PAL[ci % FW_PAL.length];
    // 섬광과 연기
    this.flashes.push({ x, y, life: 0, max: big ? 0.22 : 0.15, r: big ? 260 : 180, col: '255,240,220' });
    this.flashBoost = Math.min(1.4, this.flashBoost + (big ? 0.9 : 0.55));
    for (let i = 0; i < (big ? 5 : 3); i++) {
      this.smokes.push({ x: x + rnd(-25, 25), y: y + rnd(-20, 20), r: rnd(80, 130) * (big ? 1.4 : 1), life: 0, max: rnd(6, 9), img: Math.floor(Math.random() * 4), rot: Math.random() * 6.28 });
    }
    const add = (n: number, v0: number, o: Partial<Star>, ring = false) => {
      // 구 모양으로 퍼지는 별을 화면에 투영: 구 표면의 고른 방향 → 원판 안의 점 (가장자리가 진해 보인다)
      const tilt = rnd(0.35, 0.8);
      for (let i = 0; i < n; i++) {
        let dx: number; let dy: number;
        if (ring) { const a = (i / n) * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a) * tilt; }
        else {
          const u = Math.random() * 2 - 1; const a = Math.random() * Math.PI * 2; const r = Math.sqrt(1 - u * u);
          dx = r * Math.cos(a); dy = r * Math.sin(a);
        }
        const v = v0 * rnd(0.92, 1.06);
        this.stars.push({
          x, y, vx: dx * v, vy: dy * v, life: 0, max: rnd(1.2, 1.6), col, trail: 0, trailLife: 0.8, drag: 2.2,
          crackle: false, size: 1, hist: [], acc: 0, ...o,
        });
      }
    };
    if (kind === 'radial') {
      // 한 번은 모란(색 별), 한 번은 국화(금빛 꼬리를 끄는 별)
      if (ci % 2 === 0) add(110, 430, { col2: FW_PAL[(ci + 1) % FW_PAL.length], max: rnd(1.3, 1.7) });
      else add(100, 450, { col: GOLD, trail: 26, trailLife: 1.0, crackle: Math.random() < 0.5, max: rnd(1.4, 1.8) });
    } else if (kind === 'ring') {
      add(64, 400, { max: rnd(1.2, 1.5) }, true);
    } else if (kind === 'willow') {
      add(80, 470, { col: GOLD, trail: 40, trailLife: 2.6, drag: 2.6, max: rnd(2.8, 3.6), size: 0.8 });
    } else {
      // 큰 셸: 바깥은 금빛 국화, 속은 은빛 심(피스틸), 끝에서 타닥
      add(160, 560, { col: GOLD, trail: 26, trailLife: 1.2, crackle: true, max: rnd(1.6, 2.0), size: 1.15 });
      add(55, 240, { col: FW_PAL[1], col2: FW_PAL[2], max: rnd(1.4, 1.8) });
    }
  }

  update(dt: number) {
    // 셸: 감속하며 오르고, 금빛 불티를 흘린다
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.vy -= s.g * dt;
      s.y -= s.vy * dt; s.x += s.vx * dt;
      const n = Math.random() < 90 * dt % 1 ? Math.ceil(90 * dt) : Math.floor(90 * dt);
      for (let k = 0; k < n; k++) this.spark(s.x + rnd(-1, 1), s.y + rnd(0, 3), rnd(-12, 12), rnd(5, 25), rnd(0.25, 0.7), GOLD, 1);
      if (s.vy <= 0 || s.y <= s.ty) { this.burst(s); s.onBurst?.(s.kind); this.shells.splice(i, 1); }
    }
    // 별
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const p = this.stars[i];
      p.life += dt;
      if (p.life > p.max) {
        if (p.crackle) {
          for (let k = 0; k < 7; k++) { const a = Math.random() * 6.28; const v = rnd(25, 60); this.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rnd(0.08, 0.22), '255,250,235', 1.4); }
          this.flashes.push({ x: p.x, y: p.y, life: 0, max: 0.07, r: 9, col: '255,250,235' });
        }
        this.stars.splice(i, 1); continue;
      }
      p.hist.push([p.x, p.y]); if (p.hist.length > 8) p.hist.shift();
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + G_STAR * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.trail > 0) {
        p.acc += p.trail * dt * (1 - 0.5 * p.life / p.max);
        while (p.acc >= 1) { p.acc -= 1; this.spark(p.x + rnd(-1, 1), p.y + rnd(-1, 1), p.vx * 0.06 + rnd(-4, 4), p.vy * 0.06 + rnd(-2, 6), p.trailLife * rnd(0.5, 1.1), GLITTER, 0.9); }
      }
    }
    // 잔불티
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life += dt;
      if (p.life > p.max) { this.sparks.splice(i, 1); continue; }
      const k = Math.exp(-1.6 * dt);
      p.vx *= k; p.vy = p.vy * k + G_SPARK * dt * 0.5;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    // 연기: 바람에 밀리며 퍼지고 옅어진다
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const m = this.smokes[i];
      m.life += dt;
      if (m.life > m.max) { this.smokes.splice(i, 1); continue; }
      m.x += 9 * dt; m.y += 2 * dt; m.r += 7 * dt; m.rot += 0.04 * dt;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; f.life += dt; if (f.life > f.max) this.flashes.splice(i, 1); }
    // 하늘을 물들이는 빛: 타는 별 수와 섬광
    this.flashBoost *= Math.exp(-dt * 5);
    const target = Math.min(1, this.stars.length / 260 + this.sparks.length / 4000 + this.flashBoost);
    this.light += (target - this.light) * Math.min(1, dt * 8);
  }

  private spark(x: number, y: number, vx: number, vy: number, max: number, col: RGB, size: number) {
    if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
    this.sparks.push({ x, y, vx, vy, life: 0, max, col, size });
  }

  draw(fx: CanvasRenderingContext2D, toScreen: (x: number, y: number) => { x: number; y: number; s: number }, time: number) {
    // 1) 연기: 폭죽 빛을 받을 때만 보인다 (어두운 밤하늘에서는 거의 안 보임)
    fx.globalCompositeOperation = 'lighter';
    const lit = 0.04 + this.light * 0.5;
    for (const m of this.smokes) {
      const u = m.life / m.max;
      // 연기는 터진 뒤 천천히 피어올라(1.2초) 퍼지며 옅어진다
      const a = Math.min(1, m.life / 1.2) * (1 - u) * lit * 0.35;
      if (a < 0.01) continue;
      const p = toScreen(m.x, m.y); const r = m.r * p.s;
      fx.globalAlpha = a;
      fx.save(); fx.translate(p.x, p.y); fx.rotate(m.rot);
      fx.drawImage(this.smokeImgs[m.img], -r, -r, r * 2, r * 2);
      fx.restore();
    }
    fx.globalAlpha = 1;
    // 2) 섬광
    for (const f of this.flashes) {
      const a = 1 - f.life / f.max;
      const p = toScreen(f.x, f.y); const r = f.r * p.s * (0.7 + 0.3 * a);
      fx.globalAlpha = a * 0.9;
      fx.drawImage(this.glowOf(f.col), p.x - r, p.y - r, r * 2, r * 2);
    }
    // 3) 셸 머리
    for (const s of this.shells) {
      const p = toScreen(s.x, s.y); const r = Math.max(4, 8 * p.s);
      fx.globalAlpha = 0.9;
      fx.drawImage(this.glowOf(GOLD), p.x - r, p.y - r, r * 2, r * 2);
    }
    // 4) 잔불티: 아주 작은 점이 깜빡이며 식어 간다 (뜨거울 때 희고, 식으면 붉은 금빛)
    for (const k of this.sparks) {
      if (Math.random() < 0.22) continue; // 반짝임
      const u = k.life / k.max;
      const p = toScreen(k.x, k.y);
      const a = (1 - u) * (1 - u) * 0.95;
      const c = u < 0.25 ? '255,244,220' : k.col;
      fx.globalAlpha = a;
      fx.fillStyle = `rgb(${c})`;
      const sz = Math.max(1.1, k.size * p.s * 1.8);
      fx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
    // 5) 별: 짧은 노출 꼬리 + 빛 덩이 + 흰 심
    fx.lineCap = 'round';
    for (const st of this.stars) {
      const u = st.life / st.max;
      let a = Math.min(1, st.life / 0.05);
      if (u > 0.72) a *= Math.max(0, 1 - (u - 0.72) / 0.28) * (0.55 + 0.45 * Math.random()); // 다 타 갈 때 깜빡이며 사그라듦
      const col = st.col2 && u > 0.5 ? st.col2 : st.col;
      const p = toScreen(st.x, st.y);
      const h0 = st.hist[0] ?? [st.x, st.y];
      const q = toScreen(h0[0], h0[1]);
      fx.globalAlpha = a * 0.75;
      fx.strokeStyle = `rgb(${col})`;
      fx.lineWidth = Math.max(1.2, 2.2 * st.size * p.s);
      fx.beginPath(); fx.moveTo(q.x, q.y); fx.lineTo(p.x, p.y); fx.stroke();
      const r = Math.max(5, 11 * st.size * p.s);
      fx.globalAlpha = a;
      fx.drawImage(this.glowOf(col), p.x - r, p.y - r, r * 2, r * 2);
      // 수면에 비친 빛: 수평선 아래로 같은 거리만큼, 물결에 흔들리는 세로 줄
      const ry = this.horizonY + (this.horizonY - st.y) * 0.35;
      const rp = toScreen(st.x + Math.sin(time * 3 + st.y * 0.2) * 2, ry);
      fx.globalAlpha = a * 0.12;
      fx.fillStyle = `rgb(${col})`;
      fx.fillRect(rp.x - 1 * p.s, rp.y - 7 * p.s, 2 * p.s, 14 * p.s);
    }
    fx.globalAlpha = 1;
  }
}
