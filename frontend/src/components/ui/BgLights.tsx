'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * 배경 사진 속 랜턴 불빛을 일렁이게 하는 덮개.
 * 사진마다 랜턴 자리를 그림 크기에 대한 %로 적어 두고, 화면에 깔린 모양(cover)에 맞춰 같은 자리에 불빛을 얹는다.
 * 불빛은 따뜻한 빛무리가 불규칙하게 밝아졌다 어두워지고, 물 위에 있는 불빛은 아래로 길게 번졌다 흔들리는 반사를 가진다.
 * 모션 줄이기 설정이면 일렁임 없이 고요한 빛만 남는다.
 */
interface Light {
  /** 랜턴 자리 (그림 가로·세로에 대한 %) */
  x: number;
  y: number;
  /** 빛무리 반지름 (그림 가로에 대한 %) */
  r: number;
  /** 물 위의 반사: 아래로 번지는 길이 (그림 세로에 대한 %). 없으면 반사 없음 */
  reflect?: number;
  /** 일렁이는 속도 배율 (클수록 느림) */
  slow?: number;
  /** 밝기 배율 */
  power?: number;
  /** 사진에 이미 박혀 있는 불빛이라, 꺼질 때 그 자리를 어둡게 덮어야 한다 */
  kill?: boolean;
}

const BG_LIGHTS: Record<string, { w: number; h: number; lights: Light[] }> = {
  // B1: 구명정 안의 랜턴
  '/bg/boat_sea.webp': { w: 1376, h: 768, lights: [{ x: 60.5, y: 63.8, r: 6.5, slow: 1, power: 1 }] },
  // W3 살아남은 쪽: 다가오는 구명정의 랜턴과 물 위의 반사
  '/bg/w3_live.webp': { w: 1408, h: 768, lights: [{ x: 34.2, y: 34, r: 5, reflect: 22, slow: 1.1, power: 1 }] },
  // W3 못 산 쪽: 먼 불빛 하나. 꺼질 듯 느리고 약하게 흔들린다
  '/bg/w3_die_surface.webp': { w: 1408, h: 768, lights: [{ x: 50, y: 49.6, r: 2.6, reflect: 9, slow: 2.4, power: 0.85, kill: true }] },
};

const CSS = `
@keyframes lanternFlicker {
  0%{opacity:.78;transform:translate(-50%,-50%) scale(1)}
  7%{opacity:.5;transform:translate(-50.4%,-49.6%) scale(.93)}
  13%{opacity:.95;transform:translate(-49.7%,-50.3%) scale(1.07)}
  21%{opacity:.62;transform:translate(-50.2%,-50%) scale(.96)}
  34%{opacity:1;transform:translate(-49.8%,-50.2%) scale(1.1)}
  46%{opacity:.7;transform:translate(-50.3%,-49.8%) scale(.98)}
  58%{opacity:.92;transform:translate(-50%,-50.2%) scale(1.04)}
  71%{opacity:.55;transform:translate(-49.7%,-49.7%) scale(.94)}
  83%{opacity:.96;transform:translate(-50.2%,-50%) scale(1.06)}
  100%{opacity:.78;transform:translate(-50%,-50%) scale(1)}
}
@keyframes lanternCore {
  0%,100%{opacity:.9;transform:translate(-50%,-50%) scale(1)}
  18%{opacity:.6;transform:translate(-50%,-50%) scale(.85)}
  37%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}
  62%{opacity:.7;transform:translate(-50%,-50%) scale(.9)}
  80%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}
}
@keyframes lanternDie {
  0%{opacity:1}15%{opacity:.7}22%{opacity:.95}38%{opacity:.45}46%{opacity:.7}62%{opacity:.25}70%{opacity:.4}84%{opacity:.12}92%{opacity:.2}100%{opacity:0}
}
@keyframes lanternReflect {
  0%,100%{opacity:.6;transform:translateX(-50%) scaleX(1) scaleY(1)}
  25%{opacity:.35;transform:translateX(-50%) scaleX(.7) scaleY(.92)}
  50%{opacity:.75;transform:translateX(-50%) scaleX(1.25) scaleY(1.04)}
  75%{opacity:.4;transform:translateX(-50%) scaleX(.85) scaleY(.96)}
}
`;

