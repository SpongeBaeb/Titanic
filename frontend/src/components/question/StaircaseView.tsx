'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Question } from '@/data/questions';
import ProgressLine from '@/components/ui/ProgressLine';
import { playRoomChoose, playSqueak } from '@/lib/synth';
import { unlock, onDuckFound, DUCK_ROOMS, loadFoundDucks } from '@/engine/achievements';

interface StaircaseViewProps {
  question: Question;
  onAnswer: (value: string) => void;
  onBack?: () => void;
}

// 배경 그림(where.webp)의 크기. object-cover 로 깔리므로 화면 비율이 달라지면 보이는 부분이 달라진다.
const IMG = { w: 1920, h: 1229 };

// 핫스팟은 1280x720 화면에서 맞춰 둔 값(화면 %)이다. 그림 좌표로 바꿔 두고, 화면에는 그림과 같은 변환으로 올린다.
// (그림 좌표로 두지 않으면 화면 비율이 다를 때 안내벌레가 계단이 아닌 엉뚱한 곳에 뜬다)
const REF = { vw: 1280, vh: 720 };
const AUTHORED: Record<string, { x: number; y: number; w: number; h: number }> = {
  '1': { x: 30, y: 45, w: 6, h: 11 }, // 위로: 왼쪽 계단 (1등)
  '2': { x: 51, y: 55, w: 5, h: 15 }, // 복도 (2등)
  '3': { x: 76, y: 76, w: 6, h: 11 }, // 아래로: 오른쪽 아래 계단 (3등)
};
const SPOTS: Record<string, { x: number; y: number; w: number; h: number }> = (() => {
  const s = Math.max(REF.vw / IMG.w, REF.vh / IMG.h);
  const ox = (REF.vw - IMG.w * s) / 2;
  const oy = (REF.vh - IMG.h * s) / 2;
  const out: typeof AUTHORED = {};
  for (const [k, r] of Object.entries(AUTHORED)) {
    out[k] = { x: ((r.x / 100) * REF.vw - ox) / s, y: ((r.y / 100) * REF.vh - oy) / s, w: ((r.w / 100) * REF.vw) / s, h: ((r.h / 100) * REF.vh) / s };
  }
  return out;
})();
const HIT_PAD = 10; // 핫스팟 주변 여유(px): 작은 점이라도 누르기 쉽게

// 방 그림(1920x1072, object-cover)에 숨겨 둔 오리: 방마다 한 마리, 재질이 다르다. 위치는 그림 크기에 대한 % (x: 가운데, y: 발 닿는 곳, w: 폭)
// 그림은 public/bg/room_duck_{방}.webp (투명 배경). 파일이 없으면 오리도 눌리는 자리도 없다
const ROOM_IMG = { w: 1920, h: 1072 };
const ROOM_DUCKS: Record<string, { x: number; y: number; w: number; found: string; dim?: number }> = {
  '1': { x: 40.6, y: 49.9, w: 2.4, found: '은빛 도자기 오리. 벽난로 선반 위에서 시계를 지켜보고 있었다.' },
  '2': { x: 36.8, y: 60.3, w: 3.0, found: '나무로 깎은 오리. 책 위에서 졸고 있었다.' },
  '3': { x: 68.0, y: 76.6, w: 2.4, dim: 0.42, found: '노란 양철 오리. 긴 의자 밑 어둠 속에 숨어 있었다.' }, // 오른쪽 긴 의자 밑 그늘진 곳. 어둡게 그려 그림자에 묻힌다(dim: 밝기), 마우스가 가까이 오면 조금 밝아진다
};

// 등급마다 안내벌레의 색과 움직임이 다르다: 올려 보기 전부터 그 공간의 성격을 암시한다
interface Tone {
  core: string; // 벌레 중심색 (r,g,b)
  glow: string; // 빛무리색 (r,g,b)
  speed: number; // 움직임 속도 배율 (클수록 느리고 우아하다)
  drift: number; // 흩어지는 폭 배율
}
const TONES: Record<string, Tone> = {
  '1': { core: '255,243,196', glow: '251,191,36', speed: 1.7, drift: 0.6 }, // 1등: 금빛, 느리고 우아하게
  '2': { core: '236,242,250', glow: '186,200,220', speed: 1.3, drift: 0.5 }, // 2등: 은은한 상아색, 고요하게
  '3': { core: '255,226,190', glow: '251,146,60', speed: 0.65, drift: 1.25 }, // 3등: 따뜻한 주황, 통통 튀게
};
const DEFAULT_TONE: Tone = { core: '209,250,229', glow: '52,211,153', speed: 1, drift: 1 };

