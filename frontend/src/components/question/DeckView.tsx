'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Question } from '@/data/questions';
import ProgressLine from '@/components/ui/ProgressLine';
import AnalogClock from '@/components/cinematic/AnalogClock';
import { wallClock } from '@/engine/cinematic';
import { scenes } from '@/engine/scenes';
import { unlock } from '@/engine/achievements';
import { playCorkPop, playFireworkBurst, playStarChime, playWhaleCall, playSplash } from '@/lib/synth';

/**
 * Q5 "당신은 무엇을 위해 미국으로 가나요?"
 * 갑판 위 물건 세 개가 선택지다. 누르면 그 물건이 하늘과 바다를 움직인다.
 *   샴페인(experience) → 폭죽 · 데크체어와 별자리 도감(stability) → 별자리 · 망원경(change) → 고래
 *
 * 층 구조 (아래에서 위로)
 *   WebGL 캔버스: 하늘(별·은하수)과 바다(파도·반사·물결)를 셰이더로 그린다
 *   2D 캔버스: 폭죽, 별자리 선, 물보라
 *   고래 그림: 수면 위쪽만 보이도록 잘라 둔다
 *   갑판 앞쪽 그림(deck_q5_fg): 하늘·바다 자리가 투명하다 → 난간 틈으로 셰이더 바다가 비친다
 *   물건 핫스팟과 빛
 */

const IMG = { w: 1376, h: 768 }; // 그림 좌표계 (deck_q5.webp)
const HY = 463.6; // 수평선: 노을 갑판 그림(1672x941)에서 갑판선과 난간이 모이는 점 y≈568 을 1376x768 기준으로 옮긴 값
const WATER_Y = 503; // 고래가 솟는 수면

interface Spot { x: number; y: number; w: number; h: number; ax: number; ay: number }
const SPOTS: Record<string, Spot> = {
  experience: { x: 560, y: 450, w: 140, h: 230, ax: 630, ay: 600 }, // 앞쪽 벤치 왼쪽 (샴페인)
  stability: { x: 355, y: 485, w: 160, h: 175, ax: 430, ay: 585 }, // 앞쪽 벤치 오른쪽 (별자리 도감)
  change: { x: 745, y: 505, w: 170, h: 245, ax: 825, ay: 640 }, // 난간 앞 갑판 (망원경)
};
/**
 * 선택지 물건은 배경과 따로 그린 그림(투명 배경)이다. 그림이 아직 없으면 보이지 않고 빛과 눌리는 자리만 남는다.
 * foot: 물건이 바닥에 닿는 점(1376x768 기준), h: 높이.
 */
const OBJECTS: Record<string, { src: string; foot: [number, number]; h: number; flip?: boolean }> = {
  experience: { src: '/q5/obj_champagne.webp', foot: [630, 670], h: 225 },
  stability: { src: '/q5/obj_atlas.webp', foot: [430, 655], h: 170 },
  change: { src: '/q5/obj_telescope.webp', foot: [825, 740], h: 215, flip: true },
};
/** 구명환 (선택지가 아니라 챙길 수 있는 물건): 계단 앞 하얀 기둥에 작게 걸려 있다. foot 은 아래 끝 */
const BUOY = { foot: [503, 511] as [number, number], h: 54 };
const ORDER = ['experience', 'stability', 'change'] as const;
type Choice = (typeof ORDER)[number];

const NAMES: Record<Choice, string> = { experience: '샴페인', stability: '별자리 도감', change: '망원경' };
const LINES: Record<Choice, string> = {
  experience: '오늘 밤은, 마음껏 즐기기로 했다.',
  stability: '돌아갈 곳이 있다는 것도, 나쁘지 않다.',
  change: '저 너머에서, 다른 삶이 시작된다.',
};
// 선택 후 연출 길이(초). 이 시간이 지나면 다음 질문으로 넘어간다
const DUR: Record<Choice, number> = { experience: 6.6, stability: 7.0, change: 8.0 };
const FADE_AT: Record<Choice, number> = { experience: 5.7, stability: 6.1, change: 7.1 };

// 별자리: 북두칠성과 북극성, 카시오페이아 (그림 좌표)
const BIG_DIPPER = [
  { x: 640, y: 150 }, { x: 705, y: 172 }, { x: 770, y: 168 }, { x: 832, y: 194 },
  { x: 842, y: 262 }, { x: 922, y: 276 }, { x: 935, y: 212 },
];
const POLARIS = { x: 985, y: 84 };
const CASSIOPEIA = [{ x: 1060, y: 190 }, { x: 1115, y: 136 }, { x: 1172, y: 170 }, { x: 1220, y: 120 }, { x: 1280, y: 154 }];
// 별 번호(0~6 북두칠성, 7 북극성, 8~12 카시오페이아) 순서대로 이어 그린다
const STARS = [...BIG_DIPPER, POLARIS, ...CASSIOPEIA];
const SEGMENTS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3], [5, 6], [6, 7], [8, 9], [9, 10], [10, 11], [11, 12]];

const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uOff; uniform float uScale;
uniform float uZoom; uniform vec2 uCenter;
uniform float uNight; uniform float uCalm; uniform float uStar; uniform float uMilky; uniform float uDawn; uniform float uGlow; uniform vec3 uGlowCol;
uniform vec4 uRip[4];
uniform sampler2D uSky; uniform float uHasSky;
out vec4 o;
const float HY = ${HY.toFixed(1)};
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<4;i++){ v += a*noise(p); p *= 2.03; a *= .5; } return v; }

