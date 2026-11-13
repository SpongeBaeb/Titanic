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
 * 카드로 고르기(키보드 1~4 포함)는 언제나 쓸 수 있다. 동작 줄이기 설정에서는 카드만 보여 준다.
 */

const IMG = { w: 1920, h: 1047 }; // crash.webp
const FLOOR_Y = 560; // 갑판 바닥이 시작되는 높이
const DOOR = { x: 458, y: 598 }; // 선내로 들어가는 입구(갑판실 왼쪽 끝): 일부 사람들이 이쪽으로 들어간다
const GOAL = DOOR;

/** 갑판 바닥의 오른쪽 끝(난간 안쪽). 이보다 오른쪽은 바다다 */
const xMax = (y: number) => Math.min(1500, 1150 + 0.573 * (y - 600));
/** 걸을 수 있는 곳으로 밀어 넣는다 (왼쪽 위의 환기구 상자와 난간 밖 바다는 제외) */
function walk(x: number, y: number, bottom = IMG.h - 20): [number, number] {
  const yy = clamp(y, FLOOR_Y + 20, bottom);
  const minX = yy < 735 ? 285 : 30;
  return [clamp(x, minX, xMax(yy) - 10), yy];
}

interface Zone { key: string; x: number; y: number; r: number }
const ZONES: Zone[] = [
  { key: 'check_crew', x: 800, y: 735, r: 120 }, // 갑판 가운데, 등불을 든 승무원
  { key: 'check_escape', x: 1040, y: 615, r: 100 }, // 구명정 쪽 (구명조끼와 탈출 경로)
  { key: 'calm_others', x: 330, y: 880, r: 125 }, // 갑판 왼쪽 아래, 웅크린 사람들
  { key: 'follow_crowd', x: DOOR.x, y: DOOR.y + 12, r: 105 }, // 선내로 들어가는 사람들을 따라간다
];
const DWELL = 1.8; // 한 구역에 이만큼 머물면 선택된다(초)

// 소문이 퍼지며 바뀌는 말 (문구는 초안)
const RUMORS = [
  '빙산이래.',
  '배가 부딪혔대.',
  '별일 아니래, 곧 출발한대.',
  '물이 들어온대.',
  '구명정이 모자란대.',
  '선장은 이미 알고 있었대.',
];

const depth = (y: number) => Math.min(1.4, Math.max(0.45, 0.45 + 0.95 * ((y - 540) / (IMG.h - 540))));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface Agent {
  x: number; y: number; vx: number; vy: number;
  speed: number; phase: number; kind: number; // kind: 0 남자 1 여자 2 중절모 3 아이
  mill: boolean; tx: number; ty: number; a: number; wait: number; enter: boolean; sp: number;
}
interface Phrase { agent: number; text: string; gen: number; age: number; life: number; src: number }

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
  onBack?: () => void;
}

