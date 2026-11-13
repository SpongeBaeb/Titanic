'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
  // 선택 확정 연출: 고른 쪽 실루엣이 또렷해지고 불이 한 번 밝아진 뒤 암전되며 넘어간다
  const [chosen, setChosen] = useState<'male' | 'female' | null>(null);
  const [touchPreview, setTouchPreview] = useState(false);
  const lastPointer = useRef<string>('mouse');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();
  // 거울 크기는 화면 높이에 맞춘다: 틀 높이가 화면의 약 62%가 되도록
  const [vh, setVh] = useState(800);
  const [vw, setVw] = useState(1280);
  useEffect(() => {
    const f = () => { setVh(window.innerHeight); setVw(window.innerWidth); };
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const mirrorFit = Math.min(1.5, Math.max(0.75, vh / 920));
  // 가리킨(고른) 쪽: 촛불과 거울 빛이 이쪽으로 모인다
  const lightSide = chosen ?? hoveredGender;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const confirm = (g: 'male' | 'female') => {
    if (chosen) return;
    setHoveredGender(g);
    setChosen(g);
    timer.current = setTimeout(() => onAnswer(g), reduceMotion ? 200 : 900);
  };
  // 마우스는 올리면 미리 보기, 누르면 확정. 터치는 한 번 누르면 미리 보기, 한 번 더 누르면 확정.
  const handleClick = (g: 'male' | 'female') => {
    if (chosen) return;
    const touch = lastPointer.current === 'touch';
    lastPointer.current = 'mouse';
    if (touch && hoveredGender !== g) {
      setHoveredGender(g);
      setTouchPreview(true);
      return;
    }
    confirm(g);
  };
  const zoneProps = (g: 'male' | 'female') => ({
    onPointerDown: (e: React.PointerEvent) => { lastPointer.current = e.pointerType; },
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse' && !chosen) setHoveredGender(g); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse' && !chosen) setHoveredGender(null); },
    onFocus: () => { if (!chosen) setHoveredGender(g); },
    onBlur: () => { if (!chosen && lastPointer.current !== 'touch') setHoveredGender(null); },
    onClick: () => handleClick(g),
  });

  // Fallback to CSS mirror if asset is missing
  const [hasMirrorAsset, setHasMirrorAsset] = useState(true);
  
  // --- Debug Panel State ---
  const isEditMode = useQuizStore(state => state.showDebug);
  const [config, setConfig] = useState({
    // y와 scale은 화면 높이에 맞춘 기준값에 더하는 보정값이다 (0, 1이 기본)
    mirror: { x: 0, y: 0, scale: 1, maskW: 76, maskH: 66 },
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
          src="/bg/house.webp" 
          alt="Vintage House" 
          className="w-full h-full object-cover opacity-100" 
          draggable={false}
        />
      </div>
      {/* 벽등 촛불: 배경 그림(1920x1072, object-cover)의 불꽃 위치에 겹쳐 일렁이는 빛을 얹는다 */}
      <style>{`
        @keyframes candle-flicker {
          0%   { opacity: .85; transform: translate(-50%,-50%) scale(1); }
          11%  { opacity: .55; transform: translate(-50%,-50%) scale(.94); }
          23%  { opacity: 1;   transform: translate(-50%,-50%) scale(1.06); }
          37%  { opacity: .68; transform: translate(-50%,-50%) scale(.97); }
          49%  { opacity: .95; transform: translate(-50%,-50%) scale(1.03); }
          63%  { opacity: .6;  transform: translate(-50%,-50%) scale(.95); }
          78%  { opacity: .92; transform: translate(-50%,-50%) scale(1.04); }
          100% { opacity: .85; transform: translate(-50%,-50%) scale(1); }
        }
      `}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        {(() => {
          const s = Math.max(vw / 1920, vh / 1072);
          const ox = (vw - 1920 * s) / 2;
          const oy = (vh - 1072 * s) / 2;
          const flames = [
            { x: 524, y: 190, d: 2.7, o: 0, side: 'male' },
            { x: 612, y: 196, d: 3.3, o: -1.1, side: 'male' },
            { x: 1314, y: 194, d: 3.0, o: -0.6, side: 'female' },
            { x: 1403, y: 191, d: 2.4, o: -1.9, side: 'female' },
          ];
          // 고른(가리킨) 쪽 촛불은 더 밝아지고, 반대쪽은 꺼지며 벽이 어두워진다
          const focus = chosen ?? hoveredGender;
          return (
            <>
              {flames.map((f, i) => {
                const off = !!focus && focus !== f.side;
                const boost = !!focus && focus === f.side;
                return (
                  <div key={i}>
                    {/* 켜짐/꺼짐/밝아짐을 받는 바깥 껍질 */}
                    <div
                      className="absolute"
                      style={{
                        left: ox + f.x * s,
                        top: oy + f.y * s,
                        width: 0,
                        height: 0,
                        opacity: off ? 0 : 1,
                        transform: `scale(${boost ? 1.6 : 1})`,
                        transition: 'opacity 0.9s ease, transform 0.9s ease',
                      }}
                    >
                      <div
                        className="absolute left-0 top-0"
                        style={{
                          width: 150 * s,
                          height: 150 * s,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(255,214,140,0.75) 0%, rgba(255,170,70,0.38) 28%, rgba(255,140,40,0) 68%)',
                          mixBlendMode: 'screen',
                          transform: 'translate(-50%,-50%)',
                          animation: reduceMotion ? undefined : `candle-flicker ${f.d}s ease-in-out ${f.o}s infinite`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {/* 꺼진 쪽 벽을 어둡게: 바깥쪽에서 안쪽으로 옅어진다 */}
              {(['male', 'female'] as const).map((side) => (
                <div
                  key={side}
                  className="absolute inset-y-0 w-[52%]"
                  style={{
                    [side === 'male' ? 'left' : 'right']: 0,
                    background: `linear-gradient(${side === 'male' ? '90deg' : '270deg'}, rgba(4,2,1,0.88) 0%, rgba(4,2,1,0.66) 55%, rgba(4,2,1,0) 100%)`,
                    opacity: focus && focus !== side ? 1 : 0,
                    transition: 'opacity 0.9s ease',
                  }}
                />
              ))}
            </>
          );
        })()}
      </div>
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent to-[#050302] pointer-events-none" />

      {/* Back Button */}
      <button 
        onClick={onBack}
        className="fixed left-4 top-3 md:bottom-8 md:left-8 md:top-auto z-[50] flex items-center text-slate-400 hover:text-amber-400 transition-colors group pointer-events-auto"
      >
        <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
        <span className="text-sm font-sans tracking-widest uppercase">Back</span>
      </button>

      {/* Header Info (Question Text) */}
      <div className="absolute bottom-16 md:bottom-20 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-[50] text-center pointer-events-none">
        <div className="mb-4">
          <ProgressLine />
        </div>
        <motion.h2 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl md:text-3xl font-title font-bold text-amber-50/90 mb-4 tracking-wide shadow-black drop-shadow-lg"
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
          transform: `translate(${config.mirror.x}px, calc(${(-0.2 * vh).toFixed(1)}px + ${config.mirror.y}px)) scale(${config.mirror.scale * mirrorFit})`
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
            src="/reflection.webp"
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
                src="/male.webp"
                alt="Male Silhouette"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                className="absolute bottom-0 w-[120%] object-contain origin-bottom z-[15] brightness-0"
                style={{
                  x: config.male.x,
                  y: config.male.y,
                  scale: config.male.scale,
                  // 거울에 비친 모습처럼: 옅고 흐리게, 아래쪽(몸통)은 유리 안으로 사라진다
                  filter: 'brightness(0.12) sepia(0.6) blur(2.6px)',
                  WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 42%, transparent 84%)',
                  maskImage: 'linear-gradient(to bottom, #000 0%, #000 42%, transparent 84%)',
                }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {hoveredGender === 'female' && (
              <motion.img 
                key="female"
                src="/female.webp"
                alt="Female Silhouette"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                className="absolute bottom-0 w-[120%] object-contain origin-bottom z-[15] brightness-0"
                style={{
                  x: config.female.x,
                  y: config.female.y,
                  scale: config.female.scale,
                  filter: 'brightness(0.12) sepia(0.6) blur(2.6px)',
                  WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 42%, transparent 84%)',
                  maskImage: 'linear-gradient(to bottom, #000 0%, #000 42%, transparent 84%)',
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

          {/* 유리 위 반사: 비껴가는 빛줄기와, 촛불이 비치는 작은 빛점 (z-25) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[25]"
            style={{ background: 'linear-gradient(115deg, rgba(255,235,200,0) 28%, rgba(255,235,200,0.11) 41%, rgba(255,235,200,0) 54%)' }}
          />
          {(['male', 'female'] as const).map((side) => {
            const lit = lightSide === side;
            const off = !!lightSide && lightSide !== side;
            return (
              <div
                key={side}
                aria-hidden
                className="pointer-events-none absolute z-[26]"
                style={{
                  [side === 'male' ? 'left' : 'right']: '9%',
                  top: '34%',
                  width: 46,
                  height: 46,
                  marginLeft: -23,
                  marginRight: -23,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,236,190,0.95) 0%, rgba(255,190,100,0.45) 32%, rgba(255,160,60,0) 70%)',
                  mixBlendMode: 'screen',
                  opacity: off ? 0 : lit ? 1 : 0.4,
                  transform: `scale(${lit ? 1.5 : 1})`,
                  transition: 'opacity 0.9s ease, transform 0.9s ease',
                }}
              >
                <div
                  className="h-full w-full rounded-full"
                  style={{
                    background: 'inherit',
                    animation: reduceMotion ? undefined : `candle-flicker-plain ${side === 'male' ? 2.8 : 3.1}s ease-in-out infinite`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* 거울 틀에 닿는 촛불빛: 틀 이미지 모양으로만 번지게 마스크한다 (z-31) */}
        <style>{`
          @keyframes candle-flicker-plain {
            0%, 100% { opacity: .85; } 12% { opacity: .55; } 25% { opacity: 1; }
            40% { opacity: .65; } 55% { opacity: .95; } 70% { opacity: .6; } 85% { opacity: .92; }
          }
        `}</style>
        {hasMirrorAsset && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[31]"
            style={{
              // 틀 모양 ∩ 위쪽 영역: 왼쪽·오른쪽·윗부분만 빛의 영향을 받고 아래쪽 틀은 그대로 둔다
              WebkitMaskImage: 'url(/mirror.webp), linear-gradient(to bottom, #000 0%, #000 55%, transparent 78%)',
              maskImage: 'url(/mirror.webp), linear-gradient(to bottom, #000 0%, #000 55%, transparent 78%)',
              WebkitMaskSize: 'contain, 100% 100%',
              maskSize: 'contain, 100% 100%',
              WebkitMaskRepeat: 'no-repeat, no-repeat',
              maskRepeat: 'no-repeat, no-repeat',
              WebkitMaskPosition: 'center, center',
              maskPosition: 'center, center',
              WebkitMaskComposite: 'source-in',
              maskComposite: 'intersect',
            }}
          >
            {(['male', 'female'] as const).map((side) => {
              const lit = lightSide === side;
              const off = !!lightSide && lightSide !== side;
              const dir = side === 'male' ? '90deg' : '270deg';
              return (
                <div key={side} className="absolute inset-0">
                  {/* 따뜻한 빛: 켜진 쪽 가장자리에서 안쪽으로 */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(${dir}, rgba(255,190,100,0.7) 0%, rgba(255,170,80,0.26) 28%, rgba(255,150,60,0) 52%)`,
                      mixBlendMode: 'soft-light',
                      opacity: lit ? 1 : off ? 0 : 0.3,
                      transition: 'opacity 0.9s ease',
                      animation: reduceMotion || !lit ? undefined : 'candle-flicker-plain 2.9s ease-in-out infinite',
                    }}
                  />
                  {/* 꺼진 쪽은 어두워진다 */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(${dir}, rgba(5,3,2,0.7) 0%, rgba(5,3,2,0.35) 45%, rgba(5,3,2,0) 75%)`,
                      opacity: off ? 1 : 0,
                      transition: 'opacity 0.9s ease',
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Antique Mirror Frame (z-30) */}
        {hasMirrorAsset ? (
          <img 
            src="/mirror.webp" 
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

      {/* 선택 영역: 화면 좌우 절반 전체가 버튼이다 (z-40) */}
      <div className="absolute inset-0 z-[40] flex">
        {([
          { g: 'male' as const, ko: '남성', en: 'MALE PASSENGER', side: 'left' as const },
          { g: 'female' as const, ko: '여성', en: 'FEMALE PASSENGER', side: 'right' as const },
        ]).map(({ g, ko, en, side }) => {
          const on = hoveredGender === g;
          const left = side === 'left';
          return (
            <button
              key={g}
              type="button"
              aria-label={`${ko} 승객 선택`}
              aria-pressed={chosen === g}
              disabled={!!chosen}
              {...zoneProps(g)}
              className={`group relative flex h-full flex-1 cursor-pointer items-center bg-transparent outline-none ${left ? 'justify-start pl-[8%]' : 'justify-end pr-[8%]'}`}
            >
              {/* 글자 뒤 어두운 띠: 꽃무늬 벽지 위에서도 읽히게 한다 */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-[10%] w-[60%] transition-opacity duration-700"
                style={{
                  [left ? 'left' : 'right']: 0,
                  opacity: on ? 0.95 : 0.7,
                  background: `radial-gradient(ellipse 100% 50% at ${left ? '0% 50%' : '100% 50%'}, rgba(8,4,2,0.8) 0%, rgba(8,4,2,0.5) 45%, rgba(8,4,2,0) 100%)`,
                }}
              />
              <motion.div
                className={`relative flex flex-col gap-4 pointer-events-none ${left ? 'items-start' : 'items-end'}`}
                animate={{ opacity: on ? 1 : 0.8, x: on ? (left ? 20 : -20) : 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="font-title text-4xl tracking-widest text-amber-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] md:text-6xl">{ko}</div>
                <div className="font-sans text-sm tracking-[0.2em] text-amber-200/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] md:text-base">{en}</div>
                <img
                  src="/ui/ui_divider.webp"
                  alt=""
                  aria-hidden
                  draggable={false}
                  className={`mt-2 h-auto transition-all duration-700 ${on ? 'w-[230px] opacity-100 brightness-125' : 'w-[170px] opacity-70'} ${left ? '' : '-scale-x-100'}`}
                />
              </motion.div>
            </button>
          );
        })}
      </div>

      {/* 안내 한 줄 */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-[45] -translate-x-1/2 text-center font-sans text-xs tracking-wider text-amber-200/70 md:bottom-8">
        {touchPreview && hoveredGender && !chosen ? '한 번 더 누르면 선택됩니다' : '한쪽을 가리키면 거울에 모습이 비칩니다'}
      </div>

      {/* 확정 후 암전 */}
      <AnimatePresence>
        {chosen && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[60] bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduceMotion ? 0 : 0.45, duration: reduceMotion ? 0.15 : 0.45 }}
          />
        )}
      </AnimatePresence>

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