vec3 sky(vec2 p){
  float h = clamp((HY - p.y) / HY, 0., 1.);
  vec3 c;
  if (uHasSky > .5) {
    // 하늘 사진: 구름과 수평선의 노을이 그대로 깔린다 (위에 별과 은하수가 얹힌다)
    c = texture(uSky, vec2(clamp(p.x / 1376., 0., 1.), clamp(p.y / HY, 0., .995))).rgb;
  } else {
    // 노을 하늘: 위는 짙은 푸른색, 수평선으로 갈수록 따뜻한 주황. 해는 오른쪽 수평선 위에 낮게 걸려 있다.
    vec3 gTop = vec3(.17, .28, .50), gMid = vec3(.52, .54, .64), gHor = vec3(.98, .66, .36);
    vec3 gold = mix(gHor, gMid, smoothstep(0., .24, h));
    gold = mix(gold, gTop, smoothstep(.22, 1., h));
    float sun = exp(-length((p - vec2(1260., HY - 6.)) * vec2(1., 2.4)) / 230.);
    gold += vec3(1., .72, .38) * sun * .55;
    // 밤하늘 (선택하면 노을에서 밤으로 어두워진다)
    vec3 nTop = vec3(.04, .08, .19), nHor = vec3(.19, .21, .33);
    vec3 night = mix(nHor, nTop, pow(h, .7));
    night = mix(night, vec3(.55, .36, .30), exp(-h * 12.) * .30);
    c = mix(gold, night, uNight);
  }
  c = mix(c, vec3(1., .55, .30), uDawn * exp(-h * 5.5) * .85);
  // 구름: 천천히 흘러가는 얇은 구름 띠. 노을에는 해 쪽 가장자리가 주황으로 빛나고, 밤에는 어둡고 푸르다
  vec2 cp = vec2(p.x * .0042 + uTime * .005, p.y * .0105);
  float cn = fbm(cp * 1.3 + 4.);
  float cn2 = fbm(cp * 2.7 + vec2(9., uTime * .008));
  float dens = smoothstep(.50, .76, cn * .72 + cn2 * .38);
  dens *= smoothstep(.02, .14, h) * (1. - .55 * smoothstep(.55, .95, h));
  float edge = clamp((cn - fbm(cp * 1.3 + 4. + vec2(.06, -.07))) * 10. + .5, 0., 1.);
  vec3 cLit = mix(vec3(1., .60, .34), vec3(.96, .74, .66), smoothstep(0., .4, h));
  vec3 ccol = mix(vec3(.34, .30, .44), cLit, .3 + .7 * edge);
  ccol = mix(ccol, mix(vec3(.09, .11, .19), vec3(.22, .25, .38), edge), uNight);
  c = mix(c, ccol, dens * .8);
  c *= mix(1., .55, uMilky * .5);
  // 별: 많고 또렷하게 반짝인다. 일부는 십자 빛줄기와 번지는 빛이 있는 큰 별이다
  float sc = 30.;
  vec2 g = p / sc, id = floor(g), f = fract(g) - .5;
  float r = hash(id);
  float on = step(.86 - uStar * .12, r);
  vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - .5) * .6;
  vec2 e2 = f - off;
  float d = length(e2);
  float tw = .5 + .5 * sin(uTime * (1.3 + r * 4.) + r * 40.);
  float tw2 = .5 + .5 * sin(uTime * (.7 + r * 2.) + r * 17.);
  float bright = (0.85 + uStar * 1.1) * (.45 + .55 * h) * mix(.7 * smoothstep(.22, .6, h), 1., uNight);
  float st = on * smoothstep(.10, .0, d) * (.35 + .65 * tw) * bright;
  float big = step(.975, r);
  float halo = smoothstep(.26, .0, d) * .30;
  float cross = smoothstep(.025, .0, abs(e2.x)) * smoothstep(.36, .0, abs(e2.y)) + smoothstep(.025, .0, abs(e2.y)) * smoothstep(.36, .0, abs(e2.x));
  st += big * (halo + cross * .7) * (.4 + .6 * tw2) * bright * 1.3;
  c += mix(vec3(.85, .9, 1.), vec3(1., .9, .75), hash(id + 11.)) * st * (1. - dens * .9);
  // 은하수
  float dd = (p.y - (.34 * p.x - 30.));
  float band = exp(-dd * dd / (2. * 80. * 80.));
  float cloud = .35 + fbm(p * .011 + 2.) * 1.3;
  float dust = step(.86, hash(floor(p * .6))) * .5 * band;
  c += (vec3(.48, .55, .80) * band * cloud * .55 + vec3(.9) * dust * .35) * uMilky * uNight;
  return c;
}

vec3 sea(vec2 p){
  float d = max(p.y - HY, .5);
  float persp = 1. / (d * .012 + .35);
  vec2 q = vec2((p.x - 688.) * persp * .004, persp * 1.2);
  float amp = mix(1., .05, uCalm);
  float h = 0.;
  h += sin(q.x * 7. + q.y * 3. + uTime * 1.2) * .55;
  h += sin(q.x * 13. - q.y * 5. + uTime * 1.7 + 1.7) * .38;
  h += (noise(q * 9. + vec2(uTime * .5, uTime * .32)) - .5) * .6;
  h *= amp;
  float rh = 0.;
  for(int i = 0; i < 4; i++){
    vec4 r = uRip[i];
    if(r.z >= 0.){
      float dist = length((p - r.xy) * vec2(1., 2.4));
      float w = dist - r.z * 150.;
      rh += sin(w * .30) * exp(-w * w * .0012) * exp(-r.z * .8) * r.w;
    }
  }
  h += rh;
  vec3 deepFar = vec3(.09, .22, .25), deepNear = vec3(.03, .11, .15);
  vec3 base = mix(deepFar, deepNear, smoothstep(0., 170., d));
  vec2 pr = vec2(p.x + h * 38., HY - d * .85 + h * 20.);
  vec3 refl = sky(pr);
  float fres = pow(1. - clamp(d / 280., 0., 1.), 1.4) * .75 + .16;
  vec3 col = base + refl * fres * (.36 + uCalm * .18);
  float glint = smoothstep(.55, .95, h + rh * 1.5) * (.12 + uStar * .1);
  col += vec3(.9, .8, .6) * glint;
  // 눈에 띄게 일렁이는 큰 너울과 물결선: 밝고 어두운 띠가 천천히 밀려온다
  float swell = sin(q.x * 3.4 + q.y * 2.1 + uTime * 1.5) * .5 + sin(q.x * 6.3 - q.y * 3.6 - uTime * 2.0) * .5;
  col *= 1. + swell * .13 * amp * (.5 + .5 * smoothstep(0., 140., d));
  float lines = smoothstep(.62, 1., sin(q.y * 26. + h * 6. + uTime * 2.2) * .5 + .5);
  col += mix(vec3(.45, .6, .9), vec3(.95, .72, .55), .2 + .6 * smoothstep(250., 900., p.x)) * lines * .035 * amp * exp(-d * .006);
  // 일렁이는 물결 위로 반짝이는 잔빛: 해 진 수평선 쪽(오른쪽)이 더 붉고, 가까울수록 어둡게 사그라든다
  float gl2 = smoothstep(.74, .97, noise(q * 14. + vec2(uTime * .8, -uTime * .5)) + h * .28);
  float sunW = exp(-abs(p.x - 1260.) / 430.);
  vec3 gcol = mix(vec3(.62, .76, 1.), vec3(1., .80, .50), mix(.2, 1., sunW * (1. - uNight)));
  col += gcol * gl2 * (.025 + .10 * exp(-d * .011)) * (.6 + .4 * (1. - uCalm));
  col += vec3(.7, .85, 1.) * rh * .22 * exp(-d * .004);
  col += uGlowCol * uGlow * exp(-d * .005) * (.35 + .65 * noise(q * 6. + uTime * .5));
  col *= mix(1., .5, uNight);
  col = mix(col, col * vec3(1.15, .92, .78) + vec3(.07, .03, 0.), uDawn * .55);
  return col;
}

