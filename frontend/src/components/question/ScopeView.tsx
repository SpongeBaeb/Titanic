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
  // 옆으로 길게 늘어진 너울 (망원경으로 멀리 보면 수평선과 나란한 물결 띠가 된다)
  h += .42 * sin(.07 * p.x + .21 * p.y + t * 1.0);
  h += .24 * sin(-.05 * p.x + .33 * p.y - t * 1.4 + 1.7);
  h += .10 * sin(.13 * p.x + .52 * p.y + t * 1.9 + 4.1);
  for(int i = 0; i < 3; i++){
    vec4 e = uEv[i]; float age = t - e.z;
    if(age > 0.){ float d = length(p - e.xy); float w = d - age * 8.5;
      h += e.w * .35 * sin(w * .3) * exp(-w * w * .008) * exp(-age * .8) / (1. + d * .06); }
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

float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }

// 꼬리지느러미 (혹등고래): 타원체가 아니라 얇은 날개 모양의 판이다. f: 뿌리 중심 기준 (꼬리 쪽이 -x, 폭이 ±z, 위가 +y)
//  - 평면: 앞가장자리는 뿌리에서 곧다가 끝으로 갈수록 뒤로 크게 젖혀져 끝이 뾰족한 초승달꼴, 뒷가장자리는 오목하고 가운데에 홈이 있다
//  - 혹등고래 특유의 뒷가장자리 톱니(들쭉날쭉한 물결)
//  - 단면: 앞은 둥글고 뒤로 갈수록 날카롭게 얇아지는 날개 단면, 끝으로 갈수록 더 얇아지며 살짝 들린다
float sdFluke(vec3 f){
  const float S = 2.3;                       // 반폭 (몸길이의 약 1/3이 전체 폭)
  float u = abs(f.z), t = clamp(u / S, 0., 1.);
  float le = -.04 - .45 * pow(t, 1.3) * S;   // 앞가장자리: 끝으로 갈수록 뒤로 젖혀져, 끝이 가장 뒤에 온다
  float c = 1.25 * max(1. - pow(t, 1.3), 0.);                    // 폭(코드): 뿌리 1.25에서 끝으로 곧게 좁아져 끝이 뾰족하다
  float notch = .22 * exp(-u * u / .03);                        // 뒷가장자리 가운데의 홈
  float sc = (.5 + .5 * sin(u * 7.3 + .6)) * .55 + (.5 + .5 * sin(u * 12.9 + 2.1)) * .45;
  float serr = .2 * (sc - .5) * smoothstep(.14, .4, t) * smoothstep(1., .72, t); // 톱니
  float te = le - c + notch + serr;
  float dx = max(f.x - le, te - f.x), dz = u - S;
  float d2 = max(dx, dz) * .86;              // 젖혀진 가장자리의 기울기 보정
  float tt = clamp((le - f.x) / max(c, .06), 0., 1.);
  float hy = (.09 * c + .014) * (sqrt(tt) * (1. - tt) * 1.7 + .1) * (1. - .4 * t);
  float dy = abs(f.y - .2 * t * t) - hy;
  vec2 w = vec2(d2, dy);
  return min(max(w.x, w.y), 0.) + length(max(w, 0.)) - .035;
}

// 가슴지느러미 (혹등고래의 상징): 몸길이의 약 1/3에 이르는 길고 납작한 날개. 위아래로 눌러 얇게 만든다
float flipperD(vec3 q){
  float d = 1e5;
  for(int s = 0; s < 2; s++){
    float sg = s == 0 ? -1. : 1.;
    vec3 a = J(1) + vec3(-.6, -1.05, sg * 1.0);
    vec3 b = a + vec3(-1.7, -1.1, sg * (3.3 + 1.2 * uPose.y));
    vec3 qq = q; qq.y *= 2.6; a.y *= 2.6; b.y *= 2.6;
    // 앞가장자리의 울퉁불퉁한 혹(결절): 지느러미를 따라 반지름이 물결친다
    vec3 ba = b - a; float t = clamp(dot(qq - a, ba) / dot(ba, ba), 0., 1.);
    float knob = .05 * max(0., sin(t * 26.)) * (1. - t);
    d = min(d, (sdRoundCone(qq, a, b, .46, .1) - knob) * .38);
  }
  return d;
}

