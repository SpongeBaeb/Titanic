'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Question } from '@/data/questions';
import ProgressLine from '@/components/ui/ProgressLine';
import AnalogClock from '@/components/cinematic/AnalogClock';
import { wallClock } from '@/engine/cinematic';
import { scenes } from '@/engine/scenes';
import { cutEngine } from '@/lib/ambience';
import { playGlassRattle, startMurmur, playThud, type Murmur } from '@/lib/synth';

/**
 * Q6 "이상한 소문이 돌기 시작합니다"
 *
 * 1) 항해 내내 깔려 있던 엔진 소리가 뚝 끊기고(정적), 유리잔이 달그락거린다.
 * 2) 어두운 갑판에 사람들이 한 방향(구명정 쪽)으로 흘러가고, 소문이 사람들 사이를 옮겨 다니며 변형된다.
 * 3) 클릭하지 않는다. 군중 속의 한 사람이 되어 움직이고, 한 곳에 머물면 그것이 선택이 된다.
 *    가만히 있으면 군중에 실려 "따라간다"에 닿는다. 거스르려면 힘이 든다.
 *
 * 키보드 1~4 로도 고를 수 있다. 동작 줄이기 설정에서는 카드만 보여 준다.
 */

const IMG = { w: 1918, h: 820 }; // rumor_q6.webp (밤 갑판, 오른쪽에 빙산)
const FLOOR_Y = 455; // 갑판 바닥이 시작되는 높이
const DOOR = { x: 1235, y: 478 }; // 선내로 들어가는 입구(갑판실 왼쪽 끝): 일부 사람들이 이쪽으로 들어간다
const GOAL = DOOR;

/** 갑판 바닥의 오른쪽 끝(난간 안쪽). 이보다 오른쪽은 바다다 */
const xMax = (y: number) => Math.min(1720, 1450 + 0.68 * (y - 450));
/** 걸을 수 있는 곳으로 밀어 넣는다 (왼쪽 위의 환기구 상자와 난간 밖 바다는 제외) */
function walk(x: number, y: number, bottom = BOTTOM): [number, number] {
  const yy = clamp(y, FLOOR_Y + 20, bottom);
  const minX = yy < 580 ? 330 : yy < 720 ? 170 : 40; // 왼쪽 위의 밧줄 통과 상자, 닻감개를 피한다
  return [clamp(x, minX, xMax(yy) - 10), yy];
}

interface Zone { key: string; x: number; y: number; r: number }
/** 등불을 든 승무원이 서 있는 곳: 구역을 앞뒤(원근)로 펼치려고 가운데 앞쪽으로 옮겼다 */
const CREW = { x: 760, y: 690 };
const ZONES: Zone[] = [
  { key: 'check_crew', x: CREW.x, y: CREW.y, r: 120 }, // 갑판 가운데, 등불을 든 승무원
  { key: 'check_escape', x: 450, y: 545, r: 100 }, // 구명정 쪽 (구명조끼와 탈출 경로)
  { key: 'calm_others', x: 1380, y: 730, r: 125 }, // 갑판 왼쪽 아래, 웅크린 사람들
  { key: 'follow_crowd', x: DOOR.x, y: DOOR.y + 12, r: 105 }, // 선내로 들어가는 사람들을 따라간다
];
/** 구명환을 챙겨 든 사람에게 군중이 하는 말 */
const BUOY_QUIPS = ['벌써부터 구명환이라니?', '그건 수영장에서나 쓰는 거요.', '농담이죠? 구명환이라니.', '신중한 분이시군.', '저런 건 어디서 났대요?', '혹시 뭔가 아는 거 아니오?'];
/** 바닥 구역 위에 항상 떠 있는 짧은 이름 */
const SHORT: Record<string, string> = {
  calm_others: '진정시키기',
  check_crew: '선원에게',
  check_escape: '탈출 경로',
  follow_crowd: '군중 따라가기',
};
const DWELL = 1.8;

/**
 * 군중의 혼잣말. 1912년 4월 14일 일요일 밤, 충돌 직후 갑판의 분위기를 담았다.
 * 아직 아무도 침몰을 믿지 않는다: 엔진이 멎었고, 앞 갑판에 얼음 조각이 떨어졌고, 바다는 거울처럼 고요하다.
 * 악단은 아직 갑판에서 연주하지 않는다(구명정을 내리기 시작할 즈음에야 연주를 시작했다).
 */
const CHATTER: string[] = [
  // 일등석 신사 숙녀
  '브리지 게임이나 마저 끝냅시다.',
  '얼음? 위스키에 넣을 건 이미 있소.',
  '선장이 알아서 하겠지.',
  '화이트 스타 라인이 이럴 리 없소.',
  '내일 뉴욕 신문엔 뭐라고 실릴까.',
  '내 시가가 꺼졌군. 배가 멈추다니.',
  '실내화 차림으로 나오고 말았어요.',
  '모피 코트를 챙겼어야 했는데.',
  '여보, 먼저 들어가 주무세요.',
  '내 개는 어디 있지?',
  '흡연실 친구들은 아직 카드를 친다더군.',
  '무선 전신이 있으니 걱정 마시오.',
  // 이등석, 삼등석, 아이들
  '일요일 밤인데 찬송가나 부를까.',
  '계단 문이 잠겨 있어요!',
  '아메리카까지 이 년을 모았는데…',
  '엄마, 갑판에 얼음이 있어!',
  '아가야, 엄마 손 놓지 마.',
  '애들 외투부터 입혀요.',
  '엄마, 오늘은 안 자도 돼요?',
  '아래층은 벌써 물이 찼대요.',
  // 승무원
  '신사 숙녀 여러분, 선실로 돌아가 주십시오.',
  '곧 지시가 있을 겁니다. 침착하세요.',
  '저도 아는 게 없습니다, 손님.',
  // 재치
  '얼음 조각이 공짜 기념품이래.',
  '악단이 연주하면 마음이 놓일 텐데.',
  '이 배는 가라앉지 않는다더니.',
  '구명정 훈련은 한 번도 없었지.',
  '수영 못하는 사람이 나만은 아니겠지.',
  '짐은 어쩌지? 기념품이 가방에…',
  '하느님도 이 배는 못 가라앉힌다던데.',
  '올림픽호가 곧 올 거요.',
  // 심오
  '바다는 우리 계획을 모른다.',
  '어떤 배든 바다 앞에선 나뭇조각이지.',
  '엔진이 멎으니 파도 소리가 들리네.',
  '별은 참 맑은데.',
  '고요가 더 무섭군.',
  '바다가 거울 같아. 너무 고요해.',
  '공기가 유난히 차가워.',
  '위기가 되어야 제 모습이 나오지.',
  '한 시간 전만 해도 음악을 들었는데.',
  '내가 지키려던 건 무엇이었더라.',
  '이 밤을 평생 말하게 될 거야. 살아서라면.',
  '내일은 오기는 하는 걸까.',
]; // 한 구역에 이만큼 머물면 선택된다(초)

