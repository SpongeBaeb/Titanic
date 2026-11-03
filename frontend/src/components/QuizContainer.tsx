'use client';

import { useQuizStore } from '@/store/quizStore';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ResultView from '@/components/ResultView';
import { questionsData } from '@/data/questions';
import PrologueMap from '@/components/question/PrologueMap';
import { scenes, sceneIds, PROLOGUE, RESULT } from '@/engine/scenes';
import { renderers } from '@/engine/renderers';
import NightScene from '@/components/cinematic/NightScene';
import type { CineOption } from '@/engine/cinematic';
import { loadRuns, completeRun } from '@/engine/memory';
import { emitPick } from '@/engine/events';
import { assetsFor, bgFor, nextSceneId } from '@/engine/resolve';
import { useEffect, useState, useMemo, useRef } from 'react';
import { preloadImages } from '@/lib/preloadImages';

// 바로가기 패널은 개발 서버에서만 노출 (빌드 시 값이 고정되어 운영 화면에는 나타나지 않는다)
const IS_DEV = process.env.NODE_ENV === 'development';

export default function QuizContainer() {
  const { currentStep, nextStep, advance, back, answers, flags, picks, extras, runIndex, setRun, setExtras, showDebug, toggleDebug } = useQuizStore();
  const scene = scenes[currentStep];
  const [mounted, setMounted] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const enteredAt = useRef(0);
  useEffect(() => { enteredAt.current = Date.now(); }, [currentStep]);

  useEffect(() => {
    const init = async () => {
      setRun(loadRuns() + 1);
      // Preload the most essential startup images
      const initialAssets = [
        '/bg/bg-titanic.webp',
        '/male.webp',
        '/female.webp'
      ];
      await preloadImages(initialAssets);
      setInitialLoaded(true);
      setMounted(true);
      
      const params = new URLSearchParams(window.location.search);
      // 밤 장면(N1~N3) 체험 모드: 주소에 ?night=1 이 있을 때만 Q6 뒤에 끼어든다
      if (params.get('night')) setExtras({ night: true, noTimer: params.get('notimer') ? true : undefined });
      if (params.get('result')) {
        nextStep(RESULT);
      }
    };
    init();
  }, []);

  const handlePrologue = (embarked: string) => {
    advance({ next: 'Q0', key: 'embarked', value: embarked });
  };

  const [isFlashing, setIsFlashing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 밤 장면(N1~N3)에서 선택지를 고른 뒤: 점수용 답 없이 플래그·소모 시간만 누적하고 다음 장면으로
  const handleNightChoose = (option: CineOption, ms: number) => {
    if (!scene) return;
    const spent = typeof extras.spent === 'number' ? extras.spent : 0;
    const spentNext = spent + (option.timeCost ?? 0);
    const nextFlags = { ...flags, ...(option.sets ?? {}) };
    const next = nextSceneId(scene, { answers, flags: nextFlags, picks, run: runIndex, extras: { ...extras, spent: spentNext } });
    emitPick({ run: runIndex, scene: scene.id, value: option.id, ms });
    advance({ next, sets: option.sets, extras: { spent: spentNext }, pick: option.id });
  };

  const handleAnswer = async (value: string, extra?: Record<string, unknown>) => {
    if (!scene || !scene.answerKey) return;
    const key = scene.answerKey;
    const next = nextSceneId(scene, { answers: { ...answers, [key]: value }, flags, picks, run: runIndex, extras });
    const tempAnswers = { ...answers, [key]: value };
    const ms = Date.now() - enteredAt.current;
    const commit = () => {
      emitPick({ run: runIndex, scene: scene.id, value, ms });
      advance({ next, key, value, extras: extra });
      if (next === RESULT) setRun(completeRun() + 1);
    };

    if (scene.flashOnAnswer) {
      setIsFlashing(true);
      setTimeout(async () => {
        await preloadImages(assetsFor(next, tempAnswers));
        commit();
        setIsFlashing(false);
      }, 500);
      return;
    }

    setIsTransitioning(true);
    await preloadImages(assetsFor(next, tempAnswers));
    commit();
    setIsTransitioning(false);
  };

  const bgImageUrl = useMemo(() => {
    if (currentStep === PROLOGUE) return '/bg/bg-titanic.webp';
    if (currentStep === RESULT) return '/bg/collasping.webp';
    return bgFor(currentStep, answers) ?? '/bg/bg-titanic.webp';
  }, [currentStep, answers]);

  useEffect(() => {
    // 다음 장면 배경 미리 받기
    if (!scene) return;
    const nextId = nextSceneId(scene, { answers, flags, picks, run: runIndex, extras });
    if (nextId === RESULT) return;
    const nextBg = bgFor(nextId, answers);
    if (nextBg) preloadImages([nextBg]);
  }, [currentStep, answers, flags, picks, runIndex, extras, scene]);

  const bgOpacity = scene?.bgOpacity ?? 0.4;
  const gradientClass =
    currentStep === PROLOGUE || scene?.gradient === 'intro'
      ? 'bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-slate-950/90'
      : scene?.gradient === 'rumor'
        ? 'bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/80'
        : scene?.gradient === 'lifeboat'
          ? 'bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950/80'
          : 'bg-gradient-to-b from-slate-950/70 via-slate-950/30 to-slate-950/70';

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
    if (currentStep === PROLOGUE) {
      return (
        <PrologueMap key="prologue" onSelectPort={handlePrologue} />
      );
    }

    if (currentStep === RESULT) {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const sharedResultId = params?.get('result');
      return <ResultView key="result_view" sharedResultId={sharedResultId || undefined} />;
    }

    // 밤 장면 (N1 ~ N3): 장면 패널
    if (scene?.renderer === 'night' && scene.cine) {
      return (
        <NightScene
          key={currentStep}
          cineId={scene.cine}
          ctx={{ answers, flags, picks, run: runIndex, extras }}
          timerEnabled={!extras.noTimer}
          onChoose={handleNightChoose}
        />
      );
    }

    // 엔진 장면 (Q0 ~ Q7)
    const baseQuestion = questionsData[currentStep];
    if (scene && baseQuestion && scene.renderer !== 'night') {
      // 앞 선택에 따라 문구가 바뀌는 장면(예: 구명정에 탄 경우의 Q7)
      const v = scene.variant?.({ answers, flags, picks, run: runIndex, extras });
      const question = v
        ? { ...baseQuestion, title: v.title ?? baseQuestion.title, subtitle: v.subtitle ?? baseQuestion.subtitle,
            options: v.omit ? baseQuestion.options.filter((o) => !v.omit!.includes(o.value)) : baseQuestion.options }
        : baseQuestion;
      const Renderer = renderers[scene.renderer];
      return (
        <Renderer
          key={currentStep}
          question={question}
          onAnswer={handleAnswer}
          onBack={() => back(scene.prev)}
        />
      );
    }

    return null;
  };

  return (
    <div className={`w-full relative min-h-screen ${currentStep === PROLOGUE ? '' : 'overflow-hidden'}`}>
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
              ? { opacity: bgOpacity } 
              : { opacity: bgOpacity, scale: 1, filter: currentStep === RESULT || scene?.ripple ? 'url(#water-ripple)' : 'none' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url('${bgImageUrl}')` }}
          />
        </AnimatePresence>
      </div>
      
      {/* Gradient Overlay for dark cinematic mode */}
      <div className={`absolute inset-0 transition-all duration-1000 pointer-events-none z-[1] ${
gradientClass
      }`} />

      {/* Emergency Red Pulse Overlay (Q6 only) */}
      <AnimatePresence>
        {scene?.redPulse && (
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
          initial={shouldReduceMotion || scene?.fastEnter ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion || scene?.fastExit ? { opacity: 0, transition: { duration: 0.01 } } : { opacity: 0, y: -20 }}
          transition={{ duration: scene?.fastEnter ? 0.01 : 0.8, ease: [0.76, 0, 0.24, 1] }}
          className="w-full min-h-screen relative z-10"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* 디버그용 바로가기 패널 */}
      {IS_DEV && currentStep === PROLOGUE && (
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
                  {sceneIds.map((q) => (
                    <button
                      key={q}
                      onClick={() => nextStep(q)}
                      className="bg-blue-500/20 text-white/80 px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-500/50 transition-colors backdrop-blur-sm"
                    >
                      {q}
                    </button>
                  ))}
                  <button
                    onClick={() => nextStep(RESULT)}
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
