'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence, useReducedMotion } from 'framer-motion';
import SteamField, { SteamBurst } from './SteamField';
import GaugeLayer from './GaugeLayer';
import { unlock } from '@/engine/achievements';
import GearLayer from './GearLayer';
import BoardPost from './BoardPost';
import PushButton from '@/components/ui/PushButton';
import RoomControls, { RoomLighting, type ControlId, type LightLevel } from './RoomControls';
import { useBgMap } from './useBgMap';
import { playRatchet, playSteamHiss, playTelegramPrint, playServoRise, playPop } from '@/lib/synth';
import ProgressLine from '@/components/ui/ProgressLine';
import { Question } from '@/data/questions';
import { useQuizStore } from '@/store/quizStore';

interface AgeViewProps {
  question: Question;
  onAnswer: (value: string, extra?: Record<string, unknown>) => void;
  onBack: () => void;
}

/** 구간마다 고를 수 있는 나이 범위와 처음 나이. 레버로 구간을 고른 뒤 전광판 양옆의 −/+ 로 한 살씩 세밀하게 고른다 */
const AGE_RANGE: Record<string, [number, number, number]> = {
  '0-9': [0, 9, 5], '10-17': [10, 17, 14], '18-29': [18, 29, 24], '30-39': [30, 39, 35],
  '40-49': [40, 49, 45], '50-59': [50, 59, 55], '60+': [60, 99, 65],
};
/** 타이타닉 최고령 승객은 요한 스벤손(74세, 3등석). 이 나이 이상을 고르면 업적 */
const OLDEST_AGE = 74;

/** 제어판 버튼을 한 번씩이라도 눌렀는지 (업적 "Please, Don't Touch Anything") */
const ALL_CONTROLS: ControlId[] = ['light', 'burst', 'hold', 'engine', 'flicker'];
const pressedControls = new Set<ControlId>();
const visitedAges = new Set<number>();
let ageCountSeen = 0;
/** 제어판 버튼 다섯 개와 모든 나이를 한 번씩 다 해 봤으면 업적 */
function checkDontTouch() {
  if (pressedControls.size >= ALL_CONTROLS.length && ageCountSeen > 0 && visitedAges.size >= ageCountSeen) unlock('dont-touch');
}

/** 전보 인쇄: 종이가 PRINT_STEPS 번 끊어 가며 밀려 올라온다 (소리도 같은 박자) */
const PRINT_STEPS = 8;
const PRINT_DUR = 3.0;
const PRINT_TOTAL = 0.94; // 종이 높이 중 올라오는 비율 (나머지는 프린터 속에 남는다)
const { PRINT_Y, PRINT_TIMES } = (() => {
  const y: string[] = ['0%'];
  const t: number[] = [0];
  for (let i = 1; i <= PRINT_STEPS; i++) {
    y.push(`${-((i - 1) / PRINT_STEPS) * PRINT_TOTAL * 100}%`);
    t.push((i - 1 + 0.55) / PRINT_STEPS);
    y.push(`${-(i / PRINT_STEPS) * PRINT_TOTAL * 100}%`);
    t.push(i / PRINT_STEPS);
  }
  return { PRINT_Y: y, PRINT_TIMES: t };
})();

/**
 * 증기 피스톤: 처음에는 보이지 않다가, 화면 아래에서 기둥이 천천히 길어지며 머리(− 또는 + 버튼)가 올라온다. 밑받침은 없다.
 * 머리를 누르면 눌린 그림으로 바뀌며 한 칸 들어갔다 나온다. 끝에 닿아 안 눌릴 때는 어둡게 가라앉고 살짝 눌렸다 돌아온다.
 * pw: 머리 지름(px), travel: 화면 아래에서 머리가 올라오는 거리(px).
 */
