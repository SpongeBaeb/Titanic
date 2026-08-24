'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuizStore } from '@/store/quizStore';
import { QuizResultResponse } from '@/types';
import { soundManager } from '@/lib/sound';
import html2canvas from 'html2canvas';
import TitanicPassengerCard from '@/components/ui/TitanicPassengerCard';
import { characterDB } from '@/data/characterDB';
import { questionsData } from '@/data/questions';

type RevealStage = 'LOADING' | 'STAGE1_STAT' | 'STAGE2_ADJUST' | 'STAGE3_MATCH';

interface ResultViewProps {
  sharedResultId?: string;
}

export default function ResultView({ sharedResultId }: ResultViewProps) {
  const { answers } = useQuizStore();
  const [stage, setStage] = useState<RevealStage>('LOADING');
  const [resultData, setResultData] = useState<QuizResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<'best' | 'worst' | 'opposite'>('best');
  const cardRef = useRef<HTMLDivElement>(null);

  const getOptionLabel = (questionId: string, value: any) => {
    if (value === undefined || value === null) return null;
    const q = questionsData[questionId];
    if (!q) return value;
    const opt = q.options.find(o => o.value === String(value) || o.id === String(value));
    return opt ? opt.label : value;
  };

  const summaryItems = [
    { label: '성별', value: getOptionLabel('Q0', answers.sex) },
    { label: '연령대', value: getOptionLabel('Q1', answers.ageGroup) },
    { label: '동행', value: getOptionLabel('Q2', answers.companion) },
    { label: '객실', value: getOptionLabel('Q3', answers.pclass) },
    { label: '목적', value: getOptionLabel('Q5', answers.purpose) },
    { label: '소문', value: getOptionLabel('Q6', answers.rumorAction) },
    { label: '최후', value: getOptionLabel('Q7', answers.finalAction) },
  ].filter(item => item.value);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Kakao && !(window as any).Kakao.isInitialized()) {
      (window as any).Kakao.init('0775b15ad473e250a057e5340c038cf6');
    }
  }, []);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        let res;
        if (sharedResultId) {
          res = await fetch(`http://127.0.0.1:5000/api/quiz/result/${sharedResultId}`);
        } else {
          res = await fetch('http://127.0.0.1:5000/api/quiz/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(answers),
          });
        }
        
        if (!res.ok) throw new Error('서버 통신 오류');
        
        const data: QuizResultResponse = await res.json();
        setResultData(data);
        
        // 1초 뒤 Stage 1 표시
        setTimeout(() => {
          setStage('STAGE1_STAT');
          soundManager.playHeartbeat();
        }, 1500);

      } catch (err: any) {
        setError(err.message || '결과를 불러오는 중 문제가 발생했습니다.');
        setStage('STAGE1_STAT'); // 에러시에도 진행을 위해 fallback
      }
    };

    fetchResult();
  }, [answers]);

  // Stage 전환 타이머
  useEffect(() => {
    if (stage === 'STAGE1_STAT') {
      const timer = setTimeout(() => {
        setStage('STAGE2_ADJUST');
        soundManager.playThud();
      }, sharedResultId ? 2000 : 4000); 
      return () => clearTimeout(timer);
    }
    
    if (stage === 'STAGE2_ADJUST') {
      const timer = setTimeout(() => {
        setStage('STAGE3_MATCH');
        soundManager.playThud();
      }, sharedResultId ? 2500 : 5000);
      return () => clearTimeout(timer);
    }
  }, [stage, sharedResultId]);

  const handleCopyLink = () => {
    if (!resultData?.id) return;
    const url = `${window.location.origin}/?result=${resultData.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('결과 링크가 복사되었습니다!');
    });
  };

  const handleSaveImage = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#020617' });
      const link = document.createElement('a');
      link.download = `titanic_result_${resultData?.persona}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) {
      console.error('이미지 저장 실패:', err);
      alert('이미지 저장에 실패했습니다.');
    }
  };

  const handleKakaoShare = () => {
    if (!resultData?.id || typeof window === 'undefined' || !(window as any).Kakao) {
      alert('카카오톡 공유를 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    const url = `${window.location.origin}/?result=${resultData.id}`;
    
    (window as any).Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '타이타닉 생존 시뮬레이터',
        description: `나와 가장 비슷한 1912년의 승객은 ${resultData.historical_match.name}입니다!`,
        imageUrl: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=800&q=80',
        link: {
          mobileWebUrl: url,
          webUrl: url,
        },
      },
      buttons: [
        {
          title: '운명 확인하기',
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
      ],
    });
  };

  const renderContent = () => {
    if (stage === 'LOADING') {
      return (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center justify-center space-y-4"
        >
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-lg tracking-widest animate-pulse">당신의 운명을 계산 중입니다...</p>
        </motion.div>
      );
    }

    if (!resultData) {
      return (
        <div className="text-red-400 text-center">
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-slate-800 rounded">다시 시도</button>
        </div>
      );
    }

    return (
      <AnimatePresence mode="wait">
        {stage === 'STAGE1_STAT' && (
          <motion.div
            key="stage1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            transition={{ duration: 1 }}
            className="text-center space-y-6"
          >
            <h2 className="text-2xl md:text-3xl font-light text-slate-300">1912년 4월 14일,</h2>
            <p className="text-xl text-slate-400">통계적으로 당신이 살아남을 확률은...</p>
            <div className="text-7xl md:text-9xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-slate-100 to-slate-500 drop-shadow-2xl">
              {resultData.statistical_probability}%
            </div>
          </motion.div>
        )}

        {stage === 'STAGE2_ADJUST' && (
          <motion.div
            key="stage2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            transition={{ duration: 1 }}
            className="text-center space-y-8"
          >
            <p className="text-xl md:text-2xl text-slate-300 font-light">하지만 그날 밤, 당신의 선택이 운명을 바꿨습니다.</p>
            
            <div className="relative">
              {/* 확률 변경 연출 (간단한 수치 변화) */}
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: [0, 1, 1], scale: [1.5, 1, 1] }} 
                transition={{ duration: 1.5 }}
                className={`text-6xl md:text-8xl font-bold ${resultData.adjusted_probability > resultData.statistical_probability ? 'text-blue-400' : 'text-red-400'}`}
              >
                {resultData.adjusted_probability}%
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="mt-6"
              >
                <span className="text-sm tracking-widest text-slate-500 uppercase">당신의 숨겨진 본성</span>
                <h3 className="text-3xl md:text-4xl font-serif mt-2 tracking-wider text-amber-100/90 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                  {resultData.persona}
                </h3>
              </motion.div>
            </div>
          </motion.div>
        )}

        {stage === 'STAGE3_MATCH' && (
          <motion.div
            key="stage3"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="w-full max-w-2xl text-center space-y-6"
          >
            {/* Dynamic Background based on survival */}
            {(() => {
              const currentMatchObj = 
                activeMatch === 'worst' && resultData.worst_match ? resultData.worst_match :
                activeMatch === 'opposite' && resultData.opposite_match ? resultData.opposite_match :
                resultData.historical_match;
              
              if (!currentMatchObj) return null;

              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 2 }}
                  className="fixed inset-0 -z-10"
                >
                  {/* 기존 배경을 완전히 가리는 검은색 바탕 */}
                  <div className="absolute inset-0 bg-slate-950" />
                  {/* 생존/사망 배경 이미지 */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-70"
                    style={{ backgroundImage: `url(/bg/${currentMatchObj.survived ? 'survived' : 'perished'}.png)` }}
                  />
                  {/* 결과 카드를 돋보이게 하는 하단 그라데이션 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                </motion.div>
              );
            })()}

            {/* 최종 생존 확률 */}
            <div className="flex flex-col items-center mt-12">
              <span className="text-xs tracking-widest text-slate-400/80 uppercase mb-1">나의 최종 생존 확률</span>
              <span className={`text-4xl md:text-5xl font-bold drop-shadow-lg ${resultData.adjusted_probability > resultData.statistical_probability ? 'text-blue-400' : 'text-red-400'}`}>
                {resultData.adjusted_probability}%
              </span>
            </div>

            <h2 className="text-xl text-slate-300 font-light">
              {activeMatch === 'best' && "당신과 가장 비슷한 궤적을 그린 승객"}
              {activeMatch === 'worst' && "당신과 가장 정반대의 궤적을 그린 승객"}
              {activeMatch === 'opposite' && "만약 당신이 다른 성별이었다면"}
            </h2>
            
            {/* 3D 플립 카드 UI (cardRef를 지정하여 이미지 저장 기능 유지) */}
            {(() => {
              const currentMatchObj = 
                activeMatch === 'worst' && resultData.worst_match ? resultData.worst_match :
                activeMatch === 'opposite' && resultData.opposite_match ? resultData.opposite_match :
                resultData.historical_match;

              return (
                <div ref={cardRef} className="mt-8 flex justify-center w-full">
                  {currentMatchObj && currentMatchObj.name && characterDB[currentMatchObj.name] ? (
                    <TitanicPassengerCard 
                      passengerData={{
                        ...characterDB[currentMatchObj.name],
                        imageUrl: currentMatchObj.sex === 'male' ? '/male.png' : '/female.png',
                        matchRate: currentMatchObj.match_percentage,
                        survived: currentMatchObj.survived
                      }} 
                    />
                  ) : (
                    <div className="text-slate-400">캐릭터 정보를 불러올 수 없습니다.</div>
                  )}
                </div>
              );
            })()}

            {/* Alternative Match Links */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="flex flex-col items-center gap-3 mt-8 text-sm font-medium"
            >
              {activeMatch !== 'worst' && resultData.worst_match && (
                <button onClick={() => setActiveMatch('worst')} className="text-amber-500/80 hover:text-amber-400 underline underline-offset-4 decoration-amber-500/30 transition-colors">
                  나와 가장 유사도가 낮은 인물 확인하기
                </button>
              )}
              {activeMatch !== 'opposite' && resultData.opposite_match && (
                <button onClick={() => setActiveMatch('opposite')} className="text-amber-500/80 hover:text-amber-400 underline underline-offset-4 decoration-amber-500/30 transition-colors">
                  만약 내가 다른 성별이었다면?
                </button>
              )}
              {activeMatch !== 'best' && (
                <button onClick={() => setActiveMatch('best')} className="text-blue-400/80 hover:text-blue-300 underline underline-offset-4 decoration-blue-400/30 transition-colors">
                  나의 원래 매칭 결과로 돌아가기
                </button>
              )}
            </motion.div>

            {/* User Choice Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="mt-10 p-6 bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm text-left mx-auto w-full max-w-md"
            >
              <h3 className="text-slate-300 text-sm tracking-widest font-bold mb-4 uppercase border-b border-slate-700/50 pb-2 text-center">나의 항해 기록</h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm">
                {summaryItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="text-slate-500 text-xs mb-1">{item.label}</span>
                    <span className="text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Share / Action Buttons */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 1 }}
              className="flex flex-col md:flex-row gap-4 justify-center mt-8"
            >
              <button 
                onClick={handleCopyLink}
                className="px-6 py-3 bg-slate-800 text-amber-400 rounded hover:bg-slate-700 transition-colors font-bold tracking-widest text-sm flex items-center justify-center gap-2"
              >
                <span>🔗</span> 링크 복사
              </button>
              <button 
                onClick={handleSaveImage}
                className="px-6 py-3 bg-amber-500/20 border border-amber-500/50 text-amber-100 rounded hover:bg-amber-500/40 transition-colors font-bold tracking-widest text-sm flex items-center justify-center gap-2"
              >
                <span>📸</span> 이미지 저장
              </button>
              <button 
                onClick={handleKakaoShare}
                className="px-6 py-3 bg-[#FEE500] text-[#000000] rounded hover:bg-[#FEE500]/90 transition-colors font-bold tracking-widest text-sm flex items-center justify-center gap-2"
              >
                <span>💬</span> 카카오톡 공유
              </button>
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 1 }}
              onClick={() => window.location.reload()}
              className="mt-8 px-8 py-3 bg-transparent border border-slate-600 text-slate-400 rounded hover:bg-slate-800 hover:text-slate-200 transition-colors tracking-widest text-sm"
            >
              새로운 여정 시작하기
            </motion.button>

            {/* AI 및 창작물 명시 (Disclaimer) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5, duration: 1 }}
              className="mt-12 text-[10px] md:text-xs text-slate-500/60 leading-relaxed max-w-md mx-auto"
            >
              <p>이 웹사이트의 일부 콘텐츠는 AI 기술을 사용하여 생성되었으며, 이는 ChatGPT와 Gemini의 이용약관을 준수하여 사용되었습니다.</p>
              <p className="mt-1">본 콘텐츠에는 역사적 사실을 바탕으로 한 각색 및 창작 내용이 포함되어 있습니다.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      {renderContent()}
    </div>
  );
}
