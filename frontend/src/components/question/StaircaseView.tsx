'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, MotionValue } from 'framer-motion';
import { Question } from '@/data/questions';
import ProgressLine from '@/components/ui/ProgressLine';

interface StaircaseViewProps {
  question: Question;
  onAnswer: (value: string) => void;
  onBack?: () => void;
}

// 몬스터헌터 '안내벌레' 또는 '반딧불이' 느낌의 파티클 컴포넌트
const FireflyCluster = () => {
  // 리렌더링 시 벌레들이 튀는 현상을 막기 위해 랜덤 값을 한번만 계산
  const particles = useMemo(() => [...Array(5)].map(() => ({
    x: [0, Math.random() * 60 - 30, Math.random() * 60 - 30, 0],
    y: [0, Math.random() * 60 - 30, Math.random() * 60 - 30, 0],
    duration: 3 + Math.random() * 3,
    delay: Math.random() * 2
  })), []);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {particles.map((p, i) => {
        return (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-emerald-100 shadow-[0_0_12px_3px_rgba(52,211,153,0.9)] blur-[0.5px]"
            animate={{
              x: p.x,
              y: p.y,
              opacity: [0.2, 1, 0.2],
              scale: [0.5, 1.5, 0.5]
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.delay
            }}
          />
        );
      })}
      {/* 부드러운 배경 글로우 */}
      <motion.div 
        className="absolute w-16 h-16 rounded-full bg-emerald-400/20 blur-xl"
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
};

