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
import BeatenEnding from '@/components/cinematic/BeatenEnding';
import { personalize } from '@/data/variants';
import { buildPersona } from '@/engine/persona';
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
import SceneTransition, { TransitionCard, type TransitionInfo } from '@/components/ui/SceneTransition';
import { setMix, type Mix } from '@/lib/ambience';
import TimeVortex from '@/components/ui/TimeVortex';
import BgLights from '@/components/ui/BgLights';
import CrtPowerOn from '@/components/ui/CrtPowerOn';
import DebugPanel from '@/components/ui/DebugPanel';
import BgSway from '@/components/ui/BgSway';
import BoatSeaBg, { BOAT_SEA_URL } from '@/components/ui/BoatSeaBg';
import { playTimeVortex, playCrtOn } from '@/lib/synth';
import { decideBoarding, estimateAdjusted, rollW2, type W2Way } from '@/engine/boarding';

// 장면별 배경 소리: 엔진은 Q6에서 끊기고 그 뒤로 돌아오지 않는다 (뒤로 가면 앞 장면의 소리로 복원)
function mixFor(step: string): Mix {
  if (step === 'Q5') return 'deck';
  if (step === 'Q6') return 'hold';
  if (['Q7', 'B1', 'WB', 'W1', 'W2', 'N1', 'N2', 'N3', 'DQ3', 'DQ4', 'DQ5'].includes(step) || step === RESULT) return 'quiet';
  return 'interior';
}

// 자기 화면 전체를 직접 그리는 장면: 뒤의 공용 배경 사진을 깔지 않는다 (장면이 바뀌는 사이에 엉뚱한 사진이 비치지 않게)
const OWN_BACKDROP = new Set(['companion', 'staircase', 'deck', 'rumor', 'lifeboat', 'sinkside', 'deckbridge', 'swim']);

