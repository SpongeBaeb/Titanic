'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Question } from '@/data/questions';
import { playShutter, playPhotoEject } from '@/lib/synth';
import ProgressLine from '@/components/ui/ProgressLine';

interface CompanionCameraProps {
  question: Question;
  onAnswer: (value: string) => void;
  onBack?: () => void;
}

/**
 * 동행 고르기: 카메라 파인더로 부두를 자유롭게 둘러보고, 조준점에 맞춘 사람을 찍는다.
 *  - 이동: 마우스를 움직이는 쪽으로 카메라가 따라간다 (터치는 끌기), 방향키·WASD
 *  - 확대·축소: 휠, 두 손가락, + / − 키
 *  - 촬영: 클릭·탭, 스페이스·엔터 (조준점에 피사체가 들어와 초점이 잡힌 때만)
 * 더 넓은 파노라마 그림이 생기면 WORLD 만 바꾸면 된다 (핫스팟은 그림 크기에 대한 % 좌표).
 */
const WORLD = { src: '/bg/fellow_panorama.webp', w: 3168, h: 1344 }; // 원본 1584x672 를 2배로 키워 선명하게 다듬은 파일 (더 크게 확대하면 흐려진다)

type Spot = { x: number; y: number; w: number; h: number }; // 그림 크기에 대한 % 좌표

// 피사체 위치 (그림 좌표 %): 파노라마 그림에서 따온 값
const SPOTS: Record<string, Spot> = {
  partner: { x: 40, y: 54, w: 7, h: 31 },
  friends: { x: 53, y: 58.5, w: 10.6, h: 32 },
  family: { x: 68.5, y: 56.5, w: 10, h: 30 },
  alone: { x: 84.6, y: 55.8, w: 7, h: 38 },
};

// 숨은 강아지 (이스터에그): fellow/dog_hidden.webp 가 있을 때만 월드에 나타나고 찍을 수 있다.
// 위치는 파노라마 그림에 맞춰 다시 잡는다 (그림 크기에 대한 % 좌표).
const DOG_SRC = '/fellow/dog_hidden.webp';
const DOG_SPOT: Spot = { x: 8.1, y: 84.6, w: 4.2, h: 9.5 }; // 맨 왼쪽 나무 상자 윗면에 앉아 있다
// 강아지 그림은 배경 인물들과 같은 해상도감·입자로 다시 만들었다(tools/dogtex 처리). 여기서는 대비만 살짝 낮춘다
const DOG_SOFT = 'contrast(0.95)';
const DOG_OPTION = { id: 'comp_dog', value: 'dog', label: '멍!', description: '낑낑거리는 작은 털뭉치가 렌즈를 올려다봅니다. 이 아이의 눈으로 이 배에 오르고 싶어졌습니다.' };

// 렌즈 그림(lens.webp 1200x653)의 투명한 원 반지름. 화면에 cover 로 깔리므로 화면 비율이 달라져도 항상 원이다.
const LENS = { w: 1200, h: 653, r: 343 };

// 사진기 몸체(camera_body.webp 1400x495)와 인화지(photo_frame.webp 800x952): 투입구와 사진 칸 위치는 그림에서 잰 비율이다
const CAM = { src: '/ui/camera_body.webp', w: 1400, h: 495, slot: { x: 0.248, y: 0.126, w: 0.514, h: 0.026 } };
const FRAME = { src: '/ui/photo_frame.webp', w: 800, h: 952, hole: { x: 0.0767, y: 0.0678, w: 0.8453, h: 0.7191 } };
const CAM_W = 460; // 화면에 보이는 사진기 너비(px)
const CAM_H = (CAM_W * CAM.h) / CAM.w;
const SLOT_LINE = CAM_H - (CAM.slot.y + CAM.slot.h / 2) * CAM_H; // 투입구 선: 사진기 아래에서부터의 높이
const PHOTO_W = Math.round(CAM_W * CAM.slot.w * 0.82); // 사진 너비는 투입구보다 조금 좁게
const PHOTO_H = (PHOTO_W * FRAME.h) / FRAME.w;