float whale(vec3 p){
  vec3 q = (p - uC) * uRot;
  float d = 1e5;
  // 꼬리 쪽으로 갈수록 몸이 옆으로 납작해지고 위아래로 길쭉해진다 (꼬리자루)
  float wsc = 1. + .5 * smoothstep(-1.2, -6.2, q.x);
  vec3 qb = vec3(q.x, q.y, q.z * wsc);
  for(int i = 0; i < 6; i++) d = min(d, sdRoundCone(qb, J(i), J(i + 1), RAD[i], RAD[i + 1]));
  d /= wsc;
  // 머리 위의 혹(결절): 주둥이 윗면에 작은 혹들이 줄지어 있다
  float head = smoothstep(2.6, 5.8, q.x) * step(0., q.y);
  d -= head * .055 * max(0., sin(q.x * 7.5) * sin(q.z * 8.5 + 1.3));
  // 낮은 등지느러미: 등 뒤쪽 2/3 지점의 작은 혹
  vec3 da = J(4) + vec3(.35, RAD[4] * .82, 0.);
  d = smin(d, sdRoundCone(q, da, da + vec3(-.75, .42, 0.), .3, .06), .22);
  // 꼬리지느러미: 꼬리자루 끝에서 매끄럽게 이어진다
  d = smin(d, sdFluke(q - J(6) - vec3(.55, 0., 0.)), .28);
  // 가슴지느러미
  d = smin(d, flipperD(q), .12);
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
    float fl = smoothstep(.18, -.04, flipperD(q));
    alb = mix(alb, vec3(.8, .82, .85) * (.88 + .12 * noise(q.xz * 4.)), fl * .85);
    float fk = smoothstep(.2, -.04, sdFluke(q - J(6) - vec3(.55, 0., 0.))) * smoothstep(.1, -.4, nl.y);
    float blot = smoothstep(.45, .62, fbm(q.xz * 1.7 + 7.));
    alb = mix(alb, mix(vec3(.82, .83, .86), vec3(.06, .07, .09), blot), fk * .9);
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
    // ── 바다 ── (Q5 갑판에서 보던 바다와 같은 색과 결: 짙은 청록 바탕에 노을빛 하늘이 얇게 비친다)
    // 먼 물결은 한 화소가 수십 미터를 덮으므로 법선을 그만큼 넓게 재서 매끈하게 만든다 (반짝이는 잡음 방지)
    float e = max(.6, tW * tW * 9e-6);
    float sl = .16 / (1. + tW * .0015);
    vec3 n = normalize(vec3((wave(pw.xz - vec2(e, 0.), t) - wave(pw.xz + vec2(e, 0.), t)) * sl, 2. * e, (wave(pw.xz - vec2(0., e), t) - wave(pw.xz + vec2(0., e), t)) * sl));
    vec3 rr = reflect(rd, n); rr.y = max(rr.y, .0015);
    float fres = pow(1. - max(dot(-rd, n), 0.), 5.);
    // 반사는 수평선 가까운 하늘(노을의 주황)만 비치도록 낮게 눌러 둔다
    vec3 refl = skyCol(vec3(rr.x, min(rr.y, .03), rr.z), t);
    vec3 deep = mix(vec3(.03, .11, .15), vec3(.09, .22, .25), smoothstep(250., 1100., tW));
    col = deep + refl * (.07 + .2 * fres);
    // 큰 너울: 밝고 어두운 띠가 천천히 밀려온다
    float swell = sin(pw.x * .03 + pw.z * .16 + t * 1.5) * .5 + sin(-pw.x * .02 + pw.z * .29 - t * 2.) * .5;
    col *= 1. + swell * .12;
    // 물결선: 갑판에서 보던 가는 빛줄 (멀수록 흐려진다)
    float lines = smoothstep(.62, 1., sin(pw.z * .45 + wave(pw.xz, t) * 3. + t * 2.2) * .5 + .5) / (1. + e * .8);
    col += vec3(.95, .74, .55) * lines * .03;
    // 해 쪽 잔빛: 둥근 점이 아니라 옆으로 길쭉한 금빛 조각
    float gn = noise(vec2(pw.x * .05, pw.z * .32) + vec2(t * .5, -t * .7));
    col += vec3(1., .80, .50) * smoothstep(.8, .98, gn + swell * .08) * (.04 + .14 * pow(max(dot(rr, SUN), 0.), 4.)) / (1. + e * .5);
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
        float pat = exp(-d * d / (2. * pow(3. + age * 1.6, 2.))) * exp(-age * .25);
        float nz = fbm(pw.xz * .8 + vec2(0., t * .1));
        float lace = smoothstep(.42, .62, fbm(pw.xz * 1.6 + vec2(ev.x, t * .15)));
        foam += ev.w * pat * 1.2 * mix(lace, 1., exp(-age * 1.5)) * smoothstep(.22, .6, nz + .25);
      }
    }
    if(uAct > .5){
      float dd = whale(vec3(pw.x, pw.y, pw.z));
      foam += smoothstep(2.6, .2, dd) * smoothstep(.3, .7, fbm(pw.xz * 1.1 + t * .2)) * .9;
    }
    vec3 foamCol = mix(vec3(.62, .66, .72), vec3(1., .86, .7), .55) * (.7 + .3 * smoothstep(-.3, 1., dot(n, SUN) * .6 + .5));
    col = mix(col, foamCol, clamp(foam, 0., .85));
    col = mix(col, skyCol(vec3(rd.x, .004, rd.z), t) * .8, (1. - exp(-tW * .00007)) * .8);
  } else {
    col = skyCol(rd, t);
  }

  // ── 물보라 ──
  // 해를 마주 보는 역광이라 얇은 물은 금빛으로 비치고 두꺼운 물은 회청색 그늘이 진다
  for(int k = 0; k < 3; k++){
    vec4 ev = uEv[k]; float age = t - ev.z;
    if(age <= 0. || age > 3.6) continue;
    float s = ev.w;
    // 사건 자리를 지나는 세로 판 위의 점 (판 하나에 물보라를 그린다)
    float tp = (ev.y - RO.z) / rd.z;
    if(tw > 0. && tw < tp - 3.) continue;
    vec3 P = RO + rd * tp;
    float x = P.x - ev.x, y = P.y;
    float vy0 = 5. + 5. * s;
    // 물기둥: 부풀어 오르는 물 덩어리 여러 개가 겹쳐 솟았다가 무너진다 (뭉게뭉게한 흰 물보라)
    float dens = 0.;
    for(int j = 0; j < 9; j++){
      float fj = float(j) * 3.7 + float(k) * 41.;
      float vx = (hash1(fj) - .5) * (4. + 4. * s);
      float vy = (.35 + .65 * hash1(fj + 1.)) * vy0;
      float ag = age * (.85 + .3 * hash1(fj + 2.));
      vec2 c = vec2(vx * ag, vy * ag - 4.2 * ag * ag);
      float r = (.45 + .5 * hash1(fj + 3.)) * (.6 + .4 * s) + ag * .5;
      vec2 dv = vec2(x, y) - c;
      dens += exp(-dot(dv, dv) / (r * r)) * (c.y > -r ? 1. : 0.);
    }
    // 수면에 깔리는 흰 거품 둔덕
    dens += exp(-x * x / pow(2. + 2.5 * s * (1. - exp(-age * 1.5)), 2.) - y * y / .8) * s * .8 * exp(-age * .6);
    // 가장자리를 잘게 부순다: 덩어리 속은 진하고, 바깥으로 갈수록 성긴 물안개
    float det = fbm(vec2(x, y) * 1.3 + vec2(float(k) * 5., -age * 2.));
    float det2 = fbm(vec2(x * 2.4, y * .7) + vec2(age * .5, -age * 3.)); // 흘러내리는 물줄기 결
    float fib = fbm(vec2(x * 3.2, y * .45 - age * 2.5) + float(k) * 9.); // 세로로 길쭉한 물줄기 결
    float core = smoothstep(.45, .85, dens * (.55 + .5 * det) * (.45 + 1.1 * fib));
    float mistA = smoothstep(.05, .6, dens) * (.25 + .3 * det) * smoothstep(.4, 1.6, age);
    float fade = 1. - smoothstep(2., 3.6, age);
    // 가장자리의 고운 물보라 알갱이 (떨어지며 반짝인다)
    float grain = smoothstep(.04, .5, dens) * (1. - core) * step(.82, hash(floor(vec2(x, y + age * 9.) * 5.) + float(k)));
    float a = clamp(core * .92 + mistA * .3 + grain * .55, 0., .92) * fade * smoothstep(-.3, .6, y);
    // 역광: 얇은 가장자리는 노을빛으로 비치고, 두꺼운 속은 회청색 그늘
    float thin = 1. - smoothstep(.3, 1.5, dens);
    vec3 sc = mix(vec3(.7, .74, .8), vec3(1., .93, .8), .25 + .45 * thin + .3 * fib);
    col = mix(col, sc, a);
    // 튀어 나가는 물 덩어리: 수백 미터 밖에서는 물방울 하나하나는 보이지 않는다.
    // 대신 찢어진 물 덩어리가 포물선을 그리며 날아가며 뒤로 너덜너덜한 꼬리를 끌고, 떨어질 때는 빗줄기 같은 물 커튼을 남긴다.
    for(int i = 0; i < 20; i++){
      float fi = float(i) + float(k) * 31.;
      float side = hash1(fi) < .5 ? -1. : 1.;
      float vx = side * mix(2., 10., pow(hash1(fi + 5.), .7)) * (.6 + s * .3);
      float vy = mix(.5, 1.25, hash1(fi + 9.)) * vy0 * (1. - .35 * abs(vx) / 10.);
      float a2 = age * mix(.8, 1.05, hash1(fi + 4.));
      float life = 1. - smoothstep(1.6, 2.8, a2);
      if(life <= 0.) continue;
      // 공기 저항으로 옆으로 퍼지는 속도가 줄어든다
      float ax = (1. - exp(-a2 * 1.4)) / 1.4;
      vec2 c1 = vec2(vx * ax, vy * a2 - 4.9 * a2 * a2);
      if(c1.y < -.5) continue;
      float b2 = max(a2 - .16, 0.), b3 = max(a2 - .32, 0.);
      vec2 c2 = vec2(vx * (1. - exp(-b2 * 1.4)) / 1.4, vy * b2 - 4.9 * b2 * b2);
      vec2 c3 = vec2(vx * (1. - exp(-b3 * 1.4)) / 1.4, vy * b3 - 4.9 * b3 * b3);
      vec2 P2 = vec2(x, y);
      // 머리(덩어리)에서 꼬리로 갈수록 가늘고 성기게
      vec2 pa = P2 - c2, ba = c1 - c2; float h1 = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0., 1.);
      float d1 = length(pa - ba * h1);
      vec2 pb = P2 - c3, bb = c2 - c3; float h2 = clamp(dot(pb, bb) / max(dot(bb, bb), 1e-4), 0., 1.);
      float d2 = length(pb - bb * h2);
      float rw = (.45 + .45 * hash1(fi + 2.)) * (.7 + .3 * s) * (1. + a2 * .6);
      float tail = max(smoothstep(rw * mix(.45, 1., h1), 0., d1) * mix(.5, 1., h1),
                       smoothstep(rw * .45 * mix(.5, 1., h2), 0., d2) * .5 * h2);
      float along = h1 * length(ba) + (1. - h1) * 0.;
      float rag = smoothstep(.3, .62, noise(vec2(along * 1.2 + fi * 3., d1 / rw * 3.5 + fi)) * .7 + noise(P2 * 4. + fi) * .4);
      float clump = tail * rag;
      // 떨어지는 중이면 아래로 늘어진 물 커튼 (성긴 세로 결)
      float fall = smoothstep(0., -4., vy - 9.8 * a2);
      float curtain = 0.;
      if(fall > 0. && y < c1.y && y > 0.){
        float dx = abs(x - c1.x);
        curtain = smoothstep(rw * 1.1, 0., dx) * smoothstep(.45, .8, noise(vec2(x * 6. + fi, y * .5 + age * 6.)))
                * smoothstep(0., 1.5, c1.y - y) * exp(-(c1.y - y) * .25) * fall;
      }
      float aC = (clump * .95 + curtain * .4) * life * smoothstep(-.3, .4, y);
      // 물보라 장막과 같은 빛: 그늘진 흰빛에, 해 쪽 가장자리만 살짝 따뜻하게 (스스로 빛나지 않는다)
      vec3 wc = mix(vec3(.72, .76, .82), vec3(1., .93, .82), .3 + .4 * rag);
      col = mix(col, wc, clamp(aC, 0., .8));
    }
  }
  // ── 숨(물안개): 화면에 더해진다 ──
  vec3 add = vec3(0.);
  for(int b = 0; b < 1; b++){
    float tb = 1.3; vec3 bp = vec3(-15., 0., -565.);
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
      // 개발 서버에서만: 콘솔에서 window.__scopeT = 4.3 처럼 장면 시각을 고정해 볼 수 있다
      const fixT = process.env.NODE_ENV === 'development' ? (window as unknown as { __scopeT?: number }).__scopeT : undefined;
      const t = typeof fixT === 'number' ? fixT : (now - t0) / 1000;
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
