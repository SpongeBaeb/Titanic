'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 또 다른 사무장 오리: 전신을 사면 오리 사무장의 동료가 왼쪽에서 걸어 나와 엉덩이를 씰룩샐룩 흔들다가,
 * 날아오는 신호(.morse-signal)가 머리 높이에 닿기 직전에 리듬 게임처럼 포즈를 탁탁 바꿔 가며 피한다.
 * 짧은 신호(점)는 신호마다 다른 포즈로, 긴 신호(선)는 납작 엎드려 꼬리를 까딱이며 다 지나갈 때까지 버틴다.
 * 춤은 tools/build_dodge_duck.py, 회피 포즈는 tools/build_dodge_poses.py 로 만든 그림을 쓰고,
 * 없으면 오리 사무장 그림(purser_idle, purser_bow)을 좌우로 뒤집어 대신한다.
 * spot: 합선으로 신호가 쏟아질 때 이 오리에게 스포트라이트를 비춘다(나머지 화면은 어두워진다).
 */
// 둠칫 안무 아홉 박자: 가운데 → 굽히며 왼쪽 → 왼쪽 → 굽히며 오른쪽 → 오른쪽 → 주먹(오른팔) → 주먹(왼팔) → 폴짝 → 착지.
// 한 박자마다 컷이 딱딱 바뀌는 스톱모션 춤이다. 합선(스포트라이트) 때는 박자가 빨라진다. 숙임 그림은 따로.
const DANCE = ['dance_c', 'dance_low_l', 'dodge_wiggle_a', 'dance_low_r', 'dodge_wiggle_b', 'dance_pump_r', 'dance_pump_l', 'dance_hands_up', 'dance_land'].map((n) => `/spend/${n}.webp`);
const DODGE_NAMES = ['limbo', 'split', 'lunge_l', 'lunge_r', 'cap', 'prone_a', 'prone_b'];
const DODGES = DODGE_NAMES.map((n) => `/spend/dodge_${n}.webp`);
// 포즈마다 그림 안의 몸 크기가 달라(웅크리거나 엎드린 그림은 서 있는 그림보다 몸이 작게 그려져 있다) 피하는 순간 오리가 작아 보였다.
// 서 있는 그림의 몸 크기를 기준으로 (기준 몸 면적 / 포즈의 몸 면적)의 제곱근만큼 키우되, 너무 커 보이지 않게 한 번 더 제곱근을 씌운 값이다. 발밑(바닥)을 기준으로 커진다.
const DODGE_SCALE: Record<string, number> = { limbo: 1, split: 1.15, lunge_l: 1.15, lunge_r: 1.17, cap: 1.19, prone_a: 1.25, prone_b: 1.25 };
const PRONE = [DODGE_NAMES.indexOf('prone_a'), DODGE_NAMES.indexOf('prone_b')];
const QUICK = DODGE_NAMES.map((_, k) => k).filter((k) => !PRONE.includes(k)); // 짧은 신호에 쓰는 포즈
const LUNGE = [DODGE_NAMES.indexOf('lunge_l'), DODGE_NAMES.indexOf('lunge_r')];
const DASH_W = 60; // 신호 폭이 이보다 넓으면 긴 신호(선)
const POP_MS = 150; // 포즈가 바뀔 때 몸이 눌렸다 튀어 오르는 시간
const WAG_MS = 170; // 엎드려 꼬리를 까딱이는 박자

/** 다음 포즈: 방금 쓴 포즈는 다시 안 쓰고, 런지는 왼쪽 다음엔 오른쪽만 나온다 */
function nextPose(last: number, lastLunge: number) {
  const pool = QUICK.filter((k) => k !== last && k !== lastLunge);
  return pool[Math.floor(Math.random() * pool.length)];
}
const FALLBACK = { idle: '/spend/purser_idle.webp', bow: '/spend/purser_bow.webp' }; // 그림이 없을 때만: 사무장 그림을 뒤집어 쓴다
const SIGNAL_ROW = 292; // 전신 신호가 날아가는 높이(화면 아래에서 px). 오리 키의 25% 지점에 오도록 서 있는다
const LEAD = 0.27; // 신호가 닿기 이 시간(초) 전에 숙이기 시작한다

