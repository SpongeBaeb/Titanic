'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import ProgressLine from '@/components/ui/ProgressLine';
import { Question } from '@/data/questions';
import { useQuizStore } from '@/store/quizStore';

interface AgeViewProps {
  question: Question;
  onAnswer: (value: string) => void;
  onBack: () => void;
}

export default function AgeView({ question, onAnswer, onBack }: AgeViewProps) {
  // --- Physics & Mechanics ---
  const dragAngle = useMotionValue(0);
  const isDragging = useRef(false);
  const pivotRef = useRef<HTMLDivElement>(null);
  
  // --- Debug Panel State ---
  const [isEditMode, setIsEditMode] = useState(true);
  const [config, setConfig] = useState({
    rbase: { x: 0, y: 487, scale: 2.2 },
    base: { x: 0, y: 50, scale: 1.5 },
    lever: { x: 0, y: 0, scale: 4.6, originY: 125, maxAngle: 120 },
    arrow: { x: 0, y: 46, scale: 4.9, originY: 50 },
    hitArea: { w: 30, h: 50, y: -20 }, // Adjusted default for scaled lever
    snapAngles: [-107, -75, -49, -18, 18, 46, 75]
  });
  const [characterConfig, setCharacterConfig] = useState<Record<string, { x: number, y: number, scale: number }>>({});

  // Mass-Spring-Damper logic for heavy brass lever feel
  const smoothAngle = useSpring(dragAngle, { stiffness: 150, damping: 25, mass: 1.5 });

  // Option segments
  const numOptions = question.options.length;
  const snapAngles = config.snapAngles;

  const [activeIndex, setActiveIndex] = useState(3); // Start at middle
  const [showSparks, setShowSparks] = useState(false);

  // Update active index based on smooth angle
  useEffect(() => {
    return smoothAngle.on("change", (currentAngle) => {
      // Find closest snap angle
      let closestIdx = 0;
      let minDiff = Infinity;
      snapAngles.forEach((angle, idx) => {
        const diff = Math.abs(currentAngle - angle);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      if (closestIdx !== activeIndex) {
        // Option changed! Play ratchet sound conceptually and trigger sparks
        setActiveIndex(closestIdx);
        setShowSparks(true);
        setTimeout(() => setShowSparks(false), 500); // Reset sparks after 500ms
      }
    });
  }, [smoothAngle, activeIndex, snapAngles]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateAngle(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    updateAngle(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Snap to closest angle directly based on current dragAngle
    let closestIdx = 0;
    let minDiff = Infinity;
    const current = dragAngle.get();
    snapAngles.forEach((angle, idx) => {
      const diff = Math.abs(current - angle);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    dragAngle.set(snapAngles[closestIdx]);
  };

  const updateAngle = (clientX: number, clientY: number) => {
    if (!pivotRef.current) return;
    const rect = pivotRef.current.getBoundingClientRect();
    const pivotX = rect.left + rect.width / 2;
    const pivotY = rect.top + rect.height / 2;

    const dx = clientX - pivotX;
    const dy = clientY - pivotY;
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = angle + 90; // Top is 0
    
    if (angle > 180) angle -= 360;
    
    const max = config.lever.maxAngle;
    if (angle > max) angle = max;
    if (angle < -max) angle = -max;

    dragAngle.set(angle);
  };

  const handleTelegraphClick = (e: React.MouseEvent) => {
    if (!pivotRef.current) return;
    const rect = pivotRef.current.getBoundingClientRect();
    const pivotX = rect.left + rect.width / 2;
    const pivotY = rect.top + rect.height / 2;

    const dx = e.clientX - pivotX;
    const dy = e.clientY - pivotY;
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = angle + 90; // Top is 0
    if (angle > 180) angle -= 360;

    let closestIdx = 0;
    let minDiff = Infinity;
    snapAngles.forEach((snap, idx) => {
      const diff = Math.abs(angle - snap);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    dragAngle.set(snapAngles[closestIdx]);
  };

  const handleConfirm = () => {
    onAnswer(question.options[activeIndex].value);
  };

  const userSex = useQuizStore(state => state.answers.sex);
  const activeOption = question.options[activeIndex];
  
  let finalBgImage = activeOption?.bgImage;
  if (userSex === 'female' && finalBgImage && !finalBgImage.includes('10.png')) {
    finalBgImage = finalBgImage.replace('.png', 'f.png');
  }

  return (
    <div 
      className="w-full relative min-h-screen flex flex-col justify-center items-center overflow-hidden select-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      
      {/* Background Layer */}
      <div className="absolute inset-0 z-[0] pointer-events-none">
        {/* Base Background */}
        <img 
          src="/bg/telegraph.png"
          alt="Telegraph Room"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* CSS Only Animated Smoke Layers */}
        <div className="absolute inset-0 w-[200%] h-[200%] -left-[50%] -top-[50%] opacity-60 mix-blend-screen pointer-events-none">
          <style>{`
            @keyframes floatUp1 {
              0% { transform: translateY(50%) translateX(-10%) scale(1) rotate(0deg); opacity: 0; }
              20% { opacity: 0.8; }
              80% { opacity: 0.8; }
              100% { transform: translateY(-30%) translateX(10%) scale(1.5) rotate(20deg); opacity: 0; }
            }
            @keyframes floatUp2 {
              0% { transform: translateY(40%) translateX(10%) scale(1.2) rotate(0deg); opacity: 0; }
              20% { opacity: 0.6; }
              80% { opacity: 0.6; }
              100% { transform: translateY(-40%) translateX(-20%) scale(1.8) rotate(-15deg); opacity: 0; }
            }
            @keyframes floatUp3 {
              0% { transform: translateY(60%) translateX(0%) scale(0.8) rotate(0deg); opacity: 0; }
              20% { opacity: 0.7; }
              80% { opacity: 0.7; }
              100% { transform: translateY(-20%) translateX(15%) scale(1.3) rotate(10deg); opacity: 0; }
            }
          `}</style>
          <div 
            className="absolute inset-0 blur-[30px]" 
            style={{ 
              background: 'radial-gradient(circle at 50% 50%, rgba(200,210,220,0.15) 0%, transparent 60%)',
              animation: 'floatUp1 8s infinite linear' 
            }} 
          />
          <div 
            className="absolute inset-0 blur-[40px]" 
            style={{ 
              background: 'radial-gradient(circle at 40% 60%, rgba(200,210,220,0.1) 0%, transparent 65%)',
              animation: 'floatUp2 12s infinite linear -4s' 
            }} 
          />
          <div 
            className="absolute inset-0 blur-[25px]" 
            style={{ 
              background: 'radial-gradient(circle at 60% 40%, rgba(220,230,240,0.12) 0%, transparent 55%)',
              animation: 'floatUp3 10s infinite linear -2s' 
            }} 
          />
        </div>
        
        {/* Background Silhouettes (Crossfaded based on active index) */}
        <AnimatePresence>
          {activeOption && finalBgImage && (
            <motion.img 
              key={activeOption.id + (userSex === 'female' ? '_f' : '')}
              src={finalBgImage}
              alt="Age Silhouette"
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(10px)' }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="absolute top-1/2 -translate-y-1/2 left-0 w-full object-contain object-center h-[80vh]"
              style={{
                x: characterConfig[activeOption.id]?.x ?? 198,
                y: characterConfig[activeOption.id]?.y ?? 139,
                scale: characterConfig[activeOption.id]?.scale ?? 1,
              }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              draggable={false}
            />
          )}
        </AnimatePresence>
      </div>
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent to-[#050302]/40 pointer-events-none" />

      {/* Back Button */}
      <button 
        onClick={onBack}
        className="fixed bottom-8 left-8 z-[50] flex items-center text-slate-400 hover:text-amber-400 transition-colors group pointer-events-auto"
      >
        <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
        <span className="text-sm font-sans tracking-widest uppercase">Back</span>
      </button>

      {/* Header Info */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-[50] text-center pointer-events-none">
        <div className="mb-8">
          <ProgressLine currentStep={question.step} totalSteps={question.totalSteps} />
        </div>
        <motion.h2 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl md:text-3xl font-display font-bold text-amber-50/90 mb-2 tracking-wide shadow-black drop-shadow-lg"
        >
          {question.title}
        </motion.h2>
        <div className="h-8">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-amber-400 font-display text-xl font-bold tracking-widest"
          >
            {activeOption.label}
          </motion.div>
        </div>
      </div>

      {/* TELEGRAPH CONTAINER */}
      <div className="relative w-full max-w-[600px] h-[500px] mt-24 z-[20] flex justify-center items-center">
        
        {/* Particle/Steam Effects (z-10 relative to telegraph) */}
        <AnimatePresence>
          {showSparks && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.6, scale: 1.2 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-[10] bg-[radial-gradient(circle,rgba(255,255,255,0.8)_0%,transparent_70%)] blur-md pointer-events-none mix-blend-overlay"
            />
          )}
        </AnimatePresence>

        {/* Rear Base Image (rbase) */}
        <div 
          className={`absolute z-[34] pointer-events-none transition-opacity ${isEditMode ? 'opacity-40' : 'opacity-100'}`}
          style={{
            transform: `translate(${config.rbase.x}px, ${config.rbase.y}px) scale(${config.rbase.scale})`
          }}
        >
          <img src="/telegraph/rbase.png" alt="Telegraph Rear Base" className="w-[500px] md:w-[600px] h-auto drop-shadow-2xl" onError={(e) => { e.currentTarget.style.opacity = '0.5'; }} draggable={false} />
        </div>

        {/* Click-to-Snap Area (z-25, behind the lever but clickable) */}
        <div 
          className="absolute inset-0 z-[25] pointer-events-auto cursor-pointer rounded-full"
          style={{
            transform: `translate(${config.base.x}px, ${config.base.y}px) scale(${config.base.scale})`
          }}
          onClick={handleTelegraphClick}
        />

        {/* Base Image */}
        <div 
          className={`absolute z-[35] pointer-events-none transition-opacity ${isEditMode ? 'opacity-40' : 'opacity-100'}`}
          style={{
            transform: `translate(${config.base.x}px, ${config.base.y}px) scale(${config.base.scale})`
          }}
        >
          <img src="/telegraph/base.png" alt="Telegraph Base" className="w-[500px] md:w-[600px] h-auto drop-shadow-2xl pointer-events-none" onError={(e) => { e.currentTarget.style.opacity = '0.5'; }} draggable={false} />
        </div>

        {/* Pointer Arrow Image (Optional) */}
        <motion.div 
          className="absolute z-[40] pointer-events-none"
          style={{
            transformOrigin: `50% ${config.arrow.originY}%`,
            x: config.arrow.x,
            y: config.arrow.y,
            scale: config.arrow.scale,
            rotate: smoothAngle
          }}
        >
          <img src="/telegraph/arrow.png" alt="Telegraph Arrow" className="w-[65px] md:w-[80px] h-auto drop-shadow-lg" onError={(e) => { e.currentTarget.style.display = 'none'; }} draggable={false} />
          
        </motion.div>

        {/* Draggable Lever Container */}
        <div className="absolute inset-0 z-[30] flex justify-center items-center pointer-events-none">
          {/* Lever Visual (rotates) */}
          <motion.div 
            className="absolute pointer-events-none z-[30]"
            style={{
              transformOrigin: `50% ${config.lever.originY}%`,
              rotate: smoothAngle,
              x: config.lever.x,
              y: config.lever.y,
              scale: config.lever.scale
            }}
          >
            <img src="/telegraph/lever.png" alt="Telegraph Lever" className="w-[100px] md:w-[120px] h-auto drop-shadow-2xl" onError={(e) => { 
              e.currentTarget.style.display = 'none'; 
            }} draggable={false} />
            
            {/* Custom Hit Area that Rotates with the Lever */}
            <div 
              className={`absolute cursor-grab active:cursor-grabbing pointer-events-auto touch-none outline-none focus:outline-none ${isEditMode ? 'bg-red-500/40 border-2 border-red-500 border-dashed' : ''}`}
              style={{
                width: `${config.hitArea.w}px`,
                height: `${config.hitArea.h}px`,
                top: `calc(50% + ${config.hitArea.y}px)`,
                left: '50%',
                transform: 'translate(-50%, -50%)'
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              title="Grab here to move the lever"
            />
            
            {/* Hidden Pivot Point for Angle Calculation */}
            <div 
              ref={pivotRef}
              className="absolute w-1 h-1 pointer-events-none opacity-0"
              style={{
                top: `${config.lever.originY}%`,
                left: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            />
          </motion.div>

          {/* Snap Angle Visual Guides */}
          {isEditMode && (
            <motion.div 
              className="absolute pointer-events-none z-[45]"
              style={{
                transformOrigin: `50% ${config.lever.originY}%`,
                x: config.lever.x,
                y: config.lever.y,
                scale: config.lever.scale
              }}
            >
              {/* Invisible lever image to force exact same dimensions for accurate pivot math */}
              <img src="/telegraph/lever.png" className="w-[100px] md:w-[120px] h-auto opacity-0" alt="hidden" />
              
              {config.snapAngles.map((angle, i) => (
                <div key={i} className="absolute inset-0" style={{ transformOrigin: `50% ${config.lever.originY}%`, transform: `rotate(${angle}deg)` }}>
                  <div className="absolute w-1 h-12 bg-green-400 rounded-full shadow-[0_0_10px_rgba(74,222,128,0.8)]" style={{ left: 'calc(50% - 2px)', top: '5%' }} />
                  <div className="absolute font-mono text-[12px] text-green-300 font-bold bg-black/80 px-1 rounded" style={{ left: 'calc(50% - 10px)', top: '-5%' }}>{i}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

      </div>

      {/* Confirm Button */}
      <div className="absolute bottom-16 md:bottom-20 z-[40]">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleConfirm}
          className="relative w-56 h-20 flex items-center justify-center pointer-events-auto transition-all group drop-shadow-[0_15px_25px_rgba(0,0,0,0.9)] hover:drop-shadow-[0_0_30px_rgba(255,180,100,0.6)]"
        >
          <img 
            src="/labelUI.png" 
            alt="Confirm Label" 
            className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-all" 
            draggable={false}
          />
          <span className="relative z-10 text-[#2a1708] font-display uppercase tracking-widest font-extrabold text-sm md:text-base opacity-90 group-hover:opacity-100 transition-opacity" style={{ textShadow: '0 1px 1px rgba(255,255,255,0.4)' }}>
            나이 확정
          </span>
        </motion.button>
      </div>

      {/* DEBUG PANEL TOGGLE */}
      {!isEditMode && (
        <button 
          onClick={() => setIsEditMode(true)}
          className="fixed bottom-4 right-4 z-[100] bg-slate-900/80 text-amber-400 p-2 rounded-full border border-slate-700 shadow-lg hover:bg-slate-800 transition-colors pointer-events-auto"
          title="Open Debugger"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
        </button>
      )}

      {/* DEBUG PANEL */}
      {isEditMode && (
        <div className="absolute bottom-4 right-4 bg-slate-900/90 text-white p-4 z-[100] border border-slate-700 rounded shadow-2xl flex flex-col gap-3 font-mono text-[10px] w-64 backdrop-blur-md pointer-events-auto h-[60vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
            <h3 className="font-bold text-amber-400">Position Debugger</h3>
            <button onClick={() => setIsEditMode(false)} className="text-slate-400 hover:text-white">X</button>
          </div>
          
          {/* Character Controls */}
          {activeOption && (
            <div className="bg-slate-800/80 p-2 rounded mb-2 border border-blue-500/50">
              <div className="font-bold text-blue-300 mb-1">Character: {activeOption.label}</div>
              <div className="flex gap-2 mb-1 items-center">
                <span className="w-8">X</span>
                <input type="range" min="-1000" max="1000" value={characterConfig[activeOption.id]?.x ?? 198} onChange={e => setCharacterConfig({...characterConfig, [activeOption.id]: {...(characterConfig[activeOption.id] || {y:139, scale:1}), x: Number(e.target.value)}})} className="flex-1" />
                <span className="w-8 text-right">{characterConfig[activeOption.id]?.x ?? 198}</span>
              </div>
              <div className="flex gap-2 mb-1 items-center">
                <span className="w-8">Y</span>
                <input type="range" min="-1000" max="1000" value={characterConfig[activeOption.id]?.y ?? 139} onChange={e => setCharacterConfig({...characterConfig, [activeOption.id]: {...(characterConfig[activeOption.id] || {x:198, scale:1}), y: Number(e.target.value)}})} className="flex-1" />
                <span className="w-8 text-right">{characterConfig[activeOption.id]?.y ?? 139}</span>
              </div>
              <div className="flex gap-2 mb-1 items-center">
                <span className="w-8">Scale</span>
                <input type="range" min="0.1" max="5" step="0.05" value={characterConfig[activeOption.id]?.scale ?? 1} onChange={e => setCharacterConfig({...characterConfig, [activeOption.id]: {...(characterConfig[activeOption.id] || {x:198, y:139}), scale: Number(e.target.value)}})} className="flex-1" />
                <span className="w-8 text-right">{characterConfig[activeOption.id]?.scale ?? 1}</span>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(characterConfig, null, 2));
                  alert('Character configs copied to clipboard!');
                }}
                className="w-full bg-blue-600/50 hover:bg-blue-500 text-white p-1 rounded mt-2 text-xs"
              >
                Copy All Character Configs
              </button>
            </div>
          )}

          {/* RBase Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">rbase.png</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-1000" max="1000" value={config.rbase.x} onChange={e => setConfig({...config, rbase: {...config.rbase, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.rbase.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-1000" max="1000" value={config.rbase.y} onChange={e => setConfig({...config, rbase: {...config.rbase, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.rbase.y}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Scale</span><input type="range" min="0.1" max="10" step="0.1" value={config.rbase.scale} onChange={e => setConfig({...config, rbase: {...config.rbase, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.rbase.scale}</span></div>
          </div>

          {/* Base Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">base.png</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-200" max="200" value={config.base.x} onChange={e => setConfig({...config, base: {...config.base, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.base.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-200" max="200" value={config.base.y} onChange={e => setConfig({...config, base: {...config.base, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.base.y}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Scale</span><input type="range" min="0.1" max="10" step="0.1" value={config.base.scale} onChange={e => setConfig({...config, base: {...config.base, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.base.scale}</span></div>
          </div>

          {/* Lever Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">lever.png</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-200" max="200" value={config.lever.x} onChange={e => setConfig({...config, lever: {...config.lever, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-200" max="200" value={config.lever.y} onChange={e => setConfig({...config, lever: {...config.lever, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.y}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Scale</span><input type="range" min="0.1" max="10" step="0.1" value={config.lever.scale} onChange={e => setConfig({...config, lever: {...config.lever, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.scale}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Pivot Y</span><input type="range" min="0" max="200" value={config.lever.originY} onChange={e => setConfig({...config, lever: {...config.lever, originY: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.originY}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Range</span><input type="range" min="30" max="150" value={config.lever.maxAngle} onChange={e => setConfig({...config, lever: {...config.lever, maxAngle: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.maxAngle}</span></div>
          </div>

          {/* Arrow Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">arrow.png</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-200" max="200" value={config.arrow.x} onChange={e => setConfig({...config, arrow: {...config.arrow, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.arrow.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-200" max="200" value={config.arrow.y} onChange={e => setConfig({...config, arrow: {...config.arrow, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.arrow.y}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Scale</span><input type="range" min="0.1" max="10" step="0.1" value={config.arrow.scale} onChange={e => setConfig({...config, arrow: {...config.arrow, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.arrow.scale}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Pivot Y</span><input type="range" min="0" max="200" value={config.arrow.originY} onChange={e => setConfig({...config, arrow: {...config.arrow, originY: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.arrow.originY}</span></div>
          </div>
          
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">Snap Angles (Green Marks)</div>
            {config.snapAngles.map((angle, i) => (
              <div key={i} className="flex gap-2 mb-1 items-center">
                <span className="w-8">[{i}]</span>
                <input 
                  type="range" min="-180" max="180" step="1" 
                  value={angle} 
                  onChange={e => {
                    const newAngles = [...config.snapAngles];
                    newAngles[i] = Number(e.target.value);
                    setConfig({...config, snapAngles: newAngles});
                  }} 
                  className="flex-1" 
                />
                <span className="w-8 text-right">{angle}</span>
              </div>
            ))}
          </div>

          {/* Hit Area Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">Drag Hit Area (Red Box)</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">W</span><input type="range" min="10" max="300" value={config.hitArea.w} onChange={e => setConfig({...config, hitArea: {...config.hitArea, w: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.hitArea.w}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">H</span><input type="range" min="10" max="300" value={config.hitArea.h} onChange={e => setConfig({...config, hitArea: {...config.hitArea, h: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.hitArea.h}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Y</span><input type="range" min="-150" max="150" value={config.hitArea.y} onChange={e => setConfig({...config, hitArea: {...config.hitArea, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.hitArea.y}</span></div>
          </div>
          
          <button 
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(config, null, 2));
              alert('Config copied to clipboard!');
            }}
            className="w-full bg-amber-600/50 hover:bg-amber-500 text-white p-2 rounded mt-2 font-bold"
          >
            복사하기 (Copy)
          </button>
        </div>
      )}
    </div>
  );
}