// 소문이 퍼지며 바뀌는 말 (문구는 초안)
const RUMORS = [
  '빙산이래.',
  '뭔가 긁고 지나갔대.',
  '배가 부딪혔대.',
  '별일 아니래, 곧 출발한대.',
  '앞 갑판에 얼음이 쌓였대.',
  '물이 들어온대.',
  '화물칸이 잠겼대.',
  '구명정이 모자란대.',
  '선장은 이미 알고 있었대.',
  '올림픽호가 오고 있대.',
];

/**
 * 원근: 난간 기둥을 기준으로 삼는다. crash.webp 에서 난간 기둥의 높이는 바닥에 닿는 y 가 내려갈수록 거의 일정한 비율로
 * 커진다(대략 (y-520)*0.79: 먼 끝 y≈545 에서 30px, y≈750 에서 190px, y≈1010 에서 370px). 사람은 난간(약 1m)보다 크므로
 * 키는 같은 y 의 난간 높이에 비례해 (y-495) 로 잡는다. 화면 가까이(아래)일수록 훨씬 크고, 멀수록 작아진다.
 */
const personH = (y: number) => Math.max(36, 0.49 * y - 170);
/** 예전 기준(키 110px)에 대한 배율: 걸음 속도, 간격 같은 값에 곱한다 */
const depth = (y: number) => personH(y) / 110;
/** 구역 표시(바닥의 원)와 이름 글자 크기에 쓰는 완만한 배율 */
const zs = (y: number) => Math.min(1.3, Math.max(0.6, personH(y) / 200));
/** 사람이 서 있을 수 있는 가장 아래쪽 (이보다 아래는 너무 커진다) */
const BOTTOM = 795;
/** 부딪혀 쓰러진 사람들이 하는 말 */
const OUCH = [
  '아야!', '밀지 마세요!', '조심해요!', '어디 보고 다니는 거요!', '제발 진정해요!', '내 모자!', '아이가 있어요!', '무슨 짓이오!',
  '왜 뛰는 거요?', '아이고 허리야…', '이러다 다 넘어져요!', '다들 침착해요!',
  '신사한테 이게 무슨 짓이오!', '내 안경! 내 안경!', '숙녀가 있소, 조심하시오!', '런던에서 산 모자인데…', '이런 무례한 사람 같으니!',
  '아이가 밟히겠어요!', '손목시계가!', '아직 배가 가라앉은 것도 아닌데!', '뛰면 더 위험해요!', '어이쿠, 바닥이 얼음이네!', '진주 목걸이가!',
];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface Agent {
  x: number; y: number; vx: number; vy: number;
  speed: number; phase: number; kind: number; // kind: 0 남자 1 여자 2 중절모 3 아이
  mill: boolean; tx: number; ty: number; a: number; wait: number; enter: boolean; sp: number;
  down: number; downT: number; dir: number; say: string; sayT: number; delay: number; fs: number;
}
interface Phrase { agent: number; text: string; gen: number; age: number; life: number; src: number; chat?: boolean }

function figure(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, phase: number, kind: number, rim: string, body = '#07090f') {
  const bob = Math.abs(Math.sin(phase)) * h * 0.012;
  const by = y - bob;
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.01, h * 0.18, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  const draw = (dx: number, color: string) => {
    ctx.fillStyle = color;
    const w = kind === 1 ? 0.27 : 0.21;
    // 몸통(코트)
    ctx.beginPath();
    ctx.moveTo(x + dx - h * 0.15, by - h * 0.78);
    ctx.quadraticCurveTo(x + dx, by - h * 0.84, x + dx + h * 0.15, by - h * 0.78);
    ctx.lineTo(x + dx + h * w, by - h * 0.06);
    ctx.lineTo(x + dx - h * w, by - h * 0.06);
    ctx.closePath();
    ctx.fill();
    // 다리
    ctx.fillRect(x + dx - h * 0.09, by - h * 0.07, h * 0.07, h * 0.07);
    ctx.fillRect(x + dx + h * 0.02, by - h * 0.07, h * 0.07, h * 0.07);
    // 머리
    ctx.beginPath();
    ctx.arc(x + dx, by - h * 0.9, h * (kind === 3 ? 0.085 : 0.07), 0, Math.PI * 2);
    ctx.fill();
    if (kind === 2) ctx.fillRect(x + dx - h * 0.075, by - h * 0.99, h * 0.15, h * 0.05); // 중절모
    if (kind === 1) { ctx.beginPath(); ctx.ellipse(x + dx, by - h * 0.95, h * 0.1, h * 0.03, 0, 0, Math.PI * 2); ctx.fill(); } // 챙 넓은 모자
  };
  draw(-h * 0.018, rim); // 왼쪽에서 비치는 가장자리 빛
  draw(0, body);
}

interface RumorViewProps {
  question: Question;
  onAnswer: (value: string) => void;
  extras?: Record<string, unknown>;
  onBack?: () => void;
}

