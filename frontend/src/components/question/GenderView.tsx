'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProgressLine from '@/components/ui/ProgressLine';
import { Question } from '@/data/questions';
import { useQuizStore } from '@/store/quizStore';

interface GenderViewProps {
  question: Question;
  onAnswer: (value: string) => void;
  onBack: () => void;
}

export default function GenderView({ question, onAnswer, onBack }: GenderViewProps) {
  const [hoveredGender, setHoveredGender] = useState<string | null>(null);

  // Fallback to CSS mirror if asset is missing
  const [hasMirrorAsset, setHasMirrorAsset] = useState(true);
  
  // --- Debug Panel State ---
  const isEditMode = useQuizStore(state => state.showDebug);
  const [config, setConfig] = useState({
    mirror: { x: 0, y: -210, scale: 0.8, maskW: 76, maskH: 66 },
    male: { x: -10, y: 258, scale: 0.82 },
    female: { x: 0, y: 224, scale: 0.82 },
  });

  return (
    <div className="w-full relative min-h-screen flex flex-col justify-center items-center overflow-hidden">
      
      {/* Background Vintage House */}
      <div 
        className="absolute inset-0 z-[0] pointer-events-none"
      >
        <img 
          src="/bg/house.png" 
          alt="Vintage House" 
          className="w-full h-full object-cover opacity-100" 
          draggable={false}
        />
      </div>
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent to-[#050302] pointer-events-none" />

      {/* Back Button */}
      <button 
        onClick={onBack}
        className="fixed bottom-8 left-8 z-[50] flex items-center text-slate-400 hover:text-amber-400 transition-colors group pointer-events-auto"
      >
        <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
        <span className="text-sm font-sans tracking-widest uppercase">Back</span>
      </button>

      {/* Header Info (Question Text) */}
      <div className="absolute bottom-16 md:bottom-20 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-[50] text-center pointer-events-none">
        <div className="mb-4">
          <ProgressLine currentStep={question.step} totalSteps={question.totalSteps} />
        </div>
        <motion.h2 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl md:text-3xl font-display font-bold text-amber-50/90 mb-4 tracking-wide shadow-black drop-shadow-lg"
        >
          {question.title}
        </motion.h2>
        {question.subtitle && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-amber-200/50 font-sans text-sm md:text-base"
          >
            {question.subtitle}
          </motion.p>
        )}
      </div>

      {/* THE MIRROR CONTAINER */}
      <div 
        className="relative w-[300px] h-[450px] md:w-[400px] md:h-[600px] z-[10] pointer-events-none"
        style={{
          transform: `translate(${config.mirror.x}px, ${config.mirror.y}px) scale(${config.mirror.scale})`
        }}
      >
        
        {/* Mirror Content Mask (Clipped to oval shape if no asset, or masked by asset) */}
        <div 
          className="absolute inset-0 overflow-hidden flex items-end justify-center bg-black shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]"
          style={{
            borderRadius: '50%',
            width: `${config.mirror.maskW}%`,
            height: `${config.mirror.maskH}%`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* Base Reflection (Default Screen) */}
          <motion.img
            src="/reflection.png"
            alt="Mirror Reflection"
            className="absolute inset-0 w-full h-full object-cover z-[5]"
            animate={{ 
              filter: hoveredGender ? 'brightness(1) blur(4px)' : 'brightness(1) blur(0px)' 
            }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            draggable={false}
          />

          {/* Silhouettes (z-10) */}
          {/* Using existing male/female PNGs with CSS filters to make them look like dark silhouettes */}
          <AnimatePresence>
            {hoveredGender === 'male' && (
              <motion.img 
                key="male"
                src="/male.png"
                alt="Male Silhouette"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                className="absolute bottom-0 w-[120%] object-contain origin-bottom z-[15] brightness-0"
                style={{
                  x: config.male.x,
                  y: config.male.y,
                  scale: config.male.scale
                }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {hoveredGender === 'female' && (
              <motion.img 
                key="female"
                src="/female.png"
                alt="Female Silhouette"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                className="absolute bottom-0 w-[120%] object-contain origin-bottom z-[15] brightness-0"
                style={{
                  x: config.female.x,
                  y: config.female.y,
                  scale: config.female.scale
                }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
          </AnimatePresence>

          {/* Mirror Frost / Fog (z-20) */}
          <motion.div 
            className="absolute inset-0 pointer-events-none z-[20] backdrop-blur-md"
            animate={{ 
              opacity: hoveredGender ? 0.2 : 0.8,
              backdropFilter: hoveredGender ? 'blur(2px)' : 'blur(8px)'
            }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            style={{
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 60%, rgba(0,0,0,0.5) 100%)'
            }}
          >
            {/* Inner fog clouds */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
          </motion.div>
        </div>

        {/* Antique Mirror Frame (z-30) */}
        {hasMirrorAsset ? (
          <img 
            src="/mirror.png" 
            alt="Antique Mirror" 
            className="absolute inset-0 w-full h-full object-contain z-[30]"
            onError={() => setHasMirrorAsset(false)}
            draggable={false}
          />
        ) : (
          /* CSS Fallback Frame */
          <div 
            className="absolute inset-0 z-[30] pointer-events-none"
            style={{
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              border: '12px solid #3b2818',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,0.9)',
              background: 'transparent'
            }}
          >
            {/* Inner gold trim */}
            <div 
              className="absolute inset-0"
              style={{
                borderRadius: 'inherit',
                border: '2px solid #a37c35',
                margin: '2px',
                opacity: 0.7
              }}
            />
          </div>
        )}
      </div>

      {/* Interactive Selection Areas & Buttons (z-40) */}
      {/* L/R Split Screen Hover Zones */}
      <div className="absolute inset-0 z-[40] flex pointer-events-none">
        {/* LEFT: MALE */}
        <div className="flex-1 h-full flex items-center justify-start pl-[10%]">
          <div 
            className="p-8 cursor-pointer pointer-events-auto"
            onMouseEnter={() => setHoveredGender('male')}
            onMouseLeave={() => setHoveredGender(null)}
            onClick={() => onAnswer('male')}
          >
            <motion.div 
              className="flex flex-col items-start gap-4 transition-all duration-700 pointer-events-none"
              animate={{ 
                opacity: hoveredGender === 'male' ? 1 : 0.4,
                x: hoveredGender === 'male' ? 20 : 0
              }}
            >
            <div className="text-4xl md:text-6xl font-display text-amber-100/90 tracking-widest drop-shadow-lg">
              남성
            </div>
            <div className="text-amber-200/50 text-sm md:text-base font-sans tracking-wide">
              MALE PASSENGER
            </div>
            <div className={`mt-4 w-12 h-1 bg-amber-500/50 transition-all duration-700 ${hoveredGender === 'male' ? 'w-24 bg-amber-400' : ''}`} />
            </motion.div>
          </div>
        </div>

        {/* RIGHT: FEMALE */}
        <div className="flex-1 h-full flex items-center justify-end pr-[10%]">
          <div 
            className="p-8 cursor-pointer pointer-events-auto"
            onMouseEnter={() => setHoveredGender('female')}
            onMouseLeave={() => setHoveredGender(null)}
            onClick={() => onAnswer('female')}
          >
            <motion.div 
              className="flex flex-col items-end gap-4 transition-all duration-700 pointer-events-none"
              animate={{ 
                opacity: hoveredGender === 'female' ? 1 : 0.4,
                x: hoveredGender === 'female' ? -20 : 0
              }}
            >
            <div className="text-4xl md:text-6xl font-display text-amber-100/90 tracking-widest drop-shadow-lg">
              여성
            </div>
            <div className="text-amber-200/50 text-sm md:text-base font-sans tracking-wide">
              FEMALE PASSENGER
            </div>
            <div className={`mt-4 w-12 h-1 bg-amber-500/50 transition-all duration-700 ${hoveredGender === 'female' ? 'w-24 bg-amber-400' : ''}`} />
            </motion.div>
          </div>
        </div>
      </div>
      
      {/* Debug Panel */}
      {isEditMode && (
        <div className="absolute bottom-4 right-4 bg-slate-900/90 text-white p-4 rounded-lg shadow-2xl z-[100] text-xs font-mono w-80 border border-slate-700 pointer-events-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-amber-500">GenderView Debug</h3>
          </div>
          
          {/* Mirror Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">Mirror Frame</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-300" max="300" value={config.mirror.x} onChange={e => setConfig({...config, mirror: {...config.mirror, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.mirror.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-300" max="300" value={config.mirror.y} onChange={e => setConfig({...config, mirror: {...config.mirror, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.mirror.y}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Scale</span><input type="range" min="0.001" max="5" step="0.001" value={config.mirror.scale} onChange={e => setConfig({...config, mirror: {...config.mirror, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.mirror.scale}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Mask W</span><input type="range" min="10" max="150" value={config.mirror.maskW} onChange={e => setConfig({...config, mirror: {...config.mirror, maskW: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.mirror.maskW}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Mask H</span><input type="range" min="10" max="150" value={config.mirror.maskH} onChange={e => setConfig({...config, mirror: {...config.mirror, maskH: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.mirror.maskH}</span></div>
          </div>

          {/* Male Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">Male Silhouette</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-300" max="300" value={config.male.x} onChange={e => setConfig({...config, male: {...config.male, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.male.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-300" max="300" value={config.male.y} onChange={e => setConfig({...config, male: {...config.male, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.male.y}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Scale</span><input type="range" min="0.001" max="5" step="0.001" value={config.male.scale} onChange={e => setConfig({...config, male: {...config.male, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.male.scale}</span></div>
          </div>

          {/* Female Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">Female Silhouette</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-300" max="300" value={config.female.x} onChange={e => setConfig({...config, female: {...config.female, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.female.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-300" max="300" value={config.female.y} onChange={e => setConfig({...config, female: {...config.female, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.female.y}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Scale</span><input type="range" min="0.001" max="5" step="0.001" value={config.female.scale} onChange={e => setConfig({...config, female: {...config.female, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.female.scale}</span></div>
          </div>
          
          <button 
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(config, null, 2));
              alert("Copied to clipboard!");
            }}
            className="w-full mt-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded"
          >
            [복사하기] JSON 복사
          </button>
        </div>
      )}
      
    </div>
  );
}
