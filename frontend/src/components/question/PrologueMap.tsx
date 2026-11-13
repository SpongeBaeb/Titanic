'use client';

import { motion, useMotionValueEvent, useMotionTemplate, useTransform, AnimatePresence, useMotionValue, animate, useReducedMotion , type MotionStyle, type MotionValue } from 'framer-motion';
import ClassicButton from '@/components/ui/ClassicButton';
import { useRef, useEffect, useState } from 'react';

interface PrologueMapProps {
  onSelectPort: (embarked: string) => void;
}

// 추출된 총 프레임 수
const FRAME_COUNT = 121;
// 도입 연출이 재생되는 진행도의 끝 (0.1 = 처음 12프레임)
const INTRO_END = 0.1;
// 처음에 받을 대표 프레임 간격 (0, 8, 16 … 120 → 16장). 이것만 받으면 화면을 보여준다.
const KEY_FRAME_STEP = 8;
// 화면 폭이 이 이하면 모바일용(864px) 프레임을 쓴다 (scripts/optimize_images.py frames)
const MOBILE_QUERY = '(max-width: 768px)';
const LOAD_CONCURRENCY = 6;

/**
 * 다이아몬드 반짝임: 보내 주신 별 그림(가로·세로로 긴 빛줄기 4개, 대각선으로 짧은 빛줄기 4개, 한가운데의 밝은 점)을 SVG 로 그대로 그렸다.
 * 빛줄기는 가운데가 하얗고 끝으로 갈수록 연한 푸른빛이 돌며 투명해진다. 둥근 후광은 없고, 은은한 빛은 같은 별 모양을 흐리게 한 번 더 깔아 만든다.
 * 평소에는 흐린 별이 천천히 숨 쉬듯 빛나고, 주기적으로 크게 번쩍인다. 크기는 명패 너비(--plate)에 비례한다.
 */
const RAYS_LONG = [0, 90, 180, 270];
const RAYS_SHORT = [45, 135, 225, 315];
function StarShape({ blur = 0 }: { blur?: number }) {
  return (
    <g filter={blur ? 'url(#q7StarBlur)' : undefined}>
      {RAYS_LONG.map((r) => <path key={r} d="M0 -1.9 L100 0 L0 1.9 Z" fill="url(#q7RayFill)" transform={`rotate(${r})`} />)}
      {RAYS_SHORT.map((r) => <path key={r} d="M0 -1.5 L100 0 L0 1.5 Z" fill="url(#q7RayFill)" transform={`rotate(${r}) scale(0.66 1)`} />)}
      <circle r="5.5" fill="url(#q7StarCore)" />
    </g>
  );
}
function StarDefs() {
  return (
    <defs>
      <linearGradient id="q7RayFill" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="18%" stopColor="#f2f9ff" stopOpacity="0.95" />
        <stop offset="55%" stopColor="#bfe0ff" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#9fd0ff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="q7StarCore">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#dff0ff" stopOpacity="0" />
      </radialGradient>
      <filter id="q7StarBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" /></filter>
    </defs>
  );
}
function Star({ size, x = 0, y = 0, delay, gap, peak = 1, glow = 0.8 }: { size: string; x?: number; y?: number; delay: number; gap: number; peak?: number; glow?: number }) {
  return (
    <svg
      viewBox="-100 -100 200 200"
      className="absolute"
      style={{ left: `calc(var(--plate) * ${x})`, top: `calc(var(--plate) * ${y})`, width: size, height: size, marginLeft: `calc(${size} / -2)`, marginTop: `calc(${size} / -2)`, overflow: 'visible' }}
    >
      <StarDefs />
      {/* 은은한 빛: 흐린 별이 천천히 숨 쉬듯 */}
      <motion.g
        initial={{ opacity: 0.14, scale: 0.45 }}
        animate={{ opacity: [0.1, 0.26, 0.1], scale: [0.42, 0.52, 0.42] }}
        transition={{ duration: 3.8, delay, repeat: Infinity, ease: 'easeInOut' }}
      >
        <StarShape blur={1} />
      </motion.g>
      {/* 크게 번쩍임 */}
      <motion.g
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, glow, 0], scale: [0.25, peak, 0.3], rotate: [-3, 0, 3] }}
        transition={{ duration: 1.5, delay: delay + 0.9, repeat: Infinity, repeatDelay: gap, ease: 'easeInOut', times: [0, 0.42, 1] }}
      >
        <StarShape blur={1} />
        <StarShape />
      </motion.g>
    </svg>
  );
}
function DiamondSparkle({ reduce }: { reduce: boolean }) {
  // 반짝임은 반드시 다이아몬드 안에서만 보인다: 보석 크기(명패 너비의 약 5.2%)의 원 안으로 잘라 낸다. 명패 그림 속 보석의 중심은 가로 49.9%, 세로 8.6%
  const GEM = 'calc(var(--plate) * 0.052)';
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute overflow-hidden rounded-full"
      style={{ left: '49.9%', top: '8.6%', width: GEM, height: GEM, transform: 'translate(-50%, -50%)' }}
    >
      <div className="absolute" style={{ left: '50%', top: '50%', width: 0, height: 0 }}>
        {reduce ? (
          // 움직임 줄이기: 움직이지 않는 은은한 별 하나
          <svg viewBox="-100 -100 200 200" className="absolute" style={{ left: 0, top: 0, width: GEM, height: GEM, marginLeft: `calc(${GEM} / -2)`, marginTop: `calc(${GEM} / -2)`, overflow: 'visible', opacity: 0.45 }}>
            <StarDefs /><g transform="scale(0.55)"><StarShape blur={1} /></g>
          </svg>
        ) : (
          <>
            {/* 보석이 번쩍일 때 같은 모양의 하얀 면이 순간 빛난다 */}
            <motion.span
              className="absolute block rounded-full"
              style={{ left: 'calc(var(--plate) * -0.016)', top: 'calc(var(--plate) * -0.016)', width: 'calc(var(--plate) * 0.032)', height: 'calc(var(--plate) * 0.032)', background: 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(220,238,255,0) 72%)', mixBlendMode: 'screen' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.45, 0] }}
              transition={{ duration: 0.9, delay: 3.2, repeat: Infinity, repeatDelay: 4.2, ease: 'easeInOut', times: [0, 0.4, 1] }}
            />
            {/* 작은 별 셋이 보석 안에서 은은하게 어긋나며 반짝인다 */}
            <Star size={GEM} delay={2.3} gap={3.4} peak={0.95} glow={0.85} />
            <Star size="calc(var(--plate) * 0.032)" x={-0.011} y={-0.008} delay={3.1} gap={4.4} peak={0.95} glow={0.8} />
            <Star size="calc(var(--plate) * 0.026)" x={0.012} y={0.009} delay={4.0} gap={5.0} peak={0.95} glow={0.75} />
          </>
        )}
      </div>
    </div>
  );
}