export default function RumorView({ question, onAnswer, onBack, extras }: RumorViewProps) {
  const buoyRef = useRef(false); // Q5 에서 구명환을 챙겼는지
  buoyRef.current = !!extras?.lifebuoy;
  const reduce = !!useReducedMotion();
  const [active, setActive] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(reduce);
  const [chosen, setChosen] = useState<string | null>(null);
  const [title, setTitle] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null); // 지금 올라서 있는 구역
  const focusRef = useRef<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const answered = useRef(false);
  const chosenRef = useRef<{ key: string; at: number } | null>(null);
  const activeRef = useRef(false);
  const sizeRef = useRef({ vw: 1280, vh: 720, dpr: 1 });
  const target = useRef({ x: 960, y: 740 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const choose = useCallback((key: string) => {
    if (answered.current) return;
    answered.current = true;
    setChosen(key);
    chosenRef.current = { key, at: performance.now() };
    playThud();
    timers.current.push(setTimeout(() => onAnswer(key), reduce ? 350 : 2000));
  }, [onAnswer, reduce]);

  // 키보드 1~4: 언제든 직접 고를 수 있다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < question.options.length) choose(question.options[i].value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, choose]);

  // ── 타임라인: 제목 → 엔진 끊김 → 유리잔 → 정적 → 웅성거림 → 조작 가능 ──
  useEffect(() => {
    if (reduce) {
      cutEngine();
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    at(1500, () => setTitle(true));
    at(3000, () => cutEngine());
    at(3400, () => playGlassRattle());
    at(6000, () => { activeRef.current = true; setActive(true); });
    return undefined;
  }, [reduce]);

  // ── 캔버스: 갑판, 군중, 소문, 나 ──
  useEffect(() => {
    if (reduce) return;
    const root = rootRef.current;
    const cv = cvRef.current;
    if (!root || !cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const bg = new Image();
    bg.src = '/bg/rumor_q6.webp';
    const loadImg = (src: string) => { const i = new Image(); i.src = src; return i; };
    const buoyImg = loadImg('/q5/obj_lifebuoy.webp');
    const crowdImgs = Array.from({ length: 8 }, (_, k) => loadImg(`/q6/crowd_${k}.webp`));
    const officerImg = loadImg('/q6/officer_lantern.webp');
    const huddleImgs = [loadImg('/q6/huddle_0.webp'), loadImg('/q6/huddle_1.webp')];
    const doorImg = loadImg('/q6/deck_door.webp');
    // 쓰러진 사람 그림(선택): q6/fall_0~3.webp 가 있으면 쓰러져 누운 동안 이 그림을 쓰고, 없으면 서 있는 그림을 기울여 쓴다
    const fallImgs = [0, 1, 2, 3].map((k) => loadImg(`/q6/fall_${k}.webp`));
    const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;
    // 군중 그림은 모두 같은 비율로 줄여 두었다(키 차이가 그대로 남는다). 가장 큰 그림의 높이를 기준으로 맞춘다
    const CROWD_REF = 380;
    /** 발 위치(x, y)를 기준으로 그림을 그린다. h 는 월드 높이, flip 이면 왼쪽을 본다 */
    const sprite = (im: HTMLImageElement, x: number, y: number, h: number, flip = false, sway = 0, glowC?: string) => {
      const w = h * (im.naturalWidth / im.naturalHeight);
      ctx.save();
      ctx.translate(x, y);
      if (sway) ctx.rotate(sway);
      if (flip) ctx.scale(-1, 1);
      if (glowC) { ctx.shadowColor = glowC; ctx.shadowBlur = 26; }
      ctx.drawImage(im, -w / 2, -h, w, h);
      ctx.restore();
    };

    const fit = () => {
      const r = root.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      sizeRef.current = { vw: r.width, vh: r.height, dpr };
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);

    const small = window.innerWidth < 700;
    const COUNT = small ? 26 : 50; // 배경이 넓어졌으니 군중을 다시 늘린다 (쓰러뜨리는 맛). 내 자리 고리와 구역 빛기둥이 있어 사람이 많아도 찾을 수 있다
    const pick = (): [number, number] => walk(300 + Math.random() * 1200, FLOOR_Y + 60 + Math.random() * (BOTTOM - FLOOR_Y - 90));
    const spawn = (anywhere: boolean): Agent => {
      let x: number; let y: number;
      if (anywhere) { [x, y] = pick(); }
      else { y = BOTTOM + 30; x = 300 + Math.random() * 1200; }
      // 대부분은 갑판에서 서성이고, 일부만 선내로 들어간다 (충돌 직후에는 구명정으로 달려가지 않았다)
      const mill = Math.random() < 0.7;
      const [tx, ty] = mill ? pick() : [DOOR.x, DOOR.y];
      return {
        x, y, vx: 0, vy: 0, speed: mill ? 24 + Math.random() * 18 : 48 + Math.random() * 26, phase: Math.random() * 6.28,
        kind: Math.floor(Math.random() * 4), sp: Math.floor(Math.random() * 8), mill, tx, ty, a: anywhere ? 1 : 0, wait: Math.random() * 3, enter: false,
        down: 0, downT: 0, dir: 1, say: '', sayT: 0, delay: 0, fs: 0,
      };
    };
    const agents: Agent[] = Array.from({ length: COUNT }, () => spawn(true));
    const phrases: Phrase[] = [];
    const me = { x: 960, y: 740, phase: 0, moving: 0 };
    // 빨리 움직여서 사람들에게 부딪히면 쓰러지고 한마디 한다. 여러 명이 연달아 쓰러지면 주변 군중이 줄줄이 넘어진다.
    const knocks: number[] = [];
    let waveCool = 0;
    let officerSay: { text: string; until: number } | null = null;
    let lastThud = 0;
    const knock = (a: Agent, dxFromMe: number, now: number) => {
      if (a.down > 0 || a.enter) return;
      a.down = a.downT = 1.8;
      a.dir = dxFromMe >= 0 ? 1 : -1;
      a.vx = a.dir * personH(a.y) * 1.6;
      a.vy = (Math.random() - 0.5) * personH(a.y) * 0.5;
      a.fs = Math.floor(Math.random() * 4);
      a.say = OUCH[Math.floor(Math.random() * OUCH.length)];
      a.sayT = 2.3;
      if (now - lastThud > 220) { lastThud = now; playThud(); }
    };
    const cam = { ox: 0 };
    const dwell: Record<string, number> = {};
    if (process.env.NODE_ENV === 'development') (window as unknown as { __rumor?: unknown }).__rumor = { me, dwell, target, agents };
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    let murmur: Murmur | null = null;
    let murmurTried = false;
    let lastMoveAt = performance.now();
    let phraseTimer = 0;
    let rumorIdx = 0;
    // 구명환을 들고 있으면 사람들이 한마디씩 한다
    const chatterAll = buoyRef.current ? [...CHATTER, ...BUOY_QUIPS, ...BUOY_QUIPS] : CHATTER;
    let chatTimer = 0;
    let chatBag: number[] = [];

    const mutate = (text: string, gen: number): string => {
      const r = Math.random();
      if (r < 0.34 && text.length > 4) return text.slice(0, Math.max(3, text.length - 3 - Math.floor(Math.random() * 3))) + '…';
      if (r < 0.62) return RUMORS[Math.min(RUMORS.length - 1, Math.floor(gen / 1.4) + Math.floor(Math.random() * 2))];
      return text;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const e = (now - t0) / 1000;
      const { vw, vh, dpr } = sizeRef.current;
      const s = Math.max(vw / IMG.w, vh / IMG.h);
      const W = IMG.w * s;
      const ch = chosenRef.current;
      const ce = ch ? (now - ch.at) / 1000 : 0;

      // 카메라: 좌우로 넓은 그림이 화면보다 클 때 내 위치를 따라간다
      const goalOx = W > vw ? clamp(vw / 2 - me.x * s, vw - W, 0) : (vw - W) / 2;
      cam.ox += (goalOx - cam.ox) * Math.min(1, dt * 3);
      const oy = (vh - IMG.h * s) / 2;
      // 선택 후에는 고른 곳으로 파고든다
      const zone = ch ? ZONES.find((z) => z.key === ch.key) : undefined;
      const z = zone ? 1 + 0.35 * Math.min(1, ce / 1.6) * Math.min(1, ce / 1.6) : 1;
      const cx = zone ? zone.x : IMG.w / 2;
      const cy = zone ? zone.y : IMG.h / 2;
      const A = s * z;
      const E = cx * (1 - z) * s + cam.ox;
      const F = cy * (1 - z) * s + oy;
      const toWorld = (px: number, py: number) => ({ x: (px - E) / A, y: (py - F) / A });
      void toWorld;

      // ── 갱신 ──
      const crowdA = clamp((e - 4.4) / 1.4, 0, 1); // 정적 뒤 군중이 나타난다
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        if (a.sayT > 0) a.sayT -= dt;
        if (a.delay > 0) { a.delay -= dt; if (a.delay <= 0) knock(a, a.x - me.x, now); }
        if (a.down > 0) {
          // 쓰러져 있는 동안: 밀려난 방향으로 미끄러지다가 멈추고, 마지막에 일어난다
          a.down -= dt;
          a.x += a.vx * dt; a.y += a.vy * dt;
          a.vx *= Math.max(0, 1 - dt * 4); a.vy *= Math.max(0, 1 - dt * 4);
          const [wx, wy] = walk(a.x, a.y, BOTTOM + 80); a.x = wx; a.y = wy;
          continue;
        }
        if (a.enter) a.a -= dt * 1.4; else a.a = Math.min(crowdA, a.a + dt * 0.8);
        let dx = a.tx - a.x; let dy = a.ty - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        dx /= dist; dy /= dist;
        // 이웃과 거리 유지
        let sx = 0; let sy = 0;
        const rad = 42 * depth(a.y);
        for (let j = 0; j < agents.length; j++) {
          if (i === j) continue;
          const b = agents[j];
          const ddx = a.x - b.x; const ddy = (a.y - b.y) * 1.6;
          const dd = Math.hypot(ddx, ddy);
          if (dd < rad && dd > 0.01) { sx += (ddx / dd) * (1 - dd / rad); sy += (ddy / dd) * (1 - dd / rad); }
        }
        const sp = a.speed * depth(a.y) * (e < 4.4 || a.wait > 0 ? 0 : 1);
        if (a.wait > 0) a.wait -= dt;
        a.vx += ((dx + sx * 0.9) * sp - a.vx) * Math.min(1, dt * 2.2);
        a.vy += ((dy + sy * 0.9) * sp * 0.6 - a.vy) * Math.min(1, dt * 2.2);
        a.x += a.vx * dt; a.y += a.vy * dt;
        a.phase += dt * (3 + Math.hypot(a.vx, a.vy) * 0.03);
        if (a.y <= BOTTOM + 70) { const [wx, wy] = walk(a.x, a.y, BOTTOM + 80); a.x = wx; a.y = wy; }
        if (a.mill && dist < 30) { [a.tx, a.ty] = pick(); a.wait = 1 + Math.random() * 3.5; }
        if (!a.mill && !a.enter && dist < 40) a.enter = true; // 입구에 닿으면 안으로 들어간다
        if (a.enter && a.a <= 0) Object.assign(a, spawn(false));
      }

      // 나: 마우스(터치)를 따라가지만 군중에 휩쓸린다
      const tgt = target.current;
      let density = 0;
      // 밀도: 몸 크기 안에 닿아 있는 사람 수 (원근으로 사람이 커졌으니 반경도 키에 맞춘다)
      for (const a of agents) if (Math.hypot(a.x - me.x, (a.y - me.y) * 1.4) < 0.5 * personH(me.y)) density++;
      const fdx = GOAL.x - me.x; const fdy = GOAL.y - me.y; const fd = Math.hypot(fdx, fdy) || 1;
      const push = activeRef.current && !ch ? 60 * Math.min(1, density / 7) : 0;
      // 군중 속에서 가만히 있으면 커서 자체가 흐름에 실려 간다. 움직이는 동안에는 거스를 수 있지만 힘이 든다.
      if (push > 0 && now - lastMoveAt > 900) { tgt.x += (fdx / fd) * push * 1.4 * dt; tgt.y += (fdy / fd) * push * 1.4 * dt * 0.6; }
      const pullK = (3.4 / (1 + density * 0.12)) * (buoyRef.current ? 0.8 : 1); // 구명환을 들고 있으면 조금 느리다
      const mx = me.x; const my = me.y;
      me.x += (tgt.x - me.x) * Math.min(1, dt * pullK) + (fdx / fd) * push * dt;
      me.y += (tgt.y - me.y) * Math.min(1, dt * pullK) + (fdy / fd) * push * dt * 0.6;
      [me.x, me.y] = walk(me.x, me.y);
      const sp = Math.hypot(me.x - mx, me.y - my) / Math.max(dt, 0.001);
      me.moving = sp;
      me.phase += dt * (2 + Math.min(8, sp * 0.04));

      // 달려서 부딪히면: 키의 1.4배/초 이상(군중 속에서 서두르는 속도)으로 사람에게 닿으면 그 사람이 쓰러진다
      if (activeRef.current && !ch && sp > personH(me.y) * 1.4) {
        for (const a of agents) {
          if (a.down > 0 || a.delay > 0 || a.a < 0.5 || a.enter) continue;
          const ddx = a.x - me.x; const ddy = (a.y - me.y) * 1.5; const rr = personH(Math.max(a.y, me.y)) * 0.3;
          if (ddx * ddx + ddy * ddy < rr * rr) { knock(a, ddx, now); knocks.push(now); }
        }
      }
      while (knocks.length && now - knocks[0] > 5000) knocks.shift();
      if (waveCool > 0) waveCool -= dt;
      if (knocks.length >= 5 && waveCool <= 0) {
        // 연달아 여러 명이 쓰러지면 주변 사람들이 줄줄이 넘어진다
        waveCool = 6;
        knocks.length = 0;
        for (const a of agents) {
          if (a.down > 0 || a.enter || a.a < 0.4) continue;
          const dd = Math.hypot(a.x - me.x, (a.y - me.y) * 1.5);
          // 부딪힌 자리 근처(키의 1.3배 안)에서 대부분만 넘어진다: 군중 전체가 한꺼번에 쓰러지지는 않는다
          if (dd < personH(me.y) * 1.3 && Math.random() < 0.75) a.delay = 0.12 + dd / 900 + Math.random() * 0.2;
        }
        officerSay = { text: '거기 당신! 뛰지 마시오!', until: now + 2800 };
      }

      // 구역에 머무르기
      let nearest: Zone | null = null; let nearD = 1e9;
      for (const zn of ZONES) {
        const d = Math.hypot(me.x - zn.x, (me.y - zn.y) * 1.8);
        const r = zn.r * zs(zn.y);
        const inside = d < r;
        dwell[zn.key] = inside && activeRef.current && !ch ? (dwell[zn.key] ?? 0) + dt : Math.max(0, (dwell[zn.key] ?? 0) - dt * 1.6);
        if (d < nearD) { nearD = d; nearest = zn; }
        if (dwell[zn.key] >= DWELL && !ch) choose(zn.key);
      }

      // 소문: 사람에서 사람으로 옮겨 가며 변한다
      phraseTimer += dt;
      const visible = e > 5.2;
      if (visible && phraseTimer > 2.1 && agents.length) {
        phraseTimer = 0;
        const gen = (e - 5.2) / 4;
        if (phrases.filter((q) => !q.chat).length < 8) {
          const ai = Math.floor(Math.random() * agents.length);
          phrases.push({ agent: ai, text: RUMORS[Math.min(RUMORS.length - 1, rumorIdx++ % 3 + Math.floor(gen / 3))], gen: 0, age: 0, life: 7, src: ai });
        }
        // 가까운 사람에게 전달되며 변형
        const rumorsOnly = phrases.filter((q) => !q.chat);
        const p = rumorsOnly[Math.floor(Math.random() * rumorsOnly.length)];
        if (p) {
          const from = agents[p.agent];
          let best = -1; let bd = 1e9;
          for (let k = 0; k < agents.length; k++) {
            if (k === p.agent) continue;
            const d = Math.hypot(agents[k].x - from.x, agents[k].y - from.y);
            if (d < bd && d < 220) { bd = d; best = k; }
          }
          if (best >= 0) { p.agent = best; p.gen += 1; p.text = mutate(p.text, p.gen + gen); p.age = Math.max(0, p.age - 1.2); }
        }
      }
      // 혼잣말: 내 가까이 있는 사람이 더 자주 말한다. 같은 말은 한 바퀴 돌 때까지 반복하지 않는다
      chatTimer += dt;
      if (e > 6 && chatTimer > 1.5 && phrases.filter((q) => q.chat).length < 3) {
        chatTimer = 0;
        const talking = new Set(phrases.map((q) => q.agent));
        const cands = agents.map((_, k) => k).filter((k) => !talking.has(k) && agents[k].down <= 0 && agents[k].a > 0.8 && Math.abs(agents[k].x - me.x) < 760);
        if (cands.length) {
          cands.sort((k1, k2) => Math.hypot(agents[k1].x - me.x, agents[k1].y - me.y) - Math.hypot(agents[k2].x - me.x, agents[k2].y - me.y));
          const ai = cands[Math.floor(Math.pow(Math.random(), 1.6) * cands.length)];
          if (!chatBag.length) chatBag = chatterAll.map((_, k) => k).sort(() => Math.random() - 0.5);
          phrases.push({ agent: ai, text: chatterAll[chatBag.pop() as number], gen: 0, age: 0, life: 5.2, src: ai, chat: true });
        }
      }
      for (let i = phrases.length - 1; i >= 0; i--) { phrases[i].age += dt; if (phrases[i].age > phrases[i].life) phrases.splice(i, 1); }

      // 웅성거림: 가장 가까운 소문 쪽으로 커지고 기운다
      if (e > 5 && !murmurTried) { murmurTried = true; murmur = startMurmur(); }
      if (murmur) {
        let near = 1e9; let px = 0;
        for (const p of phrases) { const a = agents[p.agent]; const d = Math.hypot(a.x - me.x, a.y - me.y); if (d < near) { near = d; px = a.x - me.x; } }
        murmur.level(ch ? 0.2 : clamp(0.35 + 0.65 * (1 - near / 700), 0.3, 1) * clamp((e - 5) / 3, 0, 1));
        murmur.pan(clamp(px / 600, -1, 1));
      }

      // ── 그리기 ──
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#04070d';
      ctx.fillRect(0, 0, vw, vh);
      ctx.setTransform(dpr * A, 0, 0, dpr * A, dpr * E, dpr * F);
      if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0, IMG.w, IMG.h);
      ctx.fillStyle = 'rgba(4,6,14,0.12)';
      ctx.fillRect(0, 0, IMG.w, IMG.h);

      // 바닥 등불의 빛
      const glow = (gx: number, gy: number, r: number, a: number, c = '255,190,110') => {
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        g.addColorStop(0, `rgba(${c},${a})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
      };
      ctx.globalCompositeOperation = 'lighter';
      glow(CREW.x, CREW.y - 55, 190, 0.28 * crowdA); // 승무원의 등불
      glow(DOOR.x, DOOR.y - 50, 170, 0.34 * crowdA); // 선내로 들어가는 문의 빛
      glow(330, 850, 130, 0.08 * crowdA);
      ctx.globalCompositeOperation = 'source-over';

      // 구역 표시: 바닥에 은은한 원. 가까이 가면 또렷해지고 머문 만큼 차오른다
      if (crowdA > 0.4) {
        for (const zn of ZONES) {
          const dz = zs(zn.y);
          const near = nearest === zn ? clamp(1 - nearD / (zn.r * dz * 3), 0, 1) : 0;
          const prog = clamp((dwell[zn.key] ?? 0) / DWELL, 0, 1);
          ctx.lineWidth = 3.4;
          ctx.strokeStyle = `rgba(255,214,150,${0.38 + near * 0.5})`;
          ctx.beginPath();
          ctx.ellipse(zn.x, zn.y + 6, zn.r * dz, zn.r * dz * 0.36, 0, 0, Math.PI * 2);
          ctx.stroke();
          // 바닥에서 솟는 빛기둥: 사람들 사이에서도 구역이 어디인지 멀리서 보인다
          {
            const ph = personH(zn.y) * 1.8;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(zn.x, zn.y - ph * 0.42);
            ctx.scale(0.3, 1);
            const gp = ctx.createRadialGradient(0, 0, 0, 0, 0, ph * 0.6);
            gp.addColorStop(0, `rgba(255,222,160,${0.30 + near * 0.25})`);
            gp.addColorStop(1, 'rgba(255,222,160,0)');
            ctx.fillStyle = gp;
            ctx.fillRect(-ph * 0.6, -ph * 0.6, ph * 1.2, ph * 1.2);
            ctx.restore();
          }
          if (prog > 0) {
            ctx.lineWidth = 4.5;
            ctx.strokeStyle = 'rgba(255,226,170,0.95)';
            ctx.beginPath();
            ctx.ellipse(zn.x, zn.y + 6, zn.r * dz, zn.r * dz * 0.36, -Math.PI / 2, 0, Math.PI * 2 * prog);
            ctx.stroke();
          }
        }
      }

      // 내 자리: 발 밑에 맥박 치는 금빛 고리 (사람들 사이에서 어디 있는지 알 수 있게)
      if (crowdA > 0.4) {
        const pr = personH(me.y) * 0.46;
        const pulseR = 1 + 0.08 * Math.sin(e * 4.2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gg = ctx.createRadialGradient(me.x, me.y + 6, 0, me.x, me.y + 6, pr * 1.5);
        gg.addColorStop(0, 'rgba(255,226,150,0.34)');
        gg.addColorStop(1, 'rgba(255,226,150,0)');
        ctx.translate(0, 0);
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.ellipse(me.x, me.y + 6, pr * 1.5, pr * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = `rgba(255,232,170,${0.8 + 0.2 * Math.sin(e * 4.2)})`;
        ctx.beginPath();
        ctx.ellipse(me.x, me.y + 6, pr * pulseR, pr * pulseR * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 선내로 들어가는 문: 갑판실 왼쪽 끝에서 따뜻한 빛이 새어 나온다
      if (ready(doorImg)) {
        const dd = depth(DOOR.y);
        ctx.globalAlpha = crowdA;
        sprite(doorImg, DOOR.x, DOOR.y + 10, personH(DOOR.y) * 1.45);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        const sp0 = ctx.createRadialGradient(DOOR.x, DOOR.y + 14, 0, DOOR.x, DOOR.y + 14, 120);
        sp0.addColorStop(0, `rgba(255,180,100,${0.3 * crowdA})`);
        sp0.addColorStop(1, 'rgba(255,180,100,0)');
        ctx.fillStyle = sp0;
        ctx.fillRect(DOOR.x - 120, DOOR.y - 106, 240, 240);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const dd = depth(DOOR.y);
        const dw = 60 * dd * 1.2; const dh = 118 * dd * 1.2;
        const gx = DOOR.x - dw / 2; const gy = DOOR.y - dh;
        const g2 = ctx.createLinearGradient(0, gy, 0, gy + dh);
        g2.addColorStop(0, `rgba(255,210,140,${0.55 * crowdA})`);
        g2.addColorStop(1, `rgba(255,170,90,${0.9 * crowdA})`);
        ctx.fillStyle = g2;
        ctx.fillRect(gx, gy, dw, dh);
        ctx.strokeStyle = `rgba(30,18,10,${0.85 * crowdA})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(gx, gy, dw, dh);
        ctx.globalCompositeOperation = 'lighter';
        const sp = ctx.createRadialGradient(DOOR.x, DOOR.y + 14, 0, DOOR.x, DOOR.y + 14, 120);
        sp.addColorStop(0, `rgba(255,180,100,${0.32 * crowdA})`);
        sp.addColorStop(1, 'rgba(255,180,100,0)');
        ctx.fillStyle = sp;
        ctx.fillRect(DOOR.x - 120, DOOR.y - 106, 240, 240);
        ctx.globalCompositeOperation = 'source-over';
      }

      // 사람들(먼 쪽부터)
      type Item = { y: number; draw: () => void };
      const items: Item[] = [];
      for (const a of agents) {
        if (a.a < 0.02) continue;
        items.push({ y: a.y, draw: () => {
          // 내 앞(아래쪽)에서 나를 가리는 사람은 반투명하게 해서 내가 보이게 한다
          const blocks = a.y > me.y + 8 && Math.abs(a.x - me.x) < personH(a.y) * 0.5 && a.y - me.y < personH(a.y) * 1.1;
          ctx.globalAlpha = a.a * (blocks ? 0.32 : 1);
          const im = crowdImgs[a.sp];
          if (ready(im)) {
            const h = im.naturalHeight * (personH(a.y) / CROWD_REF);
            if (a.down > 0) {
              // 쓰러지는 동작: 0.22초에 넘어지고, 마지막 0.45초에 일어난다
              const t = a.downT - a.down;
              const ease = (v: number) => v * v * (3 - 2 * v);
              const ang = a.dir * 1.46 * ease(Math.min(1, t / 0.22)) * ease(Math.min(1, a.down / 0.45));
              const lying = fallImgs.filter(ready);
              if (lying.length && t > 0.16 && a.down > 0.42) {
                // 누워 있는 그림: 너비가 키의 0.95배가 되도록 맞춘다
                const fi = lying[a.fs % lying.length];
                const lh = fi.naturalHeight * ((personH(a.y) * 0.95) / 500); // 네 장의 몸 길이가 비슷하므로 같은 배율로 맞춘다 (가로 500px 기준)
                sprite(fi, a.x, a.y + 4, lh, a.dir < 0);
              } else sprite(im, a.x, a.y, h, a.dir < 0, ang);
            } else sprite(im, a.x, a.y - Math.abs(Math.sin(a.phase)) * h * 0.012, h, a.vx < -1, Math.sin(a.phase) * 0.012);
          } else figure(ctx, a.x, a.y, (a.kind === 3 ? 0.6 : 0.93) * personH(a.y), a.phase, a.kind, 'rgba(255,170,90,0.55)');
          ctx.globalAlpha = 1;
          // 쓰러진 사람의 한마디
          if (a.sayT > 0 && a.say) {
            const fs = 22 * clamp(depth(a.y), 0.9, 1.5);
            ctx.font = `700 ${fs}px "Noto Serif KR", "Nanum Myeongjo", serif`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.fillStyle = `rgba(255,236,200,${Math.min(1, a.sayT / 0.5)})`;
            const ty = a.y - personH(a.y) * (a.down > 0 ? 0.55 : 1.15);
            ctx.strokeText(a.say, a.x, ty);
            ctx.fillText(a.say, a.x, ty);
          }
        } });
      }
      // 승무원과 웅크린 사람들(고정)
      items.push({ y: CREW.y, draw: () => {
        ctx.globalAlpha = crowdA;
        if (ready(officerImg)) {
          const h = personH(CREW.y) * 1.0; // 군중과 같은 키 (예전 1.25배는 너무 컸다)
          sprite(officerImg, CREW.x, CREW.y, h);
          // 등불이 일렁인다
          const w = h * (officerImg.naturalWidth / officerImg.naturalHeight);
          const fl = 0.85 + 0.15 * Math.sin(e * 9) * Math.sin(e * 3.7);
          glow(CREW.x + w * 0.26, CREW.y - h * 0.5, 150, 0.4 * fl * crowdA);
        } else figure(ctx, CREW.x, CREW.y, 122 * depth(CREW.y), 0, 2, 'rgba(255,200,120,0.8)', '#0a0d16');
        ctx.globalAlpha = 1;
      } });
      if (ready(huddleImgs[0]) && ready(huddleImgs[1])) {
        const k = (0.8 * personH(735)) / 460; // 웅크린 사람들은 선 사람보다 작게
        items.push({ y: 742, draw: () => { ctx.globalAlpha = crowdA; sprite(huddleImgs[0], 1345, 742, huddleImgs[0].naturalHeight * k); ctx.globalAlpha = 1; } });
        items.push({ y: 734, draw: () => { ctx.globalAlpha = crowdA; sprite(huddleImgs[1], 1450, 734, huddleImgs[1].naturalHeight * k); ctx.globalAlpha = 1; } });
      } else {
        for (const [dx, k, h] of [[-26, 1, 84], [10, 0, 90], [40, 3, 58]] as const) {
          items.push({ y: 735 + dx * 0.02, draw: () => { ctx.globalAlpha = crowdA; figure(ctx, 1380 + dx * 1.6, 735, h * depth(735), 0, k, 'rgba(255,170,90,0.45)'); ctx.globalAlpha = 1; } });
        }
      }
      if (officerSay && now < officerSay.until) {
        const os = officerSay;
        items.push({ y: CREW.y + 1, draw: () => {
          ctx.font = `700 ${26 * clamp(depth(CREW.y), 1, 1.6)}px "Noto Serif KR", "Nanum Myeongjo", serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 6;
          ctx.strokeStyle = 'rgba(0,0,0,0.9)';
          ctx.fillStyle = 'rgba(255,214,150,1)';
          ctx.strokeText(os.text, CREW.x, CREW.y - personH(CREW.y) * 1.45);
          ctx.fillText(os.text, CREW.x, CREW.y - personH(CREW.y) * 1.45);
        } });
      }
      // 나: 따뜻한 윤곽으로 구분한다
      items.push({ y: me.y, draw: () => {
        glow(me.x, me.y - 10, 90, 0.18 * crowdA, '255,225,170');
        ctx.globalAlpha = Math.max(0.0, crowdA);
        const mi = crowdImgs[4]; // 모자를 쓴 젊은이: 따뜻한 빛으로 나를 구분한다
        if (ready(mi)) {
          const h = mi.naturalHeight * ((116 * depth(me.y)) / CROWD_REF);
          const facing = target.current.x < me.x - 4;
          sprite(mi, me.x, me.y - Math.abs(Math.sin(me.phase)) * h * 0.012, h, facing, Math.sin(me.phase) * 0.01, 'rgba(255,226,160,0.95)');
        } else figure(ctx, me.x, me.y, 116 * depth(me.y), me.phase, 2, 'rgba(255,225,160,0.95)', '#0d1018');
        if (buoyRef.current && ready(buoyImg)) {
          const bh = personH(me.y) * 0.5; const bw = buoyImg.naturalWidth * (bh / buoyImg.naturalHeight);
          const facing = target.current.x < me.x - 4;
          ctx.drawImage(buoyImg, me.x + (facing ? -1 : 1) * personH(me.y) * 0.18 - bw / 2, me.y - personH(me.y) * 0.62, bw, bh);
        }
        ctx.globalAlpha = 1;
      } });
      items.sort((p, q) => p.y - q.y).forEach((it) => it.draw());

      // 소문 글자
      ctx.textAlign = 'center';
      for (const p of phrases) {
        const a = agents[p.agent];
        if (!a) continue;
        const dz = depth(a.y);
        const near = clamp(1 - Math.hypot(a.x - me.x, a.y - me.y) / 420, 0, 1);
        const k = clamp(p.age / 0.8, 0, 1) * clamp((p.life - p.age) / 1.2, 0, 1);
        const jit = p.chat ? 0 : Math.min(4, p.gen * 0.9) * (1 - near * 0.6);
        const size = (p.chat ? 20 + near * 8 : 22 + near * 14) * clamp(dz, 0.85, p.chat ? 1.15 : 1.3);
        ctx.font = `600 ${size}px "Noto Serif KR", "Nanum Myeongjo", serif`;
        const tx = a.x; const ty = a.y - personH(a.y) * 1.12 - near * 10;
        for (let c2 = 0; c2 < (p.chat ? 1 : 2); c2++) {
          const ox = (Math.sin(e * 7 + p.src + c2 * 2) * jit) * (c2 ? 1 : -1);
          const oy = Math.cos(e * 5.3 + c2) * jit * 0.6;
          ctx.fillStyle = p.chat ? `rgba(255,236,200,${(0.62 + near * 0.38) * k})` : c2 ? `rgba(220,90,80,${0.35 * k})` : `rgba(240,225,200,${(0.45 + near * 0.5) * k * (c2 ? 0.6 : 1)})`;
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 8;
          ctx.fillText(p.text, tx + ox, ty + oy);
        }
        ctx.shadowBlur = 0;
      }

      // 구역 이름: 항상 떠 있다. 가까이 가면 또렷해지고 번호(키 1~4)가 같이 보인다. 서로 겹치면 위로 밀어낸다.
      if (crowdA > 0.5) {
        type Lab = { zn: Zone; text: string; fs: number; w: number; h: number; x: number; y: number };
        const labs: Lab[] = ZONES.map((zn) => {
          const num = question.options.findIndex((o) => o.value === zn.key) + 1;
          const text = `${num > 0 ? num + '  ' : ''}${SHORT[zn.key] ?? zn.key}`;
          const fs = 24 * clamp(zs(zn.y) + 0.15, 0.9, 1.3);
          ctx.font = `700 ${fs}px "Noto Serif KR", "Nanum Myeongjo", serif`;
          const w = ctx.measureText(text).width + fs * 1.1;
          return { zn, text, fs, w, h: fs * 1.55, x: zn.x, y: zn.y - personH(zn.y) * 1.2 - 26 };
        }).sort((p1, p2) => p1.y - p2.y);
        const placed: Lab[] = [];
        for (const lb of labs) {
          for (let k = 0; k < 6; k++) {
            const hit = placed.find((q) => Math.abs(q.x - lb.x) < (q.w + lb.w) / 2 + 8 && Math.abs(q.y - lb.y) < (q.h + lb.h) / 2 + 4);
            if (!hit) break;
            lb.y = hit.y - (hit.h + lb.h) / 2 - 8;
          }
          placed.push(lb);
        }
        for (const lb of placed) {
          const near = nearest === lb.zn ? clamp(1 - nearD / (lb.zn.r * zs(lb.zn.y) * 3), 0, 1) : 0;
          const al = (0.78 + near * 0.22) * crowdA;
          ctx.font = `700 ${lb.fs}px "Noto Serif KR", "Nanum Myeongjo", serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(8,10,18,${0.66 * al})`;
          ctx.strokeStyle = `rgba(255,214,150,${0.55 * al + near * 0.4})`;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.roundRect(lb.x - lb.w / 2, lb.y - lb.h * 0.72, lb.w, lb.h, lb.h / 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = `rgba(255,238,205,${al})`;
          ctx.fillText(lb.text, lb.x, lb.y + lb.fs * 0.1);
        }
      }

      // 나: 머리 위에 '나' 표시 (모두의 위에 그린다)
      if (crowdA > 0.4) {
        const my = me.y - personH(me.y) * 1.08 - 12 + Math.sin(e * 4.2) * 3;
        const fs = 26 * clamp(depth(me.y), 0.9, 1.5);
        ctx.fillStyle = 'rgba(255,226,150,0.98)';
        ctx.strokeStyle = 'rgba(30,20,0,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(me.x, my + fs * 0.1);
        ctx.lineTo(me.x - fs * 0.5, my - fs * 0.62);
        ctx.lineTo(me.x + fs * 0.5, my - fs * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.font = `800 ${fs}px "Noto Serif KR", "Nanum Myeongjo", serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText('나', me.x, my - fs * 0.78);
        ctx.fillStyle = 'rgba(255,240,190,1)';
        ctx.fillText('나', me.x, my - fs * 0.78);
      }

      // 구역 위에 올라서면 머리 위에 동그라미가 떠서 선택 중임을 알린다 (채워지면 선택된다)
      {
        const cz = ZONES.find((zn) => (dwell[zn.key] ?? 0) > 0.02) ?? (ch ? ZONES.find((zn) => zn.key === ch.key) : undefined);
        const fk = cz && !ch ? cz.key : null;
        if (focusRef.current !== fk) { focusRef.current = fk; setFocusKey(fk); }
        if (cz && crowdA > 0.4) {
          const prog = ch ? 1 : clamp((dwell[cz.key] ?? 0) / DWELL, 0, 1);
          const sc = clamp(depth(me.y), 0.9, 1.5);
          const R = 27 * sc;
          const rx = me.x; const ry = me.y - personH(me.y) * 1.08 - 12 - 26 * sc - R - 14 + Math.sin(e * 4.2) * 3;
          const num = question.options.findIndex((o) => o.value === cz.key) + 1;
          ctx.save();
          ctx.fillStyle = 'rgba(8,10,18,0.78)';
          ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,226,170,0.28)';
          ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 7 * Math.min(1.2, sc); ctx.lineCap = 'round';
          ctx.strokeStyle = prog >= 1 ? 'rgba(255,240,170,1)' : 'rgba(255,214,120,0.98)';
          ctx.shadowColor = 'rgba(255,200,90,0.9)'; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(rx, ry, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.font = `800 ${R * 1.05}px "Noto Serif KR", "Nanum Myeongjo", serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255,240,200,1)';
          ctx.fillText(prog >= 1 ? '✓' : num > 0 ? String(num) : '·', rx, ry + 1);
          ctx.textBaseline = 'alphabetic';
          ctx.restore();
        }
      }

      // 가장자리 어둠과 붉은 맥박(소문의 불안)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
      const pulse = 0.5 + 0.5 * Math.sin(e * 1.6);
      g.addColorStop(0, 'rgba(60,0,0,0)');
      g.addColorStop(1, `rgba(40,0,6,${0.45 + 0.12 * pulse * crowdA})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    };
    raf = requestAnimationFrame(frame);

    // 입력: 마우스는 움직이는 곳으로, 터치는 끌어서
    const world = (px: number, py: number) => {
      const { vw, vh } = sizeRef.current;
      const s = Math.max(vw / IMG.w, vh / IMG.h);
      const W = IMG.w * s;
      const goalOx = W > vw ? clamp(vw / 2 - me.x * s, vw - W, 0) : (vw - W) / 2;
      const ox = cam.ox || goalOx;
      const oy = (vh - IMG.h * s) / 2;
      return { x: (px - ox) / s, y: (py - oy) / s };
    };
    const move = (e: PointerEvent) => {
      if (!activeRef.current || chosenRef.current) return;
      if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return;
      const r = cv.getBoundingClientRect();
      const w = world(e.clientX - r.left, e.clientY - r.top);
      const [wx, wy] = walk(w.x, w.y);
      target.current = { x: wx, y: wy };
      lastMoveAt = performance.now();
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerdown', move);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerdown', move);
      murmur?.stop();
    };
  }, [reduce, question, choose]);

  const clock = scenes[question.id]?.clock;

  return (
    <div ref={rootRef} className="fixed inset-0 h-full w-full select-none overflow-clip bg-[#04070d]">
      {!reduce && <canvas ref={cvRef} aria-hidden className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} />}

      {/* 위쪽: 진행과 제목 */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-slate-950/80 via-slate-950/35 to-transparent px-6 pb-16 pt-12"
        animate={{ opacity: chosen ? 0 : active && !cardsOpen ? 0.5 : 1 }}
        transition={{ duration: 0.8 }}
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
        <AnimatePresence>
          {(title || reduce) && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4 }} className="mx-auto mt-6 max-w-xl">
              <h2 className="text-2xl font-title font-bold leading-relaxed text-danger-text drop-shadow-[0_0_8px_rgba(182,65,53,0.5)] md:text-3xl">{question.title}</h2>
              {question.subtitle && <p className="mt-3 text-sm leading-loose text-muted-ivory md:text-base" style={{ textShadow: '0 1px 10px rgba(0,0,0,0.8)' }}>{question.subtitle}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 아래쪽 안내 */}
      {!reduce && !chosen && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: active && !focusKey ? 0.85 : 0 }}
          transition={{ duration: 1.6, delay: 0.4 }}
          className="pointer-events-none absolute inset-x-0 bottom-16 z-30 px-6 text-center text-sm tracking-wide text-white/80 md:bottom-8"
          style={{ textShadow: '0 1px 10px #000' }}
        >
          군중 속에서 움직여 보세요. 한 곳에 머물면 그곳을 택하게 됩니다.
        </motion.p>
      )}

      {/* 구역에 올라서면 어떤 행동을 하게 되는지 분명히 알려 준다 */}
      <AnimatePresence>
        {!reduce && !chosen && focusKey && (() => {
          const o = question.options.find((q) => q.value === focusKey);
          if (!o) return null;
          const num = question.options.indexOf(o) + 1;
          return (
            <motion.div
              key={focusKey}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-12"
            >
              <div className="max-w-xl rounded-2xl border border-amber-200/60 bg-black/80 px-6 py-4 text-center shadow-[0_0_30px_rgba(255,200,110,0.25)] backdrop-blur-sm">
                <p className="font-title text-lg font-bold text-amber-100 md:text-xl"><span className="mr-2 text-amber-300">{num}</span>{o.label}</p>
                {o.description && <p className="mt-1.5 text-sm leading-relaxed text-muted-ivory md:text-base">{o.description}</p>}
                <p className="mt-2 text-xs tracking-wide text-amber-200/80">이대로 머무르면 이 행동을 하게 됩니다. 벗어나면 취소됩니다.</p>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {cardsOpen && !chosen && (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[35] overflow-y-auto bg-black/80 px-6 pb-24 pt-56 backdrop-blur-sm"
          >
            <div className="mx-auto flex max-w-xl flex-col gap-3">
              {question.options.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => choose(o.value)}
                  className="rounded-xl border border-white/20 bg-white/5 px-5 py-4 text-left transition-colors hover:border-amber-200/70 hover:bg-white/10"
                >
                  <span className="mr-2 text-amber-200/80">{i + 1}</span>
                  <span className="font-title text-lg font-bold text-ivory">{o.label}</span>
                  {o.description && <span className="mt-1 block text-sm text-muted-ivory">{o.description}</span>}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 뒤로 가기 */}
      {onBack && !chosen && (
        <button onClick={onBack} className="group fixed left-4 top-3 z-50 flex items-center text-slate-300 transition-colors hover:text-amber-300 md:bottom-8 md:left-8 md:top-auto">
          <span className="mr-2 transition-transform group-hover:-translate-x-1">←</span>
          <span className="font-sans text-sm uppercase tracking-widest">Back</span>
        </button>
      )}

      {/* 들어올 때는 어둠에서, 선택 뒤에는 어둠으로 */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[45] bg-black"
        initial={{ opacity: 1 }}
        animate={chosen ? { opacity: 1 } : { opacity: 0 }}
        transition={chosen ? { duration: reduce ? 0.3 : 0.9, delay: reduce ? 0 : 1.0 } : { duration: 1.6, delay: 0.1 }}
      />
    </div>
  );
}