// 합선 무대 연출 ─ 색 조명, 먼지 반짝이, 연기
const BEAMS = [
  { dx: -0.62, color: '#ff2f8f', swing: -16, dur: 1.7, delay: 0, alpha: 0.5 },
  { dx: -0.3, color: '#2fd8ff', swing: 14, dur: 2.1, delay: 0.3, alpha: 0.5 },
  { dx: 0, color: '#fff1c9', swing: 0, dur: 0, delay: 0, alpha: 0.46 }, // 오리를 곧게 비추는 흰 조명
  { dx: 0.3, color: '#ffd32f', swing: -13, dur: 1.9, delay: 0.15, alpha: 0.5 },
  { dx: 0.62, color: '#8a5bff', swing: 17, dur: 2.4, delay: 0.5, alpha: 0.5 },
];
const SPARKS = [
  { x: -0.42, y: -0.32, size: 4, color: '#ffe9a0', dur: 1.3, delay: 0 }, { x: 0.38, y: -0.4, size: 3, color: '#9be8ff', dur: 1.7, delay: 0.4 },
  { x: -0.2, y: 0.05, size: 3, color: '#ff9bd3', dur: 1.5, delay: 0.8 }, { x: 0.48, y: -0.05, size: 4, color: '#ffe9a0', dur: 1.2, delay: 0.2 },
  { x: -0.55, y: 0.22, size: 3, color: '#b9a0ff', dur: 1.8, delay: 1.0 }, { x: 0.15, y: -0.25, size: 3, color: '#9be8ff', dur: 1.4, delay: 0.6 },
  { x: 0.55, y: 0.3, size: 4, color: '#ff9bd3', dur: 1.6, delay: 0.1 }, { x: -0.1, y: 0.3, size: 3, color: '#ffe9a0', dur: 1.1, delay: 0.9 },
];
const FOG = [
  { x: -0.35, y: 0.38, w: 0.9, color: 'rgba(255,120,200,0.45)', drift: 0.22, dur: 4.2, delay: 0 },
  { x: 0.3, y: 0.4, w: 1.0, color: 'rgba(110,210,255,0.4)', drift: -0.2, dur: 5.0, delay: 0.6 },
  { x: 0, y: 0.34, w: 1.1, color: 'rgba(255,255,255,0.32)', drift: 0.12, dur: 3.6, delay: 0.3 },
  { x: -0.5, y: 0.44, w: 0.8, color: 'rgba(255,220,120,0.35)', drift: 0.25, dur: 4.6, delay: 1.0 },
  { x: 0.55, y: 0.45, w: 0.8, color: 'rgba(170,130,255,0.4)', drift: -0.24, dur: 4.0, delay: 0.2 },
];
const PUFFS = [
  { x: -0.3, rise: 0.75, sway: -0.08, color: 'rgba(255,255,255,0.55)', dur: 3.0, delay: 0 }, { x: 0.05, rise: 0.9, sway: 0.1, color: 'rgba(255,140,210,0.55)', dur: 3.4, delay: 0.5 },
  { x: 0.35, rise: 0.7, sway: 0.06, color: 'rgba(120,220,255,0.5)', dur: 2.8, delay: 1.0 }, { x: -0.1, rise: 1.0, sway: -0.12, color: 'rgba(255,225,130,0.5)', dur: 3.8, delay: 1.4 },
  { x: 0.5, rise: 0.8, sway: -0.07, color: 'rgba(255,255,255,0.5)', dur: 3.2, delay: 0.8 }, { x: -0.5, rise: 0.85, sway: 0.09, color: 'rgba(180,140,255,0.5)', dur: 3.5, delay: 1.9 },
];
const STAGE_CSS = `
@keyframes duckBeamSwing{from{transform:rotate(var(--a))}to{transform:rotate(calc(var(--a) * -1))}}
@keyframes duckPoolHue{from{filter:hue-rotate(0deg) blur(3px)}to{filter:hue-rotate(360deg) blur(3px)}}
@keyframes duckSpark{0%,100%{opacity:0;transform:scale(.4)}45%{opacity:1;transform:scale(1.4)}70%{opacity:.5;transform:scale(.8)}}
@keyframes duckFog{from{transform:translateX(calc(var(--dx) * -1)) scale(.9);opacity:.5}to{transform:translateX(var(--dx)) scale(1.2);opacity:.95}}
@keyframes duckPuff{0%{transform:translate(0,0) scale(.5);opacity:0}18%{opacity:.9}100%{transform:translate(var(--sx),var(--rise)) scale(1.9);opacity:0}}
`;

