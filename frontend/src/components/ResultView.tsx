'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuizStore } from '@/store/quizStore';
import { QuizResultResponse } from '@/types';
import { soundManager } from '@/lib/sound';
import html2canvas from 'html2canvas';
import TitanicPassengerCard from '@/components/ui/TitanicPassengerCard';
import { ProbabilityNumber } from '@/components/ui/ProbabilityNumber';
import CountingProbability from '@/components/ui/CountingProbability';
import TraitHexagon from '@/components/ui/TraitHexagon';
import { traitsFromPicks, traitsFromAxes, encodeAxes } from '@/engine/traits';
import { characterDB } from '@/data/characterDB';
import { questionsData } from '@/data/questions';
import { preloadImages } from '@/lib/preloadImages';
import { resultImage } from '@/lib/assetPath';
import { API_BASE, KAKAO_JS_KEY, friendlyError } from '@/lib/api';
import { restartJourney } from '@/lib/session';

type RevealStage = 'LOADING' | 'STAGE1_STAT' | 'STAGE_TRAITS' | 'STAGE_SUMMARY' | 'STAGE2_ADJUST' | 'STAGE3_MATCH';

interface ResultViewProps {
  sharedResultId?: string;
}

export default function ResultView({ sharedResultId: sharedProp }: ResultViewProps) {
  // 결과가 만들어지면 주소에 결과 id 가 붙는다. 그 뒤 다시 그려져도 '공유 링크로 연 화면'으로 바뀌지 않게 처음 값을 고정한다.
  const [sharedResultId] = useState(sharedProp);
  const [attempt, setAttempt] = useState(0);
  const { answers, picks, extras } = useQuizStore();
  // 성향 육각형: 이 판에서 고른 선택으로 계산한다 (공유 링크로 열면 선택 기록이 없어 건너뛴다)
  const traits = useMemo(
    () =>
      traitsFromPicks(picks) ??
      (sharedProp && typeof window !== 'undefined' ? traitsFromAxes(new URLSearchParams(window.location.search).get('t')) : null),
    [picks, sharedProp],
  );
  const traitCode = traits ? encodeAxes(traits.axes) : null;
  const [stage, setStage] = useState<RevealStage>('LOADING');
  const [resultData, setResultData] = useState<QuizResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<'best' | 'worst' | 'opposite'>('best');
  const cardRef = useRef<HTMLDivElement>(null);
  const traitRef = useRef<HTMLDivElement>(null);

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
      (window as any).Kakao.init(KAKAO_JS_KEY);
    }
  }, []);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        let res;
        if (sharedResultId) {
          // Fetch existing result
          res = await fetch(`${API_BASE}/api/quiz/result/${sharedResultId}`);
        } else {
          res = await fetch(`${API_BASE}/api/quiz/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(extras.lifebuoy ? { ...answers, lifebuoy: true } : answers),
          });
        }
        
        if (!res.ok) {
          throw new Error(res.status === 404
            ? '이 결과를 찾을 수 없습니다. 링크가 잘못되었거나 만료되었을 수 있습니다.'
            : '서버가 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }

        const data: QuizResultResponse = await res.json();
        setResultData(data);
        setError(null);

        // 새로고침해도 같은 결과를 다시 보도록 주소에 결과 id 를 남긴다 (새로 계산하지 않는다)
        if (data?.id && !sharedResultId) {
          try {
            window.history.replaceState(window.history.state, '', `${window.location.pathname}?result=${data.id}${traits ? `&t=${encodeAxes(traits.axes)}` : ''}`);
          } catch { /* 무시 */ }
        }

        if (data) {
          const assetsToPreload = [];
          if (data.historical_match) {
            assetsToPreload.push(`/bg/${data.historical_match.survived ? 'survived' : 'perished'}.webp`);
            assetsToPreload.push(resultImage(data.historical_match.name));
          }
          if (data.worst_match) {
            assetsToPreload.push(`/bg/${data.worst_match.survived ? 'survived' : 'perished'}.webp`);
            assetsToPreload.push(resultImage(data.worst_match.name));
          }
          if (data.opposite_match) {
            assetsToPreload.push(`/bg/${data.opposite_match.survived ? 'survived' : 'perished'}.webp`);
            assetsToPreload.push(resultImage(data.opposite_match.name));
          }
          preloadImages(assetsToPreload);
        }
        
        // 1초 뒤 Stage 1 표시
        setTimeout(() => {
          // 이 결과의 중심은 사용자의 성향이다: 성향 육각형부터 보여 주고, 확률과 닮은 승객은 그 뒤의 참고 정보
          setStage(traits ? 'STAGE_TRAITS' : 'STAGE1_STAT');
          soundManager.playHeartbeat();
        }, 1500);

      } catch (err: any) {
        setError(friendlyError(err) || '결과를 불러오는 중 문제가 발생했습니다.');
        setStage('STAGE1_STAT'); // 에러시에도 진행을 위해 fallback
      }
    };

    fetchResult();
  }, [answers, attempt]);

  // 같은 답으로 결과를 다시 요청한다 (새로고침하지 않으므로 고른 답이 사라지지 않는다)
  const retry = () => {
    setError(null);
    setResultData(null);
    setStage('LOADING');
    setAttempt((a) => a + 1);
  };

  // Stage 전환 타이머
  useEffect(() => {
    if (stage === 'STAGE1_STAT') {
      const timer = setTimeout(() => {
        setStage('STAGE2_ADJUST');
        soundManager.playThud();
      }, sharedResultId ? 2000 : 4000); 
      return () => clearTimeout(timer);
    }

    if (stage === 'STAGE_TRAITS') {
      const timer = setTimeout(() => {
        setStage('STAGE_SUMMARY');
        soundManager.playThud();
      }, 10500);
      return () => clearTimeout(timer);
    }
    
    if (stage === 'STAGE2_ADJUST') {
      const timer = setTimeout(async () => {
        if (resultData?.historical_match) {
          await preloadImages([
            `/bg/${resultData.historical_match.survived ? 'survived' : 'perished'}.webp`,
            resultImage(resultData.historical_match.name)
          ]);
        }
        setStage('STAGE3_MATCH');
        soundManager.playThud();
      }, sharedResultId ? 3400 : 6200);
      return () => clearTimeout(timer);
    }
  }, [stage, sharedResultId, traits]);

  const handleCopyLink = () => {
    if (!resultData?.id) return;
    const url = `${window.location.origin}/?result=${resultData.id}${traitCode ? `&t=${traitCode}` : ''}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('결과 링크가 복사되었습니다!');
    });
  };

  const handleSaveImage = async () => {
    const target = stage === 'STAGE_SUMMARY' ? traitRef.current : cardRef.current;
    if (!target) return;
    try {
      const canvas = await html2canvas(target, { backgroundColor: '#020617' });
      const link = document.createElement('a');
      link.download = `titanic_result_${traits ? traits.type.en.replace(/\s+/g, '_') : resultData?.persona}.png`;
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
    const url = `${window.location.origin}/?result=${resultData.id}${traitCode ? `&t=${traitCode}` : ''}`;
    
    (window as any).Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '타이타닉 생존 시뮬레이터',
        description: traits ? `1912년 그날 밤, 나는 '${traits.type.ko}' 유형이었습니다. 당신은 어떤 사람일까요?` : `나와 가장 비슷한 1912년의 승객은 ${resultData.historical_match.name}입니다!`,
        imageUrl: `${window.location.origin}${resultImage(resultData.historical_match.name)}`,
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
        <div role="alert" className="max-w-md text-center">
          <p className="text-lg tracking-wide text-amber-100/90">결과를 불러오지 못했습니다</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400 break-keep">{error}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button onClick={retry} className="px-6 py-2 bg-amber-500/20 border border-amber-500/50 text-amber-100 rounded hover:bg-amber-500/40 transition-colors tracking-widest text-sm">
              다시 시도
            </button>
            <button onClick={restartJourney} className="px-6 py-2 bg-transparent border border-slate-600 text-slate-400 rounded hover:bg-slate-800 transition-colors tracking-widest text-sm">
              처음부터 다시
            </button>
          </div>
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
            <div>
              <ProbabilityNumber value={resultData.statistical_probability} size="xl" tone="ivory" />
            </div>
          </motion.div>
        )}

        {stage === 'STAGE_TRAITS' && traits && (
          <motion.div
            key="stageTraits"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            transition={{ duration: 1 }}
            className="w-full max-w-xl text-center"
          >
            <p className="text-sm tracking-[0.3em] text-slate-400 uppercase">그날 밤, 당신은 이런 사람이었습니다</p>
            <div className="mt-2">
              <TraitHexagon values={traits.axes} top={traits.top} duration={2.6} delay={0.7} />
            </div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.8, duration: 1.1 }}>
              <p className="font-sans text-xs uppercase tracking-[0.35em] text-amber-200/70">{traits.type.en}</p>
              <h3 className="mt-2 font-title text-3xl md:text-4xl text-amber-100 drop-shadow-[0_0_15px_rgba(251,191,36,0.35)]">{traits.type.ko}</h3>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 5.0, duration: 1 }}
              className="mx-auto mt-4 max-w-md break-keep font-serif text-base leading-8 text-slate-200"
            >
              {traits.type.desc}
            </motion.p>
          </motion.div>
        )}

        {stage === 'STAGE_SUMMARY' && traits && (
          <motion.div
            key="stageSummary"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="w-full max-w-xl text-center"
          >
            {/* 성향 카드: 이미지로 저장·공유되는 중심 결과 */}
            <div ref={traitRef} className="rounded-2xl border border-amber-200/20 bg-slate-950/85 px-6 pb-8 pt-7 shadow-2xl backdrop-blur">
              <p className="text-xs tracking-[0.3em] text-slate-400 uppercase">1912년 4월 14일 밤, 당신은</p>
              <p className="mt-3 font-sans text-xs uppercase tracking-[0.35em] text-amber-200/70">{traits.type.en}</p>
              <h2 className="mt-1 font-title text-4xl text-amber-100 drop-shadow-[0_0_15px_rgba(251,191,36,0.35)]">{traits.type.ko}</h2>
              <TraitHexagon values={traits.axes} top={traits.top} duration={1.4} delay={0.3} />
              <p className="mx-auto max-w-md break-keep font-serif text-base leading-8 text-slate-200">{traits.type.desc}</p>

              {/* 생존 확률은 참고 정보: 한 줄로 보여 주고, 숫자는 점진적으로 오르내린다 */}
              <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-5 border-t border-slate-700/60 pt-5">
                <div className="text-left">
                  <p className="text-[11px] tracking-widest text-slate-500 uppercase">타고난 생존 확률</p>
                  <p className="mt-1 font-numeric text-xl text-slate-300">{resultData.statistical_probability}%</p>
                </div>
                <span className="text-slate-600" aria-hidden>→</span>
                <div className="text-left">
                  <p className="text-[11px] tracking-widest text-slate-500 uppercase">그날 밤의 선택 이후</p>
                  <div className="mt-1">
                    <CountingProbability from={resultData.statistical_probability} to={resultData.adjusted_probability} size="lg" duration={2} delay={1.2} />
                  </div>
                </div>
              </div>
            </div>

            {/* 나의 항해 기록 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="mt-6 mx-auto w-full max-w-md rounded-xl border border-slate-700/50 bg-slate-900/50 p-6 text-left backdrop-blur-sm"
            >
              <h3 className="mb-4 border-b border-slate-700/50 pb-2 text-center text-sm font-bold uppercase tracking-widest text-slate-300">나의 항해 기록</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                {summaryItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="mb-1 text-xs text-slate-500">{item.label}</span>
                    <span className="text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* 공유 */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }} className="mt-8 flex flex-col justify-center gap-4 md:flex-row">
              <button onClick={handleCopyLink} className="flex items-center justify-center gap-2 rounded bg-slate-800 px-6 py-3 text-sm font-bold tracking-widest text-amber-400 transition-colors hover:bg-slate-700">링크 복사</button>
              <button onClick={handleSaveImage} className="flex items-center justify-center gap-2 rounded border border-amber-500/50 bg-amber-500/20 px-6 py-3 text-sm font-bold tracking-widest text-amber-100 transition-colors hover:bg-amber-500/40">이미지 저장</button>
              <button onClick={handleKakaoShare} className="flex items-center justify-center gap-2 rounded bg-[#FEE500] px-6 py-3 text-sm font-bold tracking-widest text-[#000000] transition-colors hover:bg-[#FEE500]/90">카카오톡 공유</button>
            </motion.div>

            {/* 닮은 승객은 참고 정보: 원하면 열어 본다 */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 1 }} className="mt-8">
              <button
                onClick={() => {
                  setStage('STAGE3_MATCH');
                  soundManager.playThud();
                }}
                className="text-sm font-medium text-amber-500/80 underline decoration-amber-500/30 underline-offset-4 transition-colors hover:text-amber-400"
              >
                참고: 당신과 닮은 궤적을 그린 1912년의 승객 보기
              </button>
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 1 }}
              onClick={restartJourney}
              className="mt-8 rounded border border-slate-600 bg-transparent px-8 py-3 text-sm tracking-widest text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            >
              새로운 여정 시작하기
            </motion.button>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5, duration: 1 }} className="mx-auto mt-12 max-w-md text-xs leading-relaxed text-muted-ivory/70">
              <p>재미로 보는 성향 테스트입니다. 점수는 그날 밤의 선택으로 계산한 것이며 실제 성격을 진단하지 않습니다.</p>
              <p className="mt-1">이 웹사이트의 일부 콘텐츠는 AI 기술을 사용하여 생성되었으며, 이는 ChatGPT와 Gemini의 이용약관을 준수하여 사용되었습니다.</p>
              <p className="mt-1">본 콘텐츠에는 역사적 사실을 바탕으로 한 각색 및 창작 내용이 포함되어 있습니다.</p>
            </motion.div>
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
              {/* 확률 변경 연출: 앞의 값에서 새 값으로 숫자가 점진적으로 커지거나 작아진다 */}
              <motion.div
                initial={{ opacity: 0, scale: 1.12 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: sharedResultId ? 0.2 : 0.5, duration: 0.9 }}
              >
                <CountingProbability
                  from={resultData.statistical_probability}
                  to={resultData.adjusted_probability}
                  duration={sharedResultId ? 1.3 : 2.4}
                  delay={sharedResultId ? 0.5 : 1.2}
                />
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
                  <div className="absolute -inset-[100px] bg-slate-950" />
                  {/* 생존/사망 배경 이미지 */}
                  <div 
                    className="absolute -inset-[100px] bg-cover bg-center opacity-70"
                    style={{ backgroundImage: `url(/bg/${currentMatchObj.survived ? 'survived' : 'perished'}.webp)` }}
                  />
                  {/* 결과 카드를 돋보이게 하는 하단 그라데이션 */}
                  <div className="absolute -inset-[100px] bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                </motion.div>
              );
            })()}

            {traits && (
              <button onClick={() => setStage('STAGE_SUMMARY')} className="absolute left-6 top-6 z-10 text-sm tracking-widest text-white/70 transition-colors hover:text-white">
                ← 성향 결과로
              </button>
            )}

            {/* 최종 생존 확률 */}
            <div className="flex flex-col items-center mt-12">
              <span className="text-xs tracking-widest text-slate-400/80 uppercase mb-1">나의 최종 생존 확률</span>
              <ProbabilityNumber
                value={resultData.adjusted_probability}
                size="lg"
                tone={resultData.adjusted_probability > resultData.statistical_probability ? 'survive' : 'danger'}
              />
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
                        imageUrl: currentMatchObj.sex === 'male' ? '/male.webp' : '/female.webp',
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
                링크 복사
              </button>
              <button 
                onClick={handleSaveImage}
                className="px-6 py-3 bg-amber-500/20 border border-amber-500/50 text-amber-100 rounded hover:bg-amber-500/40 transition-colors font-bold tracking-widest text-sm flex items-center justify-center gap-2"
              >
                이미지 저장
              </button>
              <button 
                onClick={handleKakaoShare}
                className="px-6 py-3 bg-[#FEE500] text-[#000000] rounded hover:bg-[#FEE500]/90 transition-colors font-bold tracking-widest text-sm flex items-center justify-center gap-2"
              >
                카카오톡 공유
              </button>
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 1 }}
              onClick={restartJourney}
              className="mt-8 px-8 py-3 bg-transparent border border-slate-600 text-slate-400 rounded hover:bg-slate-800 hover:text-slate-200 transition-colors tracking-widest text-sm"
            >
              새로운 여정 시작하기
            </motion.button>

            {/* AI 및 창작물 명시 (Disclaimer) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5, duration: 1 }}
              className="mt-12 text-xs text-muted-ivory/70 leading-relaxed max-w-md mx-auto"
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