// 안내벌레 클러스터: 선택지 자리를 알려 준다 (모션 줄이기면 정지한 빛만)
function FireflyCluster({ tone, reduced }: { tone: Tone; reduced: boolean }) {
  const particles = useMemo(
    () =>
      [...Array(5)].map(() => ({
        x: [0, (Math.random() * 60 - 30) * tone.drift, (Math.random() * 60 - 30) * tone.drift, 0],
        y: [0, (Math.random() * 60 - 30) * tone.drift, (Math.random() * 60 - 30) * tone.drift, 0],
        duration: (3 + Math.random() * 3) * tone.speed,
        delay: Math.random() * 2,
      })),
    [tone],
  );
  const dot: React.CSSProperties = { backgroundColor: `rgb(${tone.core})`, boxShadow: `0 0 12px 3px rgba(${tone.glow},0.9)` };
  if (reduced) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="absolute h-14 w-14 rounded-full blur-xl" style={{ backgroundColor: `rgba(${tone.glow},0.25)` }} />
        <div className="absolute h-2.5 w-2.5 rounded-full" style={dot} />
      </div>
    );
  }
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full blur-[0.5px]"
          style={dot}
          animate={{ x: p.x, y: p.y, opacity: [0.2, 1, 0.2], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
        />
      ))}
      <motion.div
        className="absolute h-16 w-16 rounded-full blur-xl"
        style={{ backgroundColor: `rgba(${tone.glow},0.22)` }}
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 4 * tone.speed, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

interface Focus {
  x: number;
  y: number;
  tone: Tone;
}

