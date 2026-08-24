'use client';

import { motion, useScroll, useMotionValueEvent, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

interface PrologueMapProps {
  onSelectPort: (embarked: string) => void;
}

// 추출된 총 프레임 수
const FRAME_COUNT = 121;

export default function PrologueMap({ onSelectPort }: PrologueMapProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [ticketX, setTicketX] = useState(0);
  const [ticketY, setTicketY] = useState(0);

  const handlePortClick = (port: string) => {
    setSelectedPort(port);
    setShowTicket(true);
  };

  // 컨테이너(400vh) 기준 스크롤을 추적
  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start start", "end end"]
  });

  // 스크롤 시 발생할 수 있는 끊김(Stuttering)을 방지하기 위해 useSpring 적용
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 150,
    damping: 30,
    restDelta: 0.001
  });

  // 스크롤이 끝부분(0.7 ~ 0.9)에 다다르면 텍스트를 부드럽게 페이드아웃
  const textOpacity = useTransform(smoothProgress, [0.7, 0.9], [1, 0]);

  // 프레임 프리로딩 로직
  useEffect(() => {
    let loadedCount = 0;
    imagesRef.current = []; // 초기화

    const preloadImages = () => {
      for (let i = 0; i < FRAME_COUNT; i++) {
        const img = new Image();
        const frameNumber = i.toString().padStart(4, '0');
        img.src = `/bg/frames/frame_${frameNumber}.jpg`;
        
        img.onload = () => {
          loadedCount++;
          setLoadingProgress(Math.floor((loadedCount / FRAME_COUNT) * 100));
          if (loadedCount === FRAME_COUNT) {
            setImagesLoaded(true);
          }
        };
        // 에러 방어 코드 (프레임 누락 시 에러 방지)
        img.onerror = () => {
          loadedCount++;
          if (loadedCount === FRAME_COUNT) setImagesLoaded(true);
        }
        
        imagesRef.current.push(img);
      }
    };
    preloadImages();
  }, []);

  // 캔버스에 이미지를 그리는 핵심 함수 (object-cover 효과 구현)
  const renderFrame = (index: number) => {
    if (!canvasRef.current || !imagesRef.current[index]) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); // alpha false로 렌더링 성능 최적화
    if (!ctx) return;

    const img = imagesRef.current[index];
    // 아직 이미지가 완전 로드되지 않았다면 스킵
    if (!img.complete || img.naturalWidth === 0) return;
    
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

  // 초기 렌더링 및 리사이즈 이벤트 처리
  useEffect(() => {
    if (imagesLoaded) {
      renderFrame(0);
    }
    
    const handleResize = () => {
      if (imagesLoaded) {
        const clampedLatest = Math.max(0, Math.min(1, smoothProgress.get()));
        const frameIndex = Math.min(FRAME_COUNT - 1, Math.round(clampedLatest * (FRAME_COUNT - 1)));
        renderFrame(frameIndex);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imagesLoaded]);

  // 스크롤 변경 시 즉각적으로 캔버스 프레임 동기화
  useMotionValueEvent(smoothProgress, "change", (latest) => {
    if (!imagesLoaded) return;
    const clampedLatest = Math.max(0, Math.min(1, latest));
    const frameIndex = Math.min(
      FRAME_COUNT - 1,
      Math.round(clampedLatest * (FRAME_COUNT - 1))
    );
    renderFrame(frameIndex);
  });

  return (
    <div className="w-full relative z-10 text-slate-100 bg-slate-950">
      
      {/* SECTION 1: Sticky Canvas & Hero Text */}
      <section ref={scrollContainerRef} className="h-[400vh] w-full relative">
        
        {/* 스크롤하는 동안 이 100vh 영역이 화면에 고정(Sticky) 됨 */}
        <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
          
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
              className={`w-full h-full object-cover opacity-70 mix-blend-screen transition-opacity duration-1000 ${imagesLoaded ? 'opacity-70' : 'opacity-0'}`}
            />
            {/* 가독성을 위한 어두운 오버레이 */}
            <div className="absolute inset-0 bg-slate-950/40" />
          </div>

          {/* Hero 텍스트 */}
          <motion.div
            style={{ opacity: textOpacity }}
            className="w-full max-w-4xl text-center space-y-12 px-4 relative z-10"
          >
            <div className="space-y-4">
              <h2 className="text-xs md:text-sm tracking-[0.3em] text-amber-400/80 uppercase font-sans">April 1912</h2>
              <h1 className="text-5xl md:text-7xl font-display leading-tight tracking-widest drop-shadow-lg">THE ATLANTIC<br className="md:hidden" /> AWAITS</h1>
            </div>
            <p className="text-center text-slate-300 md:text-lg leading-loose font-sans font-light drop-shadow max-w-2xl mx-auto bg-slate-950/30 px-5 py-3 rounded-xl backdrop-blur-sm inline-block shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-slate-700/30">
              결코 가라앉지 않는다는 거대한 쇳덩어리가 출항을 준비하고 있습니다.
            </p>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div 
            style={{ opacity: textOpacity }}
            className="absolute bottom-12 flex flex-col items-center space-y-3 z-10"
          >
            <span className="text-xs tracking-widest uppercase text-slate-300 drop-shadow">Scroll Down</span>
            <div className="w-6 h-10 border border-slate-400/70 rounded-full flex justify-center p-1.5 shadow-lg bg-slate-950/40 backdrop-blur-md">
              <motion.div 
                className="w-1.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,1)]" 
                animate={{ y: [0, 12, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2: Map */}
      <section 
        className="min-h-screen flex flex-col items-center justify-center py-20 px-4 w-full relative z-20 bg-cover bg-center bg-no-repeat shadow-[0_-20px_50px_rgba(2,6,23,1)]"
        style={{ backgroundImage: "url('/bg/TitanicBoarding.png')" }}
      >
        {/* 가독성을 위해 어두운 오버레이 추가 */}
        <div className="absolute inset-0 bg-slate-950/70" />
        
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="w-full max-w-4xl text-center flex flex-col items-center relative z-10"
        >
          <motion.div 
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
            className="relative mb-12 flex items-center justify-center transition-all w-[300px] md:w-[660px]"
          >
            <div 
              className="absolute z-0 rounded-lg transition-all"
              style={{ 
                backgroundColor: '#0E2148',
                top: `46px`,
                bottom: `46px`,
                left: `26px`,
                right: `26px`,
                transform: `translate(0px, 27px)`
              }}
            />
            <img 
              src="/virUI.png" 
              alt="UI frame" 
              className="w-full h-auto object-contain drop-shadow-2xl opacity-90 relative z-10" 
            />
            <h3 
              className="absolute font-display tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] whitespace-nowrap z-20"
              style={{ 
                top: `69%`, 
                left: `50%`, 
                transform: 'translate(-50%, -50%)',
                color: '#E3D095',
                fontSize: `36px`
              }}
            >
              당신의 여정은 어디서 시작됩니까?
            </h3>
          </motion.div>

          {/* Map Container */}
          <div className="relative w-full max-w-3xl mx-auto aspect-[4/3] md:aspect-[16/9] mb-8">
            <div className="absolute inset-0 overflow-hidden">
              <img 
                src="/map-route.png" 
                alt="Route Map" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />

              <MapPin 
                label="Queenstown" 
                desc="아메리카를 향한 마지막 관문" 
                top="39%" left="46%" 
                tooltipPos="left"
                onClick={() => handlePortClick('Q')} 
              />
              <MapPin 
                label="Southampton" 
                desc="대서양 횡단의 거대한 시작점" 
                top="53%" left="79%" 
                tooltipPos="top" 
                onClick={() => handlePortClick('S')} 
              />
              <MapPin 
                label="Cherbourg" 
                desc="대륙의 부와 낭만이 모이는 곳" 
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
                  className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/40 rounded-lg pointer-events-none"
                >
                  <motion.img 
                    src={`/ticket${selectedPort}.png`}
                    initial={{ 
                      scale: 3, y: '100vh', x: 0, rotate: -60, opacity: 0,
                      filter: 'drop-shadow(0px 40px 25px rgba(0,0,0,0.7))'
                    }}
                    animate={{ 
                      scale: 1, y: ticketY, x: ticketX, rotate: -3, opacity: 1,
                      filter: 'drop-shadow(5px 15px 10px rgba(0,0,0,0.5))'
                    }}
                    transition={{ type: "spring", damping: 12, stiffness: 100, mass: 1 }}
                    className="w-[80%] max-w-[500px] object-contain pointer-events-auto"
                    onAnimationComplete={() => {
                      setTimeout(() => {
                        onSelectPort(selectedPort);
                      }, 700);
                    }}
                  />

                  {/* Ticket Position Debug Panel */}
                  <div className="absolute -bottom-16 right-0 bg-slate-900/90 p-4 rounded-lg border border-slate-700 shadow-2xl flex flex-col gap-3 w-64 text-xs font-sans z-50 pointer-events-auto">
                    <h4 className="text-amber-400 font-bold border-b border-slate-700 pb-1">Ticket Debug</h4>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-300 flex justify-between">
                        <span>Ticket X: {ticketX}px</span>
                      </label>
                      <input 
                        type="range" min="-300" max="300" value={ticketX} 
                        onChange={(e) => setTicketX(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-slate-300 flex justify-between">
                        <span>Ticket Y: {ticketY}px</span>
                      </label>
                      <input 
                        type="range" min="-300" max="300" value={ticketY} 
                        onChange={(e) => setTicketY(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function MapPin({ 
  label, 
  desc, 
  top, 
  left, 
  tooltipPos = 'bottom',
  onClick 
}: { 
  label: string; 
  desc: string; 
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
        {/* Pin dot */}
        <div className="relative w-6 h-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-60" />
          <div className="w-3 h-3 bg-amber-300 border-2 border-slate-900 rounded-full shadow-[0_0_15px_rgba(251,191,36,1)] group-hover:bg-amber-100 transition-colors" />
        </div>
        
        {/* Tooltip label */}
        <div className={`absolute opacity-80 group-hover:opacity-100 transition-all transform group-hover:scale-110 flex ${tooltipClasses}`}>
          <div className="text-sm font-display tracking-widest text-amber-100/90 group-hover:text-amber-300 uppercase bg-slate-950/90 group-hover:bg-slate-900 px-3 py-1.5 rounded border border-amber-500/30 group-hover:border-amber-400/80 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.7)] group-hover:shadow-[0_0_25px_rgba(251,191,36,0.3)] whitespace-nowrap transition-all duration-300">
            {label}
          </div>
          <div className="text-xs text-slate-300 group-hover:text-amber-100/90 tracking-wider mt-1 bg-slate-900/90 group-hover:bg-slate-800 px-2 py-1 rounded hidden md:block whitespace-nowrap transition-colors duration-300">
            {desc}
          </div>
        </div>
      </button>
    </div>
  );
}