const CHAPTER_NAME = ['탑승', '항해', '그날 밤'];
const PORT_DAY: Record<string, string> = {
  S: '1912년 4월 10일 정오 · 사우샘프턴',
  C: '1912년 4월 10일 저녁 · 셰르부르',
  Q: '1912년 4월 11일 · 퀸스타운',
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 로딩 화면에 보여 줄 장 이름, 날짜, 항해 진행 */
function transitionInfo(next: string, answers: Record<string, unknown>): TransitionInfo {
  if (next === RESULT) return { chapter: '기록', when: '1912년 4월 15일 새벽', progress: 1 };
  const ch = scenes[next]?.chapter ?? 0;
  const q = questionsData[next];
  const progress = q ? q.step / (q.totalSteps + 1) : [0.15, 0.5, 0.85][ch] ?? 0.5;
  const when = ch === 0 ? (PORT_DAY[String(answers.embarked)] ?? '1912년 4월 10일 · 사우샘프턴')
    : ch === 1 ? '1912년 4월 · 대서양 한가운데'
      : '1912년 4월 14일 밤 · 북대서양';
  return { chapter: CHAPTER_NAME[ch] ?? '항해', when, progress };
}

// 바로가기 패널은 개발 서버에서만 노출 (빌드 시 값이 고정되어 운영 화면에는 나타나지 않는다)
const IS_DEV = process.env.NODE_ENV === 'development';

export default function QuizContainer() {
  const { currentStep, nextStep, advance, back, answers, flags, picks, extras, history, runIndex, setRun, setExtras, showDebug, toggleDebug, restore, rewindTo } = useQuizStore();
  const scene = scenes[currentStep];
  const tilt = scene?.tilt ?? 0; // 못 탄 쪽 장면(W1·W2): 배가 뱃머리부터 가라앉으며 갑판이 눈앞에서 위로 솟구친다 (옆으로 눕지 않고 앞뒤로 기운다)
  const [mounted, setMounted] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const enteredAt = useRef(0);
  useEffect(() => { enteredAt.current = Date.now(); }, [currentStep]);
  useEffect(() => { setMix(mixFor(currentStep)); }, [currentStep]);
  // 지난 결과 주소(?result=...)가 남은 채로 새 판을 시작하면 이번 판의 결과가 '공유 링크'로 오인되어 인쇄 연출이 건너뛰어진다.
  // 결과 화면이 아닌 장면으로 넘어오면 남은 결과 주소를 지운다 (공유 링크로 들어온 사람은 곧바로 결과 장면이라 영향이 없다)
  useEffect(() => {
    if (currentStep === RESULT || currentStep === PROLOGUE || typeof window === 'undefined') return;
    if (!new URLSearchParams(window.location.search).has('result')) return;
    try { window.history.replaceState(window.history.state, '', window.location.pathname); } catch { /* 무시 */ }
  }, [currentStep]);

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
      // 개발용: ?age=7 처럼 나이를 정해 둔다 (아이·노인 분기를 ?step= 으로 바로 확인할 때)
      const ageParam = params.get('age');
      if (IS_DEV && ageParam !== null && Number.isFinite(Number(ageParam))) setExtras({ age: Number(ageParam) });
      // 개발용: ?run=5 처럼 회차를 정해 둔다 (오리 사무장의 회차별 대사 확인용)
      const runParam = params.get('run');
      if (IS_DEV && runParam !== null && Number.isFinite(Number(runParam))) setRun(Number(runParam));
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
  const [transition, setTransition] = useState<TransitionInfo | null>(null);
  // 나이를 확정하면 타임머신이 작동해 소용돌이로 빨려 들어간 뒤 카메라 속 항구(Q2)가 드러난다
  const [vortex, setVortex] = useState<'in' | 'out' | null>(null);
  // Q7 을 마치고 서버 확률로 탑승을 판정하는 동안 화면을 하얗게 덮는다 (LifeboatView 의 플래시에서 이어진다)
  const [whiteout, setWhiteout] = useState(false);
  // 헤엄(W2)의 끝: 구하러 온 손에 끌려 올라가거나 못 닿아 가라앉은 뒤 어두워지고, 못 산 쪽은 아날로그 화면이 켜지며 결과로 넘어간다
  const [blackout, setBlackout] = useState(false);
  const [crt, setCrt] = useState(false);
  const [resultStage, setResultStage] = useState<string | null>(null); // 결과 화면의 연출 단계 (ResultView 가 알려 준다)
  useEffect(() => {
    const on = (e: Event) => setResultStage((e as CustomEvent<string | null>).detail);
    window.addEventListener('titanic:result-stage', on);
    return () => window.removeEventListener('titanic:result-stage', on);
  }, []);

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
    // W2: 고른 방식(헤엄·뛰어들기·침몰)의 생존 여부를 확률로 굴려 결과가 쓴다
    let commitExtra = extra;
    if (scene.id === 'W2') {
      const adj = typeof extras.boardP === 'number' ? extras.boardP : estimateAdjusted(answers as Record<string, unknown>, extras);
      // 헤엄 화면(SwimView)은 스스로 굴린 결과를 넘긴다. 없을 때만 예전 규칙으로 굴린다
      commitExtra = typeof extra?.w2Survived === 'boolean' ? extra : { ...(extra ?? {}), w2: value, w2Survived: rollW2(value as W2Way, adj) };
    }
    const commit = () => {
      emitPick({ run: runIndex, scene: scene.id, value, ms });
      advance({ next, key, value, extras: commitExtra });
      if (next === RESULT) {
        const runs = completeRun();
        setRun(runs + 1);
        onRunCompleted(runs);
      }
    };

    // W2 의 끝: 헤엄 화면이 마지막 연출(구명정에 끌려 올라가거나 가라앉음)을 끝내고 어두워진 상태로 넘겨 준다. 곧바로 결과로 간다.
    // 못 산 쪽(헤엄이 다했는데 못 닿은 판)은 암흑 속에서 아날로그 화면이 켜지며 결과로 이어진다.
    if (scene.id === 'W2') {
      const died = commitExtra?.w2Survived === false && commitExtra?.w2 !== 'sink';
      setBlackout(true);
      await sleep(shouldReduceMotion ? 300 : 700);
      await preloadImages(assetsFor(RESULT, tempAnswers));
      commit();
      if (died) { setCrt(true); playCrtOn(); }
      await sleep(250);
      setBlackout(false);
      if (died) {
        await sleep(shouldReduceMotion ? 700 : 2400);
        setCrt(false);
      }
      return;
    }

    // Q7: 선택까지 반영한 서버 확률로 구명정에 탔는지 판정하고, 탑승(B1)과 미탑승(W1)으로 가른다
    if (scene.id === 'Q7') {
      // 구명정을 내려 보내거나 물러선 판은 흰 화면 없이 난간 장면(WB)으로 이어진다
      const quietExit = value === 'yield_seat' || value === 'observe' || value === 'yield_weak';
      if (!quietExit) setWhiteout(true);
      const finalAnswers = { ...answers, [key]: value } as Record<string, unknown>;
      const verdict = await decideBoarding(finalAnswers, extras, flags.boat === true);
      const verdictExtras = { ...(extra ?? {}), boarded: verdict.boarded, boardP: verdict.adjusted, boardSrc: verdict.source };
      if (verdict.boarded && extra?.pushedIn === true) unlock('pushed-in'); // 장교의 팔을 밀치고 실제로 오른 판에서만
      const nextAfter = nextSceneId(scene, { answers: finalAnswers, flags: { ...flags, boat: verdict.boarded }, picks, run: runIndex, extras: { ...extras, ...verdictExtras } });
      await preloadImages(assetsFor(nextAfter, finalAnswers));
      emitPick({ run: runIndex, scene: scene.id, value, ms });
      advance({ next: nextAfter, key, value, sets: { boat: verdict.boarded }, extras: verdictExtras });
      await sleep(250);
      setWhiteout(false);
      return;
    }

    // 장면이 자기 연출로 다음 화면에 이어 준다 (Q7 의 플래시 → 결과의 사진)
    if (scene.seamlessAnswer) {
      commit();
      return;
    }

    // 나이 확정(Q1) → 소용돌이 → 카메라 속 항구(Q2). 전보 프린트 대신 이 연출로 이어 준다
    if (scene.id === 'Q1') {
      const dur = shouldReduceMotion ? 600 : 3200;
      setVortex('in');
      playTimeVortex(dur / 1000);
      await Promise.all([preloadImages(assetsFor(next, tempAnswers)), sleep(dur)]);
      commit();
      await sleep(250);
      setVortex('out');
      await sleep(shouldReduceMotion ? 500 : 1800);
      setVortex(null);
      return;
    }

    if (scene.flashOnAnswer) {
      setIsFlashing(true);
      setTimeout(async () => {
        await preloadImages(assetsFor(next, tempAnswers));
        commit();
        setIsFlashing(false);
      }, 500);
      return;
    }

    // 둥근 창이 완전히 닫힌 뒤(약 0.45초) 장면을 바꾸고, 새 장면이 자리를 잡을 때까지 덮어 둔 다음 연다
    setTransition(transitionInfo(next, tempAnswers));
    await Promise.all([preloadImages(assetsFor(next, tempAnswers)), sleep(480)]);
    commit();
    await sleep(750);
    setTransition(null);
  };

  // 앞 선택에 따라 배경이 바뀌는 갈래
  const variantBg = useMemo(
    () => scene?.variant?.({ answers, flags, picks, run: runIndex, extras }),
    [scene, answers, flags, picks, runIndex, extras],
  );
  const bgImageUrl = useMemo(() => {
    if (currentStep === PROLOGUE) return '/bg/bg-titanic.webp';
    if (currentStep === RESULT) return '/bg/collasping.webp';
    if (scene && OWN_BACKDROP.has(scene.renderer)) return null;
    return variantBg?.bgImage ?? bgFor(currentStep, answers) ?? null;
  }, [currentStep, answers, scene, variantBg]);
  // B1: 바다와 배를 따로 그린 두 겹 배경 (움직임 줄이기 설정이면 한 장짜리 사진)
  const layeredBg = bgImageUrl === BOAT_SEA_URL && !shouldReduceMotion;

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
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center" style={{ background: '#05070d' }}>
        <TransitionCard info={{ chapter: '승선 준비', when: '1912년 4월 10일', progress: 0 }} />
      </div>
    );
  }

  if (!mounted) return null;

  // Q7 을 끝낸 결과 화면은 플래시에서 곧바로 이어지므로 장면 전환 페이드를 쓰지 않는다
  const bridgeIn = currentStep === RESULT && !!answers.finalAction;

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

    // 히든 엔딩: 갑판에서 100명을 쓰러뜨려 성난 승객들에게 맞은 경우
    if (extras.beaten) return <BeatenEnding key="beaten" />;

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
      const variantQuestion = v
        ? { ...baseQuestion, title: v.title ?? baseQuestion.title, subtitle: v.subtitle ?? baseQuestion.subtitle,
            options: v.omit ? baseQuestion.options.filter((o) => !v.omit!.includes(o.value)) : baseQuestion.options }
        : baseQuestion;
      // 승객(항구, 성별, 나이)에 따라 글을 바꾸고 못 하는 선택지를 잠근다 (선택지_개정안.md)
      const question = personalize(currentStep, variantQuestion, buildPersona(answers as Record<string, unknown>, extras));
      const Renderer = renderers[scene.renderer];
      return (
        <Renderer
          key={currentStep}
          question={question}
          onAnswer={handleAnswer}
          onBack={() => back(scene.prev)}
          extras={extras}
          answers={answers as Record<string, unknown>}
          onBeaten={() => { setExtras({ beaten: true, knocked: 100 }); unlock('angry-mob'); }}
        />
      );
    }

    return null;
  };

  return (
    <div id="game-root" className={`w-full relative min-h-screen ${currentStep === PROLOGUE ? '' : 'overflow-hidden'}`}>
      <AchievementToast />
      <SoundToggle />
      <EnginePulse active={currentStep !== RESULT} />
      {/* 연출이 중요한 장면(결과 연출, 밤 시네마틱, 엔딩 카드, 플래시, 장면 전환)에서는 숨긴다.
          프롤로그·결과 정리 화면은 왼쪽 위, 그 밖의 장면에서는 소리 버튼 옆(뒤로 가기와 겹치지 않게) */}
      {!isFlashing && !transition && !extras.sunk && !extras.beaten && !(scene?.renderer === 'night' && scene.cine)
        && (currentStep !== RESULT || resultStage === 'STAGE_SUMMARY' || answers.companion === 'dog')
        && <AchievementsButton compact={currentStep !== PROLOGUE && currentStep !== RESULT} />}
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

      {/* 장면 사이 로딩: 놋쇠 둥근 창이 닫혔다 열린다 (ui/SceneTransition) */}
      <SceneTransition info={transition} />
      {vortex && <TimeVortex phase={vortex} />}
      {blackout && <div aria-hidden className="pointer-events-none fixed inset-0 z-[9995] bg-black" />}
      {crt && <CrtPowerOn />}
      <AnimatePresence>
        {whiteout && (
          <motion.div
            key="q7-whiteout"
            aria-hidden
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.6, ease: 'easeOut' } }}
            className="fixed inset-0 z-[9997] bg-white pointer-events-none"
          />
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
      <div
        className="absolute inset-0 bg-slate-950 z-0"
        style={tilt ? { transform: `perspective(1100px) rotateX(${-tilt * 2.2}deg) scale(${1 + tilt / 40})`, transformOrigin: '50% 100%', transition: 'transform 9s ease-in-out' } : undefined}
      >
        {/* 구명정이 있는 사진은 물결에 흔들린다 (BgSway) */}
        <BgSway url={bgImageUrl}>
        <AnimatePresence>
          {bgImageUrl && <motion.div
            key={bgImageUrl}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.05 }}
            animate={shouldReduceMotion 
              ? { opacity: bgOpacity } 
              : { opacity: bgOpacity, scale: 1, filter: currentStep === RESULT || scene?.ripple ? 'url(#water-ripple)' : 'none' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={layeredBg ? undefined : { backgroundImage: `url('${bgImageUrl}')`, backgroundPosition: variantBg?.bgPosition }}
          >
            {/* 바다와 배를 따로 그린 장면: 배만 흔들리고, 랜턴 불빛도 배와 같이 움직인다 */}
            {layeredBg && <BoatSeaBg opacity={bgOpacity} out={false} />}
          </motion.div>}
        </AnimatePresence>
        {/* 배경 사진 속 랜턴 불빛이 일렁인다 */}
        {!layeredBg && <BgLights key={bgImageUrl ?? 'none'} url={bgImageUrl} opacity={bgOpacity} out={false} />}
        </BgSway>
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
          initial={shouldReduceMotion || scene?.fastEnter || bridgeIn ? { opacity: 0, rotateX: -tilt * 0.6, transformPerspective: 1300 } : { opacity: 0, y: 20, rotateX: -tilt * 0.6, transformPerspective: 1300 }}
          animate={{ opacity: 1, y: 0, rotateX: shouldReduceMotion ? -tilt * 0.6 : -tilt * 1.0, transformPerspective: 1300 }}
          exit={shouldReduceMotion || scene?.fastExit ? { opacity: 0, transition: { duration: 0.01 } } : { opacity: 0, y: -20 }}
          transition={{ duration: scene?.fastEnter || bridgeIn ? 0.01 : 0.8, ease: [0.76, 0, 0.24, 1], rotateX: { duration: tilt ? 20 : 0.8, ease: 'linear' } }}
          className="w-full min-h-screen relative z-10"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* 디버그 패널: 개발 서버에서만. 어느 장면에서든 건너뛴다 (ui/DebugPanel) */}
      {IS_DEV && <DebugPanel />}
    </div>
  );
}
