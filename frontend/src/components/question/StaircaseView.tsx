'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Question } from '@/data/questions';
import ProgressLine from '@/components/ui/ProgressLine';
import { playRoomChoose } from '@/lib/synth';

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
      const p = fo ? { x: fo.x, y: fo.y } : pointer.current;
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
    // 방이 열려 있는 동안에는 그 방을 마음껏 둘러볼 수 있다: 선택지 자리에서 한참 벗어나야 닫힌다
    // (다른 선택지 자리에 들어가면 그 방으로 바뀐다)
    if (hovered && !chosen) {
      const rect = rectFor(hovered);
      if (rect && Math.hypot(e.clientX - rect.cx, e.clientY - rect.cy) > Math.max(300, size.vw * 0.36)) setHovered(null);
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
      className="fixed inset-0 h-full w-full select-none overflow-hidden bg-slate-950 cursor-none"
      onPointerMove={handlePointerMove}
      onPointerDown={(e) => {
        lastType.current = e.pointerType;
      }}
      onPointerLeave={() => {
        if (!chosen && lastType.current === 'mouse') setHovered(null);
      }}
      onClick={(e) => {
        if (chosen) return;
        // 터치: 빈 곳을 누르면 미리보기를 닫는다
        if (e.target === e.currentTarget && lastType.current === 'touch') {
          setHovered(null);
          return;
        }
        // 마우스: 방이 열려 있으면 어디를 눌러도 그 방을 고른다 (뒤로 가기 버튼과 진행 표시는 제외)
        if (lastType.current === 'mouse' && hovered && !(e.target as HTMLElement).closest('[data-nochoose]')) choose(hovered);
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
                animate={{ opacity: 1, y: 0 }}
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

              onClick={() => {
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