function Piston({ kind, show, disabled, onPress, pw, travel }: { kind: 'minus' | 'plus'; show: boolean; disabled: boolean; onPress: () => void; pw: number; travel: number }) {
  const [down, setDown] = useState(false);
  const [bump, setBump] = useState(0);
  const press = () => {
    if (!show) return;
    if (disabled) { setBump((n) => n + 1); playRatchet(); return; } // 끝에 닿았다
    setDown(true);
    setTimeout(() => setDown(false), 170);
    onPress();
  };
  // 천천히 올라오는 동안 낮게 철컥거린다
  useEffect(() => {
    if (!show) return;
    const ts = [250, 650, 1050, 1450].map((ms) => setTimeout(() => playRatchet(), ms));
    return () => ts.forEach(clearTimeout);
  }, [show]);
  const ph = pw * 1.033; // 머리 높이
  const T = Math.max(60, travel);
  const tr = show ? { duration: 2.0, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number], delay: 0.1 } : { duration: 0.6, ease: 'easeIn' as const };
  return (
    <div className="relative shrink-0" style={{ width: pw, height: ph + T }}>
      {/* 기둥: 머리 아래에서 화면 아래 끝까지. 머리가 올라온 만큼 길어진다 */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 overflow-hidden"
        style={{
          width: pw * 0.4, marginLeft: -pw * 0.2, bottom: 0, backgroundImage: "url('/ui/age_piston_rod_tile.webp')",
          backgroundRepeat: 'repeat-y', backgroundSize: '100% auto', backgroundPosition: 'center top',
          filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.5))',
        }}
        initial={{ height: 0 }}
        animate={{ height: show ? T + ph * 0.04 : 0 }}
        transition={tr}
      />
      {/* 머리 = 버튼 */}
      <motion.div
        className="absolute left-1/2"
        style={{ width: pw, height: ph, marginLeft: -pw / 2 }}
        initial={{ top: T + ph }}
        animate={{ top: show ? 0 : T + ph }}
        transition={tr}
      >
        <motion.button
          key={bump}
          type="button"
          aria-label={kind === 'minus' ? '나이 한 살 줄이기' : '나이 한 살 늘리기'}
          aria-disabled={disabled}
          onClick={press}
          className="pointer-events-auto relative block h-full w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          style={{ filter: disabled ? 'brightness(0.62) saturate(0.7)' : 'drop-shadow(0 6px 8px rgba(0,0,0,0.55))' }}
          animate={bump ? { y: [0, 3, 0] } : undefined}
          transition={{ duration: 0.18 }}
          whileTap={disabled ? undefined : { y: 3 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/ui/age_piston_${kind}_${down ? 'down' : 'up'}.webp`} alt="" draggable={false} className="pointer-events-none block h-full w-full select-none" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/ui/age_piston_${kind}_down.webp`} alt="" aria-hidden className="pointer-events-none absolute h-0 w-0 opacity-0" />
        </motion.button>
      </motion.div>
    </div>
  );
}

