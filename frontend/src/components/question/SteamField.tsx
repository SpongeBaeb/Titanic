'use client';

import { useEffect, useRef } from 'react';

/**
 * 캔버스 수증기: 구름처럼 불규칙한 스프라이트를 겹쳐 그린다.
 * - 평소: 바닥과 배관 쪽에서 느리게 피어오르는 옅은 김
 * - burst: 레버를 한 칸 넘길 때, 확정할 때 증기 배출구에서 뿜어 나오는 짧고 센 증기
 * 입자는 부력(위로 가며 느려짐), 난기류(좌우 흔들림), 커지며 옅어지는 수명을 가진다.
 */
export type SteamBurst = (clientX: number, clientY: number, power: number, dir?: number) => void;

type P = {
  x: number; y: number; vx: number; vy: number;
  size: number; grow: number; life: number; age: number;
  rot: number; rotv: number; alpha: number; sprite: number; seed: number;
};

const SPRITES = 6;

/** 불규칙한 뭉게구름 한 장: 흰 원형 그라디언트 여러 개를 겹쳐 가장자리를 흐린다 */
function makeSprite(seed: number): HTMLCanvasElement {
  const s = 160;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const blobs = 28;
  for (let i = 0; i < blobs; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * rnd() * s * 0.34;
    const x = s / 2 + Math.cos(a) * d;
    const y = s / 2 + Math.sin(a) * d * 0.85;
    const rad = s * (0.07 + rnd() * 0.17);
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(232,225,212,0.15)');
    grad.addColorStop(0.55, 'rgba(224,216,202,0.07)');
    grad.addColorStop(1, 'rgba(218,210,196,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export default function SteamField({ burstRef, reduced }: { burstRef: React.MutableRefObject<SteamBurst | null>; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduced) {
      burstRef.current = null;
      return;
    }
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sprites = Array.from({ length: SPRITES }, (_, i) => makeSprite(i + 3));
    const parts: P[] = [];
    let W = 0, H = 0, dpr = 1, raf = 0, last = performance.now(), acc = 0, running = true;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = (x: number, y: number, o: Partial<P> & { spread?: number }) => {
      if (parts.length > 260) parts.shift();
      parts.push({
        x, y,
        vx: o.vx ?? (Math.random() - 0.5) * 12,
        vy: o.vy ?? -(10 + Math.random() * 14),
        size: o.size ?? 60 + Math.random() * 60,
        grow: o.grow ?? 18 + Math.random() * 20,
        life: o.life ?? 5 + Math.random() * 3,
        age: 0,
        rot: Math.random() * Math.PI * 2,
        rotv: (Math.random() - 0.5) * 0.35,
        alpha: o.alpha ?? 0.5,
        sprite: Math.floor(Math.random() * SPRITES),
        seed: Math.random() * 1000,
      });
    };

    // 평소 배출구: 화면 비율 좌표. 배관 이음매와 바닥 쪽에서 천천히 피어오른다
    const vents = [
      { x: 0.1, y: 0.7, rate: 1.4, alpha: 0.33 },
      { x: 0.32, y: 0.5, rate: 0.8, alpha: 0.26 },
      { x: 0.9, y: 0.76, rate: 1.4, alpha: 0.33 },
      { x: 0.7, y: 0.4, rate: 0.7, alpha: 0.22 },
      { x: 0.5, y: 0.97, rate: 1.0, alpha: 0.3 },
    ];

    // 배출구에서 잠깐 이어서 뿜는 증기: 센 속도로 나와 급히 느려지며 퍼진다
    const jets: { x: number; y: number; dir: number; power: number; t: number; dur: number }[] = [];
    burstRef.current = (cx, cy, power, dir = 0) => {
      const r = canvas.getBoundingClientRect();
      jets.push({ x: cx - r.left, y: cy - r.top, dir, power, t: 0, dur: 0.4 + 0.25 * power });
    };

    const onVis = () => {
      running = !document.hidden;
      last = performance.now();
      if (running) raf = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', onVis);

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;

      // 평소 김 방출
      vents.forEach((v, i) => {
        if (Math.random() < v.rate * dt) {
          spawn(v.x * W + (Math.random() - 0.5) * 30, v.y * H, {
            vx: (Math.random() - 0.5) * 10,
            vy: -(8 + Math.random() * 10),
            size: 90 + Math.random() * 90,
            grow: 12 + Math.random() * 14,
            life: 6 + Math.random() * 4,
            alpha: v.alpha * (0.7 + Math.random() * 0.5) + i * 0,
          });
        }
      });

      for (let j = jets.length - 1; j >= 0; j--) {
        const jt = jets[j];
        jt.t += dt;
        if (jt.t > jt.dur) { jets.splice(j, 1); continue; }
        const fall = 1 - jt.t / jt.dur;
        const n = Math.round(60 * jt.power * dt * (0.4 + fall) + Math.random());
        for (let i = 0; i < n; i++) {
          const sp = (80 + Math.random() * 110) * (0.6 + jt.power * 0.4) * (0.5 + fall);
          const ang = -Math.PI / 2 + jt.dir * 0.55 + (Math.random() - 0.5) * 0.7;
          spawn(jt.x + (Math.random() - 0.5) * 8, jt.y + (Math.random() - 0.5) * 8, {
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            size: 26 + Math.random() * 26,
            grow: 70 + Math.random() * 60,
            life: 1.3 + Math.random() * 1.1,
            alpha: 0.2 + Math.random() * 0.14,
          });
        }
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        const t = p.age / p.life;
        if (t >= 1) {
          parts.splice(i, 1);
          continue;
        }
        // 부력: 올라갈수록 느려지고, 난기류로 좌우로 휘청인다
        const drag = Math.pow(0.35, dt);
        p.vx *= drag;
        p.vy = p.vy * drag - 5 * dt;
        p.vx += Math.sin(acc * 0.9 + p.seed + p.y * 0.01) * 9 * dt + Math.cos(acc * 0.6 + p.seed) * 4 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.grow * dt;
        p.rot += p.rotv * dt;
        // 천천히 나타나 오래 머물다 사라진다
        const a = p.alpha * Math.min(1, t / 0.12) * Math.pow(1 - t, 1.4);
        if (a < 0.004) continue;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const s = p.size;
        ctx.drawImage(sprites[p.sprite], -s / 2, -s / 2, s, s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      burstRef.current = null;
    };
  }, [reduced, burstRef]);

  if (reduced) return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