// 필름 입자 (작은 노이즈 이미지)
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1.2 -0.1'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>")`; // 레터박스 패널 너비(vw)
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.6; // 원본 해상도가 허락하는 한계: 더 키우면 인물이 뭉개진다
const ZOOM_START = 1.2;
// 조준점은 화면 가운데보다 약간 아래: 부두의 사람들이 그림 아래쪽에 있어서, 가운데에 두면 확대를 많이 해야만 닿는다
const RET_Y = 0.62;

// 사진이 나오는 움직임: 3번 끊어 가며 밀려 나온다 (소리도 같은 박자)
const PHOTO_STEPS = 3;
// 사진이 투입구 위로 밀려 나오는 높이(사진 높이의 %). 100 이상이어야 아래쪽 테두리까지 잘리지 않고 다 보인다
const PHOTO_RISE = 102;
const { PHOTO_Y, PHOTO_TIMES } = (() => {
  const y: string[] = ['0%'];
  const t: number[] = [0];
  for (let i = 1; i <= PHOTO_STEPS; i++) {
    y.push(`${-((i - 1) / PHOTO_STEPS) * PHOTO_RISE}%`);
    t.push((i - 1 + 0.5) / PHOTO_STEPS);
    y.push(`${-(i / PHOTO_STEPS) * PHOTO_RISE}%`);
    t.push(i / PHOTO_STEPS);
  }
  return { PHOTO_Y: y, PHOTO_TIMES: t };
})();

