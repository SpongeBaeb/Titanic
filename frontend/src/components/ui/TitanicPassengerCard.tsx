"use client";

import React, { useState, useEffect } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer 
} from 'recharts';
import { motion } from 'framer-motion';
import { characterDB } from '@/data/characterDB';
import { Quote, Settings, X } from 'lucide-react';

interface TitanicPassengerCardProps {
  passengerData: {
    name: string;
    koreanName: string;
    class: string;
    imageUrl?: string;
    matchRate?: number;
    survived?: boolean;
    meta: { label: string; value: string }[];
    purpose: string;
    stats: { subject: string; value: number; fullMark: number }[];
    story: string;
    quote: string;
    tags: string[];
    imageConfig?: { top: number; left: number; width: number; height: number };
  };
}

const TitanicPassengerCard: React.FC<TitanicPassengerCardProps> = ({ passengerData }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // 프레임 위치 조절용 디버깅 상태 (고정값 적용)
  const [frameConfig, setFrameConfig] = useState({
    top: -13,
    left: -15,
    width: 130,
    height: 125,
  });

  // 초상화 위치 조절용 디버깅 상태
  const [portraitConfig, setPortraitConfig] = useState({
    top: 0,
    left: 0,
    width: 100,
    height: 135,
  });

  const [debugCharacter, setDebugCharacter] = useState<string>('');
  const [showNameBounds, setShowNameBounds] = useState<boolean>(false);
  const [nameBoxConfig, setNameBoxConfig] = useState({ marginTop: 0 });
  const [showDebug, setShowDebug] = useState<boolean>(false);

  // 1. 현재 렌더링에 사용할 데이터 결정 (디버그 오버라이드)
  const activeData = debugCharacter && characterDB[debugCharacter] 
    ? { ...characterDB[debugCharacter], matchRate: passengerData.matchRate, survived: characterDB[debugCharacter].survived ?? passengerData.survived } 
    : passengerData;

  const [debugFrame, setDebugFrame] = useState<'auto' | '1' | '2' | '3'>('auto');

  // 객실 등급에 따른 프레임 선택 (디버깅 오버라이드)
  let frameImage = '/frame/frame3.png';
  if (debugFrame !== 'auto') {
    frameImage = `/frame/frame${debugFrame}.png`;
  } else if (activeData.class.includes('1')) {
    frameImage = '/frame/frame1.png';
  } else if (activeData.class.includes('2')) {
    frameImage = '/frame/frame2.png';
  }

  // result 폴더의 이미지를 먼저 시도하고, 없으면 fallback
  const initialImage = `/result/${encodeURIComponent(activeData.name)}.png`;
  const [imgSrc, setImgSrc] = useState(initialImage);

  // 승객 정보가 바뀔 때마다 이미지 소스 및 기본 위치 초기화
  useEffect(() => {
    setImgSrc(`/result/${encodeURIComponent(activeData.name)}.png`);
    if (activeData.imageConfig) {
      setPortraitConfig(activeData.imageConfig);
    } else {
      setPortraitConfig({ top: 0, left: 0, width: 100, height: 135 });
    }
  }, [activeData.name, activeData.imageConfig]);

  const saveImageConfigToDB = async () => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
      const res = await fetch(`${API_BASE}/api/admin/image-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: activeData.name, config: portraitConfig })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(`${activeData.name}의 이미지 위치가 영구적으로 저장되었습니다!`);
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      alert('서버 오류로 저장하지 못했습니다.');
    }
  };

  return (
    <div 
      className="flex justify-center items-center w-full p-6 font-sans" 
      style={{ perspective: '1200px' }}
    >
      
      {/* 디버깅 툴 토글 버튼 */}
      {!showDebug && (
        <button 
          onClick={() => setShowDebug(true)}
          className="fixed top-4 left-4 z-50 bg-slate-900/80 text-white p-2 rounded-full hover:bg-slate-700 transition-colors shadow-lg border border-slate-600"
          title="디버깅 도구 열기"
        >
          <Settings size={20} />
        </button>
      )}

      {/* 디버깅 툴 패널 */}
      {showDebug && (
        <div 
          className="fixed top-4 left-4 bg-slate-900/95 text-white p-4 rounded-xl z-50 text-[10px] flex flex-col gap-2 w-72 shadow-2xl border border-slate-600 max-h-[90vh] overflow-y-auto backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-sm text-amber-400">디버깅 도구</h4>
            <button 
              onClick={() => setShowDebug(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          </div>
          
        {/* 캐릭터 테스트 */}
        <div className="flex flex-col gap-1 mb-2">
          <label className="text-slate-300 font-bold">캐릭터 강제 지정</label>
          <select 
            className="bg-slate-700 text-white rounded p-1"
            value={debugCharacter}
            onChange={(e) => setDebugCharacter(e.target.value)}
          >
            <option value="">(자동 매칭 결과 사용)</option>
            {Object.keys(characterDB).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* 이름 영역 가이드 */}
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="showNameBounds" 
              checked={showNameBounds} 
              onChange={e => setShowNameBounds(e.target.checked)} 
            />
            <label htmlFor="showNameBounds" className="text-slate-300 font-bold cursor-pointer hover:text-white">
              이름 영역 가이드 (Bounding Box) 켜기
            </label>
          </div>
          {showNameBounds && (
            <div className="pl-4 flex flex-col gap-1 border-l-2 border-slate-700">
              <label className="flex items-center gap-2 text-slate-300">
                Margin Top: {nameBoxConfig.marginTop}px 
                <input type="range" min="-30" max="50" value={nameBoxConfig.marginTop} onChange={e => setNameBoxConfig({...nameBoxConfig, marginTop: +e.target.value})} className="flex-1" />
              </label>
            </div>
          )}
        </div>

        {/* 프레임 테스트 */}
        <div className="flex gap-2 mb-2">
          <button className={`px-2 py-1 rounded ${debugFrame === 'auto' ? 'bg-amber-500 text-black' : 'bg-slate-700'}`} onClick={() => setDebugFrame('auto')}>자동</button>
          <button className={`px-2 py-1 rounded ${debugFrame === '1' ? 'bg-amber-500 text-black' : 'bg-slate-700'}`} onClick={() => setDebugFrame('1')}>1등석</button>
          <button className={`px-2 py-1 rounded ${debugFrame === '2' ? 'bg-amber-500 text-black' : 'bg-slate-700'}`} onClick={() => setDebugFrame('2')}>2등석</button>
          <button className={`px-2 py-1 rounded ${debugFrame === '3' ? 'bg-amber-500 text-black' : 'bg-slate-700'}`} onClick={() => setDebugFrame('3')}>3등석</button>
        </div>

        <div className="border-t border-slate-700 pt-2">
          <h5 className="font-bold text-slate-300">프레임 (Frame)</h5>
          <label className="flex items-center gap-2">Top: {frameConfig.top}% <input type="range" min="-50" max="150" value={frameConfig.top} onChange={e => setFrameConfig({...frameConfig, top: +e.target.value})} className="flex-1" /></label>
          <label className="flex items-center gap-2">Left: {frameConfig.left}% <input type="range" min="-50" max="150" value={frameConfig.left} onChange={e => setFrameConfig({...frameConfig, left: +e.target.value})} className="flex-1" /></label>
          <label className="flex items-center gap-2">Width: {frameConfig.width}% <input type="range" min="50" max="200" value={frameConfig.width} onChange={e => setFrameConfig({...frameConfig, width: +e.target.value})} className="flex-1" /></label>
          <label className="flex items-center gap-2">Height: {frameConfig.height}% <input type="range" min="50" max="200" value={frameConfig.height} onChange={e => setFrameConfig({...frameConfig, height: +e.target.value})} className="flex-1" /></label>
        </div>

        <div className="border-t border-slate-700 pt-2 mt-1">
          <h5 className="font-bold text-slate-300">초상화 (Portrait)</h5>
          <label className="flex items-center gap-2">Top: {portraitConfig.top}% <input type="range" min="-50" max="150" value={portraitConfig.top} onChange={e => setPortraitConfig({...portraitConfig, top: +e.target.value})} className="flex-1" /></label>
          <label className="flex items-center gap-2">Left: {portraitConfig.left}% <input type="range" min="-50" max="150" value={portraitConfig.left} onChange={e => setPortraitConfig({...portraitConfig, left: +e.target.value})} className="flex-1" /></label>
          <label className="flex items-center gap-2">Width: {portraitConfig.width}% <input type="range" min="50" max="200" value={portraitConfig.width} onChange={e => setPortraitConfig({...portraitConfig, width: +e.target.value})} className="flex-1" /></label>
          <label className="flex items-center gap-2">Height: {portraitConfig.height}% <input type="range" min="50" max="200" value={portraitConfig.height} onChange={e => setPortraitConfig({...portraitConfig, height: +e.target.value})} className="flex-1" /></label>
        </div>

        <div className="border-t border-slate-700 pt-2 mt-1">
          <button 
            onClick={saveImageConfigToDB}
            className="w-full bg-amber-500 text-black font-bold py-1.5 rounded hover:bg-amber-400 transition-colors"
          >
            현재 위치 DB에 영구 저장하기
          </button>
        </div>
        </div>
      )}


      {/* 3D Flipping Container */}
      <motion.div 
        className="relative w-full max-w-md h-[740px] cursor-pointer group"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateY: 360 }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        
        {/* ==================================================== */}
        {/* 1. FRONT FACE (Large Portrait & Summary) */}
        {/* ==================================================== */}
        <div 
          className="absolute inset-0 w-full h-full bg-[#F9F6F0] rounded-xl shadow-2xl overflow-hidden flex flex-col"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Top Accent Line */}
          <div className="h-3 w-full bg-[#1A2A3A] shrink-0 z-20 relative"></div>
          
          {/* Survival Stamp */}
          {activeData.survived !== undefined && (
            <div className={`absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 font-serif font-bold text-3xl md:text-4xl tracking-[0.2em] uppercase rotate-[-12deg] border-2 md:border-4 px-4 py-1.5 rounded-sm backdrop-blur-sm pointer-events-none transition-all duration-700
              ${activeData.survived 
                ? 'text-emerald-700 border-emerald-700 bg-emerald-100/10 shadow-[0_0_15px_rgba(4,120,87,0.3)]' 
                : 'text-rose-800 border-rose-800 bg-rose-100/10 shadow-[0_0_15px_rgba(159,18,57,0.3)]'
              }
            `}
            style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.4)' }}
            >
              {activeData.survived ? 'Survived' : 'Perished'}
            </div>
          )}

          {/* Large Hero Portrait Edge-to-Edge */}
          <div className="w-full h-[65%] relative overflow-hidden bg-[#1A2A3A]">
            <img 
              src={imgSrc} 
              onError={(e) => {
                // 이미지가 없을 경우 fallback 처리 (Anna Turja로 임시 설정)
                if (imgSrc !== "/result/Anna Turja.png") {
                  setImgSrc("/result/Anna Turja.png");
                }
              }}
              alt={activeData.name} 
              style={{
                position: 'absolute',
                top: `${portraitConfig.top}%`,
                left: `${portraitConfig.left}%`,
                width: `${portraitConfig.width}%`,
                height: `${portraitConfig.height}%`,
                objectFit: 'cover'
              }}
              className="sepia-[0.35] contrast-115 grayscale-[15%] group-hover:sepia-0 group-hover:grayscale-0 transition-all duration-[1.5s] ease-out"
            />
            {/* Elegant Gradient to blend with the bottom section */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#F9F6F0] via-[#F9F6F0]/80 to-transparent pointer-events-none"></div>
          </div>

          {/* Info Section (Bottom 35%) */}
          <div className="flex-1 flex flex-col items-center justify-start px-4 pt-3 pb-6 text-center relative z-10">
            {activeData.matchRate && (
              <div className="mb-2 text-[#D4AF37] font-bold text-[11px] tracking-widest bg-[#1A2A3A] px-3 py-1 rounded shadow-sm border border-[#D4AF37]/30">
                MATCH RATE : {activeData.matchRate}%
              </div>
            )}
            
            {/* 동적 폰트 크기 계산 */}
            {(() => {
              const len = activeData.name.length;
              let nameSizeClass = "text-3xl";
              if (len > 30) nameSizeClass = "text-xs";
              else if (len > 26) nameSizeClass = "text-sm";
              else if (len > 22) nameSizeClass = "text-base";
              else if (len > 18) nameSizeClass = "text-xl";
              else if (len > 16) nameSizeClass = "text-2xl";
              return (
                <h1 
                  className={`${nameSizeClass} font-serif font-bold text-[#1A2A3A] tracking-wider mb-1 px-2 leading-none whitespace-nowrap overflow-visible ${showNameBounds ? 'border border-red-500 bg-red-500/10' : ''}`}
                  style={{ width: '78%', marginTop: `${nameBoxConfig.marginTop}px` }}
                >
                  {activeData.name}
                </h1>
              );
            })()}
            
            <h2 className="text-sm font-serif text-neutral-600 mb-3 italic">
              {activeData.koreanName}
            </h2>
            
            {/* 개별 인적사항 표시 */}
            <div className="inline-flex flex-row justify-center items-start mb-2 px-2">
              {activeData.meta.map((m: any, idx: number) => (
                <div key={idx} className="flex flex-col items-center px-4 border-r last:border-r-0 border-[#1A2A3A]/30">
                  <span className="text-[9px] uppercase tracking-widest text-neutral-500 mb-1">{m.label}</span>
                  <span className="text-[11px] font-bold text-[#1A2A3A] leading-tight break-keep text-center max-w-[85px] whitespace-pre-line">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
            
            <p className="mt-auto text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.3em] animate-pulse pb-1 flex flex-col items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Click to flip</span>
              <span className="w-12 h-px bg-[#D4AF37]"></span>
            </p>
          </div>
          {/* Card Frame Image (Debuggable) - 최상위 레이어 */}
          <div 
            className="absolute z-50 pointer-events-none"
            style={{
              top: `${frameConfig.top}%`,
              left: `${frameConfig.left}%`,
              width: `${frameConfig.width}%`,
              height: `${frameConfig.height}%`,
              backgroundImage: `url('${frameImage}')`,
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          />
        </div>


        {/* ==================================================== */}
        {/* 2. BACK FACE (Detailed Info & Chart) */}
        {/* ==================================================== */}
        <div 
          className="absolute inset-0 w-full h-full bg-[#F9F6F0] rounded-xl shadow-2xl flex flex-col overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* Top Accent Line (Sticky) */}
          <div className="h-3 w-full bg-[#1A2A3A] sticky top-0 z-20 shrink-0"></div>
          
          <div className="p-8 flex flex-col h-full">
            
            {/* Header / Title */}
            <div className="flex justify-between items-end border-b border-[#D4AF37]/50 pb-3 mb-6">
              <h3 className="text-2xl font-serif font-bold text-[#1A2A3A]">Passenger Record</h3>
              <span className="text-xs text-[#D4AF37] font-bold tracking-widest">R.M.S. TITANIC</span>
            </div>

            {/* 뒷면 제목 (이름) */}
            <div className="flex justify-center w-full mb-4">
              {(() => {
                const len = activeData.name.length + activeData.koreanName.length;
                let nameSizeClass = "text-2xl";
                if (len > 35) nameSizeClass = "text-[10px]";
                else if (len > 30) nameSizeClass = "text-xs";
                else if (len > 25) nameSizeClass = "text-sm";
                else if (len > 20) nameSizeClass = "text-base";
                else if (len > 16) nameSizeClass = "text-xl";
                return (
                  <h1 
                    className={`${nameSizeClass} font-serif font-bold text-[#1A2A3A] tracking-wider mb-1 px-2 text-center leading-none whitespace-nowrap overflow-visible ${showNameBounds ? 'border border-red-500 bg-red-500/10' : ''}`}
                    style={{ width: '90%', marginTop: `${nameBoxConfig.marginTop}px` }}
                  >
                    {activeData.name} 
                    <span className="text-neutral-600 font-normal italic ml-2 text-[0.8em]">
                      {activeData.koreanName}
                    </span>
                  </h1>
                );
              })()}
            </div>
            
            {/* Meta Info */}
            <div className="space-y-2 text-sm w-full mb-4">
              <div className="flex items-start">
                <span className="font-bold w-20 text-[#D4AF37] shrink-0 text-left">탑승목적</span>
                <span className="flex-1 leading-tight text-[#1A2A3A] font-medium text-left">{activeData.purpose}</span>
              </div>
            </div>
            
            {/* Middle: Hexagon Spectrum (Radar Chart) */}
            <div className="px-2 py-2 mb-3 bg-white/40 rounded shadow-sm border border-[#D4AF37]/20">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={activeData.stats}>
                    <PolarGrid gridType="polygon" stroke="#1A2A3A" strokeOpacity={0.1} />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fill: '#1A2A3A', fontSize: 11, fontWeight: '700', fontFamily: 'sans-serif' }} 
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar
                      name="능력치"
                      dataKey="value"
                      stroke="#D4AF37"
                      strokeWidth={2}
                      fill="#D4AF37"
                      fillOpacity={0.4}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Story */}
            <div className="text-[#1A2A3A] mt-2 mb-4">
              <p className="text-[12.5px] leading-normal text-justify">
                {activeData.story}
              </p>
            </div>

            {/* Bottom: Quote & Tags */}
            <div className="text-[#1A2A3A] mt-auto">
              {/* Quote Block */}
              <div className="relative bg-[#1A2A3A] text-[#F9F6F0] px-5 py-3 rounded shadow-inner mb-4 border border-[#D4AF37]">
                <Quote className="absolute top-2 left-2 text-[#D4AF37] opacity-20 w-6 h-6" />
                <blockquote className="relative z-10 font-serif italic text-center text-sm leading-snug mt-1">
                  "{activeData.quote}"
                </blockquote>
              </div>
              
              {/* Tags */}
              <div className="flex flex-wrap gap-2 justify-center">
                {activeData.tags.map((tag: string, index: number) => (
                  <span 
                    key={index} 
                    className="bg-[#1A2A3A] text-[#D4AF37] px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest shadow-sm border border-[#1A2A3A]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
          </div>
        </div>
        
      </motion.div>
    </div>
  );
};

export default TitanicPassengerCard;