export default function PrologueMap({ onSelectPort }: PrologueMapProps) {
  const mapScrollRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [ticketX, setTicketX] = useState(0);
  const [ticketY, setTicketY] = useState(0);
  const tearX = 27.5; // 찢어지는 X 위치 (퍼센트) 고정
  const tearProgress = useMotionValue(0);
  
  const rightY = useTransform(tearProgress, (val) => val);
  const rightX = useTransform(tearProgress, [0, 500], [0, 50]);
  const rightRotate = useTransform(tearProgress, [0, 500], [0, 15]);

  const handlePortClick = (port: string) => {
    setSelectedPort(port);
    setShowTicket(true);
    tearProgress.set(0);
  };

  // 한 화면 안에서 장면이 바뀐다: 스크롤로 아래로 내려가지 않고, 같은 자리에서 배 영상이 다가오며 지도가 겹쳐 나타난다.
  // fp: 영상 진행도(0~1). 도입 연출은 0~0.1, 지도로 넘어가면 1.
  const fp = useMotionValue(0);
  const [phase, setPhase] = useState<'hero' | 'map'>('hero');
  const phaseRef = useRef<'hero' | 'map'>('hero');
  const busy = useRef(false);
  const introCtl = useRef<{ stop: () => void } | null>(null);
  const showTicketRef = useRef(false);
  showTicketRef.current = showTicket;

  // 현창으로 빨려 들어가는 장면 전환: 글자들은 시차를 두고 위로 걷히고, 황동 현창 고리가 화면을 가득 채우도록 커지며,
  // 고리의 유리 구멍 안으로 지도가 원형으로 퍼져 나타난다. 고리 위치와 크기는 넘어가기 시작할 때 잰다.
  // 배경 영상 속 배의 선체 창(현창) 하나를 따라간다. 프레임 0, 12, 24 … 120 에서 그 창이 있는 자리(프레임 원본 1296x704 기준)를 미리 재 두었다.
  const WIN_X = [585.5, 585.6, 583.8, 583.7, 584.8, 582, 578.9, 580.7, 581.2, 582.1, 578.8];
  const WIN_Y = [398.4, 406.5, 416.3, 428.1, 444.5, 460, 476.7, 500.1, 522, 544.4, 563.8];
  const WIN_AT = WIN_X.map((_, k) => k / 10);
  const ringBase = 13; // 처음 창의 크기(px)
  const winScreen = (v: number, axis: 'x' | 'y') => {
    const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const vh = typeof window === 'undefined' ? 720 : window.innerHeight;
    const f = Math.min(1, Math.max(0, v)) * 10;
    const k = Math.min(9, Math.floor(f));
    const w = f - k;
    const fx = WIN_X[k] + (WIN_X[k + 1] - WIN_X[k]) * w;
    const fy = WIN_Y[k] + (WIN_Y[k + 1] - WIN_Y[k]) * w;
    const sc = Math.max(vw / 1296, vh / 704);
    const zoom = 1 + 0.14 * Math.min(1, Math.max(0, (v - INTRO_END) / (1 - INTRO_END)));
    const px = (vw - 1296 * sc) / 2 + fx * sc;
    const py = (vh - 704 * sc) / 2 + fy * sc;
    return axis === 'x' ? vw / 2 + (px - vw / 2) * zoom : vh / 2 + (py - vh / 2) * zoom;
  };
  void WIN_AT;
  const ringCx = useTransform(fp, (v) => winScreen(v, 'x'));
  const ringCy = useTransform(fp, (v) => winScreen(v, 'y'));
  const useExit = (a: number, b: number, dy: number) => ({
    opacity: useTransform(fp, [a, b], [1, 0]),
    y: useTransform(fp, [a, b], [0, dy]),
  });
  const exitBrand = useExit(0.1, 0.4, -70);
  const exitPlate = useExit(0.11, 0.5, -110);
  const exitHook = useExit(0.12, 0.44, -60);
  const exitSub = useExit(0.13, 0.4, -40);
  const exitDivider = useExit(0.13, 0.38, -24);
  const exitLabel = useExit(0.12, 0.38, 30);
  // 창이 커지는 정도: 처음에는 선체의 작은 창, 뒤로 갈수록 지수적으로 커져 화면 전체를 삼킨다.
  // 값들끼리 서로 이어 받지 않고 모두 fp 하나에서 직접 계산한다 (이어 받으면 한 박자씩 어긋나 지도와 고리가 맞지 않는다)
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  // 초반에는 아예 보이지 않다가 후반(0.58 근처)에 한 번에 나타나, 거기서부터 화면 전체로 커진다
  const scaleAt = (v: number) => (v < 0.58 ? 6 * (0.7 + 0.3 * clamp01((v - 0.55) / 0.03)) : 6 * Math.pow(63, clamp01((v - 0.58) / 0.37)));
  // 선체는 비스듬히 보이므로 창도 처음에는 옆면에 붙은 타원으로 시작해, 커지면서 정면을 향하도록 돌아선다
  const turnAt = (v: number) => {
    const t = clamp01((v - 0.58) / 0.32);
    return 62 * (1 - t * t * (3 - 2 * t));
  };
  const pitchAt = (v: number) => -turnAt(v) * (14 / 62); // 아래쪽으로도 살짝 기울어 있다
  const radiusAt = (v: number) => {
    const s = scaleAt(v);
    // 창이 나타나는 순간부터 구멍 안에는 다음 화면(지도)이 비친다
    return v < 0.55 ? 0 : 0.32 * ringBase * s;
  };
  const ringScale = useTransform(fp, scaleAt);
  const ringTurn = useTransform(fp, turnAt);
  const ringPitch = useTransform(fp, pitchAt);
  const ringOpacity = useTransform(fp, [0.55, 0.575, 0.93, 0.99], [0, 1, 1, 0]);
  const arrowOpacity = useTransform(fp, [0.1, 0.2], [1, 0]);
  const bgZoom = useTransform(fp, [INTRO_END, 1], [1, 1.14]);
  const clipRy = useTransform(fp, (v) => radiusAt(v) * Math.cos((pitchAt(v) * Math.PI) / 180));
  const clipRx = useTransform(fp, (v) => radiusAt(v) * Math.cos((turnAt(v) * Math.PI) / 180));
  const mapClip = useMotionTemplate`ellipse(${clipRx}px ${clipRy}px at ${ringCx}px ${ringCy}px)`;

  const goMap = () => {
    if (busy.current || phaseRef.current === 'map') return;
    busy.current = true;
    introCtl.current?.stop();
    animate(fp, 1, {
      duration: reduceMotion ? 0.01 : 4.6,
      ease: [0.5, 0, 0.25, 1],
      onComplete: () => {
        phaseRef.current = 'map';
        setPhase('map');
        busy.current = false;
      },
    });
  };
  const goHero = () => {
    if (busy.current || phaseRef.current === 'hero') return;
    busy.current = true;
    phaseRef.current = 'hero';
    setPhase('hero');
    animate(fp, INTRO_END, {
      duration: reduceMotion ? 0.01 : 1.8,
      ease: [0.45, 0, 0.2, 1],
      onComplete: () => {
        busy.current = false;
      },
    });
  };
  const nav = useRef({ goMap, goHero });
  nav.current = { goMap, goHero };

  // 휠, 터치 스와이프, 키보드로 장면을 넘긴다
  useEffect(() => {
    const mapAtTop = () => (mapScrollRef.current?.scrollTop ?? 0) <= 1;
    const onWheel = (e: WheelEvent) => {
      if (phaseRef.current === 'hero') {
        if (e.deltaY > 12) nav.current.goMap();
      } else if (e.deltaY < -12 && !showTicketRef.current && mapAtTop()) {
        nav.current.goHero();
      }
    };
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0]?.clientY ?? 0; };
    const onTouchEnd = (e: TouchEvent) => {
      const dy = startY - (e.changedTouches[0]?.clientY ?? startY);
      if (phaseRef.current === 'hero') {
        if (dy > 50) nav.current.goMap();
      } else if (dy < -60 && !showTicketRef.current && mapAtTop()) {
        nav.current.goHero();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current === 'hero' && (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'End')) {
        e.preventDefault();
        nav.current.goMap();
      } else if (phaseRef.current === 'map' && !showTicketRef.current && (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Escape')) {
        if (mapAtTop()) { e.preventDefault(); nav.current.goHero(); }
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // 요청한 프레임이 아직 없으면 가장 가까운 받은 프레임을 찾는다
  const findLoadedFrame = (index: number): HTMLImageElement | null => {
    const imgs = imagesRef.current;
    for (let d = 0; d < FRAME_COUNT; d++) {
      for (const i of [index - d, index + d]) {
        const im: HTMLImageElement | undefined = imgs[i];
        if (im && im.complete && im.naturalWidth > 0) return im;
      }
    }
    return null;
  };

  // 캔버스에 이미지를 그리는 핵심 함수 (object-cover 효과 구현).
  // index 는 소수일 수 있다: 두 프레임 사이는 뒤 프레임을 소수 부분만큼 흐리게 겹쳐(크로스페이드) 느린 움직임도 뚝뚝 끊기지 않고 부드럽게 보이게 한다.
  const renderFrame = (index: number) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); // alpha false로 렌더링 성능 최적화
    if (!ctx) return;

    const i0 = Math.max(0, Math.min(FRAME_COUNT - 1, Math.floor(index)));
    const frac = Math.max(0, Math.min(1, index - i0));
    const img = findLoadedFrame(i0);
    if (!img) return;

    // 디스플레이 해상도에 맞게 캔버스 크기 조정 (바뀔 때만: 매번 다시 잡으면 캔버스가 지워지고 다시 할당돼 끊긴다)
    if (canvas.width !== window.innerWidth) canvas.width = window.innerWidth;
    if (canvas.height !== window.innerHeight) canvas.height = window.innerHeight;

    // 부드러운 렌더링을 위한 이미지 스무딩
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const draw = (im: HTMLImageElement) => {
      // CSS의 object-cover와 동일하게 계산
      const ratio = Math.max(canvas.width / im.width, canvas.height / im.height);
      const sx = (canvas.width - im.width * ratio) / 2;
      const sy = (canvas.height - im.height * ratio) / 2;
      ctx.drawImage(im, 0, 0, im.width, im.height, sx, sy, im.width * ratio, im.height * ratio);
    };
    ctx.globalAlpha = 1;
    draw(img);
    if (frac > 0.02 && i0 < FRAME_COUNT - 1) {
      const next = findLoadedFrame(i0 + 1);
      if (next && next !== img) { ctx.globalAlpha = frac; draw(next); ctx.globalAlpha = 1; }
    }
  };
  /** 진행도(0~1)를 소수 프레임 번호로 바꾼다 */
  const frameOf = (progress: number) => Math.min(FRAME_COUNT - 1, Math.max(0, progress) * (FRAME_COUNT - 1));

  // 프레임 점진적 로딩: 대표 프레임(16장)만 받으면 화면을 보여주고,
  // 나머지는 거친 간격(4 → 2 → 1)부터 백그라운드에서 채운다.
  useEffect(() => {
    let cancelled = false;
    const dir = window.matchMedia(MOBILE_QUERY).matches ? 'frames-m' : 'frames-d';
    imagesRef.current = new Array(FRAME_COUNT);

    const load = (i: number) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (!cancelled) imagesRef.current[i] = img;
          resolve();
        };
        // 누락된 프레임은 건너뛰고 가까운 프레임을 대신 쓴다
        img.onerror = () => resolve();
        img.src = `/bg/${dir}/frame_${i.toString().padStart(4, '0')}.webp`;
      });

    // 로딩 순서: 대표 프레임 → 4칸 간격 → 2칸 간격 → 나머지
    const seen = new Set<number>();
    const passes: number[][] = [];
    // 도입 연출(배가 천천히 다가오는 0~INTRO_END 구간)이 도중에 뚝뚝 끊기지 않도록, 그 구간의 프레임은 처음부터 모두 받아 둔다
    const introIds = Array.from({ length: Math.ceil(INTRO_END * (FRAME_COUNT - 1)) + 3 }, (_, i) => i);
    for (const step of [KEY_FRAME_STEP, 4, 2, 1]) {
      const ids: number[] = [];
      if (step === KEY_FRAME_STEP) for (const i of introIds) { if (!seen.has(i)) { seen.add(i); ids.push(i); } }
      for (let i = 0; i < FRAME_COUNT; i += step) {
        if (!seen.has(i)) { seen.add(i); ids.push(i); }
      }
      if (step === KEY_FRAME_STEP && !seen.has(FRAME_COUNT - 1)) {
        seen.add(FRAME_COUNT - 1);
        ids.push(FRAME_COUNT - 1);
      }
      passes.push(ids);
    }

    const runPass = async (ids: number[], onEach?: () => void) => {
      let next = 0;
      const worker = async () => {
        while (!cancelled && next < ids.length) {
          await load(ids[next++]);
          onEach?.();
        }
      };
      await Promise.all(Array.from({ length: LOAD_CONCURRENCY }, worker));
    };

    (async () => {
      let done = 0;
      await runPass(passes[0], () => {
        done++;
        setLoadingProgress(Math.floor((done / passes[0].length) * 100));
      });
      if (cancelled) return;
      setImagesLoaded(true);

      for (let p = 1; p < passes.length && !cancelled; p++) {
        await runPass(passes[p]);
        // 새로 받은 프레임으로 현재 화면을 다시 그린다
        const latest = Math.max(0, Math.min(1, fp.get()));
        renderFrame(frameOf(latest));
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // 도입 연출: 아무것도 하지 않아도 배가 천천히 다가온다 (모션 줄이기 설정이면 생략)
  useEffect(() => {
    if (!imagesLoaded || reduceMotion) return;
    if (phaseRef.current !== 'hero' || fp.get() >= INTRO_END) return;
    introCtl.current = animate(fp, INTRO_END, { duration: 9, ease: 'easeOut' });
    return () => introCtl.current?.stop();
  }, [imagesLoaded, reduceMotion]);

  // 초기 렌더링 및 리사이즈 이벤트 처리
  useEffect(() => {
    if (imagesLoaded) {
      renderFrame(0);
    }
    
    const handleResize = () => {
      if (imagesLoaded) {
        renderFrame(frameOf(fp.get()));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imagesLoaded]);

  // 진행도가 바뀔 때마다 캔버스 프레임 동기화
  useMotionValueEvent(fp, "change", (latest) => {
    if (!imagesLoaded) return;
    renderFrame(frameOf(latest));
  });

  return (
    <div className="relative z-10 h-[100svh] w-full select-none overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
          
          {/* 백그라운드 캔버스 */}
          <motion.div style={{ scale: bgZoom }} className="absolute inset-0 -z-20 w-full h-full pointer-events-none bg-slate-950">
            {/* 로딩 표시 */}
            {!imagesLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400 mb-4"></div>
                <div className="text-sm font-sans tracking-widest">LOADING ASSETS {loadingProgress}%</div>
              </div>
            )}
            <canvas 
              ref={canvasRef}
              className={`w-full h-full object-cover opacity-70 mix-blend-screen sepia-[.3] transition-opacity duration-1000 ${imagesLoaded ? 'opacity-70' : 'opacity-0'}`}
            />
            {/* 가독성을 위한 어두운 오버레이 */}
            <div className="absolute inset-0 bg-slate-950/10" />
          </motion.div>

          {/* 따뜻한 빛바랜 색조와 비네트: 오래된 사진 같은 분위기, 글자 가독성 */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(20,12,4,0.05),rgba(4,6,10,0.82))]" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#1b1206]/60 via-transparent to-[#05080d]/85" />

          {/* Hero 텍스트 */}
          <motion.div
            style={{ '--plate': 'min(80vw, 470px, 74vh)' } as unknown as MotionStyle}
            className="relative z-10 flex w-full max-w-5xl flex-col items-center px-6 text-center"
          >
            <motion.div style={exitBrand}>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 1.2 }}
              className="flex items-center gap-3 font-display text-[11px] font-semibold tracking-[0.4em] text-bright-brass md:gap-5 md:text-sm"
            >
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-brass md:w-20" />
              WHITE STAR LINE
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-brass md:w-20" />
            </motion.div>
            </motion.div>

            {/* 날개 달린 금 명패 + 금빛 제목 */}
            <motion.div style={exitPlate} className="relative mt-2">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.7, duration: 1.3, ease: 'easeOut' }}
              className="relative w-[var(--plate)]"
            >
              <div className="absolute rounded-[10px] bg-[#0b1a38]" style={{ left: '7.6%', right: '7.6%', top: '27.5%', bottom: '14.5%' }} />
              <div className="absolute rounded-[10px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_70%)]" style={{ left: '7.6%', right: '7.6%', top: '27.5%', bottom: '14.5%' }} />
              <img src="/ui/ui_title_plate.webp" alt="" draggable={false} className="relative block w-full drop-shadow-[0_14px_20px_rgba(0,0,0,0.6)]" />
              {/* 명패 윗부분 다이아몬드의 반짝임: 네 갈래 별 모양 빛이 번쩍이고 보석이 순간 하얗게 빛난다. 명패 그림 속 다이아몬드 자리는 가로 49.9%, 세로 8.6% */}
              <DiamondSparkle reduce={!!reduceMotion} />
              <div className="absolute inset-x-[9%] flex flex-col items-center justify-center" style={{ top: '30%', bottom: '16%' }}>
                <h1
                  className="bg-gradient-to-b from-[#F1DBA8] via-[#CDB47D] to-[#8C7248] bg-clip-text font-display font-semibold leading-none tracking-[0.14em] whitespace-nowrap text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]"
                  aria-label="THE ATLANTIC AWAITS"
                  style={{ fontSize: 'calc(var(--plate) * 0.05)' }}
                >
                  THE ATLANTIC AWAITS
                </h1>
                <div className="mt-[3%] flex items-center gap-3 tracking-[0.5em] text-brass" style={{ fontSize: 'max(8px, calc(var(--plate) * 0.02))' }}>
                  <span className="h-px w-10 bg-brass/70 md:w-24" />
                  <span className="rotate-45 text-[0.6em]">&#9632;</span>
                  ANNO MCMXII
                  <span className="rotate-45 text-[0.6em]">&#9632;</span>
                  <span className="h-px w-10 bg-brass/70 md:w-24" />
                </div>
              </div>
            </motion.div>
            </motion.div>

            <motion.div style={exitHook}>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : 2.1, duration: 1.4 }}
              className="mt-[3.2vh] font-serif italic text-ivory drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]"
              style={{ fontSize: 'clamp(24px, 5.8vh, 40px)', lineHeight: 1.15, textShadow: '0 0 28px rgba(255,226,170,0.28)' }}
            >
              과연 당신이라면, 살아남았을까?
            </motion.p>
            </motion.div>
            <motion.div style={exitSub}>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : 2.6, duration: 1 }}
              className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#d6c8a4] drop-shadow md:text-[15px]"
            >
              결코 가라앉지 않는다는 거대한 쇳덩어리가 출항을 준비하고 있습니다.
            </motion.p>
            </motion.div>
            <motion.div style={exitDivider}>
            <motion.img
              src="/ui/ui_divider.webp"
              alt=""
              draggable={false}
              initial={reduceMotion ? false : { opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 0.95, scaleX: 1 }}
              transition={{ delay: reduceMotion ? 0 : 2.9, duration: 1 }}
              className="mt-3 h-auto w-[min(78vw,480px)]"
            />
            </motion.div>

            {/* 승선하기 버튼 대신 아래로 내리도록 이끈다: 선박의 둥근 창(현창) 모양 황동 고리 안에서 화살표가 내려앉는다.
                휠, 스와이프, 방향키로 넘어가고, 이 안내를 눌러도(또는 키보드로 선택해도) 넘어간다 */}
            <motion.button
              type="button"
              onClick={goMap}
              aria-label="승선하기: 아래로 내려 시작합니다"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 3, duration: 0.9 }}
              className="group mt-[2.6vh] flex flex-col items-center gap-[1.3vh] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-bright-brass"
            >
              <motion.span
                style={{ ...exitLabel, fontSize: 'clamp(19px, 3.4vh, 28px)', letterSpacing: '0.5em', paddingLeft: '0.5em' }}
                className="bg-gradient-to-b from-[#F1DBA8] via-[#CDB47D] to-[#8C7248] bg-clip-text font-display font-semibold text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
              >
                승선하기
              </motion.span>
              {/* 화살표는 가는 선 하나: 천천히 내려앉았다 올라온다. 현창은 첫 화면에 없고, 내리기 시작하면 배의 선체 창에서 나타난다 */}
              <motion.span aria-hidden className="relative block" style={{ width: 'clamp(40px, 7vh, 56px)', height: 'clamp(40px, 7vh, 56px)', opacity: arrowOpacity }}>
                <motion.svg
                  aria-hidden
                  viewBox="0 0 100 100"
                  className="absolute inset-0 h-full w-full"
                  animate={reduceMotion ? undefined : { y: [-2.5, 3.5, -2.5], opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 2.4, delay: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <path d="M32 40 L50 60 L68 40" fill="none" stroke="#F1DBA8" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </motion.span>
              <motion.span className="text-[11px] tracking-[0.45em] text-[#cdbf9c] md:text-xs" style={{ ...exitLabel, paddingLeft: '0.45em' }}>아래로 내리세요</motion.span>
            </motion.button>
          </motion.div>
      </div>

      {/* 선체의 창에서 커지는 황동 현창: 배경 영상 속 창 위치를 따라가며, 구멍 안으로 지도가 드러난다 */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute z-[15]"
        style={{ left: ringCx, top: ringCy, width: ringBase, height: ringBase, x: '-50%', y: '-50%', scale: ringScale, opacity: ringOpacity, rotateY: ringTurn, rotateX: ringPitch, transformPerspective: 900 }}
      >
        <img src="/ui/porthole_ring.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full brightness-[0.82] drop-shadow-[0_0_3px_rgba(255,214,140,0.2)]" />
      </motion.div>

      {/* 지도 구역: 같은 화면 위로 서서히 겹쳐 나타난다 (스크롤로 내려가지 않는다) */}
      <motion.section
        ref={mapScrollRef}
        aria-hidden={phase !== 'map'}
        style={{
          clipPath: phase === 'map' ? 'none' : mapClip,
          WebkitClipPath: phase === 'map' ? 'none' : mapClip,
          pointerEvents: phase === 'map' ? 'auto' : 'none',
          // 승선권을 찢는 동안은 스크롤을 잠근다: 찢어진 조각이 아래로 내려가며 화면이 길어져 스크롤이 따라 내려가는 것을 막는다
          overflowY: showTicket ? 'hidden' : 'auto',
          overscrollBehavior: 'contain',
          backgroundImage: "radial-gradient(ellipse at center, rgba(27,18,6,0) 0%, rgba(4,6,10,0.7) 100%), linear-gradient(rgba(5,8,13,0.7), rgba(5,8,13,0.7)), url('/bg/TitanicBoarding.webp')",
        }}
        className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-cover bg-center bg-no-repeat"
      >
        <div className="my-auto flex w-full flex-col items-center px-4 pt-8 pb-[104px] md:pt-10 md:pb-[124px]">
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center text-center">
          <div className="relative mb-5 flex w-[min(92vw,400px)] items-center justify-center">
            <div
              className="absolute z-0 rounded-[10px]"
              style={{ backgroundColor: '#0E2148', top: '27.5%', bottom: '14.5%', left: '7.6%', right: '7.6%' }}
            />
            <img
              src="/ui/ui_title_plate.webp"
              alt=""
              draggable={false}
              className="relative z-10 h-auto w-full object-contain drop-shadow-2xl"
            />
            <h3
              className="absolute z-20 w-[78%] bg-gradient-to-b from-[#F1DBA8] via-[#CDB47D] to-[#8C7248] bg-clip-text text-center font-display font-semibold leading-snug tracking-wider text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]"
              style={{
                top: '56.5%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 'calc(min(92vw, 400px) * 0.062)',
              }}
            >
              당신의 여정은<br />어디서 시작됩니까?
            </h3>
          </div>

          {/* 안내: 항구 고르기 */}
          <div className="-mt-2 mb-4 flex items-center gap-4 font-display text-xs font-semibold tracking-[0.4em] text-bright-brass md:text-sm">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-brass md:w-20" />
            CHOOSE YOUR PORT OF EMBARKATION
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-brass md:w-20" />
          </div>

          {/* 지도: 금빛 주조 액자(화면 전체를 두르던 이미지)가 지도 위에 얹혀 가장자리를 가린다. 지도는 화면이 허락하는 만큼 크게 */}
          <div
            className="relative mx-auto mb-3 w-full bg-black/30 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
            style={{ maxWidth: 'min(66rem, max(300px, calc((100svh - 420px) * 1.79)))', containerType: 'inline-size' }}
          >
          {/* 지도 그림 본래의 가로세로 비율(1600x893)로 상자를 만들어, 화면 크기와 상관없이 액자가 항상 지도에 딱 맞는다 */}
          <div className="relative w-full" style={{ aspectRatio: '1600 / 893' }}>
            <div className="absolute inset-0 overflow-hidden">
              <img 
                src="/map-route.webp" 
                alt="Route Map" 
                draggable={false}
                className="block h-full w-full object-fill"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />

              <MapPin
                label="Queenstown"
                desc="아메리카를 향한 마지막 관문"
                meta="아일랜드 · 4월 11일 · 마지막 기항"
                accent="#4a8f6c" tone="#4a8f6c"
                show={phase === 'map'} delay={1.1} reduceMotion={reduceMotion}
                top="39%" left="46%"
                tooltipPos="left"
                onClick={() => handlePortClick('Q')}
              />
              <MapPin
                label="Southampton"
                desc="대서양 횡단의 거대한 시작점"
                meta="잉글랜드 · 4월 10일 · 출항항"
                accent="#4a78b0" tone="#4a78b0"
                show={phase === 'map'} delay={0.1} reduceMotion={reduceMotion}
                top="53%" left="79%"
                tooltipPos="top"
                onClick={() => handlePortClick('S')}
              />
              <MapPin
                label="Cherbourg"
                desc="대륙의 부와 낭만이 모이는 곳"
                meta="프랑스 · 4월 10일 밤 · 두 번째 기항"
                accent="#b34a4f" tone="#b34a4f"
                show={phase === 'map'} delay={0.6} reduceMotion={reduceMotion}
                top="71%" left="78%"
                tooltipPos="left"
                onClick={() => handlePortClick('C')}
              />
            </div>

            {/* Ticket Animation Overlay scoped to Map */}
            <AnimatePresence>
              {showTicket && selectedPort && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/70 rounded-lg pointer-events-none"
                >
                  <motion.div
                    className="relative flex touch-none items-center justify-center w-[80vw] max-w-[500px] pointer-events-auto cursor-grab active:cursor-grabbing"
                    initial={{ 
                      scale: 3, y: '100vh', x: 0, rotate: -60, opacity: 0,
                      filter: 'drop-shadow(0px 40px 25px rgba(0,0,0,0.7))'
                    }}
                    animate={{ 
                      scale: 1, y: ticketY, x: ticketX, rotate: -3, opacity: 1,
                      filter: 'drop-shadow(5px 15px 10px rgba(0,0,0,0.5))'
                    }}
                    transition={{ type: "spring", damping: 15, stiffness: 100, mass: 1 }}
                    onPan={(e, info) => {
                      // Only allow increasing the tear distance
                      if (info.offset.y > tearProgress.get()) {
                        tearProgress.set(info.offset.y);
                      }
                    }}
                    onPanEnd={(e, info) => {
                      if (tearProgress.get() > 100) {
                        // Complete the tear
                        animate(tearProgress, 1000, {
                          duration: 0.8,
                          ease: "easeIn",
                          onComplete: () => onSelectPort(selectedPort)
                        });
                      }
                    }}
                  >
                    {/* Left half - purely static */}
                    <motion.img 
                      src={`/ticket${selectedPort}.webp`}
                      draggable={false}
                      className="absolute w-full object-contain pointer-events-none"
                      style={{ clipPath: `polygon(0% 0%, ${tearX}% 0%, ${tearX}% 100%, 0% 100%)` }}
                    />
                    
                    {/* Right half - moves down based on tearProgress */}
                    <motion.img 
                      src={`/ticket${selectedPort}.webp`}
                      draggable={false}
                      className="absolute w-full object-contain pointer-events-none"
                      style={{ 
                        clipPath: `polygon(${tearX}% 0%, 100% 0%, 100% 100%, ${tearX}% 100%)`,
                        y: rightY,
                        x: rightX,
                        rotate: rightRotate
                      }}
                    />
                    
                    {/* Hidden placeholder to dictate container size */}
                    <img src={`/ticket${selectedPort}.webp`} draggable={false} className="w-full object-contain opacity-0 pointer-events-none" />
                  </motion.div>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className="absolute bottom-1 flex flex-col items-center font-light pointer-events-none animate-bounce"
                  >
                    <span className="mb-2 font-display text-base font-semibold tracking-[0.3em] text-bright-brass drop-shadow-md">아래로 드래그하여 티켓 끊기</span>
                    <div className="h-10 w-px bg-gradient-to-b from-bright-brass to-transparent" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
            {/* 액자: 지도 위에 얹는다 (9칸 이미지를 늘려 쓴다). 지도 가장자리의 찢긴 종이 테두리가 이 아래로 들어간다 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20"
              style={{
                '--fw': 'clamp(14px, 4.2cqw, 44px)',
                borderStyle: 'solid',
                borderWidth: 'var(--fw)',
                borderImage: "url('/ui/ui_screen_frame.webp') 68 / var(--fw) stretch",
              } as React.CSSProperties}
            />
          </div>
        </div>
        </div>
      </motion.section>

      {/* 처음 화면으로 */}
      {phase === 'map' && !showTicket && (
        <button
          onClick={goHero}
          className="absolute bottom-[60px] left-1/2 z-40 -translate-x-1/2 font-display text-xs font-semibold tracking-[0.35em] text-bright-brass/80 transition-colors hover:text-bright-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-bright-brass md:bottom-[72px]"
        >
          RETURN TO THE QUAY
        </button>
      )}

      {/* 화면 네 귀퉁이 장식: 꽃무늬 금 모서리를 뒤집어 붙인다. 처음 화면(승선하기)부터 지도 화면까지 계속 보인다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-2 z-30 md:inset-3"
      >
        {[
          { pos: 'left-0 top-0', flip: 'none' },
          { pos: 'right-0 top-0', flip: 'scaleX(-1)' },
          { pos: 'bottom-0 left-0', flip: 'scaleY(-1)' },
          { pos: 'bottom-0 right-0', flip: 'scale(-1,-1)' },
        ].map((c) => (
          <img
            key={c.pos}
            src="/ui/ui_corner.webp"
            alt=""
            draggable={false}
            className={`absolute drop-shadow-[0_3px_5px_rgba(0,0,0,0.65)] ${c.pos}`}
            style={{ width: 'clamp(84px, 10vw, 150px)', height: 'auto', transform: c.flip }}
          />
        ))}
      </div>
    </div>
  );
}

function MapPin({ 
  label, 
  desc,
  meta,
  accent,
  tone,
  top,
  left,
  tooltipPos = 'bottom',
  show,
  delay,
  reduceMotion,
  onClick
}: {
  show: boolean;
  delay: number;
  reduceMotion: boolean | null;
  label: string;
  desc: string;
  meta: string;
  accent: string;
  tone: string;
  top: string; 
  left: string; 
  tooltipPos?: 'bottom' | 'right' | 'left' | 'top';
  onClick: () => void; 
}) {
  
  let tooltipClasses = "";
  if (tooltipPos === 'bottom') {
    tooltipClasses = "top-full mt-2 left-1/2 -translate-x-1/2 origin-top flex-col items-center";
  } else if (tooltipPos === 'right') {
    tooltipClasses = "left-full ml-3 top-1/2 -translate-y-1/2 origin-left flex-col items-start";
  } else if (tooltipPos === 'left') {
    tooltipClasses = "right-full mr-3 top-1/2 -translate-y-1/2 origin-right flex-col items-end";
  } else if (tooltipPos === 'top') {
    tooltipClasses = "bottom-full mb-2 left-1/2 -translate-x-1/2 origin-bottom flex-col items-center";
  }

  return (
    <div className="absolute z-10" style={{ top, left, transform: 'translate(-50%, -50%)' }}>
      <button
        onClick={onClick}
        aria-label={label}
        className="relative flex items-center justify-center group w-12 h-12"
      >
        {/* 황동 핀: 남색 에나멜 메달 + 맥박. 지도에 도착하면 화면 밖(관객 쪽)에서 안으로 차례로 쾅 박힌다 */}
        <motion.div
          className="relative flex h-9 w-9 items-center justify-center"
          initial={false}
          animate={show ? { scale: [3.4, 1, 0.93, 1.02, 1], opacity: [0, 1, 1, 1, 1], filter: ['blur(8px)', 'blur(0px)', 'blur(0px)', 'blur(0px)', 'blur(0px)'] } : { scale: 3.4, opacity: 0, filter: 'blur(8px)' }}
          transition={
            !show || reduceMotion
              ? { duration: 0 }
              : {
                  // 사람이 지도 위에 내려놓듯 부드럽게 내려와(0~0.7초) 살짝 눌렸다가 가라앉는다
                  duration: 1.4,
                  delay,
                  times: [0, 0.5, 0.66, 0.84, 1],
                  ease: ['easeInOut', 'easeOut', 'easeInOut', 'easeOut'],
                }
          }
        >
          {/* 박히는 순간 번지는 충격 고리 */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border-2"
            style={{ borderColor: accent }}
            initial={false}
            animate={show && !reduceMotion ? { scale: [0.9, 3.4], opacity: [0.95, 0] } : { scale: 0.9, opacity: 0 }}
            transition={show && !reduceMotion ? { duration: 0.9, delay: delay + 0.68, ease: 'easeOut' } : { duration: 0 }}
          />
          <div className="absolute inset-0 animate-ping rounded-full" style={{ backgroundColor: accent, opacity: 0.35 }} />
          <img
            src="/ui/ui_pin.webp"
            alt=""
            draggable={false}
            className="relative h-full w-full rounded-full object-contain transition-transform duration-300 group-hover:scale-125 group-hover:brightness-125"
            style={{ boxShadow: `0 0 0 2.5px ${accent}, 0 0 0 4px rgba(184,154,91,0.9), 0 3px 6px rgba(40,25,10,0.55)` }}
          />
        </motion.div>

        {/* 명판 툴팁: 핀이 박힌 뒤에 나타난다 */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: show ? 1 : 0 }}
          transition={show && !reduceMotion ? { duration: 0.4, delay: delay + 1.0 } : { duration: 0 }}
        >
        <div className={`absolute flex opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100 ${tooltipClasses}`}>
          <div
            className="whitespace-nowrap rounded-[3px] border border-brass bg-[linear-gradient(180deg,#0e1f29,#07111a)] px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.25em] text-bright-brass shadow-[inset_0_0_0_2px_#07111a,inset_0_0_0_3px_rgba(184,154,91,0.5),0_4px_12px_rgba(0,0,0,0.7)] transition-colors duration-300 group-hover:text-[#F1DBA8]"
            style={{ borderTopColor: tone, borderTopWidth: 3 }}
          >
            {label}
          </div>
          <div className="mt-1 hidden whitespace-nowrap rounded-[3px] border border-brass/30 bg-[#07111a]/90 px-2 py-1 font-serif text-xs italic tracking-wide text-[#cdbf9c] md:block">
            {desc}
            <span className="mt-0.5 block text-[10px] not-italic tracking-[0.12em]" style={{ color: tone }}>{meta}</span>
          </div>
        </div>
        </motion.div>
      </button>
    </div>
  );
}
