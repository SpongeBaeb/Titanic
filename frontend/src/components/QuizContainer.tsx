'use client';

import { useQuizStore } from '@/store/quizStore';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ResultView from '@/components/ResultView';
import DogResultView from '@/components/DogResultView';
import { questionsData } from '@/data/questions';
import PrologueMap from '@/components/question/PrologueMap';
import { scenes, sceneIds, PROLOGUE, RESULT } from '@/engine/scenes';
import { renderers } from '@/engine/renderers';
import NightScene from '@/components/cinematic/NightScene';
import SpecialCard from '@/components/cinematic/SpecialCard';
import type { CineOption } from '@/engine/cinematic';
import { loadRuns, completeRun } from '@/engine/memory';
import { onRunCompleted, onRunStarted, unlock } from '@/engine/achievements';
import { AchievementToast, AchievementsButton } from '@/components/ui/Achievements';
import { emitPick } from '@/engine/events';
import { assetsFor, bgFor, nextSceneId } from '@/engine/resolve';
import { useEffect, useState, useMemo, useRef } from 'react';
import { preloadImages } from '@/lib/preloadImages';
import { loadSession, saveSession, clearSession } from '@/lib/session';
import SoundToggle from '@/components/ui/SoundToggle';
import EnginePulse from '@/components/ui/EnginePulse';
import { setMix, type Mix } from '@/lib/ambience';

// 장면별 배경 소리: 엔진은 Q6에서 끊기고 그 뒤로 돌아오지 않는다 (뒤로 가면 앞 장면의 소리로 복원)
function mixFor(step: string): Mix {
  if (step === 'Q5') return 'deck';
  if (step === 'Q6') return 'hold';
  if (['Q7', 'N1', 'N2', 'N3', 'DQ3', 'DQ4', 'DQ5'].includes(step) || step === RESULT) return 'quiet';
  return 'interior';
}

// 바로가기 패널은 개발 서버에서만 노출 (빌드 시 값이 고정되어 운영 화면에는 나타나지 않는다)
const IS_DEV = process.env.NODE_ENV === 'development';