export default function CompanionCamera({ question, onAnswer, onBack }: CompanionCameraProps) {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  const [focusKey, setFocusKey] = useState<string | null>(null);
  const focusRef = useRef<string | null>(null);
  const dogAimed = useRef(false); // 강아지가 조준점에 들어와 있는가 (화면에는 아무 표시도 하지 않는다)
  const [photo, setPhoto] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [hint, setHint] = useState(true);
  // 터치 기기에서는 마우스 대신 드래그·핀치 안내를 보여 준다
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    try { setCoarse(window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 640); } catch { /* 무시 */ }
  }, []);
  const busy = useRef(false);

  // 강아지 그림이 있는지 확인한다 (없으면 강아지 분기는 존재하지 않는 것처럼 둔다)
  const [dogReady, setDogReady] = useState(false);
  const spotsRef = useRef<Record<string, Spot>>(SPOTS);
  useEffect(() => {
    let alive = true;
    const im = new Image();
    im.onload = () => {
      if (!alive) return;
      spotsRef.current = { ...SPOTS, dog: DOG_SPOT };
      setDogReady(true);
    };
    im.onerror = () => {};
    im.src = DOG_SRC;
    return () => {
      alive = false;
    };
  }, []);

  // target 은 입력이 움직이는 '조준점'(그림 크기에 대한 0~1 좌표), cur 는 거기에 부드럽게 따라가는 값.
  // 카메라 중심은 조준점을 따라가되 그림 가장자리에서 멈추고, 그때 조준점이 렌즈 구멍 안에서 가장자리 쪽으로 밀려난다.
  const target = useRef({ x: 0.5, y: 0.72, z: ZOOM_START });
  const cur = useRef({ x: 0.5, y: 0.72, z: ZOOM_START });
  const reticleRef = useRef<HTMLDivElement>(null);
  const mouseU = useRef<{ u: number; v: number } | null>(null);
  const size = useRef({ vw: 1280, vh: 720, r: 360 }); // r: 화면 속 렌즈 구멍의 반지름(px)
  const keys = useRef<Record<string, boolean>>({});
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, pinchDist: 0, startZoom: ZOOM_START });

  const base = () => {
    const { vw, vh } = size.current;
    const s = Math.max(vw / WORLD.w, vh / WORLD.h);
    return { W0: WORLD.w * s, H0: WORLD.h * s };
  };

  // 조준점 A(월드 0~1)와 확대 z 로 카메라 중심과 조준점의 화면 이동량(px)을 구한다
  const camFor = (A: { x: number; y: number }, z: number) => {
    const { vw, vh, r } = size.current;
    const { W0, H0 } = base();
    const baseY = ((RET_Y - 0.5) * vh) / (H0 * z); // 조준점은 화면 가운데보다 아래에 있다
    // 렌즈 구멍(원) 안에서 보이는 반폭·반높이: 그림 밖이 구멍 안으로 들어오지 않게 카메라를 막는다
    const hx = Math.min(r, vw / 2) / (W0 * z);
    const hy = Math.min(r, vh / 2) / (H0 * z);
    const wantX = A.x;
    const wantY = A.y - baseY;
    const cx = hx >= 0.5 ? 0.5 : Math.min(1 - hx, Math.max(hx, wantX));
    const cy = hy >= 0.5 ? 0.5 : Math.min(1 - hy, Math.max(hy, wantY));
    return { cx, cy, rx: (wantX - cx) * W0 * z, ry: (wantY - cy) * H0 * z, W0, H0, baseY };
  };

  const clampTarget = useCallback(() => {
    const t = target.current;
    const { vh, r } = size.current;
    t.z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, t.z));
    t.x = Math.min(1, Math.max(0, t.x));
    t.y = Math.min(1, Math.max(0, t.y));
    // 조준점이 렌즈 구멍(원) 밖으로 나가지 못하게 한다
    const cam = camFor(t, t.z);
    const vx = cam.rx;
    const vy = (RET_Y - 0.5) * vh + cam.ry;
    const lim = r * 0.8;
    const len = Math.hypot(vx, vy);
    if (len > lim) {
      const k = lim / len;
      const nvx = vx * k;
      const nvy = vy * k;
      t.x = cam.cx + nvx / (cam.W0 * t.z);
      t.y = cam.cy + cam.baseY + (nvy - (RET_Y - 0.5) * vh) / (cam.H0 * t.z);
      t.x = Math.min(1, Math.max(0, t.x));
      t.y = Math.min(1, Math.max(0, t.y));
    }
  }, []);

  // 크기 추적
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vw = r.width || window.innerWidth;
      const vh = r.height || window.innerHeight;
      const sl = Math.max(vw / LENS.w, vh / LENS.h);
      size.current = { vw, vh, r: LENS.r * sl };
      el.style.setProperty('--lens-r', `${(LENS.r + 14) * sl}px`); // 황동 테두리 밑으로 살짝 겹치게 잘라 틈이 안 보이게 한다
      clampTarget();
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [clampTarget]);

  // 매 프레임: 키보드 이동, 부드러운 추적, 화면 반영, 초점 판정
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = target.current;
      const c = cur.current;
      const k = keys.current;
      const { vw, vh } = size.current;
      const { W0, H0 } = base();
      const dx = (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.a ? 1 : 0);
      const dy = (k.ArrowDown || k.s ? 1 : 0) - (k.ArrowUp || k.w ? 1 : 0);
      if (dx || dy) {
        t.x += (dx * 520 * dt) / (W0 * c.z);
        t.y += (dy * 520 * dt) / (H0 * c.z);
        setHint(false);
      }
      const dz = (k['+'] || k['='] || k.e ? 1 : 0) - (k['-'] || k['_'] || k.q ? 1 : 0);
      if (dz) {
        t.z *= Math.exp(dz * 1.2 * dt);
        setHint(false);
      }
      clampTarget();
      const f = 1 - Math.exp(-dt * (reduce ? 40 : 11));
      c.x += (t.x - c.x) * f;
      c.y += (t.y - c.y) * f;
      c.z += (t.z - c.z) * f;
      const cam = camFor(c, c.z);
      const el = worldRef.current;
      if (el) {
        el.style.width = `${W0}px`;
        el.style.height = `${H0}px`;
        el.style.transform = `translate3d(${vw / 2 - cam.cx * W0 * c.z}px, ${vh / 2 - cam.cy * H0 * c.z}px, 0) scale(${c.z})`;
      }
      if (reticleRef.current) reticleRef.current.style.transform = `translate(${cam.rx}px, ${cam.ry}px)`;
      // 초점: 조준점에 피사체가 들어왔는가
      const px = c.x * 100;
      const py = c.y * 100;
      let found: string | null = null;
      let dogHit = false;
      for (const [key, s] of Object.entries(spotsRef.current)) {
        // 작은 강아지는 조금 더 넉넉하게 잡아 준다
        const mx = key === 'dog' ? 4.5 : Math.max(s.w * 0.2 + 0.3, 1.5);
        const my = key === 'dog' ? 6.5 : Math.max(s.h * 0.15 + 0.4, 2.5);
        const hit = px >= s.x - mx && px <= s.x + s.w + mx && py >= s.y - my && py <= s.y + s.h + my;
        if (key === 'dog') dogHit = hit;
        else if (hit && !found) found = key;
      }
      dogAimed.current = dogHit;
      if (found !== focusRef.current) {
        focusRef.current = found;
        setFocusKey(found);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clampTarget, reduce]);

  const shoot = useCallback(() => {
    if (busy.current) return;
    const key = focusRef.current ?? (dogAimed.current ? 'dog' : null);
    if (!key) {
      // 초점이 안 잡혔다: 파인더가 살짝 떨려 알려 준다
      setNudge(true);
      setTimeout(() => setNudge(false), 450);
      return;
    }
    busy.current = true;
    playShutter(); // 합성음(음소거 기본)
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    setPhoto(key);
    // 사진기가 올라오고 사진이 한 칸씩 뽑혀 나온다. 다 본 뒤 다음 질문으로 (모션 줄이기면 짧게)
    if (!reduce) setTimeout(() => playPhotoEject(), 650);
    setTimeout(() => onAnswer(key), reduce ? 400 : 3500);
  }, [onAnswer, reduce]);

  // 개발 서버에서만: 조준 없이 촬영을 시험할 수 있게 한다
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') (window as unknown as { __cam?: unknown }).__cam = { shoot: (k: string) => { focusRef.current = k as never; shoot(); } };
  }, [shoot]);

  // 키보드
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === ' ' || key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) shoot();
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', '+', '=', '-', '_', 'q', 'e'].includes(key)) {
        e.preventDefault();
        keys.current[key] = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys.current[key] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [shoot]);

  // 휠 확대·축소 (스크롤을 막아야 해서 passive 가 아닌 리스너로 건다)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current.z *= Math.exp(-e.deltaY * 0.0014);
      clampTarget();
      aimFromMouse();
      setHint(false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampTarget]);

  // 마우스: 움직이는 쪽으로 카메라가 따라간다 (끌지 않는다). 클릭하면 촬영.
  // 터치: 끌어서 이동, 두 손가락으로 확대, 짧게 탭하면 촬영.
  const aimFromMouse = useCallback(() => {
    const m = mouseU.current;
    if (!m) return;
    // 마우스의 화면 위치가 곧 그림 전체(0~1)에서의 조준점이다. 가장자리에서는 카메라가 멈추고 조준점만 렌즈 안에서 끝으로 간다
    target.current.x = m.u;
    target.current.y = m.v;
    clampTarget();
  }, [clampTarget]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current.moved = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.startZoom = target.current.z;
      gesture.current.moved = 99;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      const { vw, vh } = size.current;
      // 화면 가장자리까지 가지 않아도 끝까지 둘러볼 수 있게 가운데 84%를 전체 범위로 쓴다
      mouseU.current = {
        u: Math.min(1, Math.max(0, (e.clientX / vw - 0.08) / 0.84)),
        v: Math.min(1, Math.max(0, (e.clientY / vh - 0.08) / 0.84)),
      };
      aimFromMouse();
      setHint(false);
      return;
    }
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const nx = e.clientX;
    const ny = e.clientY;
    if (pointers.current.size === 1) {
      const dx = nx - p.x;
      const dy = ny - p.y;
      gesture.current.moved += Math.abs(dx) + Math.abs(dy);
      if (gesture.current.moved > 6) {
        const { W0, H0 } = base();
        target.current.x -= dx / (W0 * cur.current.z);
        target.current.y -= dy / (H0 * cur.current.z);
        clampTarget();
        setHint(false);
      }
    } else if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, { x: nx, y: ny });
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current.pinchDist > 0) {
        target.current.z = gesture.current.startZoom * (d / gesture.current.pinchDist);
        clampTarget();
        setHint(false);
      }
    }
    pointers.current.set(e.pointerId, { x: nx, y: ny });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      shoot();
      return;
    }
    const wasOne = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (wasOne && gesture.current.moved <= 6) shoot();
    if (pointers.current.size === 0) gesture.current.pinchDist = 0;
  };

  const findOption = (v: string | null) => (v === 'dog' ? DOG_OPTION : question.options.find((o) => o.value === v));
  const focusData = focusKey ? findOption(focusKey) : undefined;
  const photoData = photo ? findOption(photo) : null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 h-full w-full cursor-none touch-none select-none overflow-hidden bg-black"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="application"
      aria-label="카메라로 부두를 둘러보고 함께 온 사람을 찍어 보세요. 방향키로 이동, 플러스 마이너스 키로 확대·축소, 스페이스로 촬영"
    >
      {/* 뒤로 */}
      {onBack && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={onBack}
          className="absolute left-8 top-8 z-50 flex items-center gap-2 text-white/70 transition-colors hover:text-white"
        >
          <span className="font-sans text-sm uppercase tracking-widest">Back</span>
        </button>
      )}

      {/* 렌즈 구멍(원) 밖은 그림이 보이지 않게 둥글게 잘라 검게 둔다: 화면 양옆 여백이 렌즈 그림에 가려지지 않는 비율에서도 새어 나오지 않는다 */}
      <div className="absolute inset-0" style={{ clipPath: 'circle(var(--lens-r, 48vh) at 50% 50%)' }}>
        {/* 월드: 그림 한 장을 카메라가 이동·확대해서 보여 준다. 옛날 사진기처럼 흑백 */}
        <div ref={worldRef} className="absolute left-0 top-0 will-change-transform" style={{ transformOrigin: '0 0', filter: 'grayscale(1) contrast(1.12) brightness(0.96)' }}>
          <img src={WORLD.src} alt="" draggable={false} className="pointer-events-none block h-full w-full select-none" />
          {dogReady && (
            <img
              src={DOG_SRC}
              alt=""
              draggable={false}
              className="pointer-events-none absolute select-none"
              style={{ left: `${DOG_SPOT.x}%`, top: `${DOG_SPOT.y}%`, width: `${DOG_SPOT.w}%`, height: `${DOG_SPOT.h}%`, objectFit: 'contain', filter: DOG_SOFT }}
            />
          )}
        </div>
      </div>

      {/* 필름 질감: 입자와 가장자리 어둡게 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] opacity-[0.22] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px', animation: 'film-grain 0.5s steps(4) infinite' }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[6]" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)' }} />

      {/* 렌즈 */}
      <img src="/lens.webp" alt="" draggable={false} className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover" />

      {/* 조준점: 가운데에 피사체가 들어오면 초점이 잡힌다 */}
      <div className="pointer-events-none absolute inset-x-0 z-[15] flex items-center justify-center" style={{ top: `${RET_Y * 100}%`, height: 0 }}>
        <div ref={reticleRef} className="will-change-transform">
        <motion.div
          animate={nudge ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="relative"
          style={{ width: focusKey ? 150 : 110, height: focusKey ? 150 : 110, transition: 'width .25s, height .25s' }}
        >
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <span
              key={c}
              className="absolute h-6 w-6"
              style={{
                top: c[0] === 't' ? 0 : undefined,
                bottom: c[0] === 'b' ? 0 : undefined,
                left: c[1] === 'l' ? 0 : undefined,
                right: c[1] === 'r' ? 0 : undefined,
                borderTop: c[0] === 't' ? `2px solid ${focusKey ? '#fcd34d' : 'rgba(255,255,255,0.55)'}` : undefined,
                borderBottom: c[0] === 'b' ? `2px solid ${focusKey ? '#fcd34d' : 'rgba(255,255,255,0.55)'}` : undefined,
                borderLeft: c[1] === 'l' ? `2px solid ${focusKey ? '#fcd34d' : 'rgba(255,255,255,0.55)'}` : undefined,
                borderRight: c[1] === 'r' ? `2px solid ${focusKey ? '#fcd34d' : 'rgba(255,255,255,0.55)'}` : undefined,
                transition: 'border-color .2s',
              }}
            />
          ))}
          <span className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-white/60" />
          <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-white/60" />
        </motion.div>
        </div>
      </div>

      {/* UI 레이어 */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute inset-x-0 top-0 flex flex-col items-center bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent pb-24 pt-12">
          <div className="mb-6 mt-4 w-full max-w-xl px-6">
            <ProgressLine />
          </div>
          <div className="flex w-full flex-col gap-2 px-4 text-center">
            <h2 className="font-serif text-2xl tracking-widest text-white/90 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] md:text-3xl">{question.title}</h2>
            <p className="font-sans text-xs uppercase tracking-[0.2em] text-ivory/90 [text-shadow:0_1px_8px_#000,0_0_14px_#000]">Look around and take a photo</p>
          </div>
        </div>

        {/* 사용법: 처음 조작하기 전까지만 */}
        <AnimatePresence>
          {hint && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 top-[78%] w-[min(86vw,420px)] md:w-[44vw] -translate-x-1/2 text-center font-sans text-xs leading-relaxed tracking-[0.14em] text-white/75 [text-shadow:0_1px_8px_#000]"
            >
              {coarse ? (<>화면을 끌어 둘러보고 두 손가락으로 확대하세요<br />조준점에 사람을 맞추고 화면을 탭하세요</>) : (<>마우스를 움직여 둘러보세요 · 휠로 확대<br />조준점에 사람을 맞추고 클릭하세요</>)}
            </motion.p>
          )}
        </AnimatePresence>

        {/* 하단: 초점이 잡힌 사람의 자막 */}
        <div className="absolute inset-0 flex flex-col items-center justify-end px-4 pb-28">
          <AnimatePresence mode="wait">
            {focusData && !photo && (
              <motion.div
                key={focusData.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <h3 className="mb-2 font-title text-3xl text-amber-100 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)] md:text-4xl">{focusData.label}</h3>
                <p className="mx-auto max-w-md font-sans text-sm text-slate-300">{focusData.description}</p>
                <p className="mt-3 font-sans text-[11px] uppercase tracking-[0.3em] text-amber-200/70">{coarse ? '탭해서 촬영' : '클릭하거나 스페이스를 눌러 촬영'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 셔터 플래시 */}
      <AnimatePresence>
        {flash && <motion.div key="flash" className="pointer-events-none absolute inset-0 z-[60] bg-white" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />}
      </AnimatePresence>

      {/* 사진기: 화면 아래에서 올라오고, 윗면 투입구에서 사진이 한 칸씩 끊어 가며 밀려 나온다 */}
      <AnimatePresence>
        {photoData && photo && (
          <motion.div
            key="camera"
            className="pointer-events-none absolute bottom-0 left-1/2 z-[55]"
            style={{ x: '-50%', width: CAM_W, height: CAM_H }}
            initial={{ y: reduce ? 0 : CAM_H + 40 }}
            animate={{ y: 0 }}
            transition={{ duration: reduce ? 0.15 : 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <img src={CAM.src} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" />
            {/* 사진이 나오는 구역: 투입구 선 아래는 잘려서, 사진이 투입구에서 솟아 나오는 것처럼 보인다 */}
            <div className="absolute left-1/2 z-[2] -translate-x-1/2" style={{ bottom: SLOT_LINE, width: PHOTO_W, height: 0, clipPath: 'inset(-100vh -40vw 0 -40vw)' }}>
              <motion.div
                className="absolute left-0 top-0 drop-shadow-[0_10px_18px_rgba(0,0,0,0.6)]"
                style={{ width: PHOTO_W, height: PHOTO_H }}
                initial={{ y: '0%' }}
                animate={reduce ? { y: `-${PHOTO_RISE}%` } : { y: PHOTO_Y }}
                transition={reduce ? { duration: 0.2 } : { delay: 0.7, duration: 1.7, times: PHOTO_TIMES, ease: 'easeOut' }}
              >
                {/* 사진 칸: 인화지의 비어 있는 자리에 찍은 장면을 끼운다 */}
                <div
                  className="absolute overflow-hidden"
                  style={{ left: FRAME.hole.x * PHOTO_W, top: FRAME.hole.y * PHOTO_H, width: FRAME.hole.w * PHOTO_W, height: FRAME.hole.h * PHOTO_H }}
                >
                  <PhotoCrop spot={photo === 'dog' ? DOG_SPOT : SPOTS[photo]} withDog={dogReady} boxW={FRAME.hole.w * PHOTO_W} boxH={FRAME.hole.h * PHOTO_H} />
                </div>
                <img src={FRAME.src} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" />
                <p className="absolute inset-x-0 text-center font-serif text-[11px] leading-snug text-[#4a3a1c]" style={{ top: (FRAME.hole.y + FRAME.hole.h) * PHOTO_H + 10 }}>
                  {photoData.label}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** 폴라로이드 사진 부분: 월드 그림에서 찍힌 사람 주변만 잘라 보여 준다. 그림 가장자리(특히 아래쪽)의 사람을 찍어도 그림 밖이 비어 투명해지지 않도록 위치를 그림 안으로 묶는다. (숨은 강아지가 월드에 있으면 함께 찍힌다) */
function PhotoCrop({ spot, withDog, boxW, boxH }: { spot: Spot; withDog: boolean; boxW: number; boxH: number }) {
  const cx = (spot.x + spot.w / 2) / 100;
  const cy = (spot.y + spot.h / 2) / 100;
  const frac = Math.min(0.5, Math.max(0.16, (spot.w / 100) * 3));
  // 사진 칸은 정사각형이 아니라 인화지 구멍(가로 0.845 x 세로 0.856 PHOTO_W)과 똑같은 크기로 채운다. 예전에는 정사각형이라 아래가 비어 투명하게 보였다
  // 세로도 사진 칸을 다 덮도록: 그림이 가로로 길어서(약 2.4:1) 많이 확대하지 않으면 세로가 모자라 아래가 비었다
  const bgW = Math.max(boxW / frac, boxH * (WORLD.w / WORLD.h));
  const bgH = bgW * (WORLD.h / WORLD.w);
  return (
    <div className="relative overflow-hidden" style={{ width: boxW, height: boxH, filter: 'grayscale(1) contrast(1.12)' }}>
      <div className="absolute" style={{ width: bgW, height: bgH, left: Math.min(0, Math.max(boxW - bgW, -(cx * bgW - boxW / 2))), top: Math.min(0, Math.max(boxH - bgH, -(cy * bgH - boxH / 2))) }}>
        <img src={WORLD.src} alt="" draggable={false} className="block h-full w-full" />
        {withDog && (
          <img
            src={DOG_SRC}
            alt=""
            draggable={false}
            className="absolute"
            style={{ left: `${DOG_SPOT.x}%`, top: `${DOG_SPOT.y}%`, width: `${DOG_SPOT.w}%`, height: `${DOG_SPOT.h}%`, objectFit: 'contain', filter: DOG_SOFT }}
          />
        )}
      </div>
    </div>
  );
}
