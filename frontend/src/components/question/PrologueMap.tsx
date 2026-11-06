'use client';

import { motion, useMotionValueEvent, useTransform, AnimatePresence, useMotionValue, animate, useReducedMotion } from 'framer-motion';
import ClassicButton from '@/components/ui/ClassicButton';
import Sprig from '@/components/ui/Sprig';
import { useRef, useEffect, useState } from 'react';

interface PrologueMapProps {
  onSelectPort: (embarked: string) => void;
}

// 추출된 총 프레임 수
const FRAME_COUNT = 121;
// 처음에 받을 대표 프레임 간격 (0, 8, 16 … 120 → 16장). 이것만 받으면 화면을 보여준다.
const KEY_FRAME_STEP = 8;
// 화면 폭이 이 이하면 모바일용(864px) 프레임을 쓴다 (scripts/optimize_images.py frames)
const MOBILE_QUERY = '(max-width: 768px)';
const LOAD_CONCURRENCY = 6;

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

  const textOpacity = useTransform(fp, [0.12, 0.34], [1, 0]);
  const mapOpacity = useTransform(fp, [0.72, 0.96], [0, 1]);
  const mapScale = useTransform(fp, [0.72, 1], [1.06, 1]);

  const goMap = () => {
    if (busy.current || phaseRef.current === 'map') return;
    busy.current = true;
    introCtl.current?.stop();
    animate(fp, 1, {
      duration: reduceMotion ? 0.01 : 2.6,
      ease: [0.45, 0, 0.2, 1],
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
    animate(fp, 0.1, {
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

  // 캔버스에 이미지를 그리는 핵심 함수 (object-cover 효과 구현)
  const renderFrame = (index: number) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); // alpha false로 렌더링 성능 최적화
    if (!ctx) return;

    const img = findLoadedFrame(index);
    if (!img) return;

    // 디스플레이 해상도에 맞게 캔버스 크기 조정
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // CSS의 object-cover와 동일하게 계산
    const hRatio = canvas.width / img.width;
    const vRatio = canvas.height / img.height;
    const ratio = Math.max(hRatio, vRatio);

    const centerShift_x = (canvas.width - img.width * ratio) / 2;
    const centerShift_y = (canvas.height - img.height * ratio) / 2;

    // 부드러운 렌더링을 위한 이미지 스무딩
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, img.width, img.height,
                  centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
  };

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
    for (const step of [KEY_FRAME_STEP, 4, 2, 1]) {
      const ids: number[] = [];
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
        renderFrame(Math.min(FRAME_COUNT - 1, Math.round(latest * (FRAME_COUNT - 1))));
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // 도입 연출: 아무것도 하지 않아도 배가 천천히 다가온다 (모션 줄이기 설정이면 생략)
  useEffect(() => {
    if (!imagesLoaded || reduceMotion) return;
    if (phaseRef.current !== 'hero' || fp.get() >= 0.1) return;
    introCtl.current = animate(fp, 0.1, { duration: 9, ease: 'easeOut' });
    return () => introCtl.current?.stop();
  }, [imagesLoaded, reduceMotion]);

  // 초기 렌더링 및 리사이즈 이벤트 처리
  useEffect(() => {
    if (imagesLoaded) {
      renderFrame(0);
    }
    
    const handleResize = () => {
      if (imagesLoaded) {
        const clampedLatest = Math.max(0, Math.min(1, fp.get()));
        const frameIndex = Math.min(FRAME_COUNT - 1, Math.round(clampedLatest * (FRAME_COUNT - 1)));
        renderFrame(frameIndex);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imagesLoaded]);

  // 진행도가 바뀔 때마다 캔버스 프레임 동기화
  useMotionValueEvent(fp, "change", (latest) => {
    if (!imagesLoaded) return;
    const clampedLatest = Math.max(0, Math.min(1, latest));
    const frameIndex = Math.min(
      FRAME_COUNT - 1,
      Math.round(clampedLatest * (FRAME_COUNT - 1))
    );
    renderFrame(frameIndex);
  });

  return (
    <div className="relative z-10 h-[100svh] w-full select-none overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
          
          {/* 백그라운드 캔버스 */}
          <div className="absolute inset-0 -z-20 w-full h-full pointer-events-none bg-slate-950">
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
          </div>

          {/* 따뜻한 빛바랜 색조와 비네트: 오래된 사진 같은 분위기, 글자 가독성 */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(20,12,4,0.05),rgba(4,6,10,0.82))]" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#1b1206]/60 via-transparent to-[#05080d]/85" />

          {/* Hero 텍스트 */}
          <motion.div
            style={{ opacity: textOpacity }}
            className="relative z-10 flex w-full max-w-5xl flex-col items-center px-6 text-center"
          >
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

            {/* 날개 달린 금 명패 + 금빛 제목 */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.7, duration: 1.3, ease: 'easeOut' }}
              className="relative mt-2 w-[min(92vw,600px)]"
            >
              <div className="absolute rounded-[10px] bg-[#0b1a38]" style={{ left: '7.6%', right: '7.6%', top: '27.5%', bottom: '14.5%' }} />
              <div className="absolute rounded-[10px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_70%)]" style={{ left: '7.6%', right: '7.6%', top: '27.5%', bottom: '14.5%' }} />
              <img src="/ui/ui_title_plate.webp" alt="" draggable={false} className="relative block w-full drop-shadow-[0_14px_20px_rgba(0,0,0,0.6)]" />
              <div className="absolute inset-x-[9%] flex flex-col items-center justify-center" style={{ top: '30%', bottom: '16%' }}>
                <h1
                  className="bg-gradient-to-b from-[#f6e8b6] via-[#d9bd7a] to-[#9a7a38] bg-clip-text font-display font-semibold leading-none tracking-[0.14em] whitespace-nowrap text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]"
                  aria-label="THE ATLANTIC AWAITS"
                  style={{ fontSize: 'calc(min(92vw, 600px) * 0.05)' }}
                >
                  THE ATLANTIC AWAITS
                </h1>
                <div className="mt-[3%] flex items-center gap-3 tracking-[0.5em] text-brass" style={{ fontSize: 'max(8px, calc(min(92vw, 600px) * 0.02))' }}>
                  <span className="h-px w-10 bg-brass/70 md:w-24" />
                  <span className="rotate-45 text-[0.6em]">&#9632;</span>
                  ANNO MCMXII
                  <span className="rotate-45 text-[0.6em]">&#9632;</span>
                  <span className="h-px w-10 bg-brass/70 md:w-24" />
                </div>
              </div>
            </motion.div>

            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : 2.1, duration: 1.4 }}
              className="mt-7 font-serif text-lg italic text-ivory drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] md:text-[26px]"
            >
              과연 당신이라면, 살아남았을까?
            </motion.p>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : 2.6, duration: 1 }}
              className="mt-2 max-w-xl text-xs leading-relaxed text-[#cdbf9c] drop-shadow md:text-sm"
            >
              결코 가라앉지 않는다는 거대한 쇳덩어리가 출항을 준비하고 있습니다.
            </motion.p>
            <motion.img
              src="/ui/ui_divider.webp"
              alt=""
              draggable={false}
              initial={reduceMotion ? false : { opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 0.95, scaleX: 1 }}
              transition={{ delay: reduceMotion ? 0 : 2.9, duration: 1 }}
              className="mt-3 h-auto w-[min(78vw,480px)]"
            />

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 3, duration: 0.8 }}
              className="mt-7 flex flex-col items-center gap-3"
            >
              <div className="flex items-center gap-2 md:gap-4">
                <Sprig className="h-14 w-5 -rotate-90 text-bright-brass md:h-16 md:w-6" delay={3.1} />
                <button
                  onClick={goMap}
                  className="font-display text-base font-semibold tracking-[0.3em] text-[#f1deaa] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] transition-[filter] duration-300 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bright-brass md:text-xl"
                  style={{
                    '--bw': 'clamp(16px, 2.2vw, 24px)',
                    padding: '0.55em 2.6em',
                    borderStyle: 'solid',
                    borderWidth: 'var(--bw)',
                    borderImage: "url('/ui/ui_button_plate.webp') 85 / var(--bw) stretch",
                    backgroundImage: 'linear-gradient(180deg,#12264a,#0a1630)',
                    backgroundClip: 'padding-box',
                  } as React.CSSProperties}
                >
                  승선하기
                </button>
                <Sprig flip className="h-14 w-5 rotate-90 text-bright-brass md:h-16 md:w-6" delay={3.1} />
              </div>
              <span className="text-[11px] tracking-[0.2em] text-[#cdbf9c] md:text-xs">결과는 당신의 인간 유형으로 돌아옵니다</span>
            </motion.div>
          </motion.div>

          {/* Scroll Indicator: 액자 테두리 안쪽, 본문 아래에 글자만 둔다 */}
          <motion.div
            style={{ opacity: textOpacity }}
            className="absolute bottom-[50px] z-10 text-[10px] tracking-[0.35em] text-brass/80 md:bottom-[56px]"
            aria-hidden
          >
            OR SCROLL
          </motion.div>
      </div>

      {/* 지도 구역: 같은 화면 위로 서서히 겹쳐 나타난다 (스크롤로 내려가지 않는다) */}
      <motion.section
        ref={mapScrollRef}
        aria-hidden={phase !== 'map'}
        style={{
          opacity: mapOpacity,
          scale: mapScale,
          pointerEvents: phase === 'map' ? 'auto' : 'none',
          backgroundImage: "radial-gradient(ellipse at center, rgba(27,18,6,0) 0%, rgba(4,6,10,0.7) 100%), linear-gradient(rgba(5,8,13,0.7), rgba(5,8,13,0.7)), url('/bg/TitanicBoarding.webp')",
        }}
        className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-cover bg-center bg-no-repeat"
      >
        <div className="my-auto flex w-full flex-col items-center px-4 py-8 md:py-10">
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center text-center">
          <motion.div 
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
            className="relative mb-5 flex w-[min(92vw,400px)] items-center justify-center transition-all"
          >
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
              className="absolute z-20 w-[78%] bg-gradient-to-b from-[#f6e8b6] via-[#d9bd7a] to-[#9a7a38] bg-clip-text text-center font-display font-semibold leading-snug tracking-wider text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]"
              style={{
                top: '56.5%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 'calc(min(92vw, 400px) * 0.062)',
              }}
            >
              당신의 여정은<br />어디서 시작됩니까?
            </h3>
          </motion.div>

          {/* 안내: 항구 고르기 */}
          <div className="-mt-2 mb-4 flex items-center gap-4 font-display text-xs font-semibold tracking-[0.4em] text-bright-brass md:text-sm">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-brass md:w-20" />
            CHOOSE YOUR PORT OF EMBARKATION
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-brass md:w-20" />
          </div>

          {/* 지도 액자: 금빛 이중 테두리와 모서리 장식 */}
          <div className="relative mx-auto mb-3 w-full border border-brass/70 bg-black/30 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.6)] md:p-4" style={{ maxWidth: 'min(48rem, max(280px, calc((100svh - 480px) * 1.78)))' }}>
            <div aria-hidden className="pointer-events-none absolute inset-1.5 border border-brass/30" />
          <div className="relative w-full aspect-[4/3] md:aspect-[16/9]">
            <div className="absolute inset-0 overflow-hidden">
              <img 
                src="/map-route.webp" 
                alt="Route Map" 
                draggable={false}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />

              <MapPin
                label="Queenstown"
                desc="아메리카를 향한 마지막 관문"
                meta="아일랜드 · 4월 11일 · 마지막 기항"
                stop="III"
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
                stop="I"
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
                stop="II"
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
                    className="relative flex items-center justify-center w-[80vw] max-w-[500px] pointer-events-auto cursor-grab active:cursor-grabbing"
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
          </div>
          <p className="mb-2 font-serif text-sm italic text-[#cdbf9c] md:text-base">항구를 누르면 승선권이 나옵니다</p>
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

          {/* 에드워드 시대 액자 테두리: 금빛 주조 액자 이미지를 9칸으로 늘려 쓴다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-2 z-30 transition-opacity duration-700 md:inset-3"
        style={{
          opacity: phase === 'map' ? 1 : 0,
          '--fw': 'clamp(16px, 2.5vw, 34px)',
          borderStyle: 'solid',
          borderWidth: 'var(--fw)',
          borderImage: "url('/ui/ui_screen_frame.webp') 68 / var(--fw) stretch",
        } as React.CSSProperties}
      />
      {/* 화면 네 귀퉁이 장식: 꽃무늬 금 모서리를 뒤집어 붙인다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-2 z-30 transition-opacity duration-700 md:inset-3"
        style={{ opacity: phase === 'map' ? 1 : 0 }}
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
  stop,
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
  stop: string;
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
          {/* 항해 순서 표시: 로마 숫자 */}
          <span
            className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border px-1 font-display text-[9px] font-bold leading-none text-[#f3e8c8]"
            style={{ backgroundColor: accent, borderColor: 'rgba(184,154,91,0.9)' }}
          >
            {stop}
          </span>
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
            className="whitespace-nowrap rounded-[3px] border border-brass bg-[linear-gradient(180deg,#0e1f29,#07111a)] px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.25em] text-bright-brass shadow-[inset_0_0_0_2px_#07111a,inset_0_0_0_3px_rgba(184,154,91,0.5),0_4px_12px_rgba(0,0,0,0.7)] transition-colors duration-300 group-hover:text-[#f6e8b6]"
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