// 마우스를 따라다니는 글로벌 안내벌레 무리
const GlobalScoutflies = ({ mouseX, mouseY }: { mouseX: MotionValue<number>, mouseY: MotionValue<number> }) => {
  // 리렌더링 방지용 고정 랜덤값
  const flies = useMemo(() => [...Array(12)].map(() => ({
    damping: 15 + Math.random() * 20,
    stiffness: 40 + Math.random() * 80,
    localX: [0, Math.random() * 40 - 20, Math.random() * 40 - 20, 0],
    localY: [0, Math.random() * 40 - 20, Math.random() * 40 - 20, 0],
    duration: 2 + Math.random() * 2,
    delay: Math.random() * 2
  })), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {flies.map((f, i) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const springX = useSpring(mouseX, { damping: f.damping, stiffness: f.stiffness });
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const springY = useSpring(mouseY, { damping: f.damping, stiffness: f.stiffness });
        
        return (
          <motion.div
            key={i}
            className="absolute top-0 left-0"
            style={{ x: springX, y: springY }}
          >
            <motion.div
              className="absolute w-2 h-2 rounded-full bg-emerald-100 shadow-[0_0_15px_4px_rgba(52,211,153,0.8)] blur-[0.5px]"
              animate={{
                x: f.localX,
                y: f.localY,
                opacity: [0.1, 0.8, 0.1],
                scale: [0.4, 1.2, 0.4]
              }}
              transition={{
                duration: f.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: f.delay
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
};

export default function StaircaseView({ question, onAnswer, onBack }: StaircaseViewProps) {
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  
  // 마우스 트래킹용 값
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);

  const handlePointerMove = (e: React.PointerEvent) => {
    // 마우스 커서의 중심을 맞추기 위해 오프셋 보정
    mouseX.set(e.clientX - 4);
    mouseY.set(e.clientY - 4);
  };
  
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Hotspot Regions
  const [config, setConfig] = useState<Record<string, { x: number, y: number, w: number, h: number }>>({
    '1': { x: 30, y: 45, w: 6, h: 11 }, // UP (Option 1)
    '2': { x: 51, y: 55, w: 5,  h: 15 }, // CORRIDOR (Option 2)
    '3': { x: 76, y: 76, w: 6, h: 11 }, // DOWN (Option 3)
  });

  const currentHoverData = question.options.find(o => o.value === hoveredOption);

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-slate-950 overflow-hidden select-none cursor-none"
      onPointerMove={handlePointerMove}
    >
      {/* 마우스를 쫓아다니는 안내벌레 무리 */}
      <GlobalScoutflies mouseX={mouseX} mouseY={mouseY} />
      
      {/* Background Images Crossfade */}
      <AnimatePresence>
        {/* Base Image (Grand Staircase) */}
        {!hoveredOption && (
          <motion.img
            key="base"
            src="/bg/where.png"
            alt="Grand Staircase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}
        
        {/* Hovered Option Image */}
        {hoveredOption && (
          <motion.div
            key={hoveredOption}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <img 
              src={`/bg/${hoveredOption}.png`} 
              alt="Class Atmosphere" 
              className="w-full h-full object-cover" 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between">
        
        {/* Top: Back Button and Question Title (with gradient for readability) */}
        <div className="p-8 pt-12 pb-24 flex flex-col items-center relative bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent">
          {onBack && (
            <button 
              onClick={onBack}
              className="absolute top-12 left-8 text-white/70 hover:text-white flex items-center gap-2 transition-colors pointer-events-auto"
            >
              <span className="text-sm font-sans tracking-widest uppercase drop-shadow-md">Back</span>
            </button>
          )}

          <div className="text-center w-full max-w-4xl mx-auto px-4 mt-8 md:mt-0">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif text-white/95 tracking-wide drop-shadow-[0_4px_15px_rgba(0,0,0,0.8)] whitespace-pre-wrap">
              {question.title}
            </h2>
            {question.subtitle && (
              <p className="mt-4 text-white/80 font-sans tracking-widest text-xs md:text-sm drop-shadow-md">
                {question.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Bottom: Option Description */}
        <div className="h-48 flex items-end justify-center pb-24 px-6">
          <AnimatePresence mode="wait">
            {currentHoverData && (
              <motion.div
                key={currentHoverData.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.4 }}
                className="text-center max-w-2xl bg-black/40 backdrop-blur-md px-8 py-6 rounded-2xl border border-white/10 shadow-2xl"
              >
                <h3 className="text-xl md:text-2xl font-serif text-amber-100 mb-3 drop-shadow-sm">
                  {currentHoverData.label}
                </h3>
                <p className="text-slate-200 font-sans text-sm md:text-base leading-relaxed font-light">
                  {currentHoverData.description}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom ProgressLine */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 pointer-events-auto z-[60]">
        <ProgressLine currentStep={question.step} totalSteps={question.totalSteps} />
      </div>

      {/* Interactive Hotspots Layer */}
      <div className="absolute inset-0 z-20">
        {question.options.map((opt) => {
          const rect = config[opt.value];
          if (!rect) return null;

          return (
            <div
              key={opt.id}
              className={`absolute cursor-none flex items-center justify-center ${isEditMode ? 'border-2 border-red-500 bg-red-500/20 pointer-events-auto' : ''}`}
              style={{
                left: `${rect.x}%`,
                top: `${rect.y}%`,
                width: `${rect.w}%`,
                height: `${rect.h}%`,
              }}
              onPointerEnter={() => setHoveredOption(opt.value)}
              onPointerLeave={() => {
                if (hoveredOption === opt.value) setHoveredOption(null);
              }}
              onClick={() => onAnswer(opt.value)}
            >
              {/* 안내벌레(Scoutflies) 클러스터 이펙트 */}
              <AnimatePresence>
                {!hoveredOption && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 2, filter: 'blur(10px)' }} // 호버 시 퍼지면서 사라지는 연출
                    transition={{ duration: 0.8 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  >
                    <FireflyCluster />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Debug Panel */}
      {isEditMode && (
        <div className="fixed bottom-10 right-10 z-[999] bg-slate-900/80 backdrop-blur text-white p-4 rounded-xl text-xs font-mono shadow-2xl border border-white/10 w-80 pointer-events-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-amber-400 font-bold">Staircase Hotspots</h3>
            <button onClick={() => setIsEditMode(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          {Object.entries(config).map(([key, rect]) => (
            <div key={key} className="bg-slate-800/80 p-2 rounded mb-2">
              <div className="font-bold text-amber-200 mb-1">Option {key}</div>
              <div className="flex gap-2 mb-1 items-center"><span className="w-4">X</span><input type="range" min="0" max="100" value={rect.x} onChange={e => setConfig({...config, [key]: {...rect, x: Number(e.target.value)}})} className="flex-1" /><span className="w-6 text-right">{rect.x}</span></div>
              <div className="flex gap-2 mb-1 items-center"><span className="w-4">Y</span><input type="range" min="0" max="100" value={rect.y} onChange={e => setConfig({...config, [key]: {...rect, y: Number(e.target.value)}})} className="flex-1" /><span className="w-6 text-right">{rect.y}</span></div>
              <div className="flex gap-2 mb-1 items-center"><span className="w-4">W</span><input type="range" min="1" max="100" value={rect.w} onChange={e => setConfig({...config, [key]: {...rect, w: Number(e.target.value)}})} className="flex-1" /><span className="w-6 text-right">{rect.w}</span></div>
              <div className="flex gap-2 items-center"><span className="w-4">H</span><input type="range" min="1" max="100" value={rect.h} onChange={e => setConfig({...config, [key]: {...rect, h: Number(e.target.value)}})} className="flex-1" /><span className="w-6 text-right">{rect.h}</span></div>
            </div>
          ))}
          <button 
            className="w-full mt-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded transition-colors"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(config, null, 2));
              alert('Copied to clipboard!');
            }}
          >
            복사하기 (Copy)
          </button>
        </div>
      )}

      {/* Debug Gear Icon */}
      {!isEditMode && (
        <button 
          onClick={() => setIsEditMode(true)}
          className="fixed bottom-4 right-4 z-[999] w-10 h-10 bg-slate-800/50 backdrop-blur rounded-full flex items-center justify-center text-slate-400 hover:text-amber-400 transition-colors pointer-events-auto"
          title="Toggle Debug Mode"
        >
          ⚙️
        </button>
      )}

    </div>
  );
}
