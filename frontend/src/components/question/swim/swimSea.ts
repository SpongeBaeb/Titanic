/**
 * 헤엄 장면(W2)의 바다. 눈높이가 수면에 닿은 1인칭.
 *
 * 겹은 둘이다.
 *  - WebGL 캔버스: 받은 밤하늘 그림(swim/sea_plate)을 하늘로 쓰고, 바다는 셰이더로 직접 그린다.
 *    물결 높이에서 기울기를 구해 하늘을 뒤집어 비추므로 별과 은하수가 수면에서 일렁인다.
 *    구명선의 불빛은 수면에 길게 부서지고, 팔이 물을 칠 때마다 물결 고리가 퍼진다.
 *    렌즈(눈)가 물에 반쯤 잠겨 있어, 화면 맨 아래에 수면선이 걸려 오르내리고 첨벙일 때 눈앞을 덮는다.
 *  - 2D 캔버스: 첨벙거림. 실제로 물에서 팔을 내리칠 때처럼 물이 '덩어리'로 움직인다:
 *    손이 친 자리에서 물의 막(왕관 모양의 물벽)이 솟아 무너지고, 막의 끝이 끊어져 굵은 방울로 떨어지며, 물안개가 남는다.
 *    친 자리의 수면은 공기가 섞여 허옇게 끓고(셰이더), 굵고 느린 물결이 눈 쪽으로 밀려와 눈앞을 덮는다.
 *    머리는 치는 팔 쪽으로 기울고(수평선이 기운다), 물이 눈 위로 흘러 시야가 잠깐 일그러진다.
 */

import { createFrameBudget } from '@/lib/frameBudget';

export interface SwimSeaOptions {
  reduce: boolean;
  skyUrl: string;
  /** 수평선의 화면 높이 비율 */
  horizon: number;
}
export interface SwimSea {
  /** WebGL 을 쓸 수 있는가 (못 쓰면 하늘 그림을 그대로 깐다) */
  ok: boolean;
  /** 구명선 불빛: 가로 위치(0~1), 가까워진 정도(0~1) */
  setLight(x: number, near: number): void;
  /** 불빛이 한 번 크게 깜빡인다 (소리쳐 불렀을 때) */
  flash(): void;
  /** 손이 물을 친다: 화면 위치(0~1)와 세기 */
  splash(x: number, y: number, power: number): void;
  /** 손이 물을 몸 쪽으로 끌어당긴다: 시작 자리(0~1), 옮겨 가는 거리(화면 높이에 대한 비율), 걸리는 시간(초), 세기 */
  pull(x: number, y: number, dx: number, dy: number, dur: number, power: number): void;
  /** 몸이 가라앉는다: 수면이 눈 위로 올라온다 */
  sink(): void;
  destroy(): void;
}

const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0., 1.); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec2 uImg;
uniform float uTime, uHY, uDunk, uLx, uNear, uFlash, uSurge, uRoll, uWash;
uniform sampler2D uSky;
uniform sampler2D uBoat; // 멀리 있는 구명정(W3 의 그림에서 오려 낸 것): 전체가 정사각 비율 240x115 의 투명 그림
uniform vec4 uRip[12];
// 눈앞(렌즈)에 맺힌 물방울: (가운데 x, y, 가로 반지름, 세로 반지름), 짙기
uniform vec4 uDrop[8];
uniform float uDropA[8];
out vec4 o;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p){
  float a = .5, s = 0.;
  for(int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; }
  return s;
}

// 하늘: 받은 그림의 위쪽 절반(수평선 위)을 수평선에 맞춰 깐다
vec3 skyAt(vec2 p, float hy){
  float s = max(hy / (uImg.y * .5), uRes.x / uImg.x);
  vec2 uv = vec2(.5 + (p.x - uRes.x * .5) / (uImg.x * s), .5 - (hy - p.y) / (uImg.y * s));
  uv = clamp(uv, vec2(.002), vec2(.998, .497));
  vec3 c = texture(uSky, uv).rgb;
  float lum = max(c.r, max(c.g, c.b));
  c *= 1. + .3 * sin(uTime * 2.6 + hash(floor(p / 3.)) * 40.) * smoothstep(.3, .7, lum);
  return c;
}

// 물결 높이 (수면 좌표)
float waveH(vec2 q, float t){
  float h = 0.;
  h += sin(q.x * 1.1 + q.y * .6 + t * .9) * .50;
  h += sin(q.x * -.7 + q.y * 1.7 + t * 1.25 + 1.3) * .32;
  h += sin(q.x * 2.9 + q.y * 2.3 - t * 1.9) * .14;
  h += (fbm(q * 1.6 + vec2(t * .25, t * .18)) - .5) * .9;
  h += (noise(q * 7. + vec2(-t * .6, t * .5)) - .5) * .16;
  return h;
}