export default function RumorView({ question, onAnswer, onBack }: RumorViewProps) {
  const reduce = !!useReducedMotion();
  const [active, setActive] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(reduce);
  const [chosen, setChosen] = useState<string | null>(null);
  const [title, setTitle] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const answered = useRef(false);
  const chosenRef = useRef<{ key: string; at: number } | null>(null);
  const activeRef = useRef(false);
  const sizeRef = useRef({ vw: 1280, vh: 720, dpr: 1 });
  const target = useRef({ x: 900, y: 900 });
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
    bg.src = '/bg/crash.webp';
    const loadImg = (src: string) => { const i = new Image(); i.src = src; return i; };
    const crowdImgs = Array.from({ length: 8 }, (_, k) => loadImg(`/q6/crowd_${k}.webp`));
    const officerImg = loadImg('/q6/officer_lantern.webp');
    const huddleImgs = [loadImg('/q6/huddle_0.webp'), loadImg('/q6/huddle_1.webp')];
    const doorImg = loadImg('/q6/deck_door.webp');
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
    const COUNT = small ? 42 : 76;
    const pick = (): [number, number] => walk(340 + Math.random() * 760, FLOOR_Y + 60 + Math.random() * 420);
    const spawn = (anywhere: boolean): Agent => {
      let x: number; let y: number;
      if (anywhere) { [x, y] = pick(); }
      else { y = IMG.h + 40; x = 250 + Math.random() * 950; }
      // 대부분은 갑판에서 서성이고, 일부만 선내로 들어간다 (충돌 직후에는 구명정으로 달려가지 않았다)
      const mill = Math.random() < 0.7;
      const [tx, ty] = mill ? pick() : [DOOR.x, DOOR.y];
      return {
        x, y, vx: 0, vy: 0, speed: mill ? 24 + Math.random() * 18 : 48 + Math.random() * 26, phase: Math.random() * 6.28,
        kind: Math.floor(Math.random() * 4), sp: Math.floor(Math.random() * 8), mill, tx, ty, a: anywhere ? 1 : 0, wait: Math.random() * 3, enter: false,
      };
    };
    const agents: Agent[] = Array.from({ length: COUNT }, () => spawn(true));
    const phrases: Phrase[] = [];
    const me = { x: 900, y: 930, phase: 0, moving: 0 };
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
        if (a.y <= IMG.h - 10) { const [wx, wy] = walk(a.x, a.y, IMG.h + 50); a.x = wx; a.y = wy; }
        if (a.mill && dist < 30) { [a.tx, a.ty] = pick(); a.wait = 1 + Math.random() * 3.5; }
        if (!a.mill && !a.enter && dist < 40) a.enter = true; // 입구에 닿으면 안으로 들어간다
        if (a.enter && a.a <= 0) Object.assign(a, spawn(false));
      }

      // 나: 마우스(터치)를 따라가지만 군중에 휩쓸린다
      const tgt = target.current;
      let density = 0;
      for (const a of agents) if (Math.hypot(a.x - me.x, (a.y - me.y) * 1.4) < 95 * depth(me.y)) density++;
      const fdx = GOAL.x - me.x; const fdy = GOAL.y - me.y; const fd = Math.hypot(fdx, fdy) || 1;
      const push = activeRef.current && !ch ? 60 * Math.min(1, density / 7) : 0;
      // 군중 속에서 가만히 있으면 커서 자체가 흐름에 실려 간다. 움직이는 동안에는 거스를 수 있지만 힘이 든다.
      if (push > 0 && now - lastMoveAt > 900) { tgt.x += (fdx / fd) * push * 1.4 * dt; tgt.y += (fdy / fd) * push * 1.4 * dt * 0.6; }
      const pullK = 3.4 / (1 + density * 0.12);
      const mx = me.x; const my = me.y;
      me.x += (tgt.x - me.x) * Math.min(1, dt * pullK) + (fdx / fd) * push * dt;
      me.y += (tgt.y - me.y) * Math.min(1, dt * pullK) + (fdy / fd) * push * dt * 0.6;
      [me.x, me.y] = walk(me.x, me.y);
      const sp = Math.hypot(me.x - mx, me.y - my) / Math.max(dt, 0.001);
      me.moving = sp;
      me.phase += dt * (2 + Math.min(8, sp * 0.04));

      // 구역에 머무르기
      let nearest: Zone | null = null; let nearD = 1e9;
      for (const zn of ZONES) {
        const d = Math.hypot(me.x - zn.x, (me.y - zn.y) * 1.8);
        const r = zn.r * depth(zn.y);
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
        if (phrases.length < 10) {
          const ai = Math.floor(Math.random() * agents.length);
          phrases.push({ agent: ai, text: RUMORS[Math.min(RUMORS.length - 1, rumorIdx++ % 3 + Math.floor(gen / 3))], gen: 0, age: 0, life: 7, src: ai });
        }
        // 가까운 사람에게 전달되며 변형
        const p = phrases[Math.floor(Math.random() * phrases.length)];
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
      ctx.fillStyle = 'rgba(4,6,14,0.34)';
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
      glow(800, 680, 190, 0.28 * crowdA); // 승무원의 등불
      glow(DOOR.x, DOOR.y - 50, 170, 0.34 * crowdA); // 선내로 들어가는 문의 빛
      glow(330, 850, 130, 0.08 * crowdA);
      ctx.globalCompositeOperation = 'source-over';

      // 구역 표시: 바닥에 은은한 원. 가까이 가면 또렷해지고 머문 만큼 차오른다
      if (crowdA > 0.4) {
        for (const zn of ZONES) {
          const dz = depth(zn.y);
          const near = nearest === zn ? clamp(1 - nearD / (zn.r * dz * 3), 0, 1) : 0;
          const prog = clamp((dwell[zn.key] ?? 0) / DWELL, 0, 1);
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = `rgba(255,214,150,${0.08 + near * 0.38})`;
          ctx.beginPath();
          ctx.ellipse(zn.x, zn.y + 6, zn.r * dz, zn.r * dz * 0.36, 0, 0, Math.PI * 2);
          ctx.stroke();
          if (prog > 0) {
            ctx.lineWidth = 4.5;
            ctx.strokeStyle = 'rgba(255,226,170,0.95)';
            ctx.beginPath();
            ctx.ellipse(zn.x, zn.y + 6, zn.r * dz, zn.r * dz * 0.36, -Math.PI / 2, 0, Math.PI * 2 * prog);
            ctx.stroke();
          }
        }
      }

      // 선내로 들어가는 문: 갑판실 왼쪽 끝에서 따뜻한 빛이 새어 나온다
      if (ready(doorImg)) {
        const dd = depth(DOOR.y);
        ctx.globalAlpha = crowdA;
        sprite(doorImg, DOOR.x, DOOR.y + 10, 170 * dd);
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
          ctx.globalAlpha = a.a;
          const im = crowdImgs[a.sp];
          if (ready(im)) {
            const h = im.naturalHeight * ((110 * depth(a.y)) / CROWD_REF);
            sprite(im, a.x, a.y - Math.abs(Math.sin(a.phase)) * h * 0.012, h, a.vx < -1, Math.sin(a.phase) * 0.012);
          } else figure(ctx, a.x, a.y, (a.kind === 3 ? 66 : 102) * depth(a.y), a.phase, a.kind, 'rgba(255,170,90,0.55)');
          ctx.globalAlpha = 1;
        } });
      }
      // 승무원과 웅크린 사람들(고정)
      items.push({ y: 735, draw: () => {
        ctx.globalAlpha = crowdA;
        if (ready(officerImg)) {
          const h = 138 * depth(735);
          sprite(officerImg, 800, 735, h);
          // 등불이 일렁인다
          const w = h * (officerImg.naturalWidth / officerImg.naturalHeight);
          const fl = 0.85 + 0.15 * Math.sin(e * 9) * Math.sin(e * 3.7);
          glow(800 + w * 0.26, 735 - h * 0.5, 150, 0.4 * fl * crowdA);
        } else figure(ctx, 800, 735, 122 * depth(735), 0, 2, 'rgba(255,200,120,0.8)', '#0a0d16');
        ctx.globalAlpha = 1;
      } });
      if (ready(huddleImgs[0]) && ready(huddleImgs[1])) {
        const k = (122 * depth(880)) / 480;
        items.push({ y: 892, draw: () => { ctx.globalAlpha = crowdA; sprite(huddleImgs[0], 292, 892, huddleImgs[0].naturalHeight * k); ctx.globalAlpha = 1; } });
        items.push({ y: 884, draw: () => { ctx.globalAlpha = crowdA; sprite(huddleImgs[1], 400, 884, huddleImgs[1].naturalHeight * k); ctx.globalAlpha = 1; } });
      } else {
        for (const [dx, k, h] of [[-26, 1, 84], [10, 0, 90], [40, 3, 58]] as const) {
          items.push({ y: 880 + dx * 0.02, draw: () => { ctx.globalAlpha = crowdA; figure(ctx, 330 + dx * 1.6, 880, h * depth(880), 0, k, 'rgba(255,170,90,0.45)'); ctx.globalAlpha = 1; } });
        }
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
        const jit = Math.min(4, p.gen * 0.9) * (1 - near * 0.6);
        const size = (22 + near * 14) * clamp(dz, 0.85, 1.3);
        ctx.font = `600 ${size}px "Noto Serif KR", "Nanum Myeongjo", serif`;
        const tx = a.x; const ty = a.y - 140 * dz - near * 10;
        for (let c2 = 0; c2 < 2; c2++) {
          const ox = (Math.sin(e * 7 + p.src + c2 * 2) * jit) * (c2 ? 1 : -1);
          const oy = Math.cos(e * 5.3 + c2) * jit * 0.6;
          ctx.fillStyle = c2 ? `rgba(220,90,80,${0.35 * k})` : `rgba(240,225,200,${(0.45 + near * 0.5) * k * (c2 ? 0.6 : 1)})`;
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 8;
          ctx.fillText(p.text, tx + ox, ty + oy);
        }
        ctx.shadowBlur = 0;
      }

      // 가까운 구역의 이름
      if (activeRef.current && !ch && nearest && nearD < nearest.r * depth(nearest.y) * 3) {
        const opt = question.options.find((o) => o.value === nearest!.key);
        if (opt) {
          const k = clamp(1 - nearD / (nearest.r * depth(nearest.y) * 3), 0, 1);
          ctx.font = `600 ${24 * clamp(depth(nearest.y), 0.9, 1.2)}px "Noto Serif KR", "Nanum Myeongjo", serif`;
          ctx.fillStyle = `rgba(255,236,200,${0.25 + k * 0.7})`;
          ctx.shadowColor = 'rgba(0,0,0,0.95)';
          ctx.shadowBlur = 10;
          ctx.fillText(opt.label.replace(/\.$/, ''), nearest.x, nearest.y - 150 * depth(nearest.y));
          ctx.shadowBlur = 0;
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
          animate={{ opacity: active ? 0.85 : 0 }}
          transition={{ duration: 1.6, delay: 0.4 }}
          className="pointer-events-none absolute inset-x-0 bottom-16 z-30 px-6 text-center text-sm tracking-wide text-white/80 md:bottom-8"
          style={{ textShadow: '0 1px 10px #000' }}
        >
          군중 속에서 움직여 보세요. 한 곳에 머물면 그곳을 택하게 됩니다.
        </motion.p>
      )}

      {/* 카드로 고르기: 언제나 쓸 수 있다 */}
      {!chosen && !reduce && (
        <button
          type="button"
          onClick={() => setCardsOpen((v) => !v)}
          className="absolute bottom-4 right-4 z-40 rounded-full border border-white/30 bg-black/55 px-4 py-1.5 text-sm text-white/85 backdrop-blur-sm transition-colors hover:border-amber-200/70 hover:text-amber-100"
        >
          {cardsOpen ? '닫기' : '카드로 고르기'}
        </button>
      )}
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