export default function BgLights({ url, opacity = 1, out = false }: { url: string | null; opacity?: number; /** true 면 불빛이 깜빡이다 완전히 꺼진다 */ out?: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const entry = url ? BG_LIGHTS[url] : undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, [entry]);

  if (!entry) return null;
  // 배경은 가운데를 기준으로 화면을 덮는다(bg-cover bg-center): 같은 계산으로 사진 속 자리를 화면 좌표로 바꾼다
  const s = Math.max(box.w / entry.w, box.h / entry.h);
  const ox = (box.w - entry.w * s) / 2;
  const oy = (box.h - entry.h * s) / 2;
  const ready = box.w > 0 && box.h > 0;

  return (
    <>
    <motion.div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      transition={{ duration: 1.4, delay: 0.5 }}
      style={{ mixBlendMode: 'screen' }}
    >
      <style>{CSS}</style>
      <div className="absolute inset-0" style={{ animation: out && !reduce ? 'lanternDie 3.4s linear forwards' : undefined, opacity: out && reduce ? 0 : undefined }}>
      {ready && entry.lights.map((l, i) => {
        const cx = ox + (l.x / 100) * entry.w * s;
        const cy = oy + (l.y / 100) * entry.h * s;
        const rad = (l.r / 100) * entry.w * s;
        const slow = l.slow ?? 1;
        const power = l.power ?? 1;
        return (
          <div key={i}>
            {/* 넓게 번지는 빛무리 */}
            <div
              className="absolute rounded-full"
              style={{
                left: cx, top: cy, width: rad * 4.2, height: rad * 4.2,
                background: `radial-gradient(circle, rgba(255,196,110,${0.5 * power}) 0%, rgba(255,150,60,${0.2 * power}) 38%, rgba(255,130,40,0) 70%)`,
                transform: 'translate(-50%,-50%)',
                animation: reduce ? undefined : `lanternFlicker ${3.1 * slow}s ease-in-out ${i * 0.7}s infinite`,
                opacity: reduce ? 0.7 : undefined,
              }}
            />
            {/* 불꽃 중심 */}
            <div
              className="absolute rounded-full"
              style={{
                left: cx, top: cy, width: rad * 1.3, height: rad * 1.3,
                background: `radial-gradient(circle, rgba(255,236,190,${0.95 * power}) 0%, rgba(255,190,100,${0.45 * power}) 45%, rgba(255,170,80,0) 75%)`,
                transform: 'translate(-50%,-50%)',
                animation: reduce ? undefined : `lanternCore ${1.7 * slow}s ease-in-out ${i * 0.3}s infinite`,
                opacity: reduce ? 0.9 : undefined,
              }}
            />
            {/* 물 위의 반사: 아래로 길게 번지며 가로로 흔들린다 */}
            {l.reflect ? (
              <div
                className="absolute"
                style={{
                  left: cx, top: cy + rad * 0.9, width: rad * 0.9, height: (l.reflect / 100) * entry.h * s,
                  background: `linear-gradient(to bottom, rgba(255,190,100,${0.5 * power}), rgba(255,160,70,${0.18 * power}) 55%, rgba(255,140,50,0))`,
                  filter: 'blur(3px)',
                  transform: 'translateX(-50%)',
                  transformOrigin: '50% 0',
                  animation: reduce ? undefined : `lanternReflect ${2.4 * slow}s ease-in-out ${i * 0.5}s infinite`,
                  opacity: reduce ? 0.5 : undefined,
                }}
              />
            ) : null}
          </div>
        );
      })}
      </div>
    </motion.div>
    {/* 사진 속에 박힌 불빛은 꺼질 때 그 자리를 어둡게 덮는다 */}
    {ready && out && entry.lights.filter((l) => l.kill).map((l, i) => (
      <motion.div
        key={`kill-${i}`}
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          left: ox + (l.x / 100) * entry.w * s, top: oy + (l.y / 100) * entry.h * s,
          width: (l.r / 100) * entry.w * s * 4, height: (l.r / 100) * entry.w * s * 6,
          background: 'radial-gradient(ellipse, rgba(2,4,8,1) 0%, rgba(2,4,8,0.92) 45%, rgba(2,4,8,0) 75%)',
          transform: 'translate(-50%,-45%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0.3 : 3.4, ease: [0.4, 0, 0.9, 1] }}
      />
    ))}
    </>
  );
}
