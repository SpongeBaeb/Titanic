'use client';

import { useQuizStore } from '@/store/quizStore';
import { motion, AnimatePresence } from 'framer-motion';
import ResultView from '@/components/ResultView';
import { questionsData } from '@/data/questions';
import QuestionView from '@/components/question/QuestionView';
import PrologueMap from '@/components/question/PrologueMap';
import GenderView from '@/components/question/GenderView';
import AgeView from '@/components/question/AgeView';
import CompanionCamera from '@/components/question/CompanionCamera';
import StaircaseView from '@/components/question/StaircaseView';
import { useEffect, useState } from 'react';

export default function QuizContainer() {
  const { currentStep, nextStep, setAnswer, answers } = useQuizStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get('result')) {
      nextStep('RESULT');
    }
  }, []);

  const handlePrologue = (embarked: string) => {
    setAnswer('embarked', embarked);
    nextStep('Q0');
  };

  const [isFlashing, setIsFlashing] = useState(false);

  const handleAnswer = (key: string, value: string, next: any) => {
    if (key === 'companion') {
      setIsFlashing(true);
      setTimeout(() => {
        setAnswer(key as any, value);
        nextStep(next);
        setIsFlashing(false);
      }, 50);
      return;
    }
    setAnswer(key as any, value);
    nextStep(next);
  };

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
      const stepKeys: Record<string, string> = {
        'Q0': 'sex',
        'Q1': 'ageGroup',
        'Q2': 'companion',
        'Q3': 'pclass',
        'Q4': 'fareIntent',
        'Q5': 'purpose',
        'Q6': 'rumorAction',
        'Q7': 'finalAction'
      };
      const nextSteps: Record<string, any> = {
        'Q0': 'Q1', 'Q1': 'Q2', 'Q2': 'Q3', 'Q3': 'Q4', 'Q4': 'Q5', 'Q5': 'Q6', 'Q6': 'Q7', 'Q7': 'RESULT'
      };
      const prevSteps: Record<string, any> = {
        'Q0': 'PROLOGUE', 'Q1': 'Q0', 'Q2': 'Q1', 'Q3': 'Q2', 'Q4': 'Q3', 'Q5': 'Q4', 'Q6': 'Q5', 'Q7': 'Q6'
      };

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
            exit={{ opacity: 0, transition: { duration: 3.0, ease: "easeOut" } }}
            className="fixed inset-0 bg-white z-[9999] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Base Background Color & Image Layer */}
      <div 
        className="absolute inset-0 bg-slate-950 bg-cover bg-center bg-no-repeat opacity-40 transition-all duration-1000"
        style={{ 
          backgroundImage: `url('${
            ['PROLOGUE', 'Q0', 'Q1'].includes(currentStep) 
              ? '/bg/bg-titanic.png' 
              : currentStep === 'RESULT'
                ? '/bg/collasping.png'
                : currentStep === 'Q7'
                  ? '/bg/lifeboat.png'
                  : ['Q5', 'Q6'].includes(currentStep)
                    ? '/bg/railing.png'
                    : currentStep === 'Q3'
                      ? '/bg/where.png'
                      : currentStep === 'Q4' && answers.pclass
                        ? `/bg/${answers.pclass}.png`
                      : '/bg/bg-dock.png'
          }')` 
        }}
      />
      
      {/* Gradient Overlay for dark cinematic mode */}
      <div className={`absolute inset-0 transition-all duration-1000 pointer-events-none z-[1] ${
        currentStep === 'Q6'
          ? 'bg-gradient-to-b from-slate-950 via-slate-950/80 to-slate-950'
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
          initial={{ opacity: 0, filter: 'blur(8px)', scale: 0.98 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          exit={{ opacity: 0, filter: 'blur(8px)', scale: 1.02 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="w-full min-h-screen relative z-10"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* 디버그용 바로가기 패널 */}
      {currentStep === 'PROLOGUE' && (
        <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 bg-slate-900/80 p-3 rounded-lg border border-slate-700 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-bold mb-1">[Debug] 바로가기</div>
          <div className="grid grid-cols-2 gap-2">
            {['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'].map((q) => (
              <button
                key={q}
                onClick={() => nextStep(q as any)}
                className="bg-blue-500/50 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-500/90 transition-colors"
              >
                {q}
              </button>
            ))}
            <button
              onClick={() => nextStep('RESULT')}
              className="col-span-2 bg-red-500/50 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-500/90 transition-colors"
            >
              RESULT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