/** 마우스를 따라다니는 안내벌레 무리: 캔버스 한 장에서 직접 그린다. 선택지에 올리면 그쪽으로 몰려가 그 색으로 물든다 */
function ScoutCanvas({ pointer, focus }: { pointer: React.MutableRefObject<{ x: number; y: number }>; focus: React.MutableRefObject<Focus | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const flies = [...Array(12)].map(() => ({
      x: -1000,
      y: -1000,
      k: 0.025 + Math.random() * 0.07, // 따라가는 속도
      r: 6 + Math.random() * 18, // 맴도는 반경
      sp: 1.2 + Math.random() * 1.6,
      ph: Math.random() * Math.PI * 2,
    }));
    let raf = 0;
    let mix = 0; // 0: 기본색, 1: 올린 선택지의 색 (부드럽게 섞는다)
    const col = { core: [209, 250, 229], glow: [52, 211, 153] };
    const parse = (s: string) => s.split(',').map(Number);
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);
    const tick = (now: number) => {
      const t = now / 1000;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalCompositeOperation = 'lighter';
      const fo = focus.current;
      mix += ((fo ? 1 : 0) - mix) * 0.06;
      const tc = fo ? parse(fo.tone.core) : DEFAULT_TONE.core.split(',').map(Number);
      const tg = fo ? parse(fo.tone.glow) : DEFAULT_TONE.glow.split(',').map(Number);
      for (let i = 0; i < 3; i++) {
        col.core[i] += (tc[i] - col.core[i]) * 0.08;
        col.glow[i] += (tg[i] - col.glow[i]) * 0.08;
      }
      // 선택지에 올리면 벌레들이 그쪽으로 쏠리되, 손을 떠나 완전히 끌려가지는 않는다 (자석처럼 느껴지지 않게 절반만 쏠린다)
      const pc = pointer.current;
      const p = fo && pc.x > -500 ? { x: pc.x + (fo.x - pc.x) * 0.4, y: pc.y + (fo.y - pc.y) * 0.4 } : fo ? { x: fo.x, y: fo.y } : pc;
      if (p.x > -500) {
        for (const f of flies) {
          const rr = f.r * (1 - 0.35 * mix);
          const tx = p.x + Math.cos(t * f.sp + f.ph) * rr;
          const ty = p.y + Math.sin(t * f.sp * 1.3 + f.ph) * rr;
          if (f.x < -500) {
            f.x = tx;
            f.y = ty;
          }
          f.x += (tx - f.x) * f.k;
          f.y += (ty - f.y) * f.k;
          const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * f.sp * 2 + f.ph));
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 12);
          g.addColorStop(0, `rgba(${col.core.map(Math.round).join(',')},${a})`);
          g.addColorStop(0.35, `rgba(${col.glow.map(Math.round).join(',')},${a * 0.55})`);
          g.addColorStop(1, `rgba(${col.glow.map(Math.round).join(',')},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(f.x, f.y, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
  }, [pointer, focus]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50 h-full w-full" />;
}

export default function StaircaseView({ question, onAnswer, onBack }: StaircaseViewProps) {
  const reduce = !!useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const answered = useRef(false);
  const lastType = useRef<string>('mouse');
  const pointer = useRef({ x: -1000, y: -1000 });
  const focus = useRef<Focus | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [size, setSize] = useState({ vw: 1280, vh: 720 });
  // 둘러보기: 세 방을 모두 들여다보면 업적 (고르기 전)
  const viewed = useRef(new Set<string>());
  // 숨은 오리: 방이 다 열린 뒤에야 보인다
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [duckArt, setDuckArt] = useState<Record<string, boolean>>({}); // 그림 파일이 있는 방
  const [duckRatio, setDuckRatio] = useState<Record<string, number>>({}); // 오리 그림의 세로/가로 (그릴 때 쓴다)
  const [duckMsg, setDuckMsg] = useState<{ room: string; text: string } | null>(null);
  const [taken, setTaken] = useState<Record<string, boolean>>({}); // 이번 방문에서 집어 간 오리: 누르면 사라진다
  // 주소에 ?duckdebug 를 붙이면 숨은 오리의 눌리는 자리를 점선으로 보이고, 마지막 입력이 어디에 닿았는지 화면 위에 적는다 (오리가 눌리지 않을 때 원인을 찾는 용)
  const [dbgOn, setDbgOn] = useState(false);
  const [dbgLog, setDbgLog] = useState<string[]>([]);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('duckdebug')) return;
    setDbgOn(true);
    const on = (e: Event) => {
      const pe = e as PointerEvent;
      const t = e.target as HTMLElement;
      const label = `${t.tagName}${t.getAttribute?.('aria-label') ? `:${t.getAttribute('aria-label')}` : ''}${t.className && typeof t.className === 'string' ? `.${t.className.split(' ').slice(0, 2).join('.')}` : ''}`;
      setDbgLog((l) => [`${e.type} ${Math.round(pe.clientX)},${Math.round(pe.clientY)} → ${label}`, ...l].slice(0, 6));
    };
    ['pointerdown', 'click'].forEach((t) => window.addEventListener(t, on, true));
    return () => ['pointerdown', 'click'].forEach((t) => window.removeEventListener(t, on, true));
  }, []);
  const [duckNear, setDuckNear] = useState(false); // 마우스가 숨은 오리 가까이 오면 설명 상자가 흐려져 오리가 보인다
  const [, setDuckTick] = useState(0); // 오리를 찾으면 다시 그린다 (찾은 기록은 localStorage 에서 읽는다)
  const duckMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 화면 크기에 맞춘 그림 변환 (object-cover 와 같은 계산)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const upd = () => {
      const r = el.getBoundingClientRect();
      setSize({ vw: r.width, vh: r.height });
    };
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const m = useMemo(() => {
    const s = Math.max(size.vw / IMG.w, size.vh / IMG.h);
    return { s, ox: (size.vw - IMG.w * s) / 2, oy: (size.vh - IMG.h * s) / 2 };
  }, [size]);

  // 핫스팟의 화면 위치: 세로로 긴 화면에서는 그림 양옆이 잘려 화면 밖에 놓일 수 있어, 화면 안으로 밀어 넣어 항상 고를 수 있게 한다
  const rectFor = useCallback(
    (v: string) => {
      const r = SPOTS[v];
      if (!r) return null;
      const width = r.w * m.s + HIT_PAD * 2;
      const height = r.h * m.s + HIT_PAD * 2;
      const left = Math.min(Math.max(m.ox + r.x * m.s - HIT_PAD, 12), Math.max(12, size.vw - width - 12));
      const top = Math.min(Math.max(m.oy + r.y * m.s - HIT_PAD, 12), Math.max(12, size.vh - height - 12));
      return { left, top, width, height, cx: left + width / 2, cy: top + height / 2 };
    },
    [m, size],
  );

  // 선택지에 올리면 마우스를 따라다니던 벌레들이 그쪽으로 몰려가 그 등급의 색으로 물든다
  useEffect(() => {
    const rect = hovered ? rectFor(hovered) : null;
    focus.current = hovered && rect ? { x: rect.cx, y: rect.cy, tone: TONES[hovered] ?? DEFAULT_TONE } : null;
  }, [hovered, rectFor]);

  useEffect(() => () => { if (duckMsgTimer.current) clearTimeout(duckMsgTimer.current); }, []);
  // 오리 그림은 미리 받아 둔다: 방이 열린 순간 바로 눌릴 수 있게
  useEffect(() => {
    DUCK_ROOMS.forEach((room) => {
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = im.naturalWidth; c.height = im.naturalHeight;
          const g = c.getContext('2d');
          if (g) {
            g.drawImage(im, 0, 0);
            const d = g.getImageData(0, 0, c.width, c.height).data;
            const a = new Uint8ClampedArray(c.width * c.height);
            for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
            duckMask.current[room] = { w: c.width, h: c.height, a };
          }
        } catch { /* 마스크를 못 읽으면 그림 상자 전체로 판정한다 */ }
        setDuckRatio((r) => ({ ...r, [room]: im.naturalHeight / im.naturalWidth }));
        setDuckArt((a) => ({ ...a, [room]: true }));
      };
      im.src = `/bg/room_duck_${room}.webp`;
    });
  }, []);
  useEffect(() => {
    if (!hovered) return;
    viewed.current.add(hovered);
    if (DUCK_ROOMS.every((r) => viewed.current.has(r))) unlock('be-right-back');
  }, [hovered]);
  useEffect(() => {
    if (!hovered) return;
    const t = setTimeout(() => setRevealedFor(hovered), reduce ? 200 : 1600);
    return () => clearTimeout(t);
  }, [hovered, reduce]);

  /** 숨은 오리의 화면 자리 (그림 속 자리를 화면 좌표로). 오리를 그릴 때와 마우스 범위를 정할 때 같이 쓴다 */
  const duckBox = useCallback((room: string) => {
    const d = ROOM_DUCKS[room];
    if (!d) return null;
    const s = Math.max(size.vw / ROOM_IMG.w, size.vh / ROOM_IMG.h);
    const ox = (size.vw - ROOM_IMG.w * s) / 2;
    const oy = (size.vh - ROOM_IMG.h * s) / 2;
    const w = (d.w / 100) * ROOM_IMG.w * s;
    const cx = ox + (d.x / 100) * ROOM_IMG.w * s;
    const bottom = oy + (d.y / 100) * ROOM_IMG.h * s;
    return { w, cx, bottom, cy: bottom - w * 0.37 };
  }, [size]);

  const lastDuckAt = useRef(0); // 오리를 집은 시각: 그 직후의 클릭으로 방이 골라지지 않게 한다
  // 오리 그림의 투명도: 눌리는 자리를 오리 모양 그대로 정한다 (그림 파일에서 읽는다)
  const duckMask = useRef<Record<string, { w: number; h: number; a: Uint8ClampedArray }>>({});
  /** 숨은 오리 그림이 놓인 화면 상자 */
  const duckImgBox = (room: string) => {
    const db = duckBox(room);
    if (!db) return null;
    const h = db.w * (duckRatio[room] ?? 0.731);
    return { left: db.cx - db.w / 2, top: db.bottom - h, width: db.w, height: h };
  };
  /** 오리 위(그림 속 오리 모양, 투명한 곳은 제외)를 눌렀는가. 그림 상자 안이어도 투명한 곳이면 아니다 */
  const hitsDuck = (room: string, clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }): boolean => {
    const lx = clientX - box.left;
    const ly = clientY - box.top;
    if (lx < 0 || ly < 0 || lx > box.width || ly > box.height) return false;
    const m = duckMask.current[room];
    if (!m) return true;
    const px = Math.min(m.w - 1, Math.max(0, Math.floor((lx / box.width) * m.w)));
    const py = Math.min(m.h - 1, Math.max(0, Math.floor((ly / box.height) * m.h)));
    return m.a[py * m.w + px] > 24;
  };

  const findDuck = (room: string, at: number) => {
    if (chosen || taken[room]) return;
    lastDuckAt.current = at;
    const n = onDuckFound(room);
    setTaken((t) => ({ ...t, [room]: true }));
    setDuckTick((x) => x + 1);
    playSqueak();
    setDuckMsg({ room, text: `${ROOM_DUCKS[room].found} (${n}/${DUCK_ROOMS.length})` });
    if (duckMsgTimer.current) clearTimeout(duckMsgTimer.current);
    duckMsgTimer.current = setTimeout(() => setDuckMsg(null), 4200);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // 선택: 고른 방으로 파고들며 어두워진 뒤 다음 질문으로 넘어간다. 한 번만 처리된다(빠르게 두 번 눌러도 한 번).
  const choose = useCallback(
    (value: string) => {
      if (answered.current) return;
      answered.current = true;
      setHovered(value);
      setChosen(value);
      if (!reduce) playRoomChoose(value);
      timer.current = setTimeout(() => onAnswer(value), reduce ? 250 : 1700);
    },
    [onAnswer, reduce],
  );

  // 키보드: 1·2·3 으로 고른다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < question.options.length) choose(question.options[i].value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, choose]);

  const handlePointerMove = (e: React.PointerEvent) => {
    lastType.current = e.pointerType;
    if (e.pointerType !== 'mouse') return;
    pointer.current = { x: e.clientX - 4, y: e.clientY - 4 };
    // 방이 열려 있는 동안에는 그 방을 둘러볼 수 있다: 선택지 자리에서 어느 정도 벗어나면 닫힌다
    // (다른 선택지 자리에 들어가면 그 방으로 바뀐다. 예전에는 화면의 3분의 1이나 벗어나야 닫혀서 방이 마우스에 달라붙은 느낌이었다)
    // 다른 선택지 자리 위에 있으면 그 방으로 바꾼다 (자리에 들어서는 순간의 enter 이벤트와 이 이동 이벤트가 겹쳐도 방이 닫히지 않게)
    if (!chosen) {
      const inside = question.options.find((o) => {
        const r = rectFor(o.value);
        return !!r && e.clientX >= r.left && e.clientX <= r.left + r.width && e.clientY >= r.top && e.clientY <= r.top + r.height;
      });
      if (inside) {
        if (inside.value !== hovered) setHovered(inside.value);
        return;
      }
    }
    if (hovered && !chosen) {
      const rect = rectFor(hovered);
      const R = Math.max(150, size.vw * 0.15);
      let inRange = !!rect && Math.hypot(e.clientX - rect.cx, e.clientY - rect.cy) <= R;
      // 숨은 오리는 선택지 자리에서 멀리 있을 수 있다: 오리까지 이어지는 길과 오리 둘레도 범위 안으로 본다 (오리를 집어 가기 전까지)
      const db = duckBox(hovered);
      if (!inRange && rect && db && !taken[hovered]) {
        const ax = rect.cx, ay = rect.cy, bx = db.cx, by = db.cy;
        const dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, ((e.clientX - ax) * dx + (e.clientY - ay) * dy) / (dx * dx + dy * dy || 1)));
        const onPath = Math.hypot(e.clientX - (ax + dx * t), e.clientY - (ay + dy * t)) <= 110;
        const nearDuck = Math.hypot(e.clientX - bx, e.clientY - by) <= Math.max(90, db.w * 1.6);
        inRange = onPath || nearDuck;
      }
      if (!inRange) setHovered(null);
      // 오리 가까이: 아래 설명 상자가 오리를 가리므로 그동안 흐려 준다
      const near = !!db && !taken[hovered] && revealedFor === hovered && Math.hypot(e.clientX - db.cx, e.clientY - db.cy) <= Math.max(110, db.w * 2.4);
      setDuckNear((v) => (v === near ? v : near));
    } else {
      setDuckNear((v) => (v ? false : v));
    }
  };

  const hoverData = question.options.find((o) => o.value === hovered);
  const hoverRect = hovered ? rectFor(hovered) : null;
  const bigR = Math.hypot(size.vw, size.vh);
  const dur = reduce ? 0.2 : 1.9; // 공간이 넓어지는 시간: 천천히 펼쳐진다
  const durOut = reduce ? 0.2 : 0.9; // 닫힐 때는 조금 빠르게

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 h-full w-full select-none overflow-hidden bg-slate-950 ${hovered && revealedFor === hovered && !taken[hovered] && ROOM_DUCKS[hovered] && !chosen ? 'cursor-crosshair' : 'cursor-none'}`}
      onPointerMove={handlePointerMove}
      onPointerDown={(e) => {
        lastType.current = e.pointerType;
        // 오리 그 자체(그림 속 오리 모양)를 누르면 오리를 집는다. 이 클릭은 방을 고르지 않는다 (findDuck 이 시각을 적어 둔다)
        if (hovered && !chosen && !taken[hovered] && revealedFor === hovered && duckArt[hovered]) {
          const box = duckImgBox(hovered);
          if (box && hitsDuck(hovered, e.clientX, e.clientY, box)) {
            e.preventDefault();
            findDuck(hovered, e.timeStamp);
          }
        }
      }}
      onPointerLeave={() => {
        if (!chosen && lastType.current === 'mouse') setHovered(null);
      }}
      onClick={(e) => {
        if (chosen) return;
        if (lastDuckAt.current && e.timeStamp - lastDuckAt.current < 2500) return; // 오리를 집은 직후에는 방을 고르지 않는다
        // 터치: 빈 곳을 누르면 미리보기를 닫는다
        if (e.target === e.currentTarget && lastType.current === 'touch') {
          setHovered(null);
          return;
        }
        // 마우스: 방이 열려 있으면 어디를 눌러도 그 방을 고른다 (뒤로 가기 버튼과 진행 표시는 제외)
        if (lastType.current === 'mouse' && hovered && !(e.target as HTMLElement).closest('[data-nochoose]')) {
          choose(hovered);
        }
      }}
    >
      {!reduce && !chosen && <ScoutCanvas pointer={pointer} focus={focus} />}

      {/* 홀 그림은 항상 깔아 두고, 그 위에서 선택지 그림만 올린 자리에서 원이 퍼지며 나타난다 (두 그림이 동시에 투명해져 어두워지는 일이 없다) */}
      <img src="/bg/where.webp" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <AnimatePresence>
        {hovered && hoverRect && (
          <motion.div
            key={hovered}
            className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
            initial={reduce ? { opacity: 0 } : { clipPath: `circle(0px at ${hoverRect.cx}px ${hoverRect.cy}px)` }}
            animate={reduce ? { opacity: 1 } : { clipPath: `circle(${bigR}px at ${hoverRect.cx}px ${hoverRect.cy}px)` }}
            exit={reduce ? { opacity: 0 } : { clipPath: `circle(0px at ${hoverRect.cx}px ${hoverRect.cy}px)`, transition: { duration: durOut, ease: [0.5, 0, 0.6, 1] } }}
            transition={{ duration: dur, ease: [0.22, 0.6, 0.25, 1] }}
          >
            {/* 고르면 그 방으로 파고들듯 천천히 확대된다 */}
            <motion.img
              src={`/bg/${hovered}.webp`}
              alt=""
              aria-hidden
              className="h-full w-full object-cover"
              animate={{ scale: chosen === hovered && !reduce ? 1.16 : 1 }}
              transition={{ duration: 1.6, ease: 'easeIn' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 원이 퍼질 때의 빛 테두리 */}
      {!reduce && (
        <AnimatePresence>
          {hovered && hoverRect && (
            <motion.div
              key={`ring-${hovered}`}
              aria-hidden
              className="pointer-events-none absolute rounded-full"
              style={{ left: hoverRect.cx, top: hoverRect.cy, x: '-50%', y: '-50%', border: `2px solid rgba(${(TONES[hovered] ?? DEFAULT_TONE).glow},0.7)`, boxShadow: `0 0 28px rgba(${(TONES[hovered] ?? DEFAULT_TONE).glow},0.5)` }}
              initial={{ width: 0, height: 0, opacity: 0.9 }}
              animate={{ width: bigR * 2, height: bigR * 2, opacity: 0 }}
              exit={{ opacity: 0, transition: { duration: durOut } }}
              transition={{ duration: dur, ease: [0.22, 0.6, 0.25, 1] }}
            />
          )}
        </AnimatePresence>
      )}

      {/* UI */}
      <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between">
        <div className="relative flex flex-col items-center bg-gradient-to-b from-slate-950/90 via-slate-950/70 to-transparent p-8 pb-24 pt-12">
          {onBack && (
            <button data-nochoose onClick={onBack} className="pointer-events-auto absolute left-8 top-12 flex items-center gap-2 text-white/70 transition-colors hover:text-white">
              <span className="font-sans text-sm uppercase tracking-widest drop-shadow-md">Back</span>
            </button>
          )}
          <div className="mx-auto mt-8 w-full max-w-4xl px-4 text-center md:mt-0">
            <h2 className="whitespace-pre-wrap font-title text-2xl font-bold tracking-wide text-white/95 drop-shadow-[0_4px_15px_rgba(0,0,0,0.8)] md:text-3xl lg:text-4xl">{question.title}</h2>
            {question.subtitle && <p className="mt-4 font-sans text-sm leading-relaxed text-ivory/90 [text-shadow:0_1px_10px_rgb(0_0_0/0.85)] md:text-base">{question.subtitle}</p>}
          </div>
        </div>

        <div className="flex h-48 items-end justify-center px-6 pb-24">
          <AnimatePresence mode="wait">
            {hoverData && !chosen && (
              <motion.div
                key={hoverData.id}
                initial={{ opacity: 0, y: reduce ? 0 : 20 }}
                animate={{ opacity: duckNear && !!hovered && !taken[hovered] ? 0 : 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : 10 }}
                transition={{ duration: reduce ? 0.15 : 0.4 }}
                className="max-w-2xl rounded-2xl border border-white/10 bg-black/40 px-8 py-6 text-center shadow-2xl backdrop-blur-md"
              >
                <h3 className="mb-3 font-serif text-xl text-amber-100 drop-shadow-sm md:text-2xl">{hoverData.label}</h3>
                <p className="font-sans text-sm font-light leading-relaxed text-slate-200 md:text-base">{hoverData.description}</p>
                {lastType.current === 'touch' && <p className="mt-3 font-sans text-[11px] uppercase tracking-[0.25em] text-amber-200/70">한 번 더 눌러 선택</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div data-nochoose className="pointer-events-auto absolute bottom-8 left-1/2 z-[60] w-full max-w-xl -translate-x-1/2 px-6">
        <ProgressLine />
      </div>

      {/* 핫스팟: 그림 좌표를 화면 좌표로 바꿔서 올린다 */}
      <div className="absolute inset-0 z-20">
        {question.options.map((opt) => {
          const rect = rectFor(opt.value);
          if (!rect) return null;
          const tone = TONES[opt.value] ?? DEFAULT_TONE;
          return (
            <div
              key={opt.id}
              className="absolute flex items-center justify-center"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
              onPointerEnter={(e) => {
                // 터치에서는 '올림'이 없다: 첫 탭이 미리보기, 두 번째 탭이 선택
                if (e.pointerType === 'mouse' && !chosen) setHovered(opt.value);
              }}

              onClick={(e) => {
                if (lastDuckAt.current && e.timeStamp - lastDuckAt.current < 2500) return;
                if (lastType.current === 'touch' && hovered !== opt.value) {
                  setHovered(opt.value);
                  return;
                }
                choose(opt.value);
              }}
            >
              <AnimatePresence>
                {!hovered && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 2, filter: 'blur(10px)' }}
                    transition={{ duration: reduce ? 0.2 : 0.8 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  >
                    <FireflyCluster tone={tone} reduced={reduce} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* 숨은 오리: 열린 방 그림 위, 그림 속 자리에 올린다. 누르면 방이 골라지지 않고 오리를 집어 가며 사라진다 */}
      {hovered && revealedFor === hovered && !chosen && ROOM_DUCKS[hovered] && duckBox(hovered) && (() => {
        const db = duckBox(hovered)!;
        const w = db.w;
        const found = loadFoundDucks().includes(hovered);
        const gone = !!taken[hovered];
        return (
          // 집어 간 오리는 위로 떠오르며 사라진다 (AnimatePresence 의 퇴장에 기대지 않고 투명도로 숨긴다: 퇴장 연출이 멈추면 오리가 남는 일이 없게)
          <motion.div
            key={`duck-${hovered}`}
            className="pointer-events-none absolute inset-0 z-[45]"
            initial={false}
            animate={gone ? (reduce ? { opacity: 0 } : { opacity: 0, y: -14, scale: 1.5 }) : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: reduce ? 0.15 : 0.35, ease: 'easeOut' }}
            style={{ transformOrigin: `${db.cx}px ${db.bottom}px`, visibility: gone ? undefined : 'visible' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/bg/room_duck_${hovered}.webp`} alt="" aria-hidden className="hidden" onLoad={() => setDuckArt((a) => ({ ...a, [hovered]: true }))} />
            {duckArt[hovered] && (() => {
              // 오리 그림 상자(투명한 곳 포함). 눌리는 곳은 이 안의 오리 모양뿐이다
              const box = duckImgBox(hovered)!;
              const dim = ROOM_DUCKS[hovered].dim ?? 1;
              const light = duckNear ? Math.min(1, dim + 0.4) : dim; // 그늘에 있는 오리는 마우스가 가까이 오면 조금 밝아진다
              const room = hovered;
              return (
                <button
                  type="button"
                  data-nochoose
                  aria-label="숨은 오리"
                  disabled={gone}
                  className="absolute"
                  style={{ pointerEvents: 'none', left: box.left, top: box.top, width: box.width, height: box.height, background: 'transparent', outline: dbgOn ? '2px dashed #ff3b3b' : undefined }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/bg/room_duck_${room}.webp`} alt="" draggable={false} className="pointer-events-none absolute inset-0 select-none"
                    style={{ width: '100%', height: '100%', transition: 'filter 300ms', filter: `brightness(${light}) ${found ? 'drop-shadow(0 0 6px rgba(255,220,120,0.9))' : ''}` }} />
                </button>
              );
            })()}
          </motion.div>
        );
      })()}
      {dbgOn && (
        <div data-nochoose className="pointer-events-none fixed left-2 top-2 z-[9999] max-w-[90vw] rounded bg-black/80 p-2 font-mono text-[11px] leading-snug text-lime-300">
          <div>duckdebug · hovered={String(hovered)} · revealed={String(revealedFor)} · taken={JSON.stringify(taken)} · chosen={String(chosen)}</div>
          {dbgLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {duckMsg && (
        <div data-nochoose className="pointer-events-none absolute inset-x-0 top-1/3 z-[65] flex justify-center px-6">
          <div className="max-w-md rounded-xl border border-amber-200/30 bg-black/65 px-6 py-3 text-center font-serif text-sm leading-relaxed text-amber-100 backdrop-blur-sm">{duckMsg.text}</div>
        </div>
      )}

      {/* 고른 뒤 화면이 어두워지며 넘어간다 */}
      <AnimatePresence>
        {chosen && (
          <motion.div
            key="fade"
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[70] bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 1.05, duration: reduce ? 0.2 : 0.6, ease: 'easeIn' }}
          />
        )}
      </AnimatePresence>

      {/* 키보드·스크린 리더용: 보이지 않는 선택 버튼 (포커스하면 해당 공간이 미리 보인다) */}
      <ul className="sr-only">
        {question.options.map((opt, i) => (
          <li key={opt.id}>
            <button type="button" onFocus={() => !chosen && setHovered(opt.value)} onBlur={() => !chosen && setHovered((h) => (h === opt.value ? null : h))} onClick={() => choose(opt.value)}>
              {i + 1}. {opt.label}. {opt.description}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
