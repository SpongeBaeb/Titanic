'use client';

import { useQuizStore } from '@/store/quizStore';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ResultView from '@/components/ResultView';
import { questionsData } from '@/data/questions';
import QuestionView from '@/components/question/QuestionView';
import PrologueMap from '@/components/question/PrologueMap';
import GenderView from '@/components/question/GenderView';
import AgeView from '@/components/question/AgeView';
import CompanionCamera from '@/components/question/CompanionCamera';
import StaircaseView from '@/components/question/StaircaseView';
import MoneyMinigameView from '@/components/question/MoneyMinigameView';
import { useEffect, useState, useMemo } from 'react';
import { preloadImages } from '@/lib/preloadImages';

export default function QuizContainer() {
  const { currentStep, nextStep, setAnswer, answers, showDebug, toggleDebug } = useQuizStore();
  const [mounted, setMounted] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const init = async () => {
      // Preload the most essential startup images
      const initialAssets = [
        '/bg/bg-titanic.png',
        '/bg/male.png',
        '/bg/female.png',
        '/map/map_cherbourg.png',
        '/map/map_queenstown.png',
        '/map/map_southampton.png'
      ];
      await preloadImages(initialAssets);
      setInitialLoaded(true);
      setMounted(true);
      
      const params = new URLSearchParams(window.location.search);
      if (params.get('result')) {
        nextStep('RESULT');
      }
    };
    init();
  }, []);

  const handlePrologue = (embarked: string) => {
    setAnswer('embarked', embarked);
    nextStep('Q0');
  };

  const [isFlashing, setIsFlashing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const getAssetsForStep = (step: string, currentAnswers: any): string[] => {
    const assets: string[] = [];
    const q = questionsData[step];
    
    if (q?.bgImage) {
      assets.push(typeof q.bgImage === 'function' ? q.bgImage(currentAnswers) : q.bgImage);
    }
    
    if (step === 'Q1') {
      assets.push('/telegraph/base.png', '/telegraph/rbase.png', '/telegraph/lever.png', '/telegraph/arrow.png');
      q?.options.forEach(opt => {
        if (opt.bgImage) assets.push(opt.bgImage);
      });
    } else if (step === 'Q2') {
      q?.options.forEach(opt => {
        if (opt.bgImage) assets.push(opt.bgImage);
      });
      assets.push('/camera-lens.png');
    } else if (step === 'Q3') {
      assets.push('/bg/3.png', '/bg/4.png', '/bg/5.png');
    } else if (step === 'Q4') {
      assets.push(
        '/spend/target.png', '/spend/bucket.png', '/spend/titanic_duck.png',
        '/spend/label.png', '/spend/my_bag.png', '/spend/my_bag_open.png',
        '/spend/bill.png', '/spend/duckhead.png', '/spend/duckbody.png',
        '/spend/duckbody_thumbsup.png', '/spend/icon_pool.png', '/spend/icon_massage.png',
        '/spend/icon_souvenir.png', '/spend/icon_gamble.png', '/spend/icon_bath.png',
        '/spend/icon_barber.png', '/spend/icon_telegraph.png'
      );
    } else if (step === 'RESULT') {
      assets.push('/bg/collasping.png');
    }
    return assets.filter(Boolean);
  };

  const handleAnswer = async (key: string, value: string, next: any) => {
    const tempAnswers = { ...answers, [key]: value };

    if (key === 'companion') {
      setIsFlashing(true);
      setTimeout(async () => {
        const assets = getAssetsForStep(next, tempAnswers);
        await preloadImages(assets);
        setAnswer(key as any, value);
        nextStep(next);
        setIsFlashing(false);
      }, 500);
      return;
    }

    setIsTransitioning(true);
    const assets = getAssetsForStep(next, tempAnswers);
    await preloadImages(assets);
    setAnswer(key as any, value);
    nextStep(next);
    setIsTransitioning(false);
  };

  const stepKeys: Record<string, string> = {
    'Q0': 'sex', 'Q1': 'ageGroup', 'Q2': 'companion', 'Q3': 'pclass', 'Q4': 'fareIntent', 'Q5': 'purpose', 'Q6': 'rumorAction', 'Q7': 'finalAction'
  };
  const nextSteps: Record<string, any> = {
    'Q0': 'Q1', 'Q1': 'Q2', 'Q2': 'Q3', 'Q3': 'Q4', 'Q4': 'Q5', 'Q5': 'Q6', 'Q6': 'Q7', 'Q7': 'RESULT'
  };
  const prevSteps: Record<string, any> = {
    'Q0': 'PROLOGUE', 'Q1': 'Q0', 'Q2': 'Q1', 'Q3': 'Q2', 'Q4': 'Q3', 'Q5': 'Q4', 'Q6': 'Q5', 'Q7': 'Q6'
  };

  const bgImageUrl = useMemo(() => {
    if (currentStep === 'PROLOGUE') return '/bg/bg-titanic.png';
    if (currentStep === 'RESULT') return '/bg/collasping.png';
    const q = questionsData[currentStep];
    if (q?.bgImage) {
      return typeof q.bgImage === 'function' ? q.bgImage(answers) : q.bgImage;
    }
    return '/bg/bg-titanic.png';
  }, [currentStep, answers]);

  useEffect(() => {
    // Preload next step background
    const nextStepKey = nextSteps[currentStep];
    if (nextStepKey && nextStepKey !== 'RESULT') {
      const nextQ = questionsData[nextStepKey];
      if (nextQ?.bgImage) {
        const nextUrl = typeof nextQ.bgImage === 'function' ? nextQ.bgImage(answers) : nextQ.bgImage;
        preloadImages([nextUrl]);
      }
    }
  }, [currentStep, answers, nextSteps]);

  if (!initialLoaded) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
        <div className="text-amber-500/80 font-serif tracking-widest text-sm animate-pulse">
          BOARDING TITANIC...
        </div>
      </div>
    );
  }

  if (!mounted) return null;

  const renderStep = () => {
    if (currentStep === 'PROLOGUE') {
      return (
        <PrologueMap key="prologue" onSelectPort={handlePrologue} />
      );
    }

    if (currentStep === 'RESULT') {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const sharedResultId = params?.get('result');
      return <ResultView key="result_view" sharedResultId={sharedResultId || undefined} />;
    }

    // Q0 ~ Q7
    const question = questionsData[currentStep];
    if (question) {
      const handleBack = () => {
        nextStep(prevSteps[currentStep]);
      };

      if (currentStep === 'Q0') {
        return (
          <GenderView
            key="Q0"
            question={question}
            onAnswer={(value) => handleAnswer(stepKeys[currentStep], value, nextSteps[currentStep])}
            onBack={handleBack}
          />
        );
      }

      if (currentStep === 'Q1') {
        return (
          <AgeView
            key="Q1"
            question={question}
            onAnswer={(value) => handleAnswer(stepKeys[currentStep], value, nextSteps[currentStep])}
            onBack={handleBack}
          />
        );
      }

      if (currentStep === 'Q2') {
        return (
          <CompanionCamera
            key="Q2"
            question={question}
            onAnswer={(value) => handleAnswer(stepKeys[currentStep], value, nextSteps[currentStep])}
            onBack={handleBack}
          />
        );
      }

      if (currentStep === 'Q3') {
        return (
          <StaircaseView
            key="Q3"
            question={question}
            onAnswer={(value) => handleAnswer(stepKeys[currentStep], value, nextSteps[currentStep])}
            onBack={handleBack}
          />
        );
      }

      if (currentStep === 'Q4') {
        return (
          <MoneyMinigameView 
            key={currentStep} 
            question={question} 
            onAnswer={(value) => handleAnswer(stepKeys[currentStep], value, nextSteps[currentStep])} 
            onBack={handleBack}
          />
        );
      }

      return (
        <QuestionView 
          key={currentStep} 
          question={question} 
          onAnswer={(value) => handleAnswer(stepKeys[currentStep], value, nextSteps[currentStep])} 
          onBack={handleBack}
        />
      );
    }

    return null;
  };

  return (
    <div className={`w-full relative min-h-screen ${currentStep === 'PROLOGUE' ? '' : 'overflow-hidden'}`}>
      {/* Global Camera Flash Overlay */}
      <AnimatePresence>
        {isFlashing && (
          <motion.div
            key="global-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.05 } }}
            exit={{ opacity: 0, transition: { duration: 4.0, ease: "easeIn" } }}
            className="fixed inset-0 bg-white z-[9999] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Global Loading Transition Overlay */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            key="global-loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm pointer-events-auto"
          >
            <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
            <div className="text-amber-500/80 font-serif tracking-widest text-sm animate-pulse">
              LOADING...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden SVG Filter for Water Ripple */}
      <svg className="hidden">
        <filter id="water-ripple">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="20" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      {/* Base Background Image Layer with AnimatePresence and SVG filter */}
      <div className="absolute inset-0 bg-slate-950 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={bgImageUrl}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.05 }}
            animate={shouldReduceMotion 
              ? { opacity: currentStep === 'Q6' ? 0.8 : 0.4 } 
              : { opacity: currentStep === 'Q6' ? 0.8 : 0.4, scale: 1, filter: currentStep === 'RESULT' || currentStep === 'Q7' ? 'url(#water-ripple)' : 'none' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url('${bgImageUrl}')` }}
          />
        </AnimatePresence>
      </div>
      
      {/* Gradient Overlay for dark cinematic mode */}
      <div className={`absolute inset-0 transition-all duration-1000 pointer-events-none z-[1] ${
        currentStep === 'Q6'
          ? 'bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/80'
          : currentStep === 'Q7'
            ? 'bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950/80'
            : ['PROLOGUE', 'Q0', 'Q1'].includes(currentStep)
              ? 'bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-slate-950/90'
              : 'bg-gradient-to-b from-slate-950/70 via-slate-950/30 to-slate-950/70'
      }`} />

      {/* Emergency Red Pulse Overlay (Q6 only) */}
      <AnimatePresence>
        {currentStep === 'Q6' && (
          <motion.div
            key="emergency-pulse"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.15, 0.5, 0.15] }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-emergency-red pointer-events-none z-[2]"
          />
        )}
      </AnimatePresence>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={shouldReduceMotion || currentStep === 'Q3' ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion || currentStep === 'Q2' ? { opacity: 0, transition: { duration: 0.01 } } : { opacity: 0, y: -20 }}
          transition={{ duration: currentStep === 'Q3' ? 0.01 : 0.8, ease: [0.76, 0, 0.24, 1] }}
          className="w-full min-h-screen relative z-10"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* 디버그용 바로가기 패널 */}
      {currentStep === 'PROLOGUE' && (
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
          <button 
            onClick={toggleDebug}
            className="text-[10px] bg-slate-900/30 text-slate-400 px-2 py-1 rounded hover:bg-slate-800/50 transition-colors border border-slate-700/50 backdrop-blur-sm"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
          
          <AnimatePresence>
            {showDebug && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-2 bg-slate-900/20 p-3 rounded-lg border border-slate-700/30 backdrop-blur-md"
              >
                <div className="text-xs text-slate-400/80 font-bold mb-1">[Debug] 바로가기</div>
                <div className="grid grid-cols-2 gap-2">
                  {['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'].map((q) => (
                    <button
                      key={q}
                      onClick={() => nextStep(q as any)}
                      className="bg-blue-500/20 text-white/80 px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-500/50 transition-colors backdrop-blur-sm"
                    >
                      {q}
                    </button>
                  ))}
                  <button
                    onClick={() => nextStep('RESULT')}
                    className="col-span-2 bg-red-500/20 text-white/80 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-500/50 transition-colors backdrop-blur-sm"
                  >
                    RESULT
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
