'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useSpring, AnimatePresence } from 'framer-motion';
import { Question } from '@/data/questions';
import ProgressLine from '@/components/ui/ProgressLine';

interface CompanionCameraProps {
  question: Question;
  onAnswer: (value: string) => void;
  onBack?: () => void;
}

type HotspotConfig = { x: number; y: number; w: number; h: number };

export default function CompanionCamera({ question, onAnswer, onBack }: CompanionCameraProps) {
  const [hoveredOption, setHoveredTarget] = useState<string | null>(null);
  const [shutterTriggered, setShutterTriggered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hotspotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 핫스팟 최종 확정 위치
  const SPOTS: Record<string, HotspotConfig> = {
    alone:   { x: 72, y: 65, w: 7, h: 27 },
    partner: { x: 32, y: 65, w: 10, h: 29 },
    friends: { x: 46, y: 62, w: 12, h: 18 },
    family:  { x: 59, y: 65, w: 11, h: 18 },
  };

  // 레터박스 패널 너비 최종 고정값 (vw 단위)
  const PANEL_WIDTH = 21;

  // 줌 오리진 보정 최종 고정값 (피사체 중심점으로부터의 offset %)
  const FOCUS_OFFSETS: Record<string, { x: number, y: number }> = {
    alone:   { x: 20, y: 0 },
    partner: { x: -100, y: 0 },
    friends: { x: 0, y: 0 },
    family:  { x: 0, y: 0 },
  };

  // 배경(Scene) 시점 및 크기 최종 고정값
  const BG_CONFIG = {
    scale: 130,
    offsetX: -5,
    offsetY: 2,
    parallaxX: 35,
    parallaxY: 15,
    limitYDown: -3,
    limitYUp: 100,
    limitXLeft: -30,
    limitXRight: 43,
  };

  // 마우스 원본 좌표 (패럴랙스 용)
  const rawMouse = useRef({ x: 0, y: 0 });

  // 패럴랙스(시차) 연출용 씬(Scene) 좌표
  const sceneX = useSpring(0, { stiffness: 60, damping: 25, mass: 0.8 });
  const sceneY = useSpring(0, { stiffness: 60, damping: 25, mass: 0.8 });

  // 줌인 효과 상태 (부드러운 화면 이동을 위해 Origin도 스프링 적용)
  const zoomOriginX = useSpring(0.5, { stiffness: 60, damping: 20, mass: 1 });
  const zoomOriginY = useSpring(0.5, { stiffness: 60, damping: 20, mass: 1 });
  const zoomScale = useSpring(1, { stiffness: 60, damping: 20, mass: 1 });

  // 호버 대상이 바뀔 때 줌인 효과 발동
  useEffect(() => {
    if (hoveredOption && containerRef.current) {
      const spot = SPOTS[hoveredOption];
      // 피사체의 정중앙 좌표 계산
      let originX = spot.x + spot.w / 2;
      let originY = spot.y + spot.h / 2;
      
      // 유저가 조절한 포커스 보정값 적용
      if (FOCUS_OFFSETS[hoveredOption]) {
        originX += FOCUS_OFFSETS[hoveredOption].x;
        originY += FOCUS_OFFSETS[hoveredOption].y;
      }

      // Origin 값을 0~1 사이로 정규화하여 스프링에 전달
      zoomOriginX.set(originX / 100);
      zoomOriginY.set(originY / 100);
      zoomScale.set(1.15); // 15% 줌인
    } else if (containerRef.current) {
      zoomScale.set(1); // 원래 크기로 복구 (Origin은 그대로 두어 자연스럽게 줌아웃)
    }
  }, [hoveredOption, zoomScale, zoomOriginX, zoomOriginY]);

  // 사운드 객체 초기화
  const shutterSoundRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    shutterSoundRef.current = new Audio('/camera-shutter.mp3');
    shutterSoundRef.current.load();
  }, []);


  const handlePointerMove = (e: React.PointerEvent) => {
    if (shutterTriggered || !containerRef.current) return;
    
    rawMouse.current = { x: e.clientX, y: e.clientY };
    
    // 패럴랙스 배경 이동 (화면 중앙을 기준으로 정규화: -1 ~ 1)
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    
    let targetX = -nx * window.innerWidth * (BG_CONFIG.parallaxX / 100);
    let targetY = -ny * window.innerHeight * (BG_CONFIG.parallaxY / 100);
    
    const minLimitY = window.innerHeight * (BG_CONFIG.limitYDown / 100);
    const maxLimitY = window.innerHeight * (BG_CONFIG.limitYUp / 100);
    if (targetY < minLimitY) targetY = minLimitY;
    if (targetY > maxLimitY) targetY = maxLimitY;

    const minLimitX = window.innerWidth * (BG_CONFIG.limitXLeft / 100);
    const maxLimitX = window.innerWidth * (BG_CONFIG.limitXRight / 100);
    if (targetX < minLimitX) targetX = minLimitX;
    if (targetX > maxLimitX) targetX = maxLimitX;

    sceneX.set(Math.round(targetX)); 
    sceneY.set(Math.round(targetY));
  };



  const handleSnap = (value: string) => {
    if (shutterTriggered) return;
    setShutterTriggered(true);
    
    if (shutterSoundRef.current) {
      shutterSoundRef.current.currentTime = 0;
      shutterSoundRef.current.play().catch(e => console.log('Audio play failed:', e));
    }

    // 확 밝아진 후 거의 즉시 다음 질문으로 넘김 (서서히 페이드인은 부모 컨테이너가 처리)
    setTimeout(() => {
      onAnswer(value);
    }, 50);
  };

  const currentHoverData = question.options.find(o => o.value === hoveredOption);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 w-full h-full bg-slate-900 overflow-hidden cursor-crosshair touch-none select-none"
      onPointerMove={handlePointerMove}
      style={{
        '--mouse-x': '-1000px',
        '--mouse-y': '-1000px'
      } as React.CSSProperties}
    >
      {/* Back Button */}
      {onBack && (
        <button 
          onClick={onBack}
          className="absolute top-8 left-8 z-50 text-white/70 hover:text-white flex items-center gap-2 transition-colors"
        >
          <span className="text-sm font-sans tracking-widest uppercase">Back</span>
        </button>
      )}

      {/* 1. 단일 배경 패럴랙스 씬 */}
      <motion.div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 will-change-transform"
        style={{ 
          x: sceneX, 
          y: sceneY,
          scale: zoomScale,
          originX: zoomOriginX,
          originY: zoomOriginY,
          width: `${BG_CONFIG.scale}vw`,
          height: `${BG_CONFIG.scale}vh`,
          marginTop: `${BG_CONFIG.offsetY}vh`,
          marginLeft: `${BG_CONFIG.offsetX}vw`
        }}
      >
        <img src="/bg/withwho.png" alt="Background" className="w-full h-full object-cover pointer-events-none" />

        {/* 핫스팟 투명 영역 렌더링 (디버그 테두리 제거) */}
        {Object.entries(SPOTS).map(([key, rect]) => (
          <div 
            key={key}
            ref={(el) => { hotspotRefs.current[key] = el; }}
            className={`absolute flex items-center justify-center cursor-pointer pointer-events-auto ${hoveredOption === key ? 'z-0' : 'z-10'}`}
            style={{ 
              left: `${rect.x}%`, top: `${rect.y}%`, 
              width: `${rect.w}%`, height: `${rect.h}%` 
            }}
            onPointerEnter={() => { if (!shutterTriggered) setHoveredTarget(key); }}
            onPointerLeave={() => {
              if (hoveredOption === key) setHoveredTarget(null);
            }}
            onClick={() => handleSnap(key)}
          >
            {/* 호버/줌인 시 마우스 이탈을 방지하기 위한 거대한 투명 히트박스 (선택된 요소 뒤에 깔림) */}
            {hoveredOption === key && (
              <div className="absolute inset-[-40vw] bg-transparent" />
            )}
            <FocusRing isFocused={hoveredOption === key} />
          </div>
        ))}
      </motion.div>

      {/* 1.5 좌우 레터박스 패널 (배경 이미지의 좌우를 가림. 마스크보다 아래에 위치) */}
      <div className="absolute inset-y-0 left-0 bg-black pointer-events-none" style={{ width: `${PANEL_WIDTH}vw` }} />
      <div className="absolute inset-y-0 right-0 bg-black pointer-events-none" style={{ width: `${PANEL_WIDTH}vw` }} />

      {/* 2.5 렌즈(lens.png) 그래픽 오버레이 (화면 전체 고정, 유효한 z-index 사용) */}
      <img 
        src="/lens.png" 
        alt="Camera Lens Frame" 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
      />

      {/* 3. UI 레이어 (자막 등) */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="absolute top-0 inset-x-0 pt-12 pb-24 flex flex-col items-center bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent">
          <div className="w-full max-w-xl px-6 mb-6 mt-4">
            <ProgressLine currentStep={question.step} totalSteps={question.totalSteps} />
          </div>
          <div className="text-center flex flex-col gap-2 w-full px-4">
            <h2 className="text-2xl md:text-3xl font-serif text-white/90 tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              {question.title}
            </h2>
            <p className="text-white/40 font-sans tracking-[0.2em] text-[10px] md:text-xs uppercase">
              Look around and take a photo
            </p>
          </div>
        </div>

        {/* 하단 인물 자막 */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 px-4">
          <AnimatePresence mode="wait">
          {currentHoverData && !shutterTriggered && (
            <motion.div
              key={currentHoverData.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h3 className="text-3xl md:text-4xl font-display text-amber-100 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)] mb-2">
                {currentHoverData.label}
              </h3>
              <p className="text-sm text-slate-300 font-sans max-w-md mx-auto">
                {currentHoverData.description}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>



      {/* 4. 글로벌 플래시 애니메이션이 트리거된 상태면 아무것도 하지 않음 (QuizContainer에서 덮어씌움) */}
    </div>
  );
}

// 락온(초점) UI 컴포넌트
function FocusRing({ isFocused }: { isFocused: boolean }) {
  if (!isFocused) return null;
  
  return (
    <motion.div 
      initial={{ scale: 1.2, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute inset-[-10px] md:inset-[-20px] border border-white/20 pointer-events-none"
    >
      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/60" />
      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/60" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/60" />
      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/60" />
      
      {/* 십자선 (Crosshair) - 아날로그 느낌을 위해 얇고 희미하게 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-[1px] bg-white/40" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-2 bg-white/40" />
    </motion.div>
  );
}