// 한 점의 색(물방울을 입히기 전): 물방울 안에서는 이 장면을 뒤집어 다시 본다
vec3 scene(vec2 p){
  float k = uRes.y / 900.;
  float hy = uHY * uRes.y;
  float lpx = uLx * uRes.x;
  float t = uTime;
  vec3 col;
  float d = p.y - hy;
  if(d <= 0.){
    col = skyAt(p, hy);
  } else {
    // 눈높이가 수면에 붙어 있어, 수평선 쪽으로 갈수록 급하게 눌린다
    float Z = (uRes.y * .06) / max(d, .5);
    vec2 q = vec2((p.x - uRes.x * .5) / uRes.y * Z, Z) * 8.;
    q.y += uSurge;
    float far = 1. / (1. + Z * .55);
    float e = .06;
    float h0 = waveH(q, t);
    float hx = (waveH(q + vec2(e, 0.), t) - h0) / e;
    float hz = (waveH(q + vec2(0., e), t) - h0) / e;
    // 손이 친 자리에서 퍼지는 물결 고리
    float ring = 0.;
    float churn = 0.; // 공기가 섞여 허옇게 끓는 정도
    for(int i = 0; i < 12; i++){
      vec4 r = uRip[i];
      if(r.z >= 0.){
        vec2 dv = (p - r.xy) * vec2(1., 3.0);
        float dist = length(dv);
        // 굵고 느린 물결: 큰 물이 움직이면 파장이 길고 천천히 퍼진다
        float w = dist - r.z * 190. * k;
        float a = sin(w * .05 / k) * exp(-w * w * .0001 / (k * k)) * exp(-r.z * .85) * r.w;
        ring += a;
        hx += a * 3.6 * dv.x / max(dist, 1.);
        hz += a * 3.6;
        float R = (55. + r.z * 150.) * k * sqrt(r.w);
        churn += smoothstep(R, R * .25, dist) * exp(-r.z * .8) * min(r.w, 1.6);
      }
    }
    // 끓는 자리는 수면이 잘게 부서진다
    float fnz = fbm(vec2(p.x, p.y * 2.6) * .028 / k + vec2(1.3, -t * .4));
    hx += (noise(p * .08 / k + vec2(t * 3.1, 0.)) - .5) * churn * 4.;
    hz += (noise(p * .08 / k + vec2(4., -t * 2.7)) - .5) * churn * 4.;
    float att = clamp(d / (46. * k), .12, 1.);
    // 하늘을 뒤집어 비춘다: 가까운 물은 높은 하늘(별, 은하수)을, 먼 물은 수평선의 안개를 비춘다
    vec2 pr = vec2(p.x + hx * 52. * k * att, hy - d * .92 - 5. * k + hz * 38. * k * att);
    vec3 refl = skyAt(vec2(pr.x, min(pr.y, hy - 1.)), hy);
    float graze = d / uRes.y;
    float fres = mix(1.05, .34, smoothstep(0., .5, graze)) * clamp(1. - hz * .3, .35, 1.4);
    vec3 base = mix(vec3(.016, .042, .060), vec3(.003, .011, .018), smoothstep(0., .42, graze));
    col = base + refl * fres * 1.35;
    // 물마루에 걸리는 차가운 별빛
    float crest = smoothstep(.45, 1.5, -hz + hx * .25);
    col += vec3(.36, .48, .62) * crest * (.035 + .05 * far);
    // 구명선의 불빛이 수면에 길게 부서진다
    float width = (3. + d * (.085 + .26 * uNear)) * (1. + .0 * k);
    float g = exp(-pow((p.x - lpx + hx * 34. * k * att) / width, 2.));
    float sparkle = smoothstep(.42, .95, noise(vec2(p.x * .33 / k + hx * 7., d * .8 / k - t * 3.2)) + hz * .55);
    float reach = exp(-d / (uRes.y * (.2 + .34 * uNear)));
    col += vec3(1., .70, .34) * g * (.22 + 1.7 * sparkle) * reach * (.42 + 1.1 * uNear) * (1. + uFlash * 1.6);
    col += vec3(.62, .78, .95) * max(ring, 0.) * .16;
    // 허연 물: 거품 무늬가 가운데부터 차올랐다가 가장자리부터 사그라든다. 그 밑은 공기가 섞여 청록빛이 돈다
    float foam = smoothstep(.66 - churn * .46, .80, fnz + churn * .16) * clamp(churn * 1.5, 0., 1.);
    col += vec3(.020, .075, .085) * clamp(churn, 0., 1.2);
    col = mix(col, vec3(.50, .62, .69) * (.62 + .6 * fnz), foam * .82);
    // 수평선의 안개
    col = mix(col, vec3(.055, .082, .098), exp(-d / (11. * k)) * .55);
  }
  // 멀리 구명정: W3 의 그림에서 오려 낸 구명정(노를 든 두 사람과 등불)을 수평선에 앉힌다. 가까워질수록 커진다
  float sw = (64. + 380. * uNear) * k, sh = sw * 115. / 240.;
  float Ly = hy - sh * .30;                       // 등불의 높이
  vec2 suv = (p - vec2(lpx - .33 * sw, Ly - .41 * sh)) / vec2(sw, sh);
  if(suv.x > 0. && suv.x < 1. && suv.y > 0. && suv.y < 1.){
    vec4 bt = texture(uBoat, suv);
    col = mix(col, bt.rgb * .92, bt.a * .97);
  }
  float flick = .9 + .1 * sin(t * 9.) * sin(t * 3.3);
  float gd = length((p - vec2(lpx, Ly)) * vec2(1., 1.25));
  col += vec3(1., .74, .40) * exp(-gd / ((7. + 30. * uNear) * k)) * (.75 + uNear) * flick * (1. + uFlash * 2.);
  col += vec3(1., .93, .78) * exp(-gd / ((1.6 + 3.2 * uNear) * k)) * 1.3 * flick;

  // 물에 반쯤 잠긴 눈: 화면 아래에 수면선이 걸려 오르내린다. 첨벙이면 눈앞을 덮는다
  float wl = uRes.y * (1. - (.022 + uDunk * 1.08))
    + (sin(p.x * .011 / k + t * 1.7) * 7. + sin(p.x * .029 / k - t * 2.3) * 3.5 + (noise(vec2(p.x * .018 / k, t * .9)) - .5) * 16.) * k;
  float under = p.y - wl;
  if(under > 0.){
    float depth = under / (220. * k);
    vec3 uc = vec3(.006, .034, .043) * (1. - .7 * clamp(depth, 0., 1.));
    float ca = pow(noise(vec2(p.x * .012 / k + t * .25, under * .02 / k - t * .35)), 3.);
    uc += vec3(.05, .12, .13) * ca * exp(-depth * 2.2);
    // 올라가는 공기 방울
    vec2 bg = vec2(p.x / (26. * k), (p.y + t * 90. * k) / (26. * k));
    vec2 bi = floor(bg), bf = fract(bg) - .5;
    float br = hash(bi);
    float bub = step(.86, br) * smoothstep(.16 * br, .0, length(bf - (vec2(hash(bi + 2.), hash(bi + 5.)) - .5) * .5));
    uc += vec3(.35, .5, .55) * bub * .5 * exp(-depth * 1.4);
    col = mix(col * .22 + uc, uc, smoothstep(0., 70. * k, under));
  }
  col += vec3(.6, .76, .86) * exp(-abs(under) / (2.2 * k)) * .42;
  col *= 1. - .55 * exp(-max(-under, 0.) / (12. * k));

  return col;
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float k = uRes.y / 900.;
  // 머리가 치는 팔 쪽으로 기운다: 수평선을 축으로 화면이 돈다
  vec2 c0 = vec2(uRes.x * .5, uHY * uRes.y);
  float cr = cos(uRoll), sr = sin(uRoll);
  p = c0 + mat2(cr, sr, -sr, cr) * (p - c0);
  // 물이 눈 위로 흘러내리는 동안 시야가 일그러진다
  p += uWash * (vec2(noise(p * .007 / k + vec2(0., uTime * 3.5)), noise(p * .008 / k + vec2(7., -uTime * 3.))) - .5) * 120. * k;
  vec3 col = scene(p);
  col = mix(col, col * .62 + vec3(.035, .07, .085), uWash * .55);
  // 렌즈에 맺힌 물방울: 하얀 동그라미가 아니라, 물방울은 작은 볼록렌즈라 뒤의 풍경을 뒤집고 확대해 보여 준다.
  // 가장자리는 어둡게 빛이 꺾이고, 아래쪽 안쪽에는 빛이 모이며, 위쪽 한 점에만 작은 하이라이트가 맺힌다.
  for(int i = 0; i < 8; i++){
    float a = uDropA[i];
    if(a > .001){
      vec4 dr = uDrop[i];
      vec2 v = (p - dr.xy) / dr.zw;
      float rr = length(v);
      if(rr < 1.){
        float m = smoothstep(1., .9, rr) * a;
        vec2 src = dr.xy - (p - dr.xy) * 1.35 + vec2(0., dr.w * .25);
        vec3 inner = scene(src);
        float rim = smoothstep(.55, 1., rr);
        inner *= 1. - .55 * rim;
        inner += vec3(.10, .14, .17) * smoothstep(.0, 1., v.y * .5 + .5) * (1. - rim) * .8;
        float hl = exp(-pow(length(v - vec2(-.38, -.42)) / .17, 2.));
        inner += vec3(.55, .62, .70) * hl * .55;
        col = mix(col, inner, m);
        col *= 1. - .22 * smoothstep(.86, 1.02, rr) * a;
      }
    }
  }
  o = vec4(pow(max(col, 0.), vec3(.9)), 1.);
}`;

interface Drop { x: number; y: number; px: number; py: number; vx: number; vy: number; size: number; life: number; max: number; warm: number; floor: number }
interface Puff { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number }
/** 물의 막: 손이 친 자리에서 솟는 물벽. 기둥마다 따로 솟았다 떨어져, 윗선이 들쭉날쭉한 왕관 모양이 된다 */
interface Sheet { x: number; y: number; t0: number; w: number; g: number; alpha: number; cols: { u: number; v: number; lean: number; shed: boolean }[] }
interface Lens { x: number; y: number; r: number; vy: number; life: number; max: number; wob: number }

export function createSwimSea(glCanvas: HTMLCanvasElement, fxCanvas: HTMLCanvasElement, opts: SwimSeaOptions): SwimSea {
  const fx = fxCanvas.getContext('2d')!;
  const gl = glCanvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  let W = 1, H = 1, dprFx = 1, dprGl = 1;
  let low = false; // 느린 기기: 해상도를 낮추고 물덩이의 번짐을 끈다
  // 캔버스 번짐을 못 쓰는 브라우저(Safari)에서는 물덩이를 더 옅게 그려 또렷한 도형으로 보이지 않게 한다
  const canBlur = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
  const resize = () => {
    const r = fxCanvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dprFx = Math.min(low ? 1 : 2, window.devicePixelRatio || 1);
    // 셰이더는 화소마다 물결을 계산하므로, 느린 기기에서는 절반 남짓한 해상도로 그리고 늘려 보여 준다
    dprGl = low ? 0.6 : Math.min(1.5, window.devicePixelRatio || 1);
    fxCanvas.width = Math.round(W * dprFx); fxCanvas.height = Math.round(H * dprFx);
    glCanvas.width = Math.round(W * dprGl); glCanvas.height = Math.round(H * dprGl);
  };
  resize();
  const budget = createFrameBudget(() => { low = true; resize(); });
  const ro = new ResizeObserver(resize);
  ro.observe(fxCanvas);

  // ── 셰이더 ──
  let prog: WebGLProgram | null = null;
  const U: Record<string, WebGLUniformLocation | null> = {};
  let ok = false;
  let imgSize: [number, number] = [1376, 768];
  if (gl) {
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[swimSea]', gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (vs && fs) {
      prog = gl.createProgram()!;
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        ok = true;
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        for (const n of ['uRes', 'uImg', 'uTime', 'uHY', 'uDunk', 'uLx', 'uNear', 'uFlash', 'uSurge', 'uSky', 'uRip', 'uDrop', 'uDropA', 'uBoat', 'uRoll', 'uWash']) U[n] = gl.getUniformLocation(prog, n);
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([3, 7, 14, 255]));
        const im = new Image();
        im.onload = () => {
          if (dead) return;
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          imgSize = [im.naturalWidth, im.naturalHeight];
        };
        im.src = opts.skyUrl;
        // 멀리 구명정 그림: 두 번째 텍스처(유닛 1)
        gl.activeTexture(gl.TEXTURE1);
        const btex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, btex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.activeTexture(gl.TEXTURE0);
        const bim = new Image();
        bim.onload = () => {
          if (dead) return;
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, btex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bim);
          gl.activeTexture(gl.TEXTURE0);
        };
        bim.src = '/swim/boat_far.webp';
      }
    }
  }
  if (!ok) { glCanvas.style.background = `#02060c url(${opts.skyUrl}) center / cover no-repeat`; }

  // ── 상태 ──
  let dead = false, raf = 0, last: number | null = null, t = 0;
  let lx = 0.63, near = 0, nearCur = 0, flash = 0;
  let dunk = 0, dunkV = 0, dunkTarget = 0, sinking = false;
  let bob = 0, bobV = 0, surge = 0, surgeV = 0, blur = 0;
  let roll = 0, rollV = 0, wash = 0;
  const sheets: Sheet[] = [];
  const rips: { x: number; y: number; t0: number; amp: number }[] = [];
  const drops: Drop[] = [], puffs: Puff[] = [], lens: Lens[] = [];
  const ripArr = new Float32Array(48);
  const pulls: { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; power: number; next: number }[] = [];
  const dropArr = new Float32Array(32), dropA = new Float32Array(8);

  const frame = (now: number) => {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    if (last !== null) budget((now - last) / 1000);
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    const k = H / 900;

    // 몸의 오르내림과 눈앞을 덮는 물: 용수철로 움직인다
    nearCur += (near - nearCur) * (1 - Math.exp(-dt * 1.2));
    flash *= Math.exp(-dt * 2.4);
    // 큰 물은 느리게 출렁인다: 용수철을 무르게, 감쇠를 약하게
    dunkV += ((dunkTarget - dunk) * (sinking ? 3.2 : 15) - dunkV * (sinking ? 2.2 : 4.4)) * dt; dunk += dunkV * dt;
    if (!sinking) dunkTarget *= Math.exp(-dt * 2.8);
    bobV += (-bob * 19 - bobV * 3.4) * dt; bob += bobV * dt;
    rollV += (-roll * 21 - rollV * 3.6) * dt; roll += rollV * dt;
    wash *= Math.exp(-dt * 2.7);
    surgeV *= Math.exp(-dt * 1.6); surge += surgeV * dt;
    for (let i = pulls.length - 1; i >= 0; i--) {
      const pl = pulls[i];
      const q = (t - pl.t0) / pl.dur;
      if (q >= 1) { pulls.splice(i, 1); continue; }
      // 손은 처음엔 물을 잡느라 느리고, 뒤로 갈수록 빨라진다
      const ez = q * q * (1.6 - 0.6 * q);
      const hx = pl.x0 + (pl.x1 - pl.x0) * ez, hyy = pl.y0 + (pl.y1 - pl.y0) * ez;
      const push = Math.sin(Math.PI * Math.min(1, q * 1.1));
      // 몸이 앞으로 나간다: 수면 무늬가 눈 쪽으로 흘러오고, 당기는 힘에 몸이 살짝 들린다
      surgeV += (5.2 * pl.power / pl.dur) * push * dt;
      bobV -= 0.5 * pl.power * push * dt;
      if (t >= pl.next) {
        pl.next = t + 0.06;
        const kk = H / 900;
        const near = 1 + ez * 1.3; // 눈에 가까워질수록 물길이 넓어진다
        rips.push({ x: hx, y: hyy, t0: t, amp: 0.5 * pl.power * near });
        while (rips.length > 12) rips.shift();
        // 손등을 타고 넘는 물: 손이 가는 쪽(눈 쪽)으로 낮게 밀려 튄다
        const dxn = pl.x1 - pl.x0, dyn = pl.y1 - pl.y0, ln = Math.hypot(dxn, dyn) || 1;
        const m = opts.reduce ? 2 : Math.round(7 * pl.power * near);
        for (let j = 0; j < m; j++) {
          const sp = (120 + Math.random() * 300) * kk * near * Math.sqrt(pl.power);
          const sx = hx + (Math.random() - 0.5) * 50 * kk * near, sy = hyy + (Math.random() - 0.5) * 10 * kk;
          drops.push({ x: sx, y: sy, px: sx, py: sy, vx: (dxn / ln) * sp + (Math.random() - 0.5) * 160 * kk, vy: (dyn / ln) * sp * 0.3 - (90 + Math.random() * 260) * kk * near, size: (1.2 + Math.pow(Math.random(), 2) * 3.2) * kk * near, life: 0, max: 0.6 + Math.random() * 0.6, warm: 0, floor: hyy + (10 + Math.random() * 40) * kk * near });
        }
        if (!opts.reduce && Math.random() < 0.6) puffs.push({ x: hx, y: hyy - 10 * kk, vx: (dxn / ln) * 90 * kk, vy: -(30 + Math.random() * 60) * kk, r: (40 + Math.random() * 50) * kk * near, life: 0, max: 0.7 + Math.random() * 0.5 });
      }
    }
    blur *= Math.exp(-dt * 5.5);
    const swell = opts.reduce ? 0 : Math.sin(t * 1.05) * 0.011 + Math.sin(t * 0.63 + 1) * 0.006;
    const hy = opts.horizon + swell + bob;

    if (ok && gl && prog) {
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.uniform2f(U.uRes, glCanvas.width, glCanvas.height);
      gl.uniform2f(U.uImg, imgSize[0], imgSize[1]);
      gl.uniform1f(U.uTime, t);
      gl.uniform1f(U.uHY, hy);
      gl.uniform1f(U.uDunk, Math.max(0, dunk));
      gl.uniform1f(U.uLx, lx);
      gl.uniform1f(U.uNear, nearCur);
      gl.uniform1f(U.uFlash, flash);
      gl.uniform1f(U.uRoll, roll);
      gl.uniform1f(U.uWash, wash);
      // 앞으로 헤엄치면 물결 무늬가 눈 쪽(가까운 쪽)으로 흘러와야 한다: 부호를 반대로 하면 물이 수평선 쪽으로 밀려가 뒤로 가는 것처럼 보인다
      gl.uniform1f(U.uSurge, surge);
      gl.uniform1i(U.uSky, 0);
      gl.uniform1i(U.uBoat, 1);
      for (let i = 0; i < 12; i++) {
        const r = rips[i];
        ripArr[i * 4] = r ? r.x * dprGl : 0; ripArr[i * 4 + 1] = r ? r.y * dprGl : 0;
        ripArr[i * 4 + 2] = r ? t - r.t0 : -1; ripArr[i * 4 + 3] = r ? r.amp : 0;
      }
      gl.uniform4fv(U.uRip, ripArr);
      gl.uniform4fv(U.uDrop, dropArr);
      gl.uniform1fv(U.uDropA, dropA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    glCanvas.style.filter = blur > 0.25 ? `blur(${blur.toFixed(1)}px)` : '';

    // ── 첨벙거림 ──
    fx.setTransform(dprFx, 0, 0, dprFx, 0, 0);
    fx.clearRect(0, 0, W, H);
    // (수면에 남는 거품은 그리지 않는다: 납작한 흰 타원이 겹쳐 흰 동그라미처럼 보였다. 수면의 물결 고리는 셰이더가 그린다)
    // 물안개 (빛이 번지는 느낌이라 더해서 그린다)
    fx.globalCompositeOperation = 'lighter';
    // 물안개
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life += dt;
      if (p.life > p.max) { puffs.splice(i, 1); continue; }
      const q = p.life / p.max;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * k * dt; p.vx *= 1 - dt * 1.5;
      const rr = p.r * (0.5 + q * 1.6);
      const gr = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      const a = 0.1 * Math.sin(Math.min(1, q * 1.15) * Math.PI);
      gr.addColorStop(0, `rgba(205,222,238,${a})`); gr.addColorStop(1, 'rgba(205,222,238,0)');
      fx.fillStyle = gr; fx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
    }
    fx.globalCompositeOperation = 'source-over';
    // 물의 막: 밑동은 두껍고 허옇고, 위로 갈수록 얇아진다. 윗선에는 빛이 걸리고, 꼭대기에 닿은 기둥은 끊어져 굵은 방울을 떨군다
    fx.lineJoin = 'round';
    for (let si = sheets.length - 1; si >= 0; si--) {
      const s = sheets[si];
      const a = t - s.t0;
      let alive = false, top = 0;
      const pts: [number, number][] = [];
      for (const c of s.cols) {
        const h = c.v * a - 0.5 * s.g * a * a;
        if (h > 0) alive = true;
        const hh = Math.max(0, h);
        const px = s.x + c.u * s.w * (1 + a * 0.5) + c.lean * a;
        pts.push([px, s.y - hh]);
        if (hh > top) top = hh;
        if (!c.shed && a > c.v / s.g) {
          c.shed = true;
          if (hh > 22 * k) for (let j = 0; j < 4; j++) drops.push({ x: px, y: s.y - hh, px, py: s.y - hh, vx: c.lean * (0.8 + Math.random() * 0.8) + (Math.random() - 0.5) * 70 * k, vy: -(20 + Math.random() * 130) * k, size: (2 + Math.random() * 3.4) * k, life: 0, max: 1.2 + Math.random() * 0.6, warm: 0, floor: s.y + (6 + Math.random() * 34) * k });
        }
      }
      if (!alive && a > 0.1) { sheets.splice(si, 1); continue; }
      const life = (2 * s.cols[Math.floor(s.cols.length / 2)].v) / s.g;
      const fade = s.alpha * Math.max(0, 1 - Math.pow(a / (life * 1.05), 2.2));
      if (fade <= 0.01 || top < 2) continue;
      const path = () => {
        fx.beginPath();
        fx.moveTo(pts[0][0], s.y + 14 * k);
        fx.lineTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          const mx = (pts[i - 1][0] + pts[i][0]) / 2, my = (pts[i - 1][1] + pts[i][1]) / 2;
          fx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], mx, my);
        }
        fx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        fx.lineTo(pts[pts.length - 1][0], s.y + 14 * k);
      };
      const gr = fx.createLinearGradient(0, s.y - top, 0, s.y + 14 * k);
      gr.addColorStop(0, `rgba(190,212,228,${0.10 * fade})`);
      gr.addColorStop(0.45, `rgba(178,204,222,${0.30 * fade})`);
      gr.addColorStop(0.86, `rgba(204,222,234,${0.46 * fade})`);
      gr.addColorStop(1, 'rgba(204,222,234,0)');
      // 부옇게: 물의 막은 또렷한 도형이 아니라 빛이 흩어지는 덩어리다
      const soft = canBlur && !low;
      if (soft) fx.filter = `blur(${(5 * k).toFixed(1)}px)`; else fx.globalAlpha = 0.6;
      path(); fx.closePath(); fx.fillStyle = gr; fx.fill();
      if (soft) fx.filter = `blur(${(1.2 * k).toFixed(1)}px)`;
      // 윗선: 얇아진 물의 가장자리에 빛이 걸린다
      fx.strokeStyle = `rgba(232,242,250,${0.18 * fade})`; fx.lineWidth = 3 * k;
      fx.beginPath(); fx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) { const mx = (pts[i - 1][0] + pts[i][0]) / 2, my = (pts[i - 1][1] + pts[i][1]) / 2; fx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], mx, my); }
      fx.stroke();
      if (soft) fx.filter = 'none'; else fx.globalAlpha = 1;
    }
    // 물방울: 지난 자리와 지금 자리를 이어 그려 빠른 것은 줄로 번진다. 빛나는 불꽃처럼 보이지 않게 더하지 않고 겹쳐 그린다
    fx.lineCap = 'round';
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.life += dt;
      if (d.life < 0) continue;
      d.px = d.x; d.py = d.y;
      d.vy += 1300 * k * dt; // 큰 물은 느리게 떨어져 보인다
      d.vx *= 1 - dt * 0.9; d.vy *= 1 - dt * 0.25;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.life > d.max || (d.vy > 0 && d.y > d.floor)) {
        if (d.size > 2.2 && d.life <= d.max && rips.length < 9 && Math.random() < 0.08) rips.push({ x: d.x, y: d.floor, t0: t, amp: 0.25 });
        drops.splice(i, 1); continue;
      }
      const q = d.life / d.max;
      const a = Math.min(1, 0.25 + d.life * 9) * (d.size > 4 * k ? 0.13 : 0.5 + 0.4 * Math.min(1, d.size / (2 * k))) * (1 - q * q);
      fx.strokeStyle = `rgba(${Math.round(176 + 60 * d.warm)},${Math.round(204 - 20 * d.warm)},${Math.round(226 - 90 * d.warm)},${a * 0.8})`;
      fx.lineWidth = Math.max(1.1, d.size * 1.35 * (1 + q * 0.3)); // 가는 바늘이 아니라 둥근 물방울로 보이게 꼬리를 짧게
      fx.beginPath(); fx.moveTo(d.x - d.vx * 0.009, d.y - d.vy * 0.009); fx.lineTo(d.x, d.y); fx.stroke();
    }
    fx.globalCompositeOperation = 'source-over';
    // 눈앞에 맺힌 물방울: 그리는 것은 셰이더가 한다(뒤의 풍경을 뒤집어 비추는 볼록렌즈). 여기서는 움직임만 갱신해 값을 넘긴다
    dropA.fill(0);
    let li = 0;
    for (let i = lens.length - 1; i >= 0; i--) {
      const l = lens[i];
      l.life += dt;
      if (l.life < 0) continue;
      if (l.life > l.max) { lens.splice(i, 1); continue; }
      const q = l.life / l.max;
      l.vy += (30 + l.r * 9) * k * dt * (q > 0.15 ? 1 : 0); l.vy *= 1 - dt * 1.4;
      l.y += l.vy * dt; l.x += Math.sin(t * 3 + l.wob) * 4 * dt;
      if (li < 8) {
        const r = l.r * (1 - q * 0.35);
        dropArr[li * 4] = l.x * dprGl; dropArr[li * 4 + 1] = l.y * dprGl;
        dropArr[li * 4 + 2] = r * dprGl; dropArr[li * 4 + 3] = r * (1 + Math.min(0.45, l.vy / 260)) * dprGl;
        dropA[li] = Math.min(1, l.life * 10) * (1 - q * q * q);
        li++;
      }
    }
    for (let i = rips.length - 1; i >= 0; i--) if (t - rips[i].t0 > 4.5) rips.splice(i, 1);
  };
  raf = requestAnimationFrame(frame);

  return {
    ok,
    setLight(x, n) { lx = x; near = n; },
    flash() { flash = 1; },
    splash(xf, yf, power) {
      const k = H / 900;
      const x = xf * W, y = yf * H;
      const warmSide = lx * W > x ? 1 : -1; // 불빛 쪽으로 튄 방울은 조금 따뜻한 빛을 받는다
      rips.push({ x, y, t0: t, amp: 1.25 * power });
      while (rips.length > 12) rips.shift();
      const heavy = power >= 0.6;
      const sq = Math.sqrt(power);
      // 물의 막 두 겹: 뒤는 넓고 낮고 옅게, 앞은 좁고 높고 짙게
      for (const layer of heavy ? [0, 1] : [1]) {
        const cols: Sheet['cols'] = [];
        const N = 26;
        const V = (layer ? 640 : 430) * k * sq;
        const p1 = Math.random() * 6.28, p2 = Math.random() * 6.28, p3 = Math.random() * 6.28;
        for (let i = 0; i < N; i++) {
          const u = (i / (N - 1)) * 2 - 1;
          const crown = 0.3 + 0.7 * Math.pow(Math.max(0, 1 - u * u), 0.8);
          const lobes = 0.8 + 0.2 * Math.sin(u * 3.1 + p1) + 0.13 * Math.sin(u * 6.7 + p2) + 0.07 * Math.sin(u * 13 + p3);
          cols.push({ u, v: V * crown * lobes, lean: u * (110 + Math.random() * 60) * k * sq, shed: false });
        }
        sheets.push({ x: x + (layer ? 0 : (Math.random() - 0.5) * 30 * k), y: y - (layer ? 0 : 6 * k), t0: t + (layer ? 0 : 0.03), w: (layer ? 92 : 150) * k * sq, g: 1500 * k, alpha: layer ? 1 : 0.6, cols });
      }
      while (sheets.length > 8) sheets.shift();
      // 사방으로 튀는 방울: 수는 줄이고 굵기를 키운다
      const n = Math.round((opts.reduce ? 30 : 120) * power);
      for (let i = 0; i < n; i++) {
        const an = -Math.PI / 2 + (Math.random() - 0.5) * 2.5;
        const up = Math.cos(an + Math.PI / 2);
        const sp = (240 + Math.random() * 620 * (0.4 + 0.6 * up)) * k * sq;
        const sx = x + (Math.random() - 0.5) * 110 * k * sq, sy = y + (Math.random() - 0.5) * 12 * k;
        const vx = Math.cos(an) * sp * 0.7, vy = Math.sin(an) * sp;
        drops.push({ x: sx, y: sy, px: sx, py: sy, vx, vy, size: (1.1 + Math.pow(Math.random(), 2.2) * 3.4) * k, life: -Math.random() * 0.1, max: 0.9 + Math.random() * 1.0, warm: Math.sign(vx) === warmSide ? Math.random() * 0.5 : 0, floor: y + (4 + Math.random() * 44) * k });
      }
      if (!opts.reduce) {
        for (let i = 0; i < Math.round(9 * power); i++) puffs.push({ x: x + (Math.random() - 0.5) * 120 * k * sq, y: y - Math.random() * 60 * k, vx: (Math.random() - 0.5) * 150 * k, vy: -(70 + Math.random() * 190) * k * sq, r: (60 + Math.random() * 90) * k * sq, life: 0, max: 1.0 + Math.random() * 0.9 });
        const m = Math.round((2 + Math.random() * 3) * power);
        for (let i = 0; i < m; i++) lens.push({ x: W * (Math.random() < 0.5 ? 0.04 + Math.random() * 0.2 : 0.76 + Math.random() * 0.2), y: H * (0.5 + Math.random() * 0.4), r: (8 + Math.pow(Math.random(), 2) * 20) * k, vy: 0, life: -Math.random() * 0.12 - 0.12, max: 2.2 + Math.random() * 2.4, wob: Math.random() * 6 });
        // 몸 전체가 물에 실린다: 눈앞까지 물이 차오르고, 머리가 치는 팔 쪽으로 기울고, 물이 눈 위를 흘러 시야가 일그러진다
        dunkTarget = Math.max(dunkTarget, 0.19 * power); dunkV += 0.42 * power;
        bobV += 0.13 * power;
        rollV += (x < W / 2 ? -1 : 1) * 0.3 * power;
        if (heavy) { wash = Math.max(wash, Math.min(1, 0.8 * power)); blur = Math.max(blur, 4.6 * power); }
      }
      surgeV += 0.35 * power;
    },
    pull(xf, yf, dx, dy, dur, power) {
      const x0 = xf * W, y0 = yf * H;
      pulls.push({ x0, y0, x1: x0 + dx * H, y1: y0 + dy * H, t0: t, dur: Math.max(0.15, dur), power, next: t });
    },
    sink() { sinking = true; dunkTarget = 1; },
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); glCanvas.style.filter = ''; },
  };
}