void main(){
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 pi = (frag - uOff) / uScale;
  vec2 p = uCenter + (pi - uCenter) / uZoom;
  float e = smoothstep(HY - 1.2, HY + 1.2, p.y);
  vec3 col = mix(sky(vec2(p.x, min(p.y, HY))), sea(vec2(p.x, max(p.y, HY))), e);
  vec2 uv = gl_FragCoord.xy / uRes;
  col *= mix(.78, 1., smoothstep(.0, .55, 1. - length(uv - .5) * 1.1));
  o = vec4(pow(col, vec3(.96)), 1.);
}`;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface View { zoom: number; cx: number; cy: number }
interface Fx { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; hist: [number, number][]; size: number; drag: number }
interface Rocket { x: number; y: number; tx: number; ty: number; vy: number; col: string; burst: () => void }

interface DeckViewProps {
  question: Question;
  onAnswer: (value: string, extra?: Record<string, unknown>) => void;
  onBack?: () => void;
}

export default function DeckView({ question, onAnswer, onBack }: DeckViewProps) {
  const reduce = !!useReducedMotion();
  const [hovered, setHovered] = useState<Choice | null>(null);
  const [chosen, setChosen] = useState<Choice | null>(null);
  const [noGL, setNoGL] = useState(false);
  const [buoy, setBuoy] = useState(false); // 구명환을 챙겼는지
  const buoyRef = useRef(false);
  const [buoyMsg, setBuoyMsg] = useState(false);
  const [buoyHover, setBuoyHover] = useState(false);
  const takeBuoy = () => {
    if (buoyRef.current || chosenRef.current) return;
    buoyRef.current = true;
    setBuoy(true);
    setBuoyMsg(true);
    playStarChime(5);
    timers.current.push(setTimeout(() => setBuoyMsg(false), 3200));
  };
  const [coarse, setCoarse] = useState(false);
  const [needPan, setNeedPan] = useState(false);
  const [watch, setWatch] = useState(false);
  const [lineOn, setLineOn] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);
  const whaleBox = useRef<HTMLDivElement>(null);
  const whaleImg = useRef<HTMLImageElement>(null);
  const tailImg = useRef<HTMLImageElement>(null);

  const hoverRef = useRef<Choice | null>(null);
  const chosenRef = useRef<Choice | null>(null);
  const chosenAt = useRef(0);
  const answered = useRef(false);
  const lastType = useRef('mouse');
  const sizeRef = useRef({ vw: 1280, vh: 720, dpr: 1 });
  const pan = useRef(0.62);
  const mouseN = useRef({ x: 0, y: 0 }); // 마우스 위치(-1~1): 갑판과 하늘이 미세하게 따라 움직인다
  const panTarget = useRef(0.62);
  const drag = useRef<{ x: number; pan: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => { hoverRef.current = hovered; }, [hovered]);
  useEffect(() => { chosenRef.current = chosen; }, [chosen]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    try { setCoarse(window.matchMedia('(pointer: coarse)').matches); } catch { /* 무시 */ }
  }, []);

  // 37초 이스터에그: 아무것도 고르지 않고 37초(빙산 발견에서 충돌까지)를 바라보면 업적. 탭이 보일 때만 센다.
  useEffect(() => {
    let seen = 0;
    const id = window.setInterval(() => {
      if (document.hidden || chosenRef.current) return;
      seen += 1;
      if (seen >= 37) {
        window.clearInterval(id);
        unlock('watchtower');
        setWatch(true);
        timers.current.push(setTimeout(() => setWatch(false), 6500));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const choose = useCallback((v: Choice) => {
    if (answered.current) return;
    answered.current = true;
    setHovered(v);
    setChosen(v);
    chosenAt.current = performance.now();
    // 확대하는 중심(화면 가운데)에 그 장면이 오도록 좌우 위치를 맞춘다
    {
      const { vw, vh } = sizeRef.current;
      const sc = Math.max(vw / IMG.w, vh / IMG.h);
      const Wd = IMG.w * sc;
      if (Wd > vw) panTarget.current = clamp01(((v === 'change' ? 900 : 688) * sc - vw / 2) / (Wd - vw));
    }
    if (reduce) {
      timers.current.push(setTimeout(() => onAnswer(v, buoyRef.current ? { lifebuoy: true } : undefined), 350));
      return;
    }
    timers.current.push(setTimeout(() => onAnswer(v, buoyRef.current ? { lifebuoy: true } : undefined), (DUR[v] + 0.3) * 1000));
    timers.current.push(setTimeout(() => setLineOn(true), (v === 'experience' ? 3.0 : v === 'stability' ? 4.2 : 5.2) * 1000));
  }, [onAnswer, reduce]);

  // 키보드: 1·2·3
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < ORDER.length) choose(ORDER[i]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose]);

  const optionOf = useCallback((v: Choice) => question.options.find((o) => o.value === v), [question]);

  const activate = (v: Choice) => {
    if (chosenRef.current) return;
    if (lastType.current === 'touch' && hoverRef.current !== v) {
      setHovered(v);
      return;
    }
    choose(v);
  };

  const panTo = (v: Choice) => {
    const { vw } = sizeRef.current;
    const s = Math.max(vw / IMG.w, sizeRef.current.vh / IMG.h);
    const W = IMG.w * s;
    if (W <= vw) return;
    const sp = SPOTS[v];
    panTarget.current = clamp01(((sp.x + sp.w / 2) * s - vw / 2) / (W - vw));
  };

  // ── 렌더 루프 ──────────────────────────────────────────────
  useEffect(() => {
    const root = rootRef.current;
    const glCanvas = glRef.current;
    const fxCanvas = fxRef.current;
    if (!root || !glCanvas || !fxCanvas) return;
    const fx = fxCanvas.getContext('2d');
    if (!fx) return;

    // WebGL2 준비 (안 되면 그림 한 장으로 대신한다)
    let gl: WebGL2RenderingContext | null = null;
    let prog: WebGLProgram | null = null;
    const loc: Record<string, WebGLUniformLocation | null> = {};
    try {
      // 개발용: 주소에 ?nogl 을 붙이면 WebGL 없이 그림 한 장으로 대신하는 경로를 시험할 수 있다
      const forceNoGL = process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).has('nogl');
      gl = forceNoGL ? null : glCanvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: process.env.NODE_ENV === 'development' });
      if (forceNoGL) setNoGL(true);
      else if (gl) {
        const mk = (type: number, src: string) => {
          const sh = gl!.createShader(type)!;
          gl!.shaderSource(sh, src);
          gl!.compileShader(sh);
          if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(sh) || 'shader');
          return sh;
        };
        prog = gl.createProgram()!;
        gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const a = gl.getAttribLocation(prog, 'a');
        gl.enableVertexAttribArray(a);
        gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
        for (const n of ['uRes', 'uTime', 'uOff', 'uScale', 'uZoom', 'uCenter', 'uNight', 'uCalm', 'uStar', 'uMilky', 'uDawn', 'uGlow', 'uGlowCol', 'uRip', 'uSky', 'uHasSky']) loc[n] = gl.getUniformLocation(prog, n);
      } else setNoGL(true);
    } catch {
      gl = null;
      setNoGL(true);
    }

    // 하늘 사진 판 (bg/sky_q5.webp): 올라오면 셰이더가 쓰고, 그 전에는 기본 그라데이션을 쓴다
    let skyTex: WebGLTexture | null = null;
    let hasSky = 0;
    if (gl && prog) {
      const g2 = gl;
      const img = new Image();
      img.onload = () => {
        try {
          skyTex = g2.createTexture();
          g2.activeTexture(g2.TEXTURE0);
          g2.bindTexture(g2.TEXTURE_2D, skyTex);
          g2.pixelStorei(g2.UNPACK_FLIP_Y_WEBGL, false);
          g2.texImage2D(g2.TEXTURE_2D, 0, g2.RGBA, g2.RGBA, g2.UNSIGNED_BYTE, img);
          g2.texParameteri(g2.TEXTURE_2D, g2.TEXTURE_MIN_FILTER, g2.LINEAR);
          g2.texParameteri(g2.TEXTURE_2D, g2.TEXTURE_MAG_FILTER, g2.LINEAR);
          g2.texParameteri(g2.TEXTURE_2D, g2.TEXTURE_WRAP_S, g2.CLAMP_TO_EDGE);
          g2.texParameteri(g2.TEXTURE_2D, g2.TEXTURE_WRAP_T, g2.CLAMP_TO_EDGE);
          hasSky = 1;
        } catch {
          hasSky = 0;
        }
      };
      // 노을 하늘은 셰이더가 그린다. 하늘 사진을 쓰려면 경로를 넣는다 (예: '/bg/sky_golden.webp').
      const SKY_SRC: string | null = null;
      if (SKY_SRC) img.src = SKY_SRC;
    }

    const fit = () => {
      const r = root.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      sizeRef.current = { vw: r.width, vh: r.height, dpr };
      for (const c of [glCanvas, fxCanvas]) {
        c.width = Math.round(r.width * dpr);
        c.height = Math.round(r.height * dpr);
      }
      if (gl) gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      const s = Math.max(r.width / IMG.w, r.height / IMG.h);
      setNeedPan(IMG.w * s > r.width * 1.2);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    const onLost = (e: Event) => { e.preventDefault(); setNoGL(true); };
    glCanvas.addEventListener('webglcontextlost', onLost);

    // 상태
    const cur = { night: 0, calm: 0.12, star: 0, milky: 0, dawn: 0, glow: 0, gr: 1, gg: 0.8, gb: 0.45 };
    const view: View = { zoom: 1, cx: 688, cy: 230 };
    const ripples: { x: number; y: number; t0: number; amp: number }[] = [];
    const fw: Fx[] = [];
    const rockets: Rocket[] = [];
    const spray: Fx[] = [];
    const events: { at: number; done: boolean; fn: () => void }[] = [];
    let phase: Choice | null = null;
    let t0 = performance.now();
    let last = t0;
    let raf = 0;
    let energy = 0;
    let shake = 0;

    const PAL = ['255,214,120', '255,170,90', '255,236,205', '255,120,145', '165,205,255'];

    const burst = (x: number, y: number, ci: number, kind: 'radial' | 'ring' | 'willow' | 'big') => {
      const n = kind === 'big' ? 190 : kind === 'ring' ? 70 : 100;
      const col = PAL[ci % PAL.length];
      for (let i = 0; i < n; i++) {
        const ang = kind === 'ring' ? (i / n) * Math.PI * 2 : Math.random() * Math.PI * 2;
        const sp = kind === 'ring' ? 150 : (kind === 'big' ? 120 + Math.random() * 190 : 60 + Math.random() * 150);
        fw.push({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0,
          max: kind === 'willow' ? 2.8 + Math.random() : 1.4 + Math.random() * 1.1, col, hist: [],
          size: kind === 'big' ? 1.8 : 1.4, drag: kind === 'willow' ? 1.6 : 0.9,
        });
      }
      if (kind === 'big') for (let i = 0; i < 60; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 80;
        fw.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: 1.8 + Math.random(), col: PAL[(ci + 2) % PAL.length], hist: [], size: 1.2, drag: 1.1 });
      }
    };
    const launch = (x: number, y: number, ci: number, kind: 'radial' | 'ring' | 'willow' | 'big') => {
      const sx = x + (Math.random() - 0.5) * 60;
      rockets.push({ x: sx, y: HY + 6, tx: x, ty: y, vy: (HY + 6 - y) / 0.8, col: PAL[ci % PAL.length], burst: () => { burst(x, y, ci, kind); playFireworkBurst(0, kind === 'big' ? 1.3 : 0.8); } });
    };
    const splash = (x: number, y: number, power: number) => {
      for (let i = 0; i < 80 * power; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const sp = 90 + Math.random() * 190 * power;
        spray.push({ x: x + (Math.random() - 0.5) * 24, y, vx: Math.cos(ang) * sp * 0.6, vy: Math.sin(ang) * sp, life: 0, max: 0.9 + Math.random() * 0.9, col: '230,242,255', hist: [], size: 1 + Math.random() * 1.8, drag: 0.3 });
      }
      ripples.push({ x, y, t0: (performance.now() - chosenAt.current) / 1000, amp: 1.1 * power });
      if (ripples.length > 4) ripples.shift();
    };

    const toScreen = (x: number, y: number) => {
      const { vw, vh } = sizeRef.current;
      const s = Math.max(vw / IMG.w, vh / IMG.h);
      return { x: ((x - view.cx) * view.zoom + view.cx) * s + layout.ox, y: ((y - view.cy) * view.zoom + view.cy) * s + layout.oy, s: s * view.zoom };
    };
    const layout = { ox: 0, oy: 0 };
    const par = { x: 0, y: 0, a: 1 }; // 시차(마우스를 따라 아주 조금 움직이는 정도)

    const startPhase = (v: Choice) => {
      phase = v;
      t0 = performance.now();
      events.length = 0;
      const at = (t: number, fn: () => void) => events.push({ at: t, done: false, fn });
      if (v === 'experience') {
        at(0.05, playCorkPop);
        const shots: [number, number, number, number, 'radial' | 'ring' | 'willow' | 'big'][] = [
          [1.0, 760, 190, 0, 'radial'], [1.7, 1050, 150, 1, 'radial'], [2.3, 890, 250, 2, 'ring'], [2.9, 640, 210, 3, 'radial'],
          [3.2, 1210, 200, 4, 'radial'], [3.6, 850, 120, 0, 'willow'], [3.95, 1010, 220, 1, 'radial'], [4.15, 730, 270, 2, 'ring'],
          [4.35, 1150, 150, 3, 'radial'], [4.6, 920, 180, 0, 'big'],
        ];
        for (const [t, x, y, c, k] of shots) at(t - 0.8, () => launch(x, y, c, k));
      } else if (v === 'stability') {
        STARS.forEach((_, i) => at(1.8 + i * 0.3, () => playStarChime(i % 8)));
      } else {
        at(1.5, playWhaleCall);
        at(2.2, () => { splash(845, WATER_Y, 1); playSplash(); });
        at(4.6, () => { splash(955, WATER_Y, 1.5); playSplash(); shake = 0.6; });
        at(5.0, () => { splash(945, WATER_Y, 0.5); });
      }
    };

    const drawStarShape = (e: number) => {
      // 별이 하나씩 켜지고, 별 사이를 선이 이어 그린다
      const s0 = 1.8;
      const per = 0.3;
      const a = (i: number) => smooth(s0 + i * per, s0 + i * per + 0.5, e);
      fx.save();
      fx.globalCompositeOperation = 'lighter';
      // 선
      fx.lineCap = 'round';
      SEGMENTS.forEach(([i, j]) => {
        const start = s0 + Math.max(i, j) * per + 0.3;
        const k = smooth(start, start + 0.7, e);
        if (k <= 0) return;
        const p = toScreen(STARS[i].x, STARS[i].y);
        const q = toScreen(STARS[j].x, STARS[j].y);
        fx.strokeStyle = `rgba(190,215,255,${0.55 * k})`;
        fx.lineWidth = Math.max(1, 1.4 * p.s);
        fx.beginPath();
        fx.moveTo(p.x, p.y);
        fx.lineTo(lerp(p.x, q.x, k), lerp(p.y, q.y, k));
        fx.stroke();
      });
      STARS.forEach((st, i) => {
        const k = a(i);
        if (k <= 0) return;
        const p = toScreen(st.x, st.y);
        const bright = i === 7 ? 1.7 : 1;
        const r = (6 + 4 * Math.sin(e * 2 + i)) * p.s * bright * (0.5 + 0.5 * k);
        const g = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2);
        g.addColorStop(0, `rgba(255,255,255,${0.95 * k})`);
        g.addColorStop(0.25, `rgba(190,215,255,${0.5 * k})`);
        g.addColorStop(1, 'rgba(120,160,255,0)');
        fx.fillStyle = g;
        fx.beginPath();
        fx.arc(p.x, p.y, r * 3.2, 0, Math.PI * 2);
        fx.fill();
      });
      fx.restore();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { vw, vh, dpr } = sizeRef.current;
      const s = Math.max(vw / IMG.w, vh / IMG.h);
      const W = IMG.w * s;
      const e = phase ? (now - t0) / 1000 : 0;
      const t = reduce ? 0 : now / 1000;

      // 좌우로 둘러보기 (그림이 화면보다 넓을 때)
      pan.current += (panTarget.current - pan.current) * Math.min(1, dt * 6);
      layout.ox = W > vw ? -(W - vw) * pan.current : (vw - W) / 2;
      layout.oy = (vh - IMG.h * s) / 2;
      par.x += (mouseN.current.x - par.x) * Math.min(1, dt * 3);
      par.y += (mouseN.current.y - par.y) * Math.min(1, dt * 3);
      par.a += ((phase || reduce ? 0 : 1) - par.a) * Math.min(1, dt * 2.5);
      // 가까운 갑판은 많이, 먼 하늘과 바다는 적게, 반대 방향으로: 마우스 쪽을 들여다보는 느낌
      const fgPx = -par.x * 9 * par.a; const fgPy = -par.y * 5 * par.a;
      const skyPx = -par.x * 3.5 * par.a; const skyPy = -par.y * 2 * par.a;

      // 호버 미리보기: 세계가 그 물건 쪽으로 살짝 기운다
      const h = hoverRef.current;
      const tgt = { night: 0, calm: 0.12, star: 0, milky: 0, dawn: 0, glow: 0 };
      if (!phase) {
        if (h === 'experience') { tgt.glow = 0.07; tgt.night = 0.18; }
        if (h === 'stability') { tgt.night = 0.42; tgt.star = 0.55; tgt.calm = 0.55; tgt.milky = 0.25; }
        if (h === 'change') { tgt.dawn = 0.18; tgt.calm = 0.3; }
        const k = Math.min(1, dt * 3);
        cur.calm += (tgt.calm - cur.calm) * k;
        cur.night += (tgt.night - cur.night) * k;
        cur.star += (tgt.star - cur.star) * k;
        cur.milky += (tgt.milky - cur.milky) * k;
        cur.dawn += (tgt.dawn - cur.dawn) * k;
        cur.glow += (tgt.glow - cur.glow) * k;
      }

      // 선택 연출
      let fgA = 1;
      let fgY = 0;
      let whale: { x: number; y: number; rot: number; a: number } | null = null;
      let tail: { x: number; y: number; rot: number } | null = null;
      if (chosenRef.current && !phase && !reduce) startPhase(chosenRef.current);
      if (phase && !reduce) {
        for (const ev of events) if (!ev.done && e >= ev.at) { ev.done = true; ev.fn(); }
        if (phase === 'experience') {
          view.cx = 900; view.cy = 300; view.zoom = 1 + 0.06 * smooth(0, 6, e);
          cur.glow = Math.min(0.9, energy);
          cur.gr = 1; cur.gg = 0.78; cur.gb = 0.42;
          cur.night = 0.82 * smooth(0, 2.4, e);
          cur.star = 0.2 * smooth(0, 3, e);
          cur.dawn = 0;
        } else if (phase === 'stability') {
          // 고개를 드는 연출: 갑판은 아래로 완전히 밀려 나가고, 하늘이 올라온다 (사진이 잘려 보이지 않도록 흐리게 지우지 않는다)
          const z = smooth(0.2, 3.4, e);
          view.cx = 860; view.cy = 200; view.zoom = lerp(1, 1.45, z);
          fgA = 1;
          fgY = smooth(0.15, 2.7, e) * (vh + 140);
          cur.night = smooth(0.1, 2.6, e);
          cur.star = smooth(0.2, 2.6, e);
          cur.milky = 0.9 * smooth(0.6, 3.6, e);
          cur.calm = lerp(0.55, 1, smooth(0, 2, e));
        } else {
          const z = smooth(0.2, 2.1, e);
          view.cx = 900; view.cy = 470; view.zoom = lerp(1, 2.4, z);
          fgA = 1 - smooth(0.2, 1.6, e);
          cur.calm = 0.3;
          cur.night = 0;
          cur.dawn = lerp(0.18, 0.7, smooth(3.6, 6.2, e));
          // 고래: 2.2초에 솟아 4.6초에 들어가고, 이어서 꼬리가 올라왔다 잠긴다
          const u = (e - 2.2) / 2.4;
          if (u > 0 && u < 1) {
            const x = lerp(845, 955, u);
            const y = WATER_Y + 46 - 4 * 125 * u * (1 - u);
            whale = { x, y, rot: -35 + 100 * u, a: 1 };
          }
          const u2 = (e - 4.7) / 2.0;
          if (u2 > 0 && u2 < 1) tail = { x: 945, y: WATER_Y + 40 - 66 * Math.sin(Math.PI * u2), rot: 10 * (u2 - 0.5) };
          if (shake > 0) shake = Math.max(0, shake - dt);
        }
      }
      // 폭죽 에너지는 살아 있는 파티클 수에서 부드럽게 구한다
      energy += (Math.min(1, fw.length / 520) - energy) * Math.min(1, dt * 6);

      // 파티클 갱신
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y -= r.vy * dt;
        if (r.y <= r.ty) { r.burst(); rockets.splice(i, 1); }
      }
      for (const arr of [fw, spray]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const p = arr[i];
          p.life += dt;
          if (p.life > p.max) { arr.splice(i, 1); continue; }
          p.hist.push([p.x, p.y]);
          if (p.hist.length > 6) p.hist.shift();
          p.vx *= 1 - p.drag * dt;
          p.vy = p.vy * (1 - p.drag * dt) + (arr === fw ? 70 : 380) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      }

      // ── WebGL ──
      const sh = shake > 0 ? (Math.random() - 0.5) * shake * 6 : 0;
      if (gl && prog) {
        const rip = new Float32Array(16);
        for (let i = 0; i < 4; i++) {
          const r = ripples[i];
          const age = r ? e - r.t0 : -1;
          rip[i * 4] = r ? r.x : 0; rip[i * 4 + 1] = r ? r.y : 0; rip[i * 4 + 2] = r && age >= 0 && age < 6 ? age : -1; rip[i * 4 + 3] = r ? r.amp : 0;
        }
        gl.uniform2f(loc.uRes, glCanvas.width, glCanvas.height);
        gl.uniform1f(loc.uTime, t);
        gl.uniform2f(loc.uOff, (layout.ox + sh + skyPx) * dpr, (layout.oy + sh + skyPy) * dpr);
        gl.uniform1f(loc.uScale, s * dpr);
        gl.uniform1f(loc.uZoom, view.zoom);
        gl.uniform2f(loc.uCenter, view.cx, view.cy);
        gl.uniform1f(loc.uCalm, cur.calm);
        gl.uniform1f(loc.uStar, cur.star);
        gl.uniform1f(loc.uMilky, cur.milky);
        gl.uniform1f(loc.uDawn, cur.dawn);
        gl.uniform1f(loc.uGlow, cur.glow);
        gl.uniform1f(loc.uNight, cur.night);
        gl.uniform3f(loc.uGlowCol, cur.gr, cur.gg, cur.gb);
        gl.uniform4fv(loc.uRip, rip);
        gl.activeTexture(gl.TEXTURE0);
        if (skyTex) gl.bindTexture(gl.TEXTURE_2D, skyTex);
        gl.uniform1i(loc.uSky, 0);
        gl.uniform1f(loc.uHasSky, hasSky);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      // ── 2D 효과 ──
      fx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx.clearRect(0, 0, vw, vh);
      fx.globalCompositeOperation = 'lighter';
      for (const r of rockets) {
        const p = toScreen(r.x, r.y);
        fx.fillStyle = `rgba(${r.col},0.9)`;
        fx.beginPath();
        fx.arc(p.x, p.y, Math.max(1.4, 1.8 * p.s), 0, Math.PI * 2);
        fx.fill();
        const q = toScreen(r.x, r.y + 28);
        const g = fx.createLinearGradient(p.x, p.y, q.x, q.y);
        g.addColorStop(0, `rgba(${r.col},0.6)`);
        g.addColorStop(1, `rgba(${r.col},0)`);
        fx.strokeStyle = g;
        fx.lineWidth = Math.max(1, 1.4 * p.s);
        fx.beginPath();
        fx.moveTo(p.x, p.y);
        fx.lineTo(q.x, q.y);
        fx.stroke();
      }
      for (const p of fw) {
        const a = 1 - p.life / p.max;
        const sp = toScreen(p.x, p.y);
        fx.strokeStyle = `rgba(${p.col},${0.75 * a})`;
        fx.lineWidth = Math.max(1, p.size * sp.s * 1.1);
        fx.lineCap = 'round';
        fx.beginPath();
        const h0 = p.hist[0] ?? [p.x, p.y];
        const hs = toScreen(h0[0], h0[1]);
        fx.moveTo(hs.x, hs.y);
        fx.lineTo(sp.x, sp.y);
        fx.stroke();
        const g = fx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 6 * sp.s);
        g.addColorStop(0, `rgba(255,255,255,${0.7 * a})`);
        g.addColorStop(1, `rgba(${p.col},0)`);
        fx.fillStyle = g;
        fx.fillRect(sp.x - 7 * sp.s, sp.y - 7 * sp.s, 14 * sp.s, 14 * sp.s);
      }
      fx.globalCompositeOperation = 'source-over';
      for (const p of spray) {
        const a = Math.max(0, 1 - p.life / p.max);
        const sp = toScreen(p.x, p.y);
        fx.fillStyle = `rgba(${p.col},${0.8 * a})`;
        fx.beginPath();
        fx.arc(sp.x, sp.y, Math.max(0.8, p.size * sp.s), 0, Math.PI * 2);
        fx.fill();
      }
      if (phase === 'stability' && !reduce) drawStarShape(e);

      // ── 고래 ──
      const wb = whaleBox.current;
      const wi = whaleImg.current;
      if (wb && wi) {
        const water = toScreen(0, WATER_Y);
        const ti = tailImg.current;
        wb.style.display = whale || tail ? 'block' : 'none';
        wb.style.height = `${water.y}px`;
        if (whale) {
          const p = toScreen(whale.x, whale.y);
          const wpx = 120 * p.s;
          wi.style.display = 'block';
          wi.style.width = `${wpx}px`;
          wi.style.transform = `translate(${p.x - wpx / 2}px, ${p.y - (wpx * 0.557) / 2}px) rotate(${whale.rot}deg)`;
        } else wi.style.display = 'none';
        if (ti) {
          if (tail) {
            const p = toScreen(tail.x, tail.y);
            const tpx = 62 * p.s;
            ti.style.display = 'block';
            ti.style.width = `${tpx}px`;
            ti.style.transform = `translate(${p.x - tpx / 2}px, ${p.y - (tpx * 0.703) / 2}px) rotate(${tail.rot}deg)`;
          } else ti.style.display = 'none';
        }
      }

      // ── 앞쪽 그림 ──
      const fg = fgRef.current;
      if (fg) {
        // 움직여도 가장자리가 비지 않도록 1.2%쯤 크게 그린다
        const ex = 0.012;
        fg.style.transformOrigin = '0 0';
        fg.style.transform = `translate(${layout.ox + sh + fgPx - IMG.w * s * ex / 2}px, ${layout.oy + sh + fgPy + fgY - IMG.h * s * ex / 2}px) scale(${s * (1 + ex)})`;
        fg.style.opacity = String(fgA);
        // 밤이 되면 노을빛을 받던 갑판도 함께 어두워진다
        fg.style.filter = cur.night > 0.01 ? `brightness(${(1 - 0.55 * cur.night).toFixed(3)}) saturate(${(1 - 0.4 * cur.night).toFixed(3)})` : 'none';
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      glCanvas.removeEventListener('webglcontextlost', onLost);
      // 컨텍스트를 강제로 닫지 않는다: 개발 모드의 Strict Mode 가 같은 캔버스로 효과를 두 번 실행하는데,
      // 닫아 버리면 두 번째 실행이 죽은 컨텍스트를 받아 늘 대체 경로로 떨어진다. 프로그램만 지운다.
      if (gl && skyTex) gl.deleteTexture(skyTex);
      if (gl && prog) gl.deleteProgram(prog);
    };
  }, [reduce]);

  // ── 입력 ──
  const onPointerMove = (e: React.PointerEvent) => {
    lastType.current = e.pointerType;
    if (e.pointerType === 'mouse') mouseN.current = { x: (e.clientX / sizeRef.current.vw) * 2 - 1, y: (e.clientY / sizeRef.current.vh) * 2 - 1 };
    const { vw } = sizeRef.current;
    if (e.pointerType === 'mouse' && needPan && !chosenRef.current) panTarget.current = clamp01(e.clientX / vw);
    if (drag.current && e.pointerType !== 'mouse') {
      const s = Math.max(vw / IMG.w, sizeRef.current.vh / IMG.h);
      const W = IMG.w * s;
      if (W > vw) panTarget.current = clamp01(drag.current.pan - (e.clientX - drag.current.x) / (W - vw));
    }
  };

  const hoverOpt = hovered ? optionOf(hovered) : null;
  const clock = scenes[question.id]?.clock;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 h-full w-full select-none overflow-clip bg-[#050b18]"
      style={{ touchAction: 'none' }}
      onPointerMove={onPointerMove}
      onPointerDown={(e) => {
        lastType.current = e.pointerType;
        drag.current = { x: e.clientX, pan: panTarget.current };
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
    >
      {/* 셰이더를 쓸 수 없을 때를 위한 그림 한 장 */}
      <canvas ref={glRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" style={{ display: noGL ? 'none' : 'block' }} />
      <canvas ref={fxRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: noGL ? 5 : undefined }} />

      {/* 고래: 수면 위쪽만 보인다 */}
      <div ref={whaleBox} aria-hidden className="pointer-events-none absolute left-0 top-0 w-full overflow-hidden" style={{ display: 'none', zIndex: noGL ? 5 : undefined }}>
        <img ref={whaleImg} src="/q5/whale_breach.webp" alt="" className="absolute left-0 top-0 max-w-none will-change-transform" style={{ transformOrigin: '50% 50%' }} />
        <img ref={tailImg} src="/q5/whale_tail.webp" alt="" className="absolute left-0 top-0 max-w-none will-change-transform" style={{ transformOrigin: '50% 50%', display: 'none' }} />
      </div>

      {/* 갑판 앞쪽: 하늘과 바다 자리가 투명한 그림 위에 물건들이 놓여 있다 */}
      <div ref={fgRef} className="absolute left-0 top-0 origin-top-left" style={{ width: IMG.w, height: IMG.h, willChange: 'transform, opacity' }}>
        {/* 셰이더를 쓸 수 있으면 하늘·바다가 투명한 앞쪽 그림, 없으면 같은 위치에서 같이 움직이는 전체 그림 한 장(배가 겹쳐 보이지 않는다) */}
        <img src={noGL ? '/bg/deck_q5.webp' : '/bg/deck_q5_fg.webp'} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
        {ORDER.map((v) => {
          const o = OBJECTS[v];
          const on = hovered === v;
          return (
            <img
              key={`obj-${v}`}
              src={o.src}
              alt=""
              aria-hidden
              draggable={false}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className="pointer-events-none absolute max-w-none"
              style={{ left: o.foot[0], top: o.foot[1], height: o.h, transform: `translate(-50%, -100%) scale(${o.flip ? -1 : 1}, 1) scale(${on ? 1.04 : 1})`, transformOrigin: '50% 100%', transition: 'transform 0.4s, filter 0.4s', filter: on ? 'sepia(0.3) saturate(1.2) brightness(1.28) drop-shadow(0 0 14px rgba(255,214,140,0.55))' : 'sepia(0.3) saturate(1.2) brightness(1.02)' }}
            />
          );
        })}
        {/* 난간에 걸린 구명환: 눌러서 챙길 수 있다 (선택과는 별개) */}
        <motion.img
          src="/q5/obj_lifebuoy.webp"
          alt=""
          aria-hidden
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          className="pointer-events-none absolute max-w-none"
          style={{ left: BUOY.foot[0], top: BUOY.foot[1], height: BUOY.h, translateX: '-50%', translateY: '-100%', transformOrigin: '50% 0%', filter: 'sepia(0.25) saturate(1.15) brightness(0.98)' }}
          animate={{ rotate: buoy ? 0 : buoyHover ? [0, 6, -5, 3.5, -2, 0] : 0, scale: buoy ? 0.5 : 1, opacity: buoy ? 0 : 1 }}
          transition={{ rotate: { duration: 1.3, ease: 'easeInOut' }, scale: { duration: 0.5 }, opacity: { duration: 0.6 } }}
        />
        {!buoy && (
          <button
            type="button"
            aria-label="난간에 걸린 구명환을 챙긴다"
            className="absolute cursor-pointer bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
            style={{ left: BUOY.foot[0] - 34, top: BUOY.foot[1] - BUOY.h - 8, width: 68, height: BUOY.h + 16 }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setBuoyHover(true); }}
            onPointerLeave={() => setBuoyHover(false)}
            onFocus={() => setBuoyHover(true)}
            onBlur={() => setBuoyHover(false)}
            onClick={takeBuoy}
          />
        )}
        {ORDER.map((v) => {
          const sp = SPOTS[v];
          const on = hovered === v;
          return (
            <div key={v}>
              {/* 가만히 있어도 물건 위에 은은한 빛이 맺힌다: 누를 수 있는 곳이라는 힌트 */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute rounded-full"
                style={{ left: sp.ax - 70, top: sp.ay - 70, width: 140, height: 140, background: 'radial-gradient(circle, rgba(255,226,160,0.55) 0%, rgba(255,200,110,0.18) 40%, rgba(255,200,110,0) 70%)', mixBlendMode: 'screen' }}
                animate={{ opacity: on ? 1 : [0.18, 0.55, 0.18], scale: on ? 1.5 : [0.8, 1.15, 0.8] }}
                transition={on ? { duration: 0.4 } : { duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: ORDER.indexOf(v) * 0.9 }}
              />
              <button
                type="button"
                aria-label={`${NAMES[v]}: ${optionOf(v)?.label ?? ''}`}
                className="absolute cursor-pointer rounded-2xl bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
                style={{ left: sp.x, top: sp.y, width: sp.w, height: sp.h }}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse' && !chosenRef.current) setHovered(v); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !chosenRef.current) setHovered(null); }}
                onFocus={() => { if (!chosenRef.current) setHovered(v); }}
                onBlur={() => { if (!chosenRef.current && lastType.current !== 'touch') setHovered((h) => (h === v ? null : h)); }}
                onClick={() => activate(v)}
              />
            </div>
          );
        })}
      </div>

      {/* 구명환을 챙기면 화면 모서리에 작게 남는다 */}
      <AnimatePresence>
        {buoy && !chosen && (
          <motion.div
            key="buoy-hud"
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute bottom-24 left-4 z-40 flex items-center gap-2 rounded-full border border-amber-200/50 bg-black/60 py-1 pl-1 pr-4 backdrop-blur-sm md:bottom-24"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/q5/obj_lifebuoy.webp" alt="" className="h-9 w-9 object-contain" />
            <span className="text-sm text-amber-100">구명환</span>
          </motion.div>
        )}
        {buoyMsg && (
          <motion.p
            key="buoy-msg"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-1/3 z-40 text-center font-title text-xl text-amber-100"
            style={{ textShadow: '0 2px 14px #000' }}
          >
            난간에서 구명환을 떼어 챙겼다.
          </motion.p>
        )}
      </AnimatePresence>

      {/* 망원경 렌즈 */}
      <AnimatePresence>
        {chosen === 'change' && !reduce && (
          <motion.div
            key="lens"
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0.0] }}
            transition={{ duration: 6.2, times: [0.04, 0.2, 0.82, 1], delay: 0.25 }}
            style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0, rgba(0,0,0,0) 33vmin, rgba(2,4,10,0.96) 35.5vmin)' }}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: '70.6vmin', height: '70.6vmin', boxShadow: 'inset 0 0 0 3px rgba(214,170,90,0.85), inset 0 0 40px rgba(0,0,0,0.6), 0 0 0 5px rgba(120,84,36,0.9)' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 연출 중 떠오르는 한 줄 */}
      <AnimatePresence>
        {chosen && lineOn && (
          <motion.p
            key="line"
            className="pointer-events-none absolute inset-x-0 bottom-[16%] px-6 text-center font-title text-xl text-ivory md:text-3xl"
            style={{ textShadow: '0 2px 16px rgba(0,0,0,0.85)' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
          >
            {LINES[chosen]}
          </motion.p>
        )}
      </AnimatePresence>

      {/* 위쪽: 진행과 질문 */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-slate-950/55 via-slate-950/20 to-transparent px-6 pb-14 pt-12"
        animate={{ opacity: chosen ? 0 : hovered ? 0.4 : 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="flex-1"><ProgressLine /></div>
          {clock && (
            <div className="flex shrink-0 flex-col items-center gap-0.5" aria-hidden>
              <AnalogClock elapsed={clock.elapsed} size={44} sinkMark={clock.mark} />
              <span className="font-numeric text-xs font-bold text-bright-brass [font-variant-numeric:lining-nums]">{wallClock(clock.elapsed)}</span>
            </div>
          )}
        </div>
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.5 }}
          className="mx-auto mt-6 max-w-xl text-2xl font-title font-bold leading-relaxed text-ivory md:text-3xl"
          style={{ textShadow: '0 2px 14px rgba(0,0,0,0.7)' }}
        >
          {question.title}
        </motion.h2>
        {question.subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, delay: 1.4 }}
            className="mx-auto mt-3 max-w-xl text-sm leading-loose text-muted-ivory md:text-base"
            style={{ textShadow: '0 1px 10px rgba(0,0,0,0.8)' }}
          >
            {question.subtitle}
          </motion.p>
        )}
      </motion.div>

      {/* 아래쪽: 올려 둔 물건의 선택지, 좁은 화면에서는 물건으로 이동하는 버튼 */}
      {!chosen && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex flex-col items-center gap-3 px-4">
          <AnimatePresence mode="wait">
            {hoverOpt && (
              <motion.div
                key={hoverOpt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-xl rounded-xl border border-amber-200/25 bg-slate-950/70 px-5 py-4 text-center backdrop-blur-md"
              >
                <p className="font-title text-lg font-bold text-ivory md:text-xl">{hoverOpt.label}</p>
                {hoverOpt.description && <p className="mt-1 text-sm leading-relaxed text-muted-ivory">{hoverOpt.description}</p>}
                {coarse && hovered && (
                  <button type="button" onClick={() => choose(hovered)} className="pointer-events-auto mt-3 rounded-full border border-amber-300/60 bg-amber-300/15 px-5 py-1.5 text-sm text-amber-100">
                    이걸로 정한다
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {(needPan || coarse) && (
            <div className="flex gap-2">
              {ORDER.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { lastType.current = 'touch'; panTo(v); setHovered(v); }}
                  className={`rounded-full border px-4 py-1.5 text-sm backdrop-blur-sm transition-colors ${hovered === v ? 'border-amber-300/80 bg-amber-300/20 text-amber-100' : 'border-white/25 bg-black/40 text-white/80'}`}
                >
                  {NAMES[v]}
                </button>
              ))}
            </div>
          )}
          {!hoverOpt && !needPan && !coarse && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 3, duration: 1.4 }} className="text-sm tracking-widest text-white/70" style={{ textShadow: '0 1px 8px #000' }}>
              갑판 위의 물건을 눌러 보세요
            </motion.p>
          )}
        </div>
      )}

      {/* 뒤로 가기 */}
      {onBack && !chosen && (
        <button onClick={onBack} className="group fixed left-4 top-3 z-50 flex items-center text-slate-300 transition-colors hover:text-amber-300 md:bottom-8 md:left-8 md:top-auto">
          <span className="mr-2 transition-transform group-hover:-translate-x-1">←</span>
          <span className="font-sans text-sm uppercase tracking-widest">Back</span>
        </button>
      )}

      {/* 들어올 때는 어둠에서 서서히 밝아지고, 선택 연출의 끝에서는 어두워지며 다음 장면으로 넘어간다 */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-40 bg-black"
        initial={{ opacity: 1 }}
        animate={chosen ? { opacity: 1 } : { opacity: 0 }}
        transition={chosen ? { duration: reduce ? 0.3 : 1.0, delay: reduce ? 0 : FADE_AT[chosen] } : { duration: 1.4, delay: 0.1 }}
      />

      {/* 37초 이스터에그 연출 */}
      <AnimatePresence>
        {watch && (
          <motion.div
            key="watch37"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
            className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/85 px-8 text-center"
            aria-live="polite"
          >
            <motion.p
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 1.4 }}
              className="font-title text-xl leading-loose text-ivory md:text-2xl"
            >
              당신은 37초 동안 바다를 바라보았습니다.<br />
              <span className="text-base text-muted-ivory md:text-lg">누군가는 같은 시간에 빙산을 보았습니다.</span>
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