export default function QuizContainer() {
  const { currentStep, nextStep, advance, back, answers, flags, picks, extras, history, runIndex, setRun, setExtras, showDebug, toggleDebug, restore, rewindTo } = useQuizStore();
  const scene = scenes[currentStep];
  const [mounted, setMounted] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const enteredAt = useRef(0);
  useEffect(() => { enteredAt.current = Date.now(); }, [currentStep]);
  useEffect(() => { setMix(mixFor(currentStep)); }, [currentStep]);

  useEffect(() => {
    const init = async () => {
      setRun(loadRuns() + 1);
      // Preload the most essential startup images
      const initialAssets = [
        '/bg/bg-titanic.webp',
        '/male.webp',
        '/female.webp'
      ];
      const params = new URLSearchParams(window.location.search);

      // 새로고침 복원: 같은 탭에서 하던 진행이 있으면 이어서 한다.
      // (다른 사람의 결과 링크로 들어온 경우에는 결과 화면의 진행만 이어받는다)
      const saved = loadSession();
      const sharedId = params.get('result');
      const okStep = saved && (saved.currentStep === PROLOGUE || saved.currentStep === RESULT || !!scenes[saved.currentStep]);
      if (saved && okStep && (!sharedId || saved.currentStep === RESULT)) {
        restore(saved as Parameters<typeof restore>[0]);
      }
      // 브라우저 기록의 시작점 표시 (뒤로 가기가 장면 단위로 동작하게 한다)
      try { window.history.replaceState({ d: 0 }, ''); } catch { /* 무시 */ }

      await preloadImages(initialAssets);
      setInitialLoaded(true);
      setMounted(true);

      // 밤 장면(N1~N3) 체험 모드: 주소에 ?night=1 이 있을 때만 Q6 뒤에 끼어든다
      if (params.get('night')) {
        setExtras({ night: true, noTimer: params.get('notimer') ? true : undefined });
        // 개발용: 실제 시간을 가속해 확인한다 (예: ?livespeed=60 이면 실제 1초가 게임 속 1분)
        const speed = Number(params.get('livespeed'));
        if (IS_DEV && speed > 0) setExtras({ liveSpeed: speed });
      }
      // 개발용: ?step=Q4 처럼 특정 장면으로 바로 이동한다
      const jump = params.get('step');
      if (IS_DEV && jump) nextStep(jump as Parameters<typeof nextStep>[0]);
      if (params.get('result')) {
        nextStep(RESULT);
      }
    };
    init();
  }, []);

  // 진행 저장: 장면이 바뀔 때마다 탭 저장소에 기록한다 (처음 화면이면 지운다)
  useEffect(() => {
    if (!mounted) return;
    if (currentStep === PROLOGUE && history.length === 0) { clearSession(); return; }
    saveSession({ currentStep, answers, flags, picks, extras, history });
  }, [mounted, currentStep, answers, flags, picks, extras, history]);

  // 브라우저 뒤로 가기·앞으로 가기를 장면 이동과 맞춘다.
  // 장면이 하나 진행될 때마다 기록을 한 칸 쌓고, 뒤로 가면 그만큼 되돌린다.
  const navDepth = useRef(0);
  const ignorePop = useRef(false);
  const fromPop = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    const n = history.length;
    const cur = navDepth.current;
    if (n > cur) {
      for (let d = cur + 1; d <= n; d++) window.history.pushState({ d }, '');
      navDepth.current = n;
    } else if (n < cur) {
      navDepth.current = n;
      if (fromPop.current) fromPop.current = false; // 브라우저가 이미 움직였다
      else { ignorePop.current = true; window.history.go(n - cur); } // 화면 안의 뒤로 가기 버튼
    }
  }, [mounted, history.length]);
  useEffect(() => {
    if (!mounted) return;
    const onPop = (e: PopStateEvent) => {
      if (ignorePop.current) { ignorePop.current = false; return; }
      const d = typeof e.state?.d === 'number' ? e.state.d : 0;
      const len = useQuizStore.getState().history.length;
      if (d < len) { fromPop.current = true; rewindTo(d); }
      else if (d > len) { ignorePop.current = true; window.history.go(len - d); } // 앞으로 가기는 지원하지 않는다
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [mounted, rewindTo]);

  // 밤 장면에 처음 들어오는 순간부터 실제 시간이 게임 속 시간으로 흐른다
  const inNight = scene?.renderer === 'night';
  useEffect(() => {
    if (inNight && extras.night && !extras.noTimer && extras.nightStart === undefined) setExtras({ nightStart: Date.now() });
  }, [inNight, extras.night, extras.noTimer, extras.nightStart, setExtras]);

  const handlePrologue = (embarked: string) => {
    onRunStarted(runIndex);
    advance({ next: 'Q0', key: 'embarked', value: embarked });
  };

  const [isFlashing, setIsFlashing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 밤 장면(N1~N3)에서 선택지를 고른 뒤: 점수용 답 없이 플래그·소모 시간만 누적하고 다음 장면으로
  const handleNightChoose = (option: CineOption, ms: number) => {
    if (!scene) return;
    if (answeringFor.current === scene.id) return;
    answeringFor.current = scene.id;
    const spent = typeof extras.spent === 'number' ? extras.spent : 0;
    const spentNext = spent + (option.timeCost ?? 0);
    const nextFlags = { ...flags, ...(option.sets ?? {}) };
    const next = nextSceneId(scene, { answers, flags: nextFlags, picks, run: runIndex, extras: { ...extras, spent: spentNext } });
    emitPick({ run: runIndex, scene: scene.id, value: option.id, ms });
    advance({ next, sets: option.sets, extras: { spent: spentNext }, pick: option.id });
  };

  // 같은 장면에서 빠르게 두 번 눌러도 한 번만 처리한다 (두 번 처리되면 다음 장면에 가짜 선택이 기록되고 뒤로 가기 기록이 꼬인다)
  const answeringFor = useRef<string | null>(null);
  useEffect(() => { answeringFor.current = null; }, [currentStep]);
  const handleAnswer = async (value: string, extra?: Record<string, unknown>) => {
    if (!scene || !scene.answerKey) return;
    if (answeringFor.current === scene.id) return;
    answeringFor.current = scene.id;
    const key = scene.answerKey;
    const next = nextSceneId(scene, { answers: { ...answers, [key]: value }, flags, picks, run: runIndex, extras });
    const tempAnswers = { ...answers, [key]: value };
    const ms = Date.now() - enteredAt.current;
    const commit = () => {
      emitPick({ run: runIndex, scene: scene.id, value, ms });
      advance({ next, key, value, extras: extra });
      if (next === RESULT) {
        const runs = completeRun();
        setRun(runs + 1);
        onRunCompleted(runs);
      }
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
      // 강아지 시점으로 끝낸 경우: 백엔드 매칭 없이 자체 결과 카드
      if (answers.companion === 'dog' && !sharedResultId) return <DogResultView key="dog_result" />;
      return <ResultView key="result_view" sharedResultId={sharedResultId || undefined} />;
    }

    // 선택 없이 시간이 모두 흐른 경우
    if (extras.sunk) return <SpecialCard key="special" />;

    // 밤 장면 (N1 ~ N3): 장면 패널
    if (scene?.renderer === 'night' && scene.cine) {
      return (
        <NightScene
          key={currentStep}
          cineId={scene.cine}
          ctx={{ answers, flags, picks, run: runIndex, extras }}
          timerEnabled={!extras.noTimer}
          onChoose={handleNightChoose}
          liveStart={typeof extras.nightStart === 'number' ? extras.nightStart : undefined}
          liveSpeed={typeof extras.liveSpeed === 'number' ? extras.liveSpeed : undefined}
          onSink={() => { setExtras({ sunk: true }); unlock('sins-of-omission'); }}
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
          extras={extras}
        />
      );
    }

    return null;
  };

  return (
    <div className={`w-full relative min-h-screen ${currentStep === PROLOGUE ? '' : 'overflow-hidden'}`}>
      <AchievementToast />
      <SoundToggle />
      <EnginePulse active={currentStep !== RESULT} />
      {(currentStep === PROLOGUE || currentStep === RESULT) && <AchievementsButton />}
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