export default function DodgeDuck({ spot = false, enter = true }: { spot?: boolean; /** true 가 되면 왼쪽에서 걸어 들어온다 (사무장이 "저쪽은 내 동료요" 하는 순간) */ enter?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState(false); // 정식 그림 세 장이 모두 있을 때
  const [flip, setFlip] = useState(false); // (임시 그림일 때만) 좌우로 번갈아 기울이는 박자
  const [ducked, setDucked] = useState(false);
  const [entered, setEntered] = useState(false); // 왼쪽에서 걸어 들어온다
  const [H, setH] = useState(300);
  const [pos, setPos] = useState({ x: 160, y: 500 }); // 스포트라이트 중심(오리 몸 한가운데)
  const duckedRef = useRef(false);
  const releaseAt = useRef(0);
  const frameRefs = useRef<(HTMLImageElement | null)[]>([]);
  const dodgeRefs = useRef<(HTMLImageElement | null)[]>([]);
  const poseRef = useRef(-1); // 지금 보이는 회피 포즈 (-1 이면 춤)
  const lastPose = useRef(-1);
  const lastLunge = useRef(-1);
  const signalRef = useRef<string | null>(null); // 지금 피하고 있는 신호
  const popAt = useRef(-1000); // 포즈가 바뀐 시각
  const danceRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef(spot);
  spotRef.current = spot;

  useEffect(() => {
    if (!enter) return;
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, [enter]);

  useEffect(() => {
    const f = () => setH(Math.round(Math.min(320, Math.max(200, window.innerHeight * 0.38))));
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  // 정식 그림이 있는지 확인
  useEffect(() => {
    let ok = 0; let cancelled = false;
    const all = [...DANCE, ...DODGES];
    all.forEach((src) => {
      const im = new Image();
      im.onload = () => { ok += 1; if (!cancelled && ok === all.length) setCustom(true); };
      im.src = src;
    });
    return () => { cancelled = true; };
  }, []);

  // 스포트라이트 위치: 켜질 때 오리의 현재 자리를 잰다
  useEffect(() => {
    if (!spot) return;
    const r = boxRef.current?.getBoundingClientRect();
    if (r) setPos({ x: r.left + r.width / 2, y: r.top + r.height * 0.55 });
  }, [spot, H, entered]);

  useEffect(() => {
    if (custom || ducked) return;
    const t = setInterval(() => setFlip((v) => !v), spot ? 120 : 300);
    return () => clearInterval(t);
  }, [custom, ducked, spot]);

  // 신호가 머리 높이로 다가오면 숙이고, 다 지나가면 일어난다
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // 둠칫: 한 박자마다 다음 컷으로 딱 바뀌고, 박자가 시작되는 순간 무릎이 굽어 몸이 눌렸다가 튀어 오른다
      const beat = spotRef.current ? 300 : 460;
      const idx = Math.floor(now / beat) % DANCE.length;
      const popPh = Math.min(1, (now - popAt.current) / POP_MS);
      const pop = Math.pow(1 - popPh, 3);
      if (danceRef.current && (duckedRef.current || popPh < 1)) {
        // 포즈가 바뀌는 순간 납작 눌렸다가 탁 펴진다
        danceRef.current.style.transform = `scale(${(1 + 0.14 * pop).toFixed(3)}, ${(1 - 0.18 * pop).toFixed(3)})`;
      } else if (danceRef.current) {
        const ph = (now % beat) / beat; // 박자 안의 위치 0~1
        const low = Math.pow(1 - ph, 3); // 박자 시작에 가장 눌리고 빠르게 회복
        const k = spotRef.current ? 1.5 : 1;
        danceRef.current.style.transform = `translateY(${(-(1 - low) * 3 * k).toFixed(2)}px) scale(${(1 + 0.025 * low * k).toFixed(3)}, ${(1 - 0.045 * low * k).toFixed(3)})`;
      }
      const box = boxRef.current;
      if (!box) return;
      const d = box.getBoundingClientRect();
      const speed = window.innerWidth / 2; // 신호는 2초에 화면 폭만큼 날아간다 (px/초)
      let threat: Element | null = null;
      let threatGap = Infinity;
      document.querySelectorAll('.morse-signal').forEach((sig) => {
        const r = sig.getBoundingClientRect();
        const cy = r.top + r.height / 2;
        if (cy < d.top - 30 || cy > d.top + d.height * 0.55) return; // 머리 높이가 아니면 상관없다
        const gap = r.left - d.right; // 신호 앞머리와 오리 사이 거리 (음수면 이미 겹침)
        const passed = r.right < d.left - 16; // 완전히 지나갔다
        if (!passed && gap / speed < LEAD && gap < threatGap) { threat = sig; threatGap = gap; }
      });
      if (threat) {
        releaseAt.current = now + 140; // 다 지나간 뒤에도 잠깐 더 숙이고 있는다
        if (!duckedRef.current) { duckedRef.current = true; setDucked(true); }
        const el = threat as Element;
        const id = el.getAttribute('data-id');
        // 새 신호가 올 때마다 다른 포즈로 탁 바꾼다
        if (id !== signalRef.current) {
          signalRef.current = id;
          if (el.getBoundingClientRect().width > DASH_W) poseRef.current = PRONE[0];
          else {
            const p = nextPose(lastPose.current, lastLunge.current);
            poseRef.current = p;
            lastPose.current = p;
            if (LUNGE.includes(p)) lastLunge.current = p;
          }
          popAt.current = now;
        }
      } else if (duckedRef.current && now > releaseAt.current) {
        duckedRef.current = false; setDucked(false);
        signalRef.current = null;
        poseRef.current = -1;
        popAt.current = now;
      }
      // 엎드려 있을 때는 꼬리를 까딱인다
      let shown = poseRef.current;
      if (PRONE.includes(shown)) shown = PRONE[Math.floor(now / WAG_MS) % 2];
      dodgeRefs.current.forEach((el, k) => { if (el) el.style.opacity = k === shown ? '1' : '0'; });
      frameRefs.current.forEach((el, k) => { if (el) el.style.opacity = !duckedRef.current && k === idx ? '1' : '0'; });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const src = ducked ? FALLBACK.bow : FALLBACK.idle;
  const bottom = Math.max(8, SIGNAL_ROW - H * 0.75);
  const beamW = H * 1.15;

  return (
    <>
      {/* 합선 무대: 오리 주변만 밝고 나머지는 어두워진다. 여러 색 조명이 천장에서 좌우로 휘젓고, 바닥에는 색이 도는 빛무리와 연기가 깔린다 */}
      <style>{STAGE_CSS}</style>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[57] transition-opacity duration-500"
        style={{
          opacity: spot ? 1 : 0,
          background: `radial-gradient(ellipse ${H * 0.62}px ${H * 0.74}px at ${pos.x}px ${pos.y}px, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.86) 100%)`,
        }}
      />
      {/* 조명 다섯 줄기: 가운데는 따뜻한 흰빛으로 오리를 비추고, 양옆의 색 조명은 서로 다른 박자로 흔들린다 */}
      {BEAMS.map((bm, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none fixed z-[57] transition-opacity duration-500"
          style={{
            opacity: spot ? bm.alpha : 0,
            left: pos.x - beamW / 2 + bm.dx * H,
            top: 0,
            width: beamW,
            height: pos.y + H * 0.36,
            clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
            background: `linear-gradient(to bottom, ${bm.color}00, ${bm.color}cc 62%, ${bm.color}44)`,
            mixBlendMode: 'screen',
            filter: 'blur(4px)',
            transformOrigin: '50% 0',
            ['--a' as string]: `${bm.swing}deg`,
            animation: spot && bm.swing ? `duckBeamSwing ${bm.dur}s ease-in-out ${bm.delay}s infinite alternate` : undefined,
          }}
        />
      ))}
      {/* 발밑의 빛무리: 색이 천천히 돈다 */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-[57] transition-opacity duration-500"
        style={{
          opacity: spot ? 1 : 0,
          left: pos.x - H * 0.5,
          top: pos.y + H * 0.34,
          width: H,
          height: H * 0.2,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,70,170,0.75), rgba(60,200,255,0.35) 45%, rgba(255,255,255,0) 72%)',
          mixBlendMode: 'screen',
          animation: spot ? 'duckPoolHue 2.4s linear infinite' : undefined,
        }}
      />
      {/* 반짝이: 조명에 걸린 먼지와 종이 조각 */}
      {spot && SPARKS.map((sp, i) => (
        <div
          key={`sp${i}`}
          aria-hidden
          className="pointer-events-none fixed z-[59] rounded-full"
          style={{
            left: pos.x + sp.x * H, top: pos.y + sp.y * H, width: sp.size, height: sp.size,
            background: sp.color, boxShadow: `0 0 ${sp.size * 3}px ${sp.color}`,
            animation: `duckSpark ${sp.dur}s ease-in-out ${sp.delay}s infinite`,
          }}
        />
      ))}
      {/* 연기: 바닥을 따라 옆으로 번지는 안개 몇 겹과, 조명 색을 받으며 피어오르는 연기 덩어리 */}
      {spot && FOG.map((f, i) => (
        <div
          key={`fog${i}`}
          aria-hidden
          className="pointer-events-none fixed z-[59]"
          style={{
            left: pos.x + f.x * H - f.w * H / 2, top: pos.y + H * f.y, width: f.w * H, height: f.w * H * 0.42, borderRadius: '50%',
            background: `radial-gradient(ellipse, ${f.color}, rgba(255,255,255,0) 70%)`, filter: 'blur(14px)', mixBlendMode: 'screen',
            ['--dx' as string]: `${f.drift * H}px`,
            animation: `duckFog ${f.dur}s ease-in-out ${f.delay}s infinite alternate`,
          }}
        />
      ))}
      {spot && PUFFS.map((pf, i) => (
        <div
          key={`pf${i}`}
          aria-hidden
          className="pointer-events-none fixed z-[59]"
          style={{
            left: pos.x + pf.x * H - H * 0.14, top: pos.y + H * 0.36, width: H * 0.28, height: H * 0.28, borderRadius: '50%',
            background: `radial-gradient(circle, ${pf.color}, rgba(255,255,255,0) 68%)`, filter: 'blur(9px)', mixBlendMode: 'screen',
            ['--rise' as string]: `${-H * pf.rise}px`, ['--sx' as string]: `${pf.sway * H}px`,
            animation: `duckPuff ${pf.dur}s ease-out ${pf.delay}s infinite`,
          }}
        />
      ))}

      <div
        ref={boxRef}
        aria-hidden
        className="pointer-events-none fixed z-[58]"
        // 엎드린 그림은 키운 만큼 옆으로 퍼지므로 왼쪽 화면 밖으로 잘리지 않게 오리 키에 비례해 안쪽에 선다
        style={{ left: `max(1.5vw, ${Math.round(H * 0.19)}px)`, bottom, height: H, width: H * 0.62, transform: entered ? 'translateX(0)' : 'translateX(-180%)', transition: 'transform 1.6s cubic-bezier(.25,.8,.3,1)' }}
      >
        {custom ? (
          <div ref={danceRef} className="absolute inset-0" style={{ transformOrigin: '50% 100%' }}>
            {/* 서 있을 때: 흔들기 다섯 컷을 겹쳐 두고 투명도로 하나만 보인다 (바뀔 때 깜빡이지 않는다). 숙일 때는 모두 사라지고 숙인 그림이 나타난다 */}
            {DANCE.map((src, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                ref={(el) => { frameRefs.current[k] = el; }}
                src={src}
                alt=""
                draggable={false}
                className="absolute bottom-0 left-1/2 block max-w-none -translate-x-1/2 drop-shadow-[0_10px_12px_rgba(0,0,0,0.5)]"
                style={{ height: '100%', width: 'auto', opacity: k === 0 ? 1 : 0 }}
              />
            ))}
            {/* 회피 포즈도 겹쳐 두고 한 컷씩 탁탁 바꾼다 */}
            {DODGES.map((src, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                ref={(el) => { dodgeRefs.current[k] = el; }}
                src={src}
                alt=""
                draggable={false}
                className="absolute bottom-0 left-1/2 block max-w-none -translate-x-1/2 drop-shadow-[0_10px_12px_rgba(0,0,0,0.5)]"
                style={{ height: '100%', width: 'auto', opacity: 0, transform: `scale(${DODGE_SCALE[DODGE_NAMES[k]] ?? 1})`, transformOrigin: '50% 100%' }}
              />
            ))}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute bottom-0 left-1/2 block max-w-none -translate-x-1/2 drop-shadow-[0_10px_12px_rgba(0,0,0,0.5)]"
            style={{
              height: '100%',
              width: 'auto',
              transformOrigin: '50% 100%',
              transform: `translateX(-50%) scaleX(-1) ${ducked ? '' : `rotate(${flip ? 6 : -6}deg) skewX(${flip ? -5 : 5}deg)`}`,
              transition: 'transform 280ms ease-in-out',
            }}
          />
        )}
      </div>
    </>
  );
}
