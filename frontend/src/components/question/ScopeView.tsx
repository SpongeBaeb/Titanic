'use client';

import { useEffect, useRef } from 'react';

/**
 * Q5 망원경 시점: 접안렌즈 안에서 코드로 만든 고래가 솟구쳤다 잠긴다.
 * 그림 한 장을 오려 붙이지 않고, 작은 WebGL2 장면(하늘, 파도치는 바다, 고래 몸, 물보라)을 직접 그린다.
 *  - 고래: 둥근 원뿔 여러 개를 이은 몸통, 가슴지느러미 두 개, 꼬리지느러미 (거리 함수로 레이마칭)
 *  - 물과의 상호작용: 몸이 물을 가르는 자리의 거품, 퍼지는 파문, 튀는 물방울, 수면에 비친 고래, 몸을 타고 흐르는 물줄기
 * 장면 시간(초)은 이 컴포넌트가 붙은 순간부터 센다: 초점 맞춤(0~1.9) → 숨(1.3) → 솟구침(2.6~4.6) → 잠김과 잔물결(~7.4).
 */

const HOLE_FRAC = 0.447; // scope_ring.webp 에서 구멍 지름 / 그림 너비 (tools/build_q5_scope.py 가 알려 준다)

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes; uniform float uT; uniform float uAct;
uniform vec3 uC; uniform mat3 uRot; uniform vec3 uPose; // 몸 위치, 회전, (등 굽힘, 지느러미 펼침)
uniform vec4 uEv[3]; // 물에 닿는 사건: x, z, 시각, 세기
const float TH = .036;
const float PITCH = -.0036;
const vec3 RO = vec3(0., 15., 0.);
const vec3 SUN = vec3(.3263, .0130, -.9451);

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash1(float n){ return fract(sin(n * 91.345 + 17.3) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for(int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= .5; } return v; }

vec3 skyCol(vec3 d, float t){
  float h = clamp(d.y / .06, 0., 1.);
  vec3 hor = vec3(.98, .66, .36), mid = vec3(.52, .54, .64), top = vec3(.17, .28, .50);
  vec3 c = mix(hor, mid, smoothstep(0., .3, h));
  c = mix(c, top, smoothstep(.22, 1., h));
  float sd = max(dot(d, SUN), 0.);
  float sunI = .75 + .45 * smoothstep(0., 7., t);
  c += vec3(1., .74, .42) * (pow(sd, 10.) * .28 + pow(sd, 90.) * .5 + pow(sd, 900.) * 2.) * sunI;
  // 얇은 구름 띠
  float cl = smoothstep(.52, .8, fbm(vec2(d.x / (max(d.y, .03) + .035) * .55 + t * .01, max(d.y, .03) * 22.)));
  c = mix(c, mix(vec3(.98, .62, .46), vec3(.78, .64, .72), h), cl * .55 * smoothstep(.0, .05, d.y) * (1. - h * .6));
  return c;
}

float wave(vec2 p, float t){
  float h = 0.;
  h += .42 * sin(.22 * p.x + .11 * p.y + t * 1.0);
  h += .22 * sin(.41 * p.x - .19 * p.y - t * 1.5 + 1.7);
  float nearW = clamp(1. + p.y / 300., 0., 1.); // 먼 바다의 작은 물결은 한 화소보다 촘촘해 반짝임 잡음이 되므로 지운다
  h += nearW * .05 * sin(.83 * p.x + .47 * p.y + t * 2.2);
  h += nearW * .10 * (noise(p * .35 + vec2(t * .3, t * .2)) - .5);
  for(int i = 0; i < 3; i++){
    vec4 e = uEv[i]; float age = t - e.z;
    if(age > 0.){ float d = length(p - e.xy); float w = d - age * 8.5;
      h += e.w * .9 * sin(w * .55) * exp(-w * w * .025) * exp(-age * .5) / (1. + d * .04); }
  }
  return h;
}

float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1. / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv); float y2 = y * y * l2; float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if(sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if(sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
vec3 J(int i){ float s = 7. - float(i) * 2.3333; return vec3(s, uPose.x * (1. - s * s / 49.), 0.); }
const float RAD[7] = float[7](.45, 1.35, 1.95, 1.85, 1.15, .55, .28);

float whale(vec3 p){
  vec3 q = (p - uC) * uRot;
  float d = 1e5;
  for(int i = 0; i < 6; i++) d = min(d, sdRoundCone(q, J(i), J(i + 1), RAD[i], RAD[i + 1]));
  // 꼬리지느러미
  vec3 f = q - J(6) - vec3(-.6, 0., 0.);
  vec3 fs = vec3(.95, .14, 2.6);
  float k0 = length(f / fs), k1 = length(f / (fs * fs));
  d = min(d, k0 * (k0 - 1.) / max(k1, 1e-4));
  // 가슴지느러미 (납작하게)
  for(int s = 0; s < 2; s++){
    float sg = s == 0 ? -1. : 1.;
    vec3 a = J(1) + vec3(-.2, -1.0, sg * 1.1);
    vec3 b = a + vec3(-1.9, -.8, sg * (1.2 + 3.0 * uPose.y));
    vec3 qq = q; qq.y *= 2.4; a.y *= 2.4; b.y *= 2.4;
    d = min(d, sdRoundCone(qq, a, b, .38, .14) * .42);
  }
  return d;
}
vec3 whaleN(vec3 p){ vec2 e = vec2(.09, 0.);
  return normalize(vec3(whale(p + e.xyy) - whale(p - e.xyy), whale(p + e.yxy) - whale(p - e.yxy), whale(p + e.yyx) - whale(p - e.yyx))); }

float marchWhale(vec3 ro, vec3 rd){
  vec3 oc = ro - uC; float b = dot(oc, rd); float c = dot(oc, oc) - 121.;
  float h = b * b - c; if(h < 0.) return -1.;
  h = sqrt(h); float t = max(-b - h, 0.); float tmax = -b + h;
  for(int i = 0; i < 64; i++){
    float d = whale(ro + rd * t);
    if(d < .035) return t;
    t += d * .9;
    if(t > tmax) return -1.;
  }
  return -1.;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes * 2. - 1.;
  float t = uT;
  vec2 sway = vec2(sin(t * .9) * .0012 + sin(t * 2.3) * .0006, cos(t * .7) * .0010);
  vec3 rd = normalize(vec3(uv.x * TH + sway.x, uv.y * TH + PITCH + sway.y, -1.));
  vec3 col; float tW = 1e9; vec3 pw = vec3(0.);
  if(rd.y < -1e-4){
    float tt = -RO.y / rd.y;
    for(int i = 0; i < 3; i++){ vec3 P = RO + rd * tt; tt = (wave(P.xz, t) - RO.y) / rd.y; }
    tW = tt; pw = RO + rd * tW;
  }
  float tw = -1.;
  if(uAct > .5) tw = marchWhale(RO, rd);

  if(tw > 0. && tw < tW){
    // ── 고래 ──
    vec3 p = RO + rd * tw; vec3 n = whaleN(p);
    vec3 q = (p - uC) * uRot; vec3 nl = n * uRot;
    float hw = p.y - wave(p.xz, t);
    float bel = smoothstep(.15, -.5, nl.y);
    vec3 base = mix(vec3(.05, .065, .08), vec3(.13, .15, .18), noise(q.xz * 1.3 + q.y));
    vec3 belly = vec3(.66, .68, .72) * (.82 + .18 * noise(q.xz * 3.));
    belly *= .85 + .15 * sin(q.z * 16. + q.y * 3.);
    vec3 alb = mix(base, belly, bel);
    float scar = smoothstep(.72, .86, fbm(q.xz * 2.2 + 3.)); alb = mix(alb, vec3(.55, .56, .58), scar * .5 * (1. - bel));
    float diff = max(dot(n, SUN), 0.);
    vec3 lit = alb * (vec3(1., .72, .46) * diff * 1.5 + skyCol(n, t) * .38);
    float rim = pow(1. - max(dot(n, -rd), 0.), 3.);
    lit += vec3(1., .72, .46) * rim * (.25 + diff * .5);
    vec3 rr = reflect(rd, n);
    lit += vec3(1., .82, .6) * pow(max(dot(rr, SUN), 0.), 30.) * 1.1 * (1. - bel * .5);
    lit += skyCol(vec3(rr.x, abs(rr.y), rr.z), t) * rim * .35;
    // 몸을 타고 흐르는 물줄기와 수면 가까운 거품
    float streak = smoothstep(.5, .85, fbm(vec2(q.x * 1.5 + q.z * .6, hw * 2.4 + t * 5.))) * smoothstep(9., .4, hw);
    lit = mix(lit, vec3(.9, .93, .96) * (.55 + diff * .8 + .25), streak * .75);
    lit = mix(lit, vec3(.95), smoothstep(1.1, 0., hw) * .6);
    col = mix(lit, skyCol(vec3(rd.x, .02, rd.z), t) * .8, .16);
  } else if(tW < 1e8){
    // ── 바다 ──
    float e = .4;
    vec3 n = normalize(vec3((wave(pw.xz - vec2(e, 0.), t) - wave(pw.xz + vec2(e, 0.), t)) * .3, 2. * e, (wave(pw.xz - vec2(0., e), t) - wave(pw.xz + vec2(0., e), t)) * .3));
    vec3 rr = reflect(rd, n); rr.y = max(rr.y, .0015);
    float fres = pow(1. - max(dot(-rd, n), 0.), 5.);
    float F = .05 + .95 * fres;
    vec3 refl = skyCol(rr, t);
    // 바다 색은 Q5 갑판의 바다와 같다: 청록 바탕에 하늘 반사가 얇게 얹힌다
    vec3 deep = mix(vec3(.08, .24, .27), vec3(.03, .12, .16), smoothstep(0., 700., tW));
    col = deep + refl * (.12 + .32 * F);
    float swell = sin(pw.x * .11 + pw.z * .07 + t * 1.5) * .5 + sin(pw.x * .2 - pw.z * .13 - t * 2.) * .5;
    col *= 1. + swell * .12;
    // Q5 바다처럼 금빛 잔물결이 해 쪽에서 반짝인다
    col += vec3(1., .80, .50) * smoothstep(.74, .97, noise(pw.xz * .12 + vec2(t * .8, -t * .5)) + swell * .1) * (.05 + .12 * pow(max(dot(rr, SUN), 0.), 6.));
    // 수면에 비친 고래
    if(uAct > .5){
      float tr = marchWhale(pw + n * .05, rr);
      if(tr > 0.){
        vec3 ph = pw + rr * tr; vec3 nn = whaleN(ph); vec3 qq = (ph - uC) * uRot; vec3 nl2 = nn * uRot;
        vec3 wc = mix(vec3(.04, .055, .07), vec3(.5, .52, .56), smoothstep(.1, -.5, nl2.y)) * (.35 + max(dot(nn, SUN), 0.) * .8);
        col = mix(col, wc, .62);
      }
    }
    // 거품: 몸이 물을 가르는 자리, 퍼져 나가는 물결 고리, 떨어진 자리에 남는 거품
    float foam = 0.;
    for(int i = 0; i < 3; i++){
      vec4 ev = uEv[i]; float age = t - ev.z;
      if(age > 0.){
        float d = length(pw.xz - ev.xy);
        float r = age * 8.5;
        float ring = exp(-(d - r) * (d - r) / (2. * pow(1.5 + age * .5, 2.))) * exp(-age * .55);
        float pat = exp(-d * d / (2. * pow(6. + age * 3.5, 2.))) * exp(-age * .22);
        float nz = fbm(pw.xz * .8 + vec2(0., t * .1));
        foam += ev.w * (ring * 1.1 + pat * 1.3) * smoothstep(.22, .6, nz + .25);
      }
    }
    if(uAct > .5){
      float dd = whale(vec3(pw.x, pw.y, pw.z));
      foam += smoothstep(2.6, .2, dd) * smoothstep(.3, .7, fbm(pw.xz * 1.1 + t * .2)) * .9;
    }
    vec3 foamCol = vec3(.93, .9, .86) * (.5 + .5 * smoothstep(-.3, 1., dot(n, SUN) * .6 + .5));
    col = mix(col, foamCol, clamp(foam, 0., .94));
    // 해가 뜨는 쪽의 잔빛
    col += vec3(1., .78, .5) * smoothstep(.9, 1., noise(pw.xz * .25 + vec2(t * .3, t * .15))) * pow(max(dot(rr, SUN), 0.), 14.) * .22;
    col = mix(col, skyCol(vec3(rd.x, .01, rd.z), t), 1. - exp(-tW * .00035));
  } else {
    col = skyCol(rd, t);
  }

  // ── 물방울과 숨(물안개): 모두 화면에 더해진다 ──
  vec3 add = vec3(0.);
  for(int k = 0; k < 3; k++){
    vec4 ev = uEv[k]; float age = t - ev.z;
    if(age > 0. && age < 2.8){
      for(int i = 0; i < 30; i++){
        float fi = float(i) + float(k) * 31.;
        float a = hash1(fi) * 6.2832, sp = mix(2., 11., hash1(fi + 5.)) * (.5 + ev.w * .5), vy = mix(5., 19., hash1(fi + 9.)) * (.6 + ev.w * .4);
        vec3 pos = vec3(ev.x + cos(a) * sp * age * .55, vy * age - 4.9 * age * age, ev.y + sin(a) * sp * age * .4);
        if(pos.y < 0.) continue;
        vec3 d = pos - RO; float z = -d.z; if(z < 1.) continue;
        vec2 sc = vec2(d.x / z - sway.x, d.y / z - PITCH - sway.y) / TH;
        float rad = (.35 + hash1(fi + 2.) * .5) / z / TH;
        float g = smoothstep(rad, 0., length(uv - sc)) * (1. - age / 2.8);
        add += vec3(.95, .93, .9) * g * .9;
      }
    }
  }
  for(int b = 0; b < 2; b++){
    float tb = b == 0 ? 1.3 : 5.3; vec3 bp = b == 0 ? vec3(-15., 0., -565.) : vec3(10., 0., -557.);
    float age = t - tb;
    if(age > 0. && age < 2.6){
      for(int i = 0; i < 18; i++){
        float fi = float(i) + float(b) * 20.;
        vec3 pos = bp + vec3((hash1(fi) - .5) * age * 3. + age * .6, 7. * (1. - exp(-age * 1.3)) * (.45 + .55 * hash1(fi + 3.)), (hash1(fi + 6.) - .5) * 1.5);
        vec3 d = pos - RO; float z = -d.z;
        vec2 sc = vec2(d.x / z - sway.x, d.y / z - PITCH - sway.y) / TH;
        float rad = (.9 + age * 1.6 + hash1(fi + 1.) * .5) / z / TH;
        float g = smoothstep(rad, 0., length(uv - sc)) * smoothstep(0., .12, age) * (1. - age / 2.6);
        add += vec3(.95, .92, .9) * g * .12;
      }
    }
  }
  col += add;

  // 렌즈: 가장자리가 어두워지고, 살짝 따뜻하게
  float vg = 1. - smoothstep(.72, 1.0, length(uv));
  col *= mix(.15, 1., vg);
  col = pow(max(col, 0.), vec3(.93));
  col += (hash(gl_FragCoord.xy + t) - .5) * .02;
  o = vec4(col, 1.);
}`;

const VERT = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 고래의 자세: 시각 t(초) → 위치, 회전, 굽힘, 지느러미. 솟구침 2.6~4.6초 */
function pose(t: number) {
  const T0 = 2.6; const T1 = 4.6;
  const u = (t - T0) / (T1 - T0);
  if (u < -0.2 || u > 1.2) return null;
  const uc = clamp01(u);
  const H = 9;
  const y = 4 * H * u * (1 - u) - 2.6;
  const x = -14 + 26 * u;
  const z = -565 + 6 * u;
  const th = (lerp(60, -64, uc) * Math.PI) / 180;
  const roll = lerp(-0.3, 1.5, uc);
  const arch = 0.4 + 0.9 * Math.sin(Math.PI * uc);
  const flap = 0.5 + 0.5 * Math.sin(Math.PI * uc);
  const cth = Math.cos(th); const sth = Math.sin(th); const cr = Math.cos(roll); const sr = Math.sin(roll);
  // Rz(th) * Rx(roll), 열 우선
  const m = [cth, sth, 0, -sth * cr, cth * cr, sr, sth * sr, -cth * sr, cr];
  return { c: [x, y, z], m, arch, flap };
}

interface ScopeViewProps {
  /** WebGL2 를 쓸 수 없을 때 */
  onFail: () => void;
}

export default function ScopeView({ onFail }: ScopeViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current; const cv = cvRef.current; const ring = ringRef.current;
    if (!wrap || !cv || !ring) return;
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) { onFail(); return; }
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT); const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { onFail(); return; }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); onFail(); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const pl = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = U('uRes'); const uT = U('uT'); const uAct = U('uAct'); const uC = U('uC'); const uRot = U('uRot'); const uPose = U('uPose'); const uEv = U('uEv');
    const EV = new Float32Array([-14, -565, 2.65, 1.0, 12, -559, 4.6, 1.7, 10, -556, 4.95, 0.5]);

    let D = 400;
    const layout = () => {
      const vw = window.innerWidth; const vh = window.innerHeight;
      D = Math.round(0.74 * Math.min(vw, vh));
      const cs = Math.round(D * 1.07);
      cv.style.width = `${cs}px`; cv.style.height = `${cs}px`;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const px = Math.min(720, Math.round(cs * dpr * 0.8));
      cv.width = px; cv.height = px;
      const S = D / HOLE_FRAC;
      ring.style.width = `${S}px`; ring.style.height = `${S}px`;
      gl.viewport(0, 0, px, px);
    };
    layout();
    window.addEventListener('resize', layout);

    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000;
      const ps = pose(t);
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uT, t);
      gl.uniform1f(uAct, ps ? 1 : 0);
      if (ps) { gl.uniform3f(uC, ps.c[0], ps.c[1], ps.c[2]); gl.uniformMatrix3fv(uRot, false, new Float32Array(ps.m)); gl.uniform3f(uPose, ps.arch, ps.flap, 0); }
      gl.uniform4fv(uEv, EV);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // 렌즈 연출: 서서히 나타나며 초점이 맞고, 살짝 다가온다
      const a = smooth(0.9, 1.8, t);
      wrap.style.opacity = String(a);
      const foc = 1 - smooth(0.9, 2.7, t);
      cv.style.filter = foc > 0.01 ? `blur(${(foc * 9).toFixed(2)}px)` : 'none';
      wrap.style.transform = `scale(${lerp(1.16, 1, smooth(0.9, 2.5, t)).toFixed(4)})`;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteBuffer(buf);
    };
  }, [onFail]);

  return (
    <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0 z-[36] flex items-center justify-center bg-black" style={{ opacity: 0 }}>
      <canvas ref={cvRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={ringRef} src="/q5/scope_ring.webp" alt="" draggable={false} className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}