export default function AgeView({ question, onAnswer, onBack }: AgeViewProps) {
  // --- Physics & Mechanics ---
  const dragAngle = useMotionValue(0);
  const isDragging = useRef(false);
  const pivotRef = useRef<HTMLDivElement>(null);
  
  // --- Debug Panel State ---
  const [isEditMode, setIsEditMode] = useState(false);
  const [config, setConfig] = useState({
    rbase: { x: 2, y: 93, scale: 0.1 },
    base: { x: -27, y: 469, scale: 3.4 },
    lever: { x: 3, y: 40, scale: 3.2, originX: 50, originY: 128, maxAngle: 120 },
    arrow: { x: 3, y: 91, scale: 2.6, originX: 50, originY: 53 },
    hitArea: { w: 30, h: 50, y: -20 },
    snapAngles: [-107, -75, -49, -18, 18, 46, 75]
  });
  const [characterConfig, setCharacterConfig] = useState<Record<string, { x: number, y: number, scale: number }>>({});

  // Mass-Spring-Damper logic for heavy brass lever feel
  const smoothAngle = useSpring(dragAngle, { stiffness: 150, damping: 25, mass: 1.5 });

  // Option segments
  const numOptions = question.options.length;
  const snapAngles = config.snapAngles;

  const [activeIndex, setActiveIndex] = useState(3); // Start at middle
  // 아직 아무것도 고르지 않은 상태에서 시작한다: 레버를 만지기 전에는 확정할 수 없다
  const [picked, setPicked] = useState(false);
  const pickedRef = useRef(false);
  const targetRef = useRef(3); // 레버가 향하는 칸(스프링이 도착하기 전에도 최신 값)
  const [confirming, setConfirming] = useState(false);
  const [exactAges, setExactAges] = useState<Record<string, number>>({}); // 구간별로 고른 정확한 나이
  const reduceMotion = useReducedMotion();
  const steamBurst = useRef<SteamBurst | null>(null);
  // 배경 레버: 조명 3단계, 증기 유지, 기관 가속, 전구 점멸
  const bg = useBgMap();
  const bgRef = useRef(bg);
  bgRef.current = bg;
  const [lightLevel, setLightLevel] = useState<LightLevel>(1);
  const [steamHold, setSteamHold] = useState(false);
  const [engineFast, setEngineFast] = useState(false);
  const [bulbFlicker, setBulbFlicker] = useState(false);
  const [burstTick, setBurstTick] = useState(0);

  /** 배경 속 배관 이음매 세 곳(그림 좌표)에서 김을 뿜는다: 인물과 UI에 가려지지 않는 자리의 밸브와 엘보 */
  const VENTS: [number, number, number][] = [
    [333, 203, -0.35], // 위쪽 왼쪽 배관의 밸브 휠
    [558, 238, 0.2], // 계기판 오른쪽의 작은 밸브
    [712, 262, 0.45], // 콘솔 뒤 배관의 꺾임(엘보)
  ];
  const valveSteam = (power: number) => {
    const b = bgRef.current;
    VENTS.forEach(([x, y, dir]) => steamBurst.current?.(b.toX(x), b.toY(y), power, dir));
  };
  const pullLever = (id: ControlId) => {
    playRatchet();
    pressedControls.add(id);
    checkDontTouch();
    if (id === 'light') setLightLevel((l) => (l === 1 ? 2 : l === 2 ? 0 : 1));
    else if (id === 'burst') {
      playSteamHiss(1.1);
      setBurstTick((t) => t + 1);
      valveSteam(1.7);
      setTimeout(() => valveSteam(1.2), 220);
    } else if (id === 'hold') {
      setSteamHold((v) => {
        if (!v) playSteamHiss(0.5);
        return !v;
      });
    } else if (id === 'engine') setEngineFast((v) => !v);
    else if (id === 'flicker') setBulbFlicker((v) => !v);
  };
  // 증기 유지: 켜 두면 밸브에서 계속 김이 올라온다
  useEffect(() => {
    if (!steamHold) return;
    valveSteam(0.5);
    const id = setInterval(() => valveSteam(0.45), 1100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steamHold]);
  // 업적: 고른 나이를 기록한다 (모든 나이를 한 번씩 골라 봤는지)
  useEffect(() => {
    ageCountSeen = numOptions;
    if (picked) visitedAges.add(activeIndex);
    checkDontTouch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, activeIndex, numOptions]);
  // 바늘은 눈금에 걸려 튕기도록 레버보다 탄성이 크다
  const needleAngle = useSpring(dragAngle, { stiffness: 260, damping: 9, mass: 0.9 });

  const markPicked = () => {
    if (!pickedRef.current) {
      // 처음 나이를 고르는 순간: 선반 속에서 승강대가 위이잉 올라오고(김이 새어 나온다), 그 위로 버튼이 똿 하고 튀어나온다
      playServoRise(0.85);
      setTimeout(playPop, 1000);
      const bgNow = bgRef.current;
      steamBurst.current?.(bgNow.toX(116), bgNow.toY(526), 0.55, -1);
      steamBurst.current?.(bgNow.toX(170), bgNow.toY(526), 0.55, 1);
    }
    pickedRef.current = true;
    setPicked(true);
  };

  /** 레버 축 양옆의 증기 배출구에서 김을 뿜는다 */
  const ventBurst = (power: number) => {
    const el = pivotRef.current;
    if (!el || !steamBurst.current) return;
    const r = el.getBoundingClientRect();
    const px = r.left + r.width / 2;
    const py = r.top + r.height / 2;
    steamBurst.current(px - 150, py - 110, power, -1);
    steamBurst.current(px + 150, py - 110, power, 1);
  };

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
        // 한 칸 넘어감: 래칫 소리와 증기 배출
        setActiveIndex(closestIdx);
        targetRef.current = closestIdx;
        if (pickedRef.current) {
          playRatchet();
          playSteamHiss(0.5);
          ventBurst(0.55);
        }
      }
    });
  }, [smoothAngle, activeIndex, snapAngles]);

  const handlePointerDown = (e: React.PointerEvent) => {
    markPicked();
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
    if (!pivotRef.current || confirming) return;
    markPicked();
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

  const goTo = (idx: number) => {
    if (confirming) return;
    const i = Math.max(0, Math.min(numOptions - 1, idx));
    markPicked();
    targetRef.current = i;
    dragAngle.set(snapAngles[i]);
  };

  const handleConfirm = () => {
    if (confirming || !pickedRef.current) return;
    setConfirming(true);
    playTelegramPrint(PRINT_STEPS, PRINT_DUR);
    playSteamHiss(1.2);
    ventBurst(1.6);
    setTimeout(() => ventBurst(1.2), 260);
    const opt = question.options[activeIndex];
    const age = exactAges[opt.id] ?? (AGE_RANGE[opt.value]?.[2] ?? 30);
    // 타이타닉의 최연소(생후 2개월, 0세)와 최고령(74세) 이하/이상을 골랐다면 업적
    if (age <= 0) unlock('youngest-passenger');
    if (age >= OLDEST_AGE) unlock('oldest-passenger');
    timerRef.current = setTimeout(() => onAnswer(opt.value, { age }), reduceMotion ? 250 : Math.round(PRINT_DUR * 1000) + 1500);
  };
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // 키보드: 좌우(위아래) 화살표로 한 칸씩, Home/End 로 양 끝, Enter/Space 로 확정
  const keyState = useRef({ activeIndex, picked, goTo, handleConfirm });
  keyState.current = { activeIndex, picked, goTo, handleConfirm };
  const keyBase = () => (pickedRef.current ? targetRef.current : 3);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keyState.current;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); k.goTo(keyBase() + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); k.goTo(keyBase() - 1); }
      else if (e.key === 'Home') { e.preventDefault(); k.goTo(0); }
      else if (e.key === 'End') { e.preventDefault(); k.goTo(numOptions - 1); }
      else if ((e.key === 'Enter' || e.key === ' ') && k.picked && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); k.handleConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [numOptions]);

  const userSex = useQuizStore(state => state.answers.sex);
  const activeOption = picked ? question.options[activeIndex] : null;
  const ageRange = activeOption ? (AGE_RANGE[activeOption.value] ?? [0, 99, 30]) : null;
  const exactAge = activeOption && ageRange ? (exactAges[activeOption.id] ?? ageRange[2]) : null;
  const stepAge = (d: number) => {
    if (!activeOption || !ageRange || exactAge === null || confirming) return;
    const nx = Math.max(ageRange[0], Math.min(ageRange[1], exactAge + d));
    if (nx === exactAge) return;
    setExactAges((p) => ({ ...p, [activeOption.id]: nx }));
    playRatchet();
  };
  const stepRef = useRef(stepAge);
  stepRef.current = stepAge;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); stepRef.current(1); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); stepRef.current(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // 피스톤 자리: 배경 그림 속 나이 어르신 의자의 오른쪽 바닥(그림 좌표 약 1035, 590)에서 머리가 멈춘다. 화면 크기가 바뀌어도 의자 옆에 머문다
  const [pistonBox, setPistonBox] = useState({ pw: 52, left: 700, h: 200, travel: 140 });
  useEffect(() => {
    const pw = Math.round(Math.min(64, Math.max(40, 84 * bg.s)));
    const headTop = bg.toY(590);
    const h = Math.max(110, window.innerHeight + 16 - headTop);
    setPistonBox({ pw, left: Math.round(bg.toX(1035)), h, travel: h - pw * 1.033 });
  }, [bg.s, bg.ox, bg.oy]); // eslint-disable-line react-hooks/exhaustive-deps
  // 전광판은 처음엔 없다가, 천장에서 증기를 내뿜은 뒤 서서히 내려온다 (증기는 위에서 아래로 흘러내린다)
  useEffect(() => {
    if (reduceMotion) return;
    const t = setTimeout(() => playSteamHiss(0.9), 700);
    return () => clearTimeout(t);
  }, [reduceMotion]);
  const topSteam = useMemo(() => Array.from({ length: 12 }, (_, k) => ({
    k, x: (Math.random() - 0.5) * 360, size: 70 + Math.random() * 60, delay: 0.55 + Math.random() * 1.7, drop: 150 + Math.random() * 120,
  })), []);
  const ageLabel = exactAge === null ? '' : exactAge === 0 ? '0세' : `${exactAge}세`;
  
  let finalBgImage = activeOption?.bgImage;
  if (userSex === 'female' && finalBgImage && !finalBgImage.includes('10.webp')) {
    finalBgImage = finalBgImage.replace('.webp', 'f.webp');
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
          src="/bg/telegraph_gauges.webp"
          alt="Telegraph Room"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* 배경 톱니바퀴: 천천히 돈다 */}
        <GearLayer reduced={!!reduceMotion} speed={engineFast ? 6 : 1} />

        {/* 계기판: 바늘을 지운 배경 위에서 상황(증기·기관·조명·고른 나이)에 맞춰 바늘이 움직인다 */}
        <GaugeLayer
          reduced={!!reduceMotion}
          inputs={{ hold: steamHold, engine: engineFast, level: lightLevel, flicker: bulbFlicker, age: picked ? activeIndex : null, ageCount: numOptions, burstTick }}
        />

        {/* 전구 조명: 레버로 밝기와 점멸을 바꾼다 */}
        <RoomLighting level={lightLevel} flicker={bulbFlicker} reduced={!!reduceMotion} />

        {/* 인물 뒤 처리: 인물 주변 배경만 살짝 흐리게 하고 어둡게 눌러 구리색 벽에서 분리한다 */}
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            maskImage: 'radial-gradient(ellipse 24% 40% at 78% 64%, #000 38%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 24% 40% at 78% 64%, #000 38%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 27% 45% at 78% 64%, rgba(6,3,2,0.58) 0%, rgba(6,3,2,0.32) 55%, rgba(6,3,2,0) 100%)' }}
        />

        {/* 인물: 왼쪽은 따뜻한 윤곽빛, 오른쪽은 청록 보조광으로 윤곽을 살리고 옷은 조금 눌러 벽과 구분한다 */}
        <div
          className="absolute inset-0"
          style={{ filter: 'saturate(0.88) brightness(0.96) drop-shadow(-3px 0 5px rgba(255,170,90,0.5)) drop-shadow(4px 0 9px rgba(70,190,200,0.3))' }}
        >
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
      </div>
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent to-[#050302]/40 pointer-events-none" />

      {/* Back Button */}
      <button 
        onClick={onBack}
        className="fixed left-4 top-3 md:bottom-8 md:left-8 md:top-auto z-[50] flex items-center text-slate-400 hover:text-amber-400 transition-colors group pointer-events-auto"
      >
        <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
        <span className="text-sm font-sans tracking-widest uppercase">Back</span>
      </button>

      {/* 헤더 글자 가독성을 위한 상단 스크림 (텔레그래프보다 아래 레이어) */}
      <div className="absolute inset-x-0 top-0 h-72 z-[2] bg-gradient-to-b from-[#050302]/90 via-[#050302]/60 to-transparent pointer-events-none" />

      {/* 나이 전광판: 천장 지지대에 매달려 있고, 숫자만 바뀐다 */}
      {/* 천장에서 내뿜는 증기: 위에서 아래로 흘러내리며 퍼지고 사라진다 */}
      {!reduceMotion && (
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 z-[52] h-0 w-0">
          {topSteam.map((p) => (
            <motion.span
              key={p.k}
              className="absolute rounded-full bg-white/55 blur-[12px]"
              style={{ left: p.x - p.size / 2, top: 6, width: p.size, height: p.size }}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.6, 0.35, 0], y: p.drop, scale: [0.5, 1.5, 2.2] }}
              transition={{ delay: p.delay, duration: 2.0, ease: 'easeOut' }}
            />
          ))}
        </div>
      )}

      <motion.div
        className="pointer-events-none absolute left-1/2 top-[68px] z-[50] -translate-x-1/2"
        initial={reduceMotion ? false : { y: -230, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reduceMotion ? { duration: 0 } : { delay: 1.3, duration: 2.2, ease: [0.22, 0.61, 0.36, 1], opacity: { delay: 1.3, duration: 0.5 } }}
      >
        <div className="relative">
          {/* 지지대: 천장 고정판에서 내려와 보드 윗틀을 단단히 잡는 굵은 황동 기둥 하나 (이미지가 있으면 이미지, 없으면 코드로 그린 기둥) */}
          <BoardPost />

        <div
          role="status"
          aria-live="polite"
          aria-label={activeOption ? `선택한 나이 ${ageLabel} (${activeOption.label} 구간)` : '나이를 아직 고르지 않았습니다'}
          className="pointer-events-none relative"
          style={{
            borderStyle: 'solid',
            borderWidth: '27px 26px 25px 26px',
            borderImage: "url('/ui/age_nameplate.webp') 139 136 130 135 / 27px 26px 25px 26px stretch",
            backgroundColor: '#050403',
            backgroundClip: 'padding-box',
          }}
        >
          <style>{`
            @keyframes led-blip { 0% { opacity: .25; filter: brightness(2.2); } 35% { opacity: 1; filter: brightness(1.6); } 100% { opacity: 1; filter: brightness(1); } }
          `}</style>
          <div className="relative flex h-[62px] w-[min(60vw,260px)] flex-col items-center justify-start overflow-hidden bg-[#070504] pt-[3px]">
            <div className="flex h-[44px] items-center justify-center">
            <span
              key={activeOption ? activeOption.id : 'none'}
              className="font-mono text-[28px] font-bold leading-none tracking-[0.1em] md:text-[32px]"
              style={{
                color: activeOption ? '#ffc060' : 'rgba(255,170,60,0.4)',
                textShadow: activeOption ? '0 0 6px rgba(255,150,30,0.95), 0 0 18px rgba(255,110,10,0.55)' : 'none',
                animation: activeOption && !reduceMotion ? 'led-blip 0.35s ease-out' : undefined,
              }}
            >
              {activeOption ? ageLabel : '--세'}
            </span>
            </div>
            {/* 진행 표시: 전광판 안쪽 아래 줄의 작은 LED 막대 */}
            <div className="absolute inset-x-4 bottom-[6px]">
              <ProgressLine led />
            </div>
            {/* 전광판의 점 격자: 글자가 작은 전구들로 보이게 한다 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle at center, rgba(0,0,0,0) 0 52%, rgba(5,3,2,0.55) 62%)',
                backgroundSize: '4px 4px',
              }}
            />
            {/* 유리 반사 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 45%)' }}
            />
          </div>
        </div>

        </div>
      </motion.div>

      {/* Header Info */}
      {/* 한 살씩 세밀하게: 나이 레버 오른쪽, 바닥에서 증기 피스톤 두 개가 나란히 올라온다. 머리가 곧 −, + 버튼이다 (키보드 −, + 도 된다) */}
      <div className="absolute z-[55] flex items-end gap-[6px]" style={{ left: pistonBox.left, bottom: -16, height: pistonBox.h }}>
        <Piston kind="minus" show={!!activeOption && !confirming} disabled={!ageRange || exactAge === null || exactAge <= ageRange[0]} onPress={() => stepAge(-1)} pw={pistonBox.pw} travel={pistonBox.travel} />
        <Piston kind="plus" show={!!activeOption && !confirming} disabled={!ageRange || exactAge === null || exactAge >= ageRange[1]} onPress={() => stepAge(1)} pw={pistonBox.pw} travel={pistonBox.travel} />
      </div>

      <div className="absolute top-[184px] left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-[50] text-center pointer-events-none">
        <motion.h2 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl md:text-3xl font-title font-bold text-amber-50/90 mb-2 tracking-wide shadow-black drop-shadow-lg"
        >
          {question.title}
        </motion.h2>
        <p className="mb-3 font-sans text-base text-amber-100 [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]">
          {picked ? '레버를 돌려 나이를 바꿀 수 있어요' : '레버를 잡고 좌우로 돌려 나이를 고르세요'}
        </p>
      </div>

      {/* 배경 레버: 조명, 증기, 기관, 전구 점멸 (전신기 컨테이너 위, 레버 자리만 눌린다) */}
      {/* 그림 층은 레버 아래(레버가 버튼 위로 지나간다), 누르는 층은 레버 위에 둬서 버튼이 레버 그림자 뒤에 막히지 않게 한다 */}
      <div className="pointer-events-none absolute inset-0 z-[19]">
        <RoomControls mode="visual" level={lightLevel} hold={steamHold} engine={engineFast} flicker={bulbFlicker} onPull={pullLever} />
      </div>

      {/* 캔버스 수증기: 제어판 버튼과 승선 장치 위로 피어오른다 (인물 자리는 비워서 얼굴을 가리지 않는다) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[22]"
        style={{
          WebkitMaskImage: 'radial-gradient(ellipse 22% 40% at 78% 64%, transparent 50%, #000 100%)',
          maskImage: 'radial-gradient(ellipse 22% 40% at 78% 64%, transparent 50%, #000 100%)',
        }}
      >
        <SteamField burstRef={steamBurst} reduced={!!reduceMotion} />
      </div>
      <div className="pointer-events-none absolute inset-0 z-[21]">
        <RoomControls mode="hit" level={lightLevel} hold={steamHold} engine={engineFast} flicker={bulbFlicker} onPull={pullLever} confirm={{ onClick: handleConfirm, disabled: !picked || confirming, ready: picked }} />
      </div>

      {/* TELEGRAPH CONTAINER */}
      <div className="relative w-full max-w-[600px] h-[500px] mt-24 z-[20] flex justify-center items-center">
        
        {/* Rear Base Image (rbase) */}
        <div 
          className={`absolute z-[50] pointer-events-none transition-opacity ${isEditMode ? 'opacity-40' : 'opacity-100'}`}
          style={{
            transform: `translate(${config.rbase.x}px, ${config.rbase.y}px) scale(${config.rbase.scale})`
          }}
        >
          <img src="/telegraph/rbase.webp" alt="Telegraph Rear Base" className="w-[500px] md:w-[600px] h-auto drop-shadow-2xl" onError={(e) => { e.currentTarget.style.opacity = '0.5'; }} draggable={false} />
        </div>

        {/* Click-to-Snap Area (z-25, behind the lever but clickable) */}
        <div 
          className="absolute inset-0 z-[25] pointer-events-auto cursor-pointer rounded-full"
          role="slider"
          aria-label="나이 선택 레버"
          aria-valuemin={0}
          aria-valuemax={numOptions - 1}
          aria-valuenow={picked ? activeIndex : undefined}
          aria-valuetext={activeOption ? activeOption.label : '선택 전'}
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
          <img src="/telegraph/base.webp" alt="Telegraph Base" className="w-[500px] md:w-[600px] h-auto drop-shadow-2xl pointer-events-none" onError={(e) => { e.currentTarget.style.opacity = '0.5'; }} draggable={false} />
        </div>

        {/* Pointer Arrow Image (Optional) */}
        <motion.div 
          className="absolute z-[40] pointer-events-none"
          style={{
            transformOrigin: `${config.arrow.originX}% ${config.arrow.originY}%`,
            x: config.arrow.x,
            y: config.arrow.y,
            scale: config.arrow.scale,
            rotate: needleAngle
          }}
        >
          <img src="/telegraph/arrow.webp" alt="Telegraph Arrow" className="w-[65px] md:w-[80px] h-auto drop-shadow-lg" onError={(e) => { e.currentTarget.style.display = 'none'; }} draggable={false} />
          
          {isEditMode && (
            <div 
              className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(255,0,0,0.8)] z-50"
              style={{
                left: `${config.arrow.originX}%`,
                top: `${config.arrow.originY}%`,
                transform: 'translate(-50%, -50%)'
              }}
              title="Arrow Pivot"
            />
          )}
        </motion.div>

        {/* Draggable Lever Container */}
        <div className="absolute inset-0 z-[30] flex justify-center items-center pointer-events-none">
          {/* Lever Visual (rotates) */}
          <motion.div 
            className="absolute pointer-events-none z-[30]"
            style={{
              transformOrigin: `${config.lever.originX}% ${config.lever.originY}%`,
              rotate: smoothAngle,
              x: config.lever.x,
              y: config.lever.y,
              scale: config.lever.scale
            }}
          >
            {/* 처음에는 손잡이 뒤에서 은은한 후광이 숨 쉬며 잡을 곳을 알려 준다 (레버를 만지면 서서히 꺼진다) */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute rounded-full"
              style={{
                left: '50%',
                top: `calc(50% + ${config.hitArea.y}px)`,
                width: 62,
                height: 62,
                x: '-50%',
                y: '-50%',
                zIndex: -1,
                background: 'radial-gradient(circle, rgba(255,222,150,0.85) 0%, rgba(255,176,70,0.42) 38%, rgba(255,150,40,0) 72%)',
                mixBlendMode: 'screen',
              }}
              initial={false}
              animate={picked || confirming ? { opacity: 0, scale: 1.4 } : { opacity: [0.5, 1, 0.5], scale: [0.92, 1.14, 0.92] }}
              transition={picked || confirming ? { duration: 0.6 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <img src="/telegraph/lever.webp" alt="Telegraph Lever" className="w-[100px] md:w-[120px] h-auto drop-shadow-2xl" onError={(e) => { 
              e.currentTarget.style.display = 'none'; 
            }} draggable={false} />
            
            {isEditMode && (
              <div 
                className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(59,130,246,0.8)] z-[60]"
                style={{
                  left: `${config.lever.originX}%`,
                  top: `${config.lever.originY}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                title="Lever Pivot"
              />
            )}
            
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
            >
            </div>
            
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
              <img src="/telegraph/lever.webp" className="w-[100px] md:w-[120px] h-auto opacity-0" alt="hidden" />
              
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

      {/* 확정 연출: 전보가 화면 아래 밖에서 한 줄씩 끊어 가며 밀려 올라온다 */}
      <AnimatePresence>
        {confirming && activeOption && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] flex justify-center">
            <div className="relative" style={{ width: 'min(70vw, 280px)', height: 0 }}>
              <motion.div
                className="absolute top-0"
                style={{ aspectRatio: '510 / 1035', height: 'min(64vh, 560px)', left: '50%', x: '-50%' }}
                initial={{ y: '0%' }}
                animate={{ y: reduceMotion ? '-94%' : PRINT_Y }}
                transition={reduceMotion ? { duration: 0.2 } : { duration: PRINT_DUR, times: PRINT_TIMES, ease: 'easeOut' }}
              >
                <div
                  className="relative h-full w-full text-center"
                  style={{
                    backgroundImage: "url('/ui/age_telegram_paper.webp')",
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    padding: '17% 11% 20%',
                    filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.55))',
                  }}
                >
                  <div className="font-display text-[10px] font-semibold leading-snug tracking-[0.18em] text-[#5a4524]">WHITE STAR LINE<br />TELEGRAM</div>
                  <div className="mx-auto my-3 h-px w-3/4 bg-[#5a4524]/50" />
                  {[
                    'PASSENGER AGE RECORDED',
                    exactAge === 0 ? '0세 (갓난아기)' : `${ageLabel}`,
                    'STOP  CONFIRMED  STOP',
                  ].map((line, i) => (
                    <motion.div
                      key={line}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: reduceMotion ? 0 : PRINT_DUR * (0.55 + i * 0.14), duration: 0.2 }}
                      className={i === 1 ? 'my-2 font-title text-2xl font-bold text-[#2a1708]' : 'font-mono text-[11px] leading-snug tracking-[0.08em] text-[#4a3a1c]'}
                    >
                      {line}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 확정 후 암전 */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[80] bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduceMotion ? 0 : PRINT_DUR + 1.0, duration: reduceMotion ? 0.1 : 0.45 }}
          />
        )}
      </AnimatePresence>

      {/* DEBUG PANEL TOGGLE */}
      {!isEditMode && process.env.NODE_ENV !== 'production' && (
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
        <div className="absolute bottom-4 right-4 bg-slate-900/30 text-white p-4 z-[100] border border-slate-700/50 rounded shadow-2xl flex flex-col gap-3 font-mono text-[10px] w-64 backdrop-blur-md pointer-events-auto h-[60vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 mb-2">
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
            <div className="font-bold text-amber-200 mb-1">rbase.webp</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-1000" max="1000" value={config.rbase.x} onChange={e => setConfig({...config, rbase: {...config.rbase, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.rbase.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-1000" max="1000" value={config.rbase.y} onChange={e => setConfig({...config, rbase: {...config.rbase, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.rbase.y}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Scale</span><input type="range" min="0.1" max="10" step="0.1" value={config.rbase.scale} onChange={e => setConfig({...config, rbase: {...config.rbase, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.rbase.scale}</span></div>
          </div>

          {/* Base Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">base.webp</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-1000" max="1000" value={config.base.x} onChange={e => setConfig({...config, base: {...config.base, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.base.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-1000" max="1000" value={config.base.y} onChange={e => setConfig({...config, base: {...config.base, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.base.y}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Scale</span><input type="range" min="0.1" max="10" step="0.1" value={config.base.scale} onChange={e => setConfig({...config, base: {...config.base, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.base.scale}</span></div>
          </div>

          {/* Lever Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">lever.webp</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-1000" max="1000" value={config.lever.x} onChange={e => setConfig({...config, lever: {...config.lever, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-1000" max="1000" value={config.lever.y} onChange={e => setConfig({...config, lever: {...config.lever, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.y}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Scale</span><input type="range" min="0.1" max="10" step="0.1" value={config.lever.scale} onChange={e => setConfig({...config, lever: {...config.lever, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.scale}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Pivot X</span><input type="range" min="0" max="200" value={config.lever.originX} onChange={e => setConfig({...config, lever: {...config.lever, originX: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.originX}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Pivot Y</span><input type="range" min="0" max="200" value={config.lever.originY} onChange={e => setConfig({...config, lever: {...config.lever, originY: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.originY}</span></div>
            <div className="flex gap-2 items-center"><span className="w-8">Range</span><input type="range" min="30" max="150" value={config.lever.maxAngle} onChange={e => setConfig({...config, lever: {...config.lever, maxAngle: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.lever.maxAngle}</span></div>
          </div>

          {/* Arrow Controls */}
          <div className="bg-slate-800/80 p-2 rounded mb-2">
            <div className="font-bold text-amber-200 mb-1">arrow.webp</div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">X</span><input type="range" min="-1000" max="1000" value={config.arrow.x} onChange={e => setConfig({...config, arrow: {...config.arrow, x: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.arrow.x}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Y</span><input type="range" min="-1000" max="1000" value={config.arrow.y} onChange={e => setConfig({...config, arrow: {...config.arrow, y: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.arrow.y}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Scale</span><input type="range" min="0.1" max="10" step="0.1" value={config.arrow.scale} onChange={e => setConfig({...config, arrow: {...config.arrow, scale: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.arrow.scale}</span></div>
            <div className="flex gap-2 mb-1 items-center"><span className="w-8">Pivot X</span><input type="range" min="0" max="200" value={config.arrow.originX} onChange={e => setConfig({...config, arrow: {...config.arrow, originX: Number(e.target.value)}})} className="flex-1" /><span className="w-8 text-right">{config.arrow.originX}</span></div>
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
