'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useAnimationFrame, animate, PanInfo } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Question } from '@/data/questions';
import ProgressLine from '@/components/ui/ProgressLine';
import ClassicButton from '@/components/ui/ClassicButton';
import FacilityWheel from '@/components/question/FacilityWheel';
import DuckPurser, { PurserPeek, PURSER_DUCKS, purserGreeting, purserLast, purserLine, purserPoke, purserIntro, purserIntroPose, purserBroke, purserBusted, PURSER_HAIR_CLEAR, purserMonologueReset, purserWheelLine, purserCandy, purserMarkFacility, purserLineMs, purserTip, purserRefuseTip, PURSER_RETURN, type PurserPose } from '@/components/question/DuckPurser';
import { useQuizStore } from '@/store/quizStore';
import DeathCard from '@/components/ui/DeathCard';
import LightningBolt from '@/components/ui/LightningBolt';
import DodgeDuck from '@/components/question/DodgeDuck';
import CasinoModal, { BULLSEYE_MULT, BULLSEYE_TOL, GAMBLE_TIERS, REVEAL_MS, type GambleTierId } from '@/components/question/money/CasinoModal';
import { INTERACTION_LINES, trackMorse, zapPaths, insideCircle, nearRect, famousBeat, DOT_MAX_MS, type MorseMark, type MorseType } from '@/components/question/money/interactions';
import { BubblePops, WaterZap, type BubblePop, type WaterZapFx } from '@/components/question/money/InteractionOverlays';
import { playCollapse } from '@/lib/collapse';
import { restartJourney } from '@/lib/session';
import { unlock, ducksAllFoundUntold, markDucksTold } from '@/engine/achievements';
import { buildPersona } from '@/engine/persona';
import { purserFacilityLine } from '@/data/variants';
import { playGunshot, playStamp, playPop, playShipHorn, playThunder } from '@/lib/synth';

interface MoneyMinigameViewProps {
  question: Question;
  onAnswer: (value: string, extra?: Record<string, unknown>) => void;
  extras?: Record<string, unknown>;
  answers?: Record<string, unknown>;
  onBack: () => void;
}

/** 이 장수 이상의 지폐를 가지면 배경이 스위트룸으로 바뀐다 */
const SUITE_BILLS = 870;
const SUITE_BG = '/bg/suite.webp';
const FACILITIES = [
  { id: 'gamble', name: '선상 도박', img: '/spend/icon_gamble.webp', color: 'bg-red-900/40 border-red-500/50' },
  { id: 'barber', name: '이발소', img: '/spend/icon_barber.webp', color: 'bg-orange-900/40 border-orange-500/50' },
  { id: 'massage', name: '전기 마사지', img: '/spend/icon_massage.webp', color: 'bg-yellow-900/40 border-yellow-500/50' },
  { id: 'telegraph', name: '무선 전신', img: '/spend/icon_telegraph.webp', color: 'bg-slate-900/40 border-slate-500/50' },
  { id: 'bath', name: '목욕탕', img: '/spend/icon_bath.webp', color: 'bg-teal-900/40 border-teal-500/50' },
  { id: 'pool', name: '수영장', img: '/spend/icon_pool.webp', color: 'bg-blue-900/40 border-blue-500/50' },
  { id: 'souvenir', name: '기념품 구입', img: '/spend/icon_souvenir.webp', color: 'bg-pink-900/40 border-pink-500/50' },
];

/** 선상 도박장 연승 업적(hot-streak)을 주는 연승 수 */
const HOT_STREAK_GOAL = 5;
const TICK_AT = [300, 700, 1150, 1650, 2200, 2800, 3450, 4150, 4800];

/**
 * 도박에 이겼을 때 화면 아래에서 솟아올라 흩날리는 동전과 지폐. 딴 지폐 수(net)가 많을수록, 정확히 맞혔을 때(exact)는 더 많이 쏟아진다.
 * 동전은 뒤집히며 돌고, 지폐는 천천히 흔들리며 떨어진다.
 */
function WinShower({ net, exact }: { net: number; exact: boolean }) {
  const parts = useMemo(() => {
    const coins = Math.min(80, 10 + net * 7 + (exact ? 34 : 0));
    const bills = Math.min(16, Math.max(2, net) + (exact ? 4 : 0));
    const mk = (kind: 'coin' | 'bill', i: number) => {
      const side = (Math.random() - 0.5) * 2;
      return {
        id: `${kind}-${i}`,
        kind,
        dx: side * (kind === 'coin' ? 46 : 38) + (Math.random() - 0.5) * 8, // vw
        apex: (kind === 'coin' ? 26 : 20) + Math.random() * (kind === 'coin' ? 34 : 24), // vh
        fall: 52 + Math.random() * 18,
        size: kind === 'coin' ? 30 + Math.random() * 26 : 92 + Math.random() * 40,
        delay: Math.random() * (exact ? 0.9 : 0.6),
        dur: 1.9 + Math.random() * 1.3,
        spin: (Math.random() < 0.5 ? -1 : 1) * (kind === 'coin' ? 540 : 160 + Math.random() * 120),
        flip: 0.25 + Math.random() * 0.3,
      };
    };
    return [
      ...Array.from({ length: coins }, (_, i) => mk('coin', i)),
      ...Array.from({ length: bills }, (_, i) => mk('bill', i)),
    ];
  }, [net, exact]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[500] overflow-hidden">
      {parts.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{ left: '50%', top: '66%', width: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2, zIndex: p.kind === 'bill' ? 1 : 2 }}
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.4 }}
          animate={{
            opacity: [0, 1, 1, 1, 0],
            x: [0, `${p.dx * 0.55}vw`, `${p.dx}vw`],
            y: [0, `${-p.apex}vh`, `${p.fall}vh`],
            rotate: p.kind === 'bill' ? [0, p.spin * 0.5, p.spin] : [0, p.spin * 0.6, p.spin],
            scale: [0.4, 1, 1],
          }}
          transition={{
            delay: p.delay,
            duration: p.dur,
            times: [0, 0.42, 1],
            ease: ['easeOut', 'easeIn'],
            opacity: { delay: p.delay, duration: p.dur, times: [0, 0.08, 0.5, 0.82, 1] },
          }}
        >
          {p.kind === 'coin' ? (
            <motion.img
              src="/spend/coin.webp"
              alt=""
              draggable={false}
              className="block w-full drop-shadow-[0_3px_5px_rgba(0,0,0,0.55)]"
              animate={{ scaleX: [1, -1, 1] }}
              transition={{ duration: p.flip, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <img src="/spend/bill.webp" alt="" draggable={false} className="block w-full drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)]" />
          )}
        </motion.div>
      ))}
    </div>,
    document.body,
  );
}

export default function MoneyMinigameView({ question, onAnswer, onBack, extras, answers }: MoneyMinigameViewProps) {
  const persona = buildPersona(answers, extras);
  const isChild = persona.band === 'baby' || persona.band === 'kid'; // 11세 이하: 칼도, 총도, 죽는 장면도 없다
  // Q1 에서 고른 정확한 나이. 기록이 없으면(옛 세션 등) 고른 나이 구간으로 짐작한다
  const ageGroupKey = typeof answers?.ageGroup === 'string' ? answers.ageGroup : null;
  const playerAge = typeof extras?.age === 'number' ? extras.age : ageGroupKey === '0-9' ? 9 : ageGroupKey === '10-17' ? 17 : null;
  // State
  const [facIndex, setFacIndex] = useState(0); // 회전 선반에서 가운데에 온 시설
  const kidGambleTries = useRef(0); // 아이가 도박장에 지폐를 놓으려 한 횟수
  const [gambleBanned, setGambleBanned] = useState(false); // 아이가 계속 시도해 사무장이 도박장을 치워 버렸다
  const facilities = gambleBanned ? FACILITIES.filter((f) => f.id !== 'gamble') : FACILITIES;
  const wheelSpins = useRef(0); // 선반을 쉬지 않고 이어서 돌린 횟수 (사무장이 지칠 때 한마디)
  const wheelLastAt = useRef(0);
  const candyGiven = useRef(0); // 사무장에게 건넨 사탕 수 (아이 전용)
  const lostGamble = useRef(false); // 도박장에서 한 번이라도 잃었는가 (사무장이 다시 온 손님에게 발뺌한다)
  const [billsAvailable, setBillsAvailable] = useState(5);
  const [duckGiven, setDuckGiven] = useState(0); // 오리 사무장에게 건넨 지폐 수
  const [duckReturned, setDuckReturned] = useState(-1); // 돈을 돌려준 뒤 또 내밀어 거절당한 횟수 (-1: 아직 돌려주지 않음)
  const [billsInBag, setBillsInBag] = useState(0);
  // 손에 든 지폐가 870장 이상이면 '스위트룸으로 옮기기' 버튼이 나오고, 870장을 내면 배경이 파를러 스위트룸으로 바뀐다 (1912년 파를러 스위트 편도 870파운드). 그림 /bg/suite.webp 가 없으면 버튼도 없다
  const [suiteImgOk, setSuiteImgOk] = useState(false);
  const [suiteBought, setSuiteBought] = useState(false); // 870장을 내고 스위트룸으로 옮긴 뒤에는 계속 스위트룸
  const suiteOfferedRef = useRef(false);
  const suiteOn = suiteImgOk && suiteBought;
  const canBuySuite = suiteImgOk && !suiteBought && billsAvailable >= SUITE_BILLS;
  useEffect(() => {
    const img = new Image();
    img.onload = () => setSuiteImgOk(true);
    img.src = SUITE_BG;
  }, []);
  // 반향(밤 장면)에서 쓰는 기록: 가방에 실제로 들어간 기념품, 도박 시도 횟수, 시설별 지출
  const [bagItems, setBagItems] = useState<string[]>([]);
  const [gambleCount, setGambleCount] = useState(0);
  const [spentOn, setSpentOn] = useState<Record<string, number>>({});
  const [totalEarnedBills, setTotalEarnedBills] = useState(5);
  
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [hasGiantBubble, setHasGiantBubble] = useState(false);
  const [hasWater, setHasWater] = useState(false);
  const [rippleOrigin, setRippleOrigin] = useState<{ x: number, y: number } | null>(null);
  const [isGamblingMode, setIsGamblingMode] = useState(false);
  const [gamblingGuess, setGamblingGuess] = useState(515); // 480~550
  const [gamblingState, setGamblingState] = useState<'idle' | 'animating' | 'result'>('idle');
  const [targetDistance, setTargetDistance] = useState(0);
  const [gamblingResult, setGamblingResult] = useState<'win' | 'lose' | 'exact' | null>(null);
  const [gamblingTier, setGamblingTier] = useState<GambleTierId>('mid');
  const [swordHit, setSwordHit] = useState(0); // 칼 꽂는 연출을 다시 재생하기 위한 번호
  const [gamblingStreak, setGamblingStreak] = useState(0); // 연승 횟수
  const [winFx, setWinFx] = useState<{ key: number; net: number; exact: boolean } | null>(null); // 당첨금 연출
  const [gamblingGain, setGamblingGain] = useState(0); // 이번 판 순이익
  const [shipPath, setShipPath] = useState<number[]>([]); // 배가 오가는 지점(해리)
  const gambleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Debug positioning state
  const [offsets, setOffsets] = useState<Record<string, { x: number, y: number }>>({
    "bath": { "x": -16, "y": 0 },
    "pool": { "x": -4, "y": 0 },
    "massage": { "x": 9, "y": 1 },
    "telegraph": { "x": 21, "y": 0 },
    "gamble": { "x": -10, "y": -9 },
    "barber": { "x": 2, "y": -10 },
    "souvenir": { "x": 15, "y": -9 }
  });
  const [globalSpacing, setGlobalSpacing] = useState({ x: -18, y: -34 });
  const [duckOffset, setDuckOffset] = useState({ y: 60 });
  const showDebug = useQuizStore(state => state.showDebug);
  const runIndex = useQuizStore(state => state.runIndex);
  const [debugHitRadius] = useState(0.19);
  const [debugHitX] = useState(53);
  const [debugHitY] = useState(39);
  const [lightningStrikes, setLightningStrikes] = useState<{ id: number, x: number, y: number }[]>([]);
  const [duckSplashes, setDuckSplashes] = useState<number[]>([]);
  const [shards, setShards] = useState<{ id: number, x: number, y: number, clip: string, vx: number, vy: number }[]>([]);

  // Hover feedback state
  const [hoveredDropZone, setHoveredDropZone] = useState<string | null>(null);

  const [isDuckDamaged, setIsDuckDamaged] = useState(false);
  const [isBubbleYellow, setIsBubbleYellow] = useState(false);
  // 시설끼리의 상호작용: 터진 거품 자리, 물에 친 번개, 전신 신호 기록
  const [bubblePops, setBubblePops] = useState<BubblePop[]>([]);
  const [waterZap, setWaterZap] = useState<WaterZapFx | null>(null);
  const sosHistory = useRef<MorseMark[]>([]);
  const cutNoted = useRef(false);
  const [spot, setSpot] = useState(false); // 합선 중 수신 오리에게 스포트라이트
  const [shorting, setShorting] = useState(false); // 전신기 합선 중
  const [charged, setCharged] = useState<Record<number, boolean>>({}); // 번개를 맞아 대전된 칼
  const shortCool = useRef(0);
  const beatIdx = useRef(0); // 다음 합선에서 연주할 유명한 박자
  const [isDraggingDuck, setIsDraggingDuck] = useState(false);
  const [hasLightningAbility, setHasLightningAbility] = useState(false);
  const [hasTelegraph, setHasTelegraph] = useState(false);
  const [colleagueIn, setColleagueIn] = useState(false); // 사무장이 동료를 소개한 뒤에야 동료 오리가 나온다
  const duckDragY = useMotionValue(0);

  // Morse Debug State
  const [morseOffset, setMorseOffset] = useState({ x: 1, y: -99 });
  const [morseFlip, setMorseFlip] = useState(false);
  const [morseSignalOffset, setMorseSignalOffset] = useState({ x: -366, y: -80 });

  // Morse Code State
  const [isMorsePressed, setIsMorsePressed] = useState(false);
  const [morseSignals, setMorseSignals] = useState<{ id: number, type: 'dot' | 'dash' }[]>([]);
  const morsePressStartTime = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  // Barber & Souvenir VFX State
  const [hasScissors, setHasScissors] = useState(false);
  const [hairs, setHairs] = useState<{ id: number, xPercent: number, width: number, height: number, cutY: number, src: string, isMagic: boolean }[]>([]);
  const [fallingHairs, setFallingHairs] = useState<{ id: number, xPercent: number, width: number, height: number, cutY: number, originalHeight: number, src: string }[]>([]);
  const [souvenirItems, setSouvenirItems] = useState<{ id: number, img: string, targetX: number, targetY: number, rotation: number, isHit?: boolean, isThrown?: boolean, isStuck?: boolean, isFloating?: boolean, startX?: number, startY?: number, stuckX?: number, stuckY?: number }[]>([]);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isScissorClosed, setIsScissorClosed] = useState(false);
  const [targetHit, setTargetHit] = useState(false);
  const [isHairInWater, setIsHairInWater] = useState(false);
  const [morseExplosions, setMorseExplosions] = useState<{ id: number, x: number, y: number }[]>([]);
  
  // Target Zombification State

  // Gamble UI Debug State



  useEffect(() => {
    if (!hasScissors) return;

    const performCut = (hitX: number, hitY: number) => {
      setHairs(prev => {
        if (prev.length === 0) return prev;
        
        let anyCut = false;
        const newFallingHairs: any[] = [];
        
        const newHairs = prev.map(hair => {
          const pxX = (hair.xPercent / 100) * window.innerWidth;
          
          if (hitX >= pxX && hitX <= pxX + hair.width && hitY >= 0 && hitY < hair.cutY) {
            anyCut = true;
            newFallingHairs.push({
              id: Date.now() + Math.random(),
              xPercent: hair.xPercent,
              width: hair.width,
              height: hair.cutY - hitY,
              cutY: hitY,
              originalHeight: hair.height,
              src: hair.src
            });
            return { ...hair, cutY: hitY };
          }
          return hair;
        });
        
        if (anyCut) {
          setTimeout(() => setIsHairInWater(true), 600); // Wait for the drop to finish
          setFallingHairs(f => {
            const next = [...f, ...newFallingHairs];
            return next.slice(-10); // Keep only the recent 10
          });
        }
        
        return newHairs;
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDown = (e: MouseEvent) => {
      setIsScissorClosed(true);
      performCut(e.clientX - 53, e.clientY);
      cutOthers(e.clientX - 53, e.clientY);
    };

    const handleMouseUp = () => {
      setIsScissorClosed(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [hasScissors]);

  // Magic Hair Regrowth Logic
  useEffect(() => {
    if (!hasScissors) return;
    
    let animationFrameId: number;
    const growHairs = () => {
      setHairs(prev => {
        let needsUpdate = false;
        const next = prev.map(hair => {
          if (hair.isMagic && hair.cutY < hair.height) {
            needsUpdate = true;
            return { ...hair, cutY: Math.min(hair.height, hair.cutY + 3) }; // 3px per frame regrowth
          }
          return hair;
        });
        return needsUpdate ? next : prev;
      });
      animationFrameId = requestAnimationFrame(growHairs);
    };
    
    animationFrameId = requestAnimationFrame(growHairs);
    return () => cancelAnimationFrame(animationFrameId);
  }, [hasScissors]);



  // Init Audio Context for Beep
  const playBeep = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start();
    oscillatorRef.current = osc;
  };

  const stopBeep = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }
  };

  const handleMorsePointerDown = () => {
    setIsMorsePressed(true);
    morsePressStartTime.current = Date.now();
    playBeep();
  };

  const handleMorsePointerUp = () => {
    if (morsePressStartTime.current === 0) return; // Prevent if didn't press down
    
    setIsMorsePressed(false);
    stopBeep();
    
    const duration = Date.now() - morsePressStartTime.current;
    morsePressStartTime.current = 0; // Reset
    
    const type: MorseType = duration < DOT_MAX_MS ? 'dot' : 'dash';
    // 가장 유명한 신호 SOS(점 셋, 선 셋, 점 셋)를 6초 안에 보내면 사무장이 알아챈다 (money/interactions)
    const tracked = trackMorse(sosHistory.current, type, Date.now());
    sosHistory.current = tracked.history;
    if (tracked.sos) onSOS();
    const newSignal = { id: Date.now() + Math.random(), type };
    
    setMorseSignals(prev => [...prev, newSignal]);
    
    // Fallback: auto remove signal after it crosses the screen (if it missed the target)
    setTimeout(() => {
      setMorseSignals(prev => prev.filter(s => s.id !== newSignal.id));
    }, 3000);
  };
  
  // Refs for collision detection
  const dropZoneRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const duckRef = useRef<HTMLImageElement>(null);
  const duckFall = useRef<{ stop: () => void } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // ── 시설끼리의 상호작용 (규칙과 문구: money/interactions.ts, 화면 효과: money/InteractionOverlays.tsx) ──
  const say = ([text, pose, ms]: readonly [string, PurserPose, number]) => purserSay(text, pose, ms);
  // 목욕탕 거품은 가위, 던진 칼과 찻잔으로 터진다. 수영장 물에 번개를 치면 물 전체가 감전된다.
  // 전신기로 SOS(··· −−− ···)를 보내면 오리 사무장이 알아챈다. 가위는 날아가는 전신 신호도 자른다. 기념품은 물 위에 놓으면 뜬다.
  const popBubble = (): boolean => {
    const r = bubbleRef.current?.getBoundingClientRect();
    if (!r) return false;
    const id = Date.now() + Math.random();
    setBubblePops(p => [...p, { id, x: r.left + r.width / 2, y: r.top + r.height / 2 }]);
    setTimeout(() => setBubblePops(p => p.filter(b => b.id !== id)), 1800);
    setHasGiantBubble(false);
    setIsBubbleYellow(false);
    playPop();
    say(INTERACTION_LINES.bubblePop);
    return true;
  };
  const zapWater = (x: number) => {
    const w = window.innerWidth; const h = window.innerHeight * 0.15;
    const id = Date.now();
    // 번개가 닿은 자리에서 양쪽으로 수면을 따라 갈라져 퍼진다
    setWaterZap({ id, paths: zapPaths(x, w, h), w, h });
    setTimeout(() => setWaterZap(z => (z && z.id === id ? null : z)), 1500);
    playSound('electric');
    const dr = duckRef.current?.getBoundingClientRect();
    if (dr && dr.bottom > window.innerHeight * 0.8) setIsDuckDamaged(true); // 물에 떠 있는 고무 오리도 감전
    say(INTERACTION_LINES.waterZap);
  };
  const cutOthers = (x: number, y: number) => {
    // 가위: 거품을 찌르면 터지고, 날아가는 전신 신호는 잘린다
    const b = bubbleRef.current?.getBoundingClientRect();
    if (b && insideCircle(x, y, b)) popBubble();
    document.querySelectorAll('.morse-signal').forEach(sig => {
      const r = sig.getBoundingClientRect();
      if (nearRect(x, y, r, 24)) {
        const id = Number(sig.getAttribute('data-id'));
        if (!id || sig.hasAttribute('data-hit')) return;
        sig.setAttribute('data-hit', 'true');
        const hid = Date.now() + Math.random();
        setMorseExplosions(prev => [...prev, { id: hid, x: r.left + r.width / 2, y: r.top + r.height / 2 }]);
        setTimeout(() => setMorseExplosions(prev => prev.filter(e => e.id !== hid)), 1000);
        setMorseSignals(prev => prev.filter(s => s.id !== id));
        if (!cutNoted.current) { cutNoted.current = true; say(INTERACTION_LINES.signalCut); }
      }
    });
  };
  const emitSignal = (type: MorseType) => {
    const sig = { id: Date.now() + Math.random(), type };
    setMorseSignals(prev => [...prev, sig]);
    setTimeout(() => setMorseSignals(prev => prev.filter(x => x.id !== sig.id)), 3000);
  };
  // 마사지 × 전신: 번개가 전신기로 튀면 합선이 난다. 3초 동안 전신기가 혼자 신호를 쏟아 내고, 수신 오리에게 스포트라이트가 비친다
  const shortCircuit = () => {
    const now = Date.now();
    if (now - shortCool.current < 6000) return;
    const beat = famousBeat(beatIdx.current++);
    shortCool.current = now + Math.max(0, beat.span + 2200 - 6000); // 박자와 조명이 다 끝나기 전에는 다시 시작하지 않는다
    setShorting(true);
    setSpot(true);
    say(INTERACTION_LINES.shortCircuit);
    for (const [at, kind] of beat.notes) {
      setTimeout(() => {
        emitSignal(kind);
        // 전신기에서 불꽃이 튄다
        const r = document.getElementById('morse-machine-image')?.getBoundingClientRect();
        if (r) {
          const hid = Date.now() + Math.random();
          setMorseExplosions(prev => [...prev, { id: hid, x: r.left + r.width * (0.25 + Math.random() * 0.6), y: r.top + r.height * (0.15 + Math.random() * 0.5) }]);
          setTimeout(() => setMorseExplosions(prev => prev.filter(e => e.id !== hid)), 700);
        }
      }, at);
    }
    setTimeout(() => setShorting(false), beat.span + 700);
    setTimeout(() => setSpot(false), beat.span + 2000); // 박자가 끝난 뒤에도 잠깐 조명이 남는다
  };
  // 마사지 × 기념품: 번개를 맞은 찻잔은 깨지고, 칼은 번개를 먹는다
  const zapSouvenir = (id: number) => {
    const it = souvenirItems.find(i => i.id === id);
    if (!it || it.isStuck) return;
    if (it.img.includes('shop2')) {
      shatterTeacup(it.targetX, it.targetY, id);
      say(INTERACTION_LINES.cupShatter);
    } else if (it.img.includes('shop1')) {
      setCharged(c => ({ ...c, [id]: true }));
      setTimeout(() => setCharged(c => { const n = { ...c }; delete n[id]; return n; }), 3200);
      say(INTERACTION_LINES.knifeCharged);
    }
  };
  const onSOS = () => {
    playShipHorn();
    say(INTERACTION_LINES.sos);
    unlock('sos');
  };
  
  // Gambling constants
  const ACTUAL_DISTANCE = 1450; // Miles traveled before crash approx
  const TOLERANCE = 100;

  // Sound effects (placeholders)
  const playSound = (type: string) => {
    // In a real app, use Howler.js or native Audio
    console.log(`Playing sound: ${type}`);
  };

  const checkCollision = (x: number, y: number) => {
    for (const [id, ref] of Object.entries(dropZoneRefs.current)) {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return id;
        }
      }
    }
    return null;
  };

  // 지폐를 오리 사무장에게 건넬 수 있다 (그림 위에 놓으면 팁). 시설 칸이 우선이다
  const billTarget = (x: number, y: number) => {
    const id = checkCollision(x, y);
    if (id) return id;
    const r = document.querySelector('[data-duck]')?.getBoundingClientRect();
    return r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? 'duck' : null;
  };

  const handleDrag = (event: any, info: any) => {
    const hoveredId = billTarget(info.point.x, info.point.y);
    setHoveredDropZone(hoveredId);
  };

  const handleSouvenirDrag = (e: any, info: PanInfo) => {
    const id = checkCollision(info.point.x, info.point.y);
    setHoveredDropZone(id === 'mybag' ? id : null);
  };

  const shatterTeacup = (x: number, y: number, itemId: number) => {
    playSound('glass');
    setTargetHit(true);
    setTimeout(() => setTargetHit(false), 500);

    const newShards = [
      { id: Date.now() + 1 + Math.random(), x, y, clip: 'polygon(0 0, 50% 20%, 30% 50%, 0 30%)', vx: -150, vy: -100 },
      { id: Date.now() + 2 + Math.random(), x, y, clip: 'polygon(50% 20%, 100% 0, 100% 40%, 60% 60%)', vx: 150, vy: -150 },
      { id: Date.now() + 3 + Math.random(), x, y, clip: 'polygon(30% 50%, 60% 60%, 80% 100%, 10% 90%)', vx: -80, vy: 150 },
      { id: Date.now() + 4 + Math.random(), x, y, clip: 'polygon(100% 40%, 100% 100%, 80% 100%, 60% 60%)', vx: 180, vy: 100 },
      { id: Date.now() + 5 + Math.random(), x, y, clip: 'polygon(0 30%, 30% 50%, 10% 90%, 0 100%)', vx: -180, vy: 50 }
    ];
    setShards(prev => [...prev, ...newShards]);
    setSouvenirItems(prev => prev.filter(i => i.id !== itemId));

    setTimeout(() => {
      setShards(prev => prev.filter(s => !newShards.find(ns => ns.id === s.id)));
    }, 1000);
  };

  // 화면 폭(md 이상이면 지폐와 가방을 시설 왼쪽 열에 둔다). 가방 드롭 영역 참조가 하나만 있도록 한 곳에만 그린다.
  const [isMd, setIsMd] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const f = () => setIsMd(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);

  // ── 사용법 시범: 화면에 들어오면 지폐 한 장이 시설로 끌려가는 모습을 먼저 보여 준다 ──
  // 지폐를 직접 끌기 시작하거나 한 장이라도 쓰면 멈춘다. 최대 3번만 보여 준다. 동작 줄이기 설정에서는 보이지 않는다.
  const billStackRef = useRef<HTMLDivElement>(null);
  const [demo, setDemo] = useState<{ sx: number; sy: number; dx: number; dy: number; n: number } | null>(null);
  const demoStopped = useRef(false);
  const facIndexRef = useRef(facIndex);
  facIndexRef.current = facIndex;
  const facilitiesRef = useRef(facilities);
  useEffect(() => { facilitiesRef.current = facilities; }, [facilities]);
  const billsRef = useRef(billsAvailable);
  billsRef.current = billsAvailable;
  const stopDemo = () => { demoStopped.current = true; setDemo(null); };
  useEffect(() => {
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch { /* 무시 */ }
    let loops = 0;
    let timer: ReturnType<typeof setTimeout>;
    const play = () => {
      if (demoStopped.current || billsRef.current < 5 || loops >= 3) { setDemo(null); return; }
      const from = billStackRef.current?.getBoundingClientRect();
      const toEl = dropZoneRefs.current[facilitiesRef.current[Math.min(facIndexRef.current, facilitiesRef.current.length - 1)].id];
      const to = toEl?.getBoundingClientRect();
      if (!from || !to || from.width === 0 || to.width === 0) { timer = setTimeout(play, 900); return; }
      loops += 1;
      const sx = from.left + from.width / 2; const sy = from.top + from.height / 2;
      setDemo({ sx, sy, dx: to.left + to.width / 2 - sx, dy: to.top + to.height / 2 - sy, n: loops });
      timer = setTimeout(() => { setDemo(null); timer = setTimeout(play, 1100); }, 3100);
    };
    timer = setTimeout(play, 2600);
    return () => clearTimeout(timer);
  }, []);

  // ── 오리 이스터에그: 기념품 가게의 칼로 오리 사무장을 두 번 위협하면 ──
  // 첫 번째는 경고(권총이 나온다), 두 번째는 발사. 총에 맞으면 사망 카드 뒤에 처음부터 다시 시작한다.
  const [dead, setDead] = useState(false);
  const knifeThreats = useRef(0);
  const knifeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const THREATS = [
    '…그 칼, 정중히 내려놓으시오. 나는 비상용 장비가 있소. 한 번만 말하겠소.',
    '손님, 그것은 영수증에 포함되지 않소. 내려놓는 편이 건강에 좋소.',
    '제복 안쪽에는 호신용 무기가 있소. 나도 보험은 있소.',
    '나를 찌르지 마시오. 제복이 구겨지면 내 위엄도 구겨지오. 그다음은 당신일 수도 있소.',
  ];
  // 마사지의 번개를 오리 사무장에게 쳤을 때의 위협 (칼과 같은 단계를 밟는다: 경고 → 발사)
  const LIGHTNING_THREATS = [
    '…번개라니. 방금 것은 장부에 적었소. 두 번은 없소.',
    '찌릿하면 정상이오. …내가 맞는 건 정상이 아니오.',
    '오리 전기구이라고 했소? 장난이 지나치오. 한 번만 말하겠소.',
    '내 깃털이 곤두선 건 번개 탓이오. 손님 탓이기도 하오.',
  ];
  const [purserShock, setPurserShock] = useState(0); // 번개를 맞을 때마다 1씩 올라, 사무장이 감전된 모습을 다시 연출한다
  // 아이에게 번개를 쳤을 때: 총도 권총도 없이 꾸짖기만 한다 (몇 번을 해도 같다)
  const CHILD_LIGHTNING_THREATS = [
    '…찌릿했소! 번개는 장난감이 아니오. 한 번만 말하겠소.',
    '깃털이 곤두섰소. 한 번만 더 하면 엄마께 이르겠소.',
    '번개를 사람한테 치면 안 되오. 오리한테도 안 되오.',
    '이건 어른도 놀라는 일이오. …얌전히 있으시오.',
  ];
  const onKnifeAtDuck = (kind: 'knife' | 'lightning' = 'knife') => {
    if (dead) return;
    if (isChild) {
      purserSay(CHILD_LIGHTNING_THREATS[Math.floor(Math.random() * CHILD_LIGHTNING_THREATS.length)], 'refuse', 4800);
      return;
    }
    knifeThreats.current += 1;
    if (knifeTimer.current) clearTimeout(knifeTimer.current);
    if (knifeThreats.current === 1) {
      // 품에서 권총을 꺼내(draw) 겨눈다(aim)
      const pool = kind === 'lightning' ? LIGHTNING_THREATS : THREATS;
      purserSay(pool[Math.floor(Math.random() * pool.length)], 'draw', 5200);
      setTimeout(() => setPurserPose((p) => (p === 'draw' ? 'aim' : p)), 900);
      // 잠시 칼을 거두면 오리도 물러선다
      knifeTimer.current = setTimeout(() => {
        knifeThreats.current = 0;
        purserSay('…방금은 못 본 걸로 하겠소. 장부에도 적지 않겠소.', 'shrug', 4200);
      }, 14000);
    } else {
      playGunshot();
      purserSay('기어코 선을 넘네.', 'fire', 3400);
      if (kind === 'knife') unlock('duck-gun'); // 업적 설명이 "칼로 위협"이라 번개로는 주지 않는다
      // 총에 맞는 순간부터 1인칭으로 털썩 쓰러진 뒤 사망 카드가 이어진다
      // 쏜 직후 총구에서 연기를 내뿜는 모습(smoke)이 쓰러지는 화면에 남는다
      setTimeout(() => { setPurserPose('smoke'); playCollapse().then(() => setDead(true)); }, 420);
    }
  };
  useEffect(() => () => { if (knifeTimer.current) clearTimeout(knifeTimer.current); }, []);
  // 개발 서버에서만: 브라우저 콘솔에서 위협을 시험할 수 있게 한다
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') (window as unknown as { __duck?: unknown }).__duck = { win: (net = 4, exact = false) => setWinFx({ key: Date.now(), net, exact }), threat: () => onKnifeAtDuck(), stamp: () => purserSay('도장 시험이오. 받았소.', 'stamp', 3500), say: (t: string, pose: PurserPose = 'idle') => purserSay(t, pose, 3600), shock: () => setPurserShock((n) => n + 1), vfx: (id: string) => triggerVFX(id), pop: () => popBubble(), zap: (x = 400) => zapWater(x), sos: () => onSOS(), drop: (id: string) => handleDrop(id), bills: (n: number) => setBillsAvailable(n), short: () => shortCircuit(), zapS: () => souvenirItems.forEach(i => zapSouvenir(i.id)) };
  });

  // 칼을 쥐고 있는 동안 빙빙 돈다. 놓으면 가까운 표적(오리 사무장, 과녁)으로 날아간다
  const [heldKnife, setHeldKnife] = useState<number | null>(null);

  const handleSouvenirDragEnd = (e: any, info: PanInfo, itemId: number) => {
    setHeldKnife(null);
    const droppedId = checkCollision(info.point.x, info.point.y);
    setHoveredDropZone(null);
    
    const item = souvenirItems.find(i => i.id === itemId);
    if (!item) return;

    const duckBox = document.querySelector('[data-duck]')?.getBoundingClientRect();
    const onDuck = !!duckBox && info.point.x >= duckBox.left - 20 && info.point.x <= duckBox.right + 20 && info.point.y >= duckBox.top - 20 && info.point.y <= duckBox.bottom + 20;

    // 수영장을 이용한 뒤 물 위에 놓은 기념품은 가라앉지 않고 뜬다
    if (hasWater && !onDuck && info.point.y > window.innerHeight * 0.84) {
      const line = window.innerHeight * 0.9;
      setSouvenirItems(prev => prev.map(i => i.id === itemId ? { ...i, isFloating: true, isThrown: false, targetX: item.targetX + info.offset.x, targetY: item.targetY + info.offset.y + (line - info.point.y) } : i));
      playSound('splash');
      return;
    }

    // 칼과 찻잔을 목욕탕 거품 가까이에서 놓으면 날아가 거품을 터뜨리고 선반으로 돌아온다
    if ((item.img.includes('shop1') || item.img.includes('shop2')) && !onDuck) {
      const br = bubbleRef.current?.getBoundingClientRect();
      const bx = info.point.x; const by = info.point.y;
      if (br && bx >= br.left - 40 && bx <= br.right + 40 && by >= br.top - 40 && by <= br.bottom + 40) {
        const cx = br.left + br.width / 2; const cy = br.top + br.height / 2;
        const baseX = item.targetX + info.offset.x; const baseY = item.targetY + info.offset.y;
        setSouvenirItems(prev => prev.map(i => i.id === itemId ? { ...i, targetX: baseX + (cx - bx), targetY: baseY + (cy - by), rotation: i.rotation + 720, isThrown: true } : i));
        playSound('snap');
        setTimeout(() => popBubble(), 210);
        setTimeout(() => setSouvenirItems(prev => prev.map(i => i.id === itemId ? { ...i, targetX: (Math.random() - 0.5) * 500, targetY: -Math.random() * 300 - 150, isThrown: false } : i)), 1000);
        return;
      }
    }

    // 칼(shop1): 오리 사무장 근처에 놓으면 알아서 날아가 위협이 된다 (속도나 정확한 방향은 보지 않는다)
    if (item.img.includes('shop1')) {
      const px = info.point.x; const py = info.point.y;
      const near = (r: DOMRect | undefined, pad: number) => !!r && px >= r.left - pad && px <= r.right + pad && py >= r.top - pad && py <= r.bottom + pad;
      const duckRect = document.querySelector('[data-duck]')?.getBoundingClientRect();
      const baseX = item.targetX + info.offset.x; const baseY = item.targetY + info.offset.y;
      if (duckRect && near(duckRect, 80)) {
        const cx = duckRect.left + duckRect.width / 2; const cy = duckRect.top + duckRect.height * 0.4;
        setSouvenirItems(prev => prev.map(i => i.id === itemId ? { ...i, targetX: baseX + (cx - px), targetY: baseY + (cy - py), rotation: i.rotation + 720, isThrown: true } : i));
        playSound('snap');
        setTimeout(() => onKnifeAtDuck(), 210);
        // 칼은 튕겨 나와 선반으로 돌아온다
        setTimeout(() => setSouvenirItems(prev => prev.map(i => i.id === itemId ? { ...i, targetX: (Math.random() - 0.5) * 500, targetY: -Math.random() * 300 - 150, isThrown: false } : i)), 1000);
        return;
      }
    }

    // 칼(shop1)을 오리 사무장 위에서 놓으면 위협이 된다
    if (item.img.includes('shop1')) {
      const duck = document.querySelector('[data-duck]')?.getBoundingClientRect();
      if (duck && info.point.x >= duck.left && info.point.x <= duck.right && info.point.y >= duck.top && info.point.y <= duck.bottom) {
        onKnifeAtDuck();
        return;
      }
    }

    // 사탕(아이에게만 나오는 기념품): 오리 사무장 위에 놓으면 건네는 것이다. 받아 가고, 단 것 앞에서 마음이 약해진다
    if (item.img.includes('shop_candy') && onDuck) {
      candyGiven.current += 1;
      setSouvenirItems(prev => prev.filter(i => i.id !== itemId));
      playSound('bag');
      purserSay(purserCandy(candyGiven.current), 'receive', 4800);
      return;
    }

    const newX = item.targetX + info.offset.x;
    const newY = item.targetY + info.offset.y;

    // Check throwing mechanic (High Velocity)
    const speed = Math.hypot(info.velocity.x, info.velocity.y);
    if ((item.img.includes('shop1') || item.img.includes('shop2')) && speed > 200) {
      const dx = info.velocity.x / speed;
      const dy = info.velocity.y / speed;
      
      // 빠르게 던지면 화면 밖으로 날아갔다가 반대편에서 선반으로 돌아온다
      const farX = newX + dx * 2500;
      const farY = newY + dy * 2500;
      setSouvenirItems(prev => prev.map(i => (i.id === itemId ? { ...i, targetX: farX, targetY: farY, rotation: i.rotation + 1080, isThrown: true } : i)));
      setTimeout(() => {
        setSouvenirItems(prev => {
          const filtered = prev.filter(i => i.id !== itemId);
          const oppositeX = dx > 0 ? -1500 : 1500;
          const oppositeY = dy > 0 ? -1000 : 1000;
          return [...filtered, {
            id: Date.now() + Math.random(),
            img: item.img,
            startX: oppositeX,
            startY: oppositeY,
            targetX: (Math.random() - 0.5) * 500,
            targetY: -Math.random() * 300 - 150,
            rotation: item.rotation + 720,
            isThrown: true,
          }];
        });
      }, 400);
      return;
    }

    if (droppedId === 'mybag') {
      playSound('cash');
      setBagItems(prev => [...prev, item.img.replace(/^.*\//, '').replace('.webp', '')]);
      setSouvenirItems(prev => prev.filter(i => i.id !== itemId));
    } else {
      setSouvenirItems(prev => prev.map(i => {
        if (i.id === itemId) return { ...i, targetX: newX, targetY: newY };
        return i;
      }));
    }
  };

  const handleTargetClick = () => {
    playSound('scissors');
    setTargetHit(true);
    setTimeout(() => setTargetHit(false), 500);

    // Pop out all stuck swords
    setSouvenirItems(prev => prev.map(item => {
      if (item.isStuck) {
        return {
          ...item,
          isStuck: false,
          isThrown: false,
          targetX: item.targetX + (Math.random() * 400 - 200),
          targetY: item.targetY - (Math.random() * 200 + 100),
          rotation: item.rotation + (Math.random() * 720 - 360)
        };
      }
      return item;
    }));
  };

  const handleDragEnd = (event: any, info: any) => {
    const hoveredId = billTarget(info.point.x, info.point.y);
    setHoveredDropZone(null);

    // 가위(Scissors)를 들고 있을 때 모바일/터치 환경에서 의도치 않게 클릭 이벤트가 겹치는 것을 방지
    // 드래그 종료 시 가위질(Click) 로직이 트리거되지 않도록 함 (전역 리스너에서 처리됨)
    
    if (hoveredId) {
      handleDrop(hoveredId);
    } else {
      // Failed drop - shake effect on bill (handled by framer motion snap back automatically, but could add state for shake)
      playSound('snap');
    }
  };

  const triggerVFX = (id: string) => {
    setActiveEffect(id);
    
    if (id === 'bath') {
      playSound('bubbles');
      setHasGiantBubble(true);
    } else if (id === 'pool') {
      const rect = dropZoneRefs.current['pool']?.getBoundingClientRect();
      if (rect) {
        setRippleOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
      setHasWater(true);
    } else if (id === 'barber') {
      hairThanked.current = false;
      setHasScissors(true);
      playSound('scissors');
      
      const newHairs = [];
      const numHairs = 12;
      const hairImages = ['/spend/hair1.webp', '/spend/hair2.webp', '/spend/hair3.webp'];
      
      // Magic hair should be on the edges (index 0,1,2 or 9,10,11) so it doesn't permanently block the center UI
      const edgeIndices = [0, 1, 2, numHairs - 3, numHairs - 2, numHairs - 1];
      const magicIndex = edgeIndices[Math.floor(Math.random() * edgeIndices.length)];
      
      for (let i = 0; i < numHairs; i++) {
        const randomImage = hairImages[Math.floor(Math.random() * hairImages.length)];
        const h = 400 + Math.random() * 400; // increased length to match width scale
        newHairs.push({
          id: i + Date.now(),
          xPercent: (100 / numHairs) * i + (Math.random() * 5),
          width: 150 + Math.random() * 100, // increased width
          height: h,
          cutY: h,
          src: randomImage,
          isMagic: i === magicIndex
        });
      }
      setHairs(newHairs);
    } else if (id === 'souvenir') {
      playSound('cash');
      setActiveEffect(id);
      
      const images = ['/spend/shop2.webp', '/spend/shop3.webp', '/spend/shop4.webp'];
      const newItems = [
        { img: isChild ? '/spend/shop_candy.webp' : '/spend/shop1.webp' }, // 칼은 꼭 하나 나온다. 아이에게는 칼 대신 사탕 (shop1 이 아니라서 위협에도 쓰이지 않는다)
        { img: images[Math.floor(Math.random() * images.length)] },
        { img: images[Math.floor(Math.random() * images.length)] },
        { img: images[Math.floor(Math.random() * images.length)] },
      ].map(base => ({
        id: Date.now() + Math.random(),
        img: base.img,
        targetX: (Math.random() - 0.5) * 500,
        targetY: -Math.random() * 300 - 150,
        rotation: (Math.random() - 0.5) * 360,
        isHit: false
      }));
      
      setSouvenirItems(prev => [...prev, ...newItems]);
      
      setTimeout(() => {
        setActiveEffect(null);
      }, 500);
    } else if (id === 'massage') {
      setHasLightningAbility(true);
      playSound('electric');
    } else if (id === 'telegraph') {
      setHasTelegraph(true);
      // 구입 대사가 끝난 뒤에 동료 이야기를 한다 (겹쳐서 앞 대사를 끊지 않는다)
      // 동료 이야기를 하는 순간, 춤추는 동료 오리가 왼쪽에서 걸어 나온다
      sayWhenFree(INTERACTION_LINES.telegraphColleague, 600, () => setColleagueIn(true));
    } else {
      setActiveEffect(id);
    }
    
    // Auto clear effect after animation
    setTimeout(() => setActiveEffect(null), 3000);
  };

  const handleDuckDragEnd = (e: any, info: any) => {
    setIsDraggingDuck(false);
    
    // 이동 거리 계산 (x축, y축 이동량의 절대값 합)
    const moveDistance = Math.abs(info.offset.x) + Math.abs(info.offset.y);

    // 이동 거리가 5px 미만이면 '클릭'으로 간주
    if (moveDistance < 5) {
      console.log("꽥! 오리가 클릭되었습니다.");
      if (hasLightningAbility) {
        setIsDuckDamaged(true);
        // 번개 시각 효과 추가
        const id = Date.now() + Math.random();
        setLightningStrikes(prev => [...prev, { id, x: info.point.x, y: info.point.y }]);
        setTimeout(() => {
          setLightningStrikes(prev => prev.filter(strike => strike.id !== id));
        }, 600);
      }
      return; // 드래그 드롭 로직(물보라 등) 중단
    }

    // 놓은 자리에서 중력으로 물 위까지 떨어지고, 닿는 순간 물보라가 튄다
    duckFall.current?.stop();
    const y0 = duckDragY.get(); // 물 위 기준선(0)보다 위면 음수
    const splash = () => {
      playSound('splash');
      const splashId = Date.now() + Math.random();
      setDuckSplashes(prev => [...prev, splashId]);
      setTimeout(() => {
        setDuckSplashes(prev => prev.filter(s => s !== splashId));
      }, 1500);
    };
    if (y0 < -6) {
      const t = Math.min(1.1, Math.sqrt((2 * Math.abs(y0)) / 2400)); // 높을수록 오래 떨어진다
      duckFall.current = animate(duckDragY, 0, {
        duration: t,
        ease: [0.55, 0, 1, 0.45], // 가속하며 낙하
        onComplete: () => {
          splash();
          // 물에 잠겼다가 떠오르며 출렁인다
          duckFall.current = animate(duckDragY, [0, 12, -4, 0], { duration: 0.7, ease: 'easeOut' });
        },
      });
    } else {
      // 물 아래로 눌러 놓았거나 수면 근처: 곧바로 첨벙, 부력으로 떠오른다
      splash();
      duckFall.current = animate(duckDragY, 0, { type: 'spring', stiffness: 150, damping: 10 });
    }
  };

  // 오리 사무장의 말풍선
  const [purserLineText, setPurserLineText] = useState<string | null>(null);
  const [purserKey, setPurserKey] = useState(0);
  const purserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [purserPose, setPurserPose] = useState<PurserPose>('idle');
  const purserSeq = useRef<ReturnType<typeof setTimeout>[]>([]);
  const purserSeqUntil = useRef(0);
  const monologueRunning = useRef(false);
  // 빼꼼 오리: 도박장 창이 사무장을 가릴 때 화면 가장자리에서 고개를 내민다 (처음 설명, 그리고 당첨 같은 사건에 궁금해서)
  const [peek, setPeek] = useState(false);
  const casinoToldRef = useRef(false);
  const peekTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const peekBusy = useRef(false);
  useEffect(() => () => peekTimers.current.forEach(clearTimeout), []);
  const purserSay = (text: string, pose: PurserPose = 'idle', ms = 3600, keepSeq = false) => {
    // 숨은 독백이 끝나기 전에는 다른 대사가 끼어들지 못한다 (업적 "오리무중"은 독백을 끝까지 들어야 얻는다)
    if (!keepSeq && Date.now() < purserSeqUntil.current) return;
    if (purserTimer.current) clearTimeout(purserTimer.current);
    setPurserLineText(text);
    setPurserPose(pose);
    setPurserKey((k) => k + 1);
    // 글자가 서서히 나오므로, 다 나온 뒤 읽을 시간까지 넉넉히 둔다. 1.5초 안팎의 짧은 즉발 대사(총성 직전)는 그대로 둔다
    const showMs = ms < 2000 ? ms : purserLineMs(text, ms);
    purserBusyUntil.current = Date.now() + showMs;
    purserTimer.current = setTimeout(() => {
      setPurserLineText(null);
      setPurserPose('idle');
    }, showMs);
  };
  // 지금 말하는 대사가 끝난 뒤에 다음 대사를 한다 (끼어들어 끊지 않는다). 그 사이 다른 대사가 또 들어오면 그 대사가 끝나길 기다린다
  const purserBusyUntil = useRef(0);
  const sayWhenFree = (args: readonly [string, PurserPose, number], earliestMs = 0, onSay?: () => void) => {
    const tryIt = () => {
      const wait = purserBusyUntil.current - Date.now();
      if (wait > 0) { purserSeq.current.push(setTimeout(tryIt, wait + 350)); return; }
      purserSay(args[0], args[1], args[2]);
      onSay?.();
    };
    purserSeq.current.push(setTimeout(tryIt, earliestMs));
  };
  useEffect(() => {
    const t = setTimeout(() => {
      // 세 방의 오리를 모두 찾은 손님은 처음 만날 때 한 번 그 이야기를 듣는다
      if (ducksAllFoundUntold()) {
        markDucksTold();
        purserSay(PURSER_DUCKS, 'think', 6800);
        return;
      }
      purserSay(purserGreeting(runIndex), runIndex === 1 ? 'hips' : 'greet', 4800);
    }, 1200);
    const seqTimers = purserSeq.current; // 배열은 바뀌지 않고 항목만 쌓인다
    return () => {
      clearTimeout(t);
      if (purserTimer.current) clearTimeout(purserTimer.current);
      seqTimers.forEach(clearTimeout);
      // 독백 도중에 화면을 떠나면 끝까지 듣지 못한 것이므로 다음에 다시 들을 수 있게 되돌린다
      if (monologueRunning.current) purserMonologueReset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 여러 줄을 이어서 말한다 (숨은 독백). 끝날 때까지 다른 대사가 끼어들지 않는다
  const purserSayAll = (first: { line: string; pose: PurserPose }, follow: { line: string; pose: PurserPose }[]) => {
    purserSay(first.line, first.pose, 4200);
    let at = purserLineMs(first.line, 4200) + 300;
    follow.forEach((l) => {
      const when = at;
      purserSeq.current.push(setTimeout(() => purserSay(l.line, l.pose, 4200, true), when));
      at += purserLineMs(l.line, 4200) + 300;
    });
    purserSeqUntil.current = Date.now() + at;
    monologueRunning.current = true;
    // 마지막 줄까지 다 말한 뒤에만 업적을 준다
    purserSeq.current.push(setTimeout(() => { monologueRunning.current = false; unlock('serious-talk'); }, at - 300));
  };

  // 이발소: 오리를 가리던 머리카락을 잘라 앞이 보이게 되면 사무장이 고마워한다 (구입 한 번에 한 번)
  const hairBlocked = useRef(false);
  const hairThanked = useRef(false);
  const hairThanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const d = document.querySelector('[data-duck]');
    if (hairs.length === 0 || !d) { hairBlocked.current = false; return; }
    const r = d.getBoundingClientRect();
    if (r.height === 0) return;
    const covers = hairs.some((h) => {
      const x = (h.xPercent / 100) * window.innerWidth;
      return x < r.right && x + h.width > r.left && h.cutY > r.top + r.height * 0.35;
    });
    if (covers) hairBlocked.current = true;
    else if (hairBlocked.current && !hairThanked.current) {
      hairBlocked.current = false;
      hairThanked.current = true;
      // 머리카락이 떨어지는 동안은 기다린다. (마법 머리카락이 매 프레임 hairs 를 바꾸므로, 효과가 다시 돌아도 이 타이머는 지우지 않는다)
      hairThanksTimer.current = setTimeout(() => purserSay(PURSER_HAIR_CLEAR, 'bow', 4600), 900);
    }
  }, [hairs]);
  useEffect(() => () => { if (hairThanksTimer.current) clearTimeout(hairThanksTimer.current); }, []);

  const handleDrop = (id: string) => {
    if (billsAvailable <= 0) return;

    if (id === 'duck') {
      // 오리에게 팁: 가방에도 시설에도 쓰이지 않고 오리의 주머니로 간다
      if (duckReturned >= 0) {
        // 이미 한 번 돌려준 뒤에는 받지 않는다: 지폐는 쓰이지 않고 돌아온다
        const r = duckReturned + 1;
        setDuckReturned(r);
        playSound('snap');
        purserSay(purserRefuseTip(r), 'hips', 3800);
        return;
      }
      const n = duckGiven + 1;
      setBillsAvailable(prev => prev - 1);
      setDuckGiven(n);
      playStamp();
      purserSay(purserTip(n), n >= 5 ? 'hips' : 'receive', 4200);
      if (n >= 5) {
        // 다섯 장을 다 받으면 발끈하고는 전부 돌려준다 (업적은 돌려주는 순간)
        setTimeout(() => {
          setBillsAvailable(prev => prev + n);
          setDuckGiven(0);
          setDuckReturned(0);
          playStamp();
          purserSay(PURSER_RETURN, 'bow', 4200);
          unlock('duck-beggar');
        }, purserLineMs(purserTip(n), 4200) - 600);
      }
    } else if (id === 'mybag') {
      setBillsAvailable(prev => prev - 1);
      setBillsInBag(prev => prev + 1);
      playSound('bag');
      purserSay(billsAvailable === 1 ? purserLast(runIndex, true) : purserLine('mybag', billsInBag), billsAvailable === 1 ? 'bow' : 'shrug'); // 아낀 돈 앞에서는 아쉬운 듯 어깨를 으쓱한다
    } else if (id === 'gamble' && playerAge !== null && playerAge < 18) {
      // 미성년자는 도박장에 들이지 않는다: 지폐는 쓰이지 않고 돌아온다
      playSound('snap');
      if (playerAge < 12) {
        // 아이가 계속 시도하면 경고하고, 세 번째에는 도박장을 선반에서 치워 버린다
        kidGambleTries.current += 1;
        const t = kidGambleTries.current;
        if (t === 1) purserSay('…아이에게는 절망을 팔지 않소. 사탕이라면 저쪽 기념품점이오.', 'refuse', 4600);
        else if (t === 2) purserSay('…또요? 한 번만 더 내밀면, 그 시설을 치워 버리겠소.', 'refuse', 4200);
        else if (t > 3) purserSay('…문은 닫는다고 했소. 같은 말을 세 번 하게 하지 마시오.', 'hips', 3800);
        else {
          purserSay('…세 번째요. 이 문은 닫겠소. 아이는 사탕이나 고르시오.', 'stamp', 4600);
          // 말이 나온 뒤 도박장이 선반에서 사라진다. 가운데 시설이 달라지지 않게 번호를 하나 당긴다
          setTimeout(() => { setFacIndex((i) => (i > 0 ? i - 1 : 0)); setGambleBanned(true); }, 1600);
        }
      } else {
        purserSay('…미성년자요. 패가망신은 어른들의 몫이오. 다른 시설을 권하겠소.', 'refuse', 4600);
      }
    } else if (id === 'gamble') {
      purserMarkFacility('gamble');
      // Don't consume bill immediately, open modal
      setIsGamblingMode(true);
      // 도박장 창이 오리를 가리므로, 처음 들어갈 때만 화면 가장자리에서 고개를 내밀어 설명하고 들어간다. 그 뒤로는 말하지 않는다
      if (!casinoToldRef.current) {
        casinoToldRef.current = true;
        peekBusy.current = true;
        peekTimers.current.forEach(clearTimeout);
        const explain = purserLine('gamble', 0);
        const t1 = purserLineMs(explain, 4800);
        const bye = '그럼 즐거운 시간 보내시오.';
        peekTimers.current = [
          setTimeout(() => setPeek(true), 600), // 창이 다 자리 잡은 뒤에 틀 가장자리를 재야 한다
          setTimeout(() => purserSay(explain, 'refuse', 4800), 1500),
          setTimeout(() => purserSay(bye, 'bow', 3000), 1500 + t1 + 200),
          setTimeout(() => { setPeek(false); peekBusy.current = false; }, 1500 + t1 + 200 + purserLineMs(bye, 3000) + 200),
        ];
      }
    } else {
      // Regular facilities
      purserMarkFacility(id);
      setBillsAvailable(prev => prev - 1);
      setSpentOn(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
      triggerVFX(id);
      purserSay(billsAvailable === 1 ? purserLast(runIndex, false) : ((spentOn[id] ?? 0) === 1 ? purserFacilityLine(id, persona) : null) ?? purserLine(id, spentOn[id] ?? 0), billsAvailable === 1 ? 'calc' : (spentOn[id] ?? 0) > 0 ? 'calc' : 'stamp');
    }
  };

  const handlePick = (distance: number) => {
    if (gamblingState !== 'idle') return;
    setGamblingGuess(distance);
    setSwordHit((n) => n + 1);
    playSound('snap'); // 칼이 꽂히는 소리
  };

  useEffect(() => () => gambleTimers.current.forEach(clearTimeout), []);

  // stake: 걸 지폐 수. 이기면 배당(장당 순이익)도 그만큼 곱해지고, 지면 건 만큼 잃는다 (기댓값은 장수와 상관없이 같다)
  const handleGambleSubmit = (stakeIn = 1) => {
    if (billsAvailable <= 0 || gamblingState !== 'idle') return;
    const stake = Math.max(1, Math.min(stakeIn, billsAvailable));

    const tier = GAMBLE_TIERS.find((t) => t.id === gamblingTier)!;
    const streakBefore = gamblingStreak;
    setGambleCount(prev => prev + 1);
    const target = Math.floor(Math.random() * (550 - 480 + 1)) + 480;
    const clamp = (v: number) => Math.max(480, Math.min(550, v));
    const side = Math.random() < 0.5 ? 1 : -1;
    // 정답 주변을 좌우로 오가며 폭이 줄어드는 경로
    setShipPath([480, clamp(target - side * 26), clamp(target + side * 17), clamp(target - side * 9), clamp(target + side * 4), target]);
    setTargetDistance(target);
    setGamblingState('animating');
    playSound('bell');
    TICK_AT.forEach((ms) => gambleTimers.current.push(setTimeout(() => playSound('snap'), ms)));

    gambleTimers.current.push(setTimeout(() => {
      const error = Math.abs(gamblingGuess - target);
      const won = error <= tier.tol;
      // 불즈아이: 배가 칼끝(칩) ±1해리 안에 멈추면 받는 돈이 두 배
      const isExact = won && error <= BULLSEYE_TOL;
      const net = (tier.net + streakBefore) * stake * (isExact ? BULLSEYE_MULT : 1); // 연승할수록 장당 보상이 1장씩 늘어난다

      setGamblingResult(isExact ? 'exact' : (won ? 'win' : 'lose'));
      if (won) {
        setWinFx({ key: Date.now(), net, exact: isExact }); gambleTimers.current.push(setTimeout(() => setWinFx(null), 7000));
        // 시끌벅적한 소리에 궁금해진 사무장이 화면 가장자리에서 빼꼼 내다본다 (말은 하지 않는다)
        if (!peekBusy.current) {
          peekBusy.current = true;
          peekTimers.current.push(setTimeout(() => setPeek(true), 900));
          peekTimers.current.push(setTimeout(() => { setPeek(false); peekBusy.current = false; }, 900 + (isExact ? 5200 : 3800)));
        }
      }
      setGamblingState('result');

      if (won) {
        setGamblingGain(net);
        setGamblingStreak(streakBefore + 1);
        // 5연승 업적 (당첨 연출이 지나간 뒤 알린다)
        if (streakBefore + 1 >= HOT_STREAK_GOAL) gambleTimers.current.push(setTimeout(() => unlock('hot-streak'), 1400));
        playSound('jackpot');
        confetti({
          particleCount: isExact ? 300 : 120 + Math.min(net, 12) * 12,
          spread: isExact ? 120 : 80,
          origin: { y: 0.65 },
          colors: ['#ffd700', '#ff8c00', '#ffffff'],
        });
        setBillsAvailable(prev => prev + net);
        setTotalEarnedBills(prev => prev + net);
      } else {
        setGamblingGain(-stake);
        setGamblingStreak(0);
        lostGamble.current = true;
        playSound('lose');
        setBillsAvailable(prev => prev - stake);
        // 도박장에서 가진 지폐를 전부 잃으면 업적
        if (billsAvailable - stake <= 0) gambleTimers.current.push(setTimeout(() => unlock('house-always-wins'), 1400));
        if (billsAvailable - stake <= 0 && suiteBought) gambleTimers.current.push(setTimeout(() => unlock('suite-bust'), 2200)); // 스위트룸으로 옮긴 뒤 전부 잃었다
      }
    }, REVEAL_MS));
  };

  const handleGambleCancel = () => {
    gambleTimers.current.forEach(clearTimeout);
    gambleTimers.current = [];
    // 창을 닫으면 빼꼼 오리도 들어가고 말풍선도 거둔다
    peekTimers.current.forEach(clearTimeout);
    peekTimers.current = [];
    peekBusy.current = false;
    setPeek(false);
    if (purserTimer.current) clearTimeout(purserTimer.current);
    setPurserLineText(null);
    setIsGamblingMode(false);
    setGamblingState('idle');
    setGamblingStreak(0);
  };

  const closeGambleResult = () => {
    // 가진 지폐를 모두 잃고 나오면 창이 닫힌 뒤 사무장이 한마디 한다
    const busted = gamblingResult === 'lose' && billsAvailable <= 0;
    handleGambleCancel();
    if (busted) sayWhenFree(purserBusted(billsInBag > 0), 700);
  };

  // 이기고 나서 한 번 더: 같은 창에서 바로 다시 건다
  const handleGambleAgain = () => {
    setGamblingState('idle');
    setGamblingResult(null);
  };

  const handleSubmitFinal = () => {
    const ratio = billsInBag / totalEarnedBills;
    let finalValue = 'luxury'; // < 20%
    if (ratio > 0.5) {
      finalValue = 'save';
    } else if (ratio >= 0.2) {
      finalValue = 'balance';
    }
    onAnswer(finalValue, { bagItems, bagBills: billsInBag, gambleCount, spentOn });
  };

  const handleGlobalClick = (e: React.MouseEvent) => {
    if (!hasLightningAbility) return;

    const id = Date.now() + Math.random();
    // 전신기 위를 누르면 키를 두드리는 것이라 번개가 치지 않는다. 가까운 곳을 누르면 번개가 금속인 전신기로 튄다(피뢰침처럼)
    let sx = e.clientX; let sy = e.clientY; let toMachine = false;
    const mEl = hasTelegraph ? document.getElementById('morse-machine-image') : null;
    if (mEl) {
      const mr = mEl.getBoundingClientRect();
      if (e.clientX >= mr.left && e.clientX <= mr.right && e.clientY >= mr.top && e.clientY <= mr.bottom) return;
      if (e.clientX >= mr.left - 170 && e.clientX <= mr.right + 170 && e.clientY >= mr.top - 170 && e.clientY <= mr.bottom + 170) {
        sx = mr.left + mr.width * 0.62; sy = mr.top + mr.height * 0.28; toMachine = true;
      }
    }
    setLightningStrikes(prev => [...prev, { id, x: sx, y: sy }]);
    playThunder();
    if (toMachine) setTimeout(() => shortCircuit(), 350);
    document.querySelectorAll('[data-souvenir-id]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left - 18 && e.clientX <= r.right + 18 && e.clientY >= r.top - 18 && e.clientY <= r.bottom + 18) zapSouvenir(Number(el.getAttribute('data-souvenir-id')));
    });
    
    // 오리 사무장이 번개를 맞으면: 감전된 모습이 되고, 칼과 같은 위협이 따른다
    const purserEl = document.querySelector('[data-duck]');
    if (purserEl) {
      const pr = purserEl.getBoundingClientRect();
      if (e.clientX >= pr.left - 20 && e.clientX <= pr.right + 20 && e.clientY >= pr.top - 20 && e.clientY <= pr.bottom + 20) {
        setPurserShock((n) => n + 1);
        setTimeout(() => onKnifeAtDuck('lightning'), 350);
      }
    }
    // Check lightning collision with duck and bubble
    if (duckRef.current) {
      const rect = duckRef.current.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        setIsDuckDamaged(true);
      }
    }
    if (hasWater && e.clientY > window.innerHeight * 0.85) zapWater(e.clientX); // 수영장 물에 번개
    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      // Increase hit area slightly for the bubble since it's round
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        setIsBubbleYellow(true);
      }
    }

    // Auto clear the strike after animation completes (600ms)
    setTimeout(() => {
      setLightningStrikes(prev => prev.filter(strike => strike.id !== id));
    }, 1100);
  };

  // 내 가방(저축 드롭 영역): 지폐 아래에 둔다. 좁은 화면에서는 예전 자리(오른쪽)에 둔다.
  const renderBag = (inline: boolean) => (
    <div
      ref={el => { dropZoneRefs.current['mybag'] = el; }}
      className={`${inline ? 'w-56' : 'ml-auto w-56 md:w-80'} flex flex-col items-center justify-end gap-2 transition-all duration-300 select-none pointer-events-auto cursor-pointer ${hoveredDropZone === 'mybag' ? 'scale-110 drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]' : ''}`}
      draggable={false}
    >
      <img
        src={hoveredDropZone === 'mybag' ? '/spend/my_bag_open.webp' : '/spend/my_bag.webp'}
        alt="내 가방"
        draggable={false}
        className={`${inline ? 'h-28' : 'h-32'} w-auto drop-shadow-xl pointer-events-none transition-all`}
      />
      <div className="font-bold text-amber-200 text-lg z-10 bg-black/50 px-4 py-2 rounded pointer-events-none opacity-0 select-none">내 가방</div>
    </div>
  );

  // Render draggable bills
  const renderBills = (inline = false) => {
    const displayCount = Math.min(billsAvailable, 5);
    const hasMore = billsAvailable > 5;
    
    return (
      <div
        ref={inline ? billStackRef : undefined}
        className={inline ? 'relative h-44 w-56 shrink-0 flex justify-center items-center z-50 pointer-events-none' : 'relative w-full h-32 flex justify-center items-center mt-12 z-50 pointer-events-none'}
        // 도박장이 열려 있는 동안에는 지폐 더미를 숨긴다 (도박장 창 위로 비쳐 보이지 않게. 보유 지폐는 도박장이 보여 준다)
        style={{ visibility: isGamblingMode ? 'hidden' : undefined }}
      >
        {Array.from({ length: displayCount }).map((_, i) => (
          <motion.div
            key={`bill-${i}`}
            drag
            dragSnapToOrigin
            onDragStart={stopDemo}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            whileHover={{ scale: 1.1, y: -10 }}
            whileDrag={{ scale: 1.2, zIndex: 100 }}
            className="absolute cursor-grab active:cursor-grabbing shadow-xl pointer-events-auto"
            style={{ 
              x: (i - (displayCount - 1) / 2) * 20,
              y: Math.abs(i - (displayCount - 1) / 2) * 5,
              rotate: (i - (displayCount - 1) / 2) * 8,
              zIndex: 50 + i 
            }}
          >
            <img 
              src="/spend/bill.webp" 
              alt="Titanic Bill" 
              className="w-48 h-auto drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] pointer-events-none"
            />
          </motion.div>
        ))}
        {/* 지폐를 다 쓰면 지폐가 있던 자리에 선택 완료 버튼이 나온다 */}
        {billsAvailable === 0 && (
          <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center gap-3 pointer-events-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <ClassicButton onClick={handleSubmitFinal} className={inline ? 'px-8 text-base' : 'px-12 text-base'}>선택 완료</ClassicButton>
            </motion.div>
          </div>
        )}
        {hasMore && (
          <div className="absolute left-1/2 ml-24 bottom-2 bg-red-600 text-white font-bold px-3 py-1 rounded-full border-2 border-white/20 shadow-lg text-sm pointer-events-auto z-[150]">
            x{billsAvailable}
          </div>
        )}
        {/* 870장 이상: 스위트룸으로 옮기기 (870장을 낸다) */}
        {canBuySuite && !isGamblingMode && (
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            onClick={(e) => { e.stopPropagation(); buySuite(); }}
            className="absolute left-1/2 -translate-x-1/2 -bottom-12 z-[150] pointer-events-auto whitespace-nowrap rounded-full border-2 border-amber-200/80 bg-gradient-to-b from-amber-400 to-amber-600 px-5 py-2 text-sm font-black tracking-wide text-amber-950 shadow-[0_4px_0_#7a4a0a]"
          >
            스위트룸으로 옮기기 (지폐 {SUITE_BILLS}장)
          </motion.button>
        )}
      </div>
    );
  };

  // 870장을 처음 모으면 사무장이 스위트룸을 권한다 (버튼이 같이 나온다)
  useEffect(() => {
    if (canBuySuite && !suiteOfferedRef.current) {
      suiteOfferedRef.current = true;
      sayWhenFree(['…870장이라. 파를러 스위트의 편도 값이오. 원하시면 방을 옮겨 드리겠소, 손님.', 'bow', 4800], 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canBuySuite]);

  // 870장을 내고 스위트룸으로 옮긴다
  const buySuite = () => {
    if (!canBuySuite || billsAvailable < SUITE_BILLS) return;
    setBillsAvailable((prev) => prev - SUITE_BILLS);
    setSuiteBought(true);
    playStamp();
    unlock('parlour-suite');
    sayWhenFree(['…파를러 스위트, 편도 870장. 짐은 이미 옮겨 놓았소. 편히 쉬시오.', 'stamp', 4800], 700);
  };

  return (
    <div ref={containerRef} onClick={handleGlobalClick} className="w-full relative min-h-screen py-12 px-6 overflow-hidden flex flex-col items-center">

      {/* 870장 이상: 배경이 스위트룸으로 천천히 바뀐다 (장면 배경 위, 시설과 글 아래) */}
      <AnimatePresence>
        {suiteOn && (
          <motion.div
            key="suite-bg"
            aria-hidden
            initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 2.2, ease: 'easeInOut' }}
            className="pointer-events-none fixed inset-0 z-[1] bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url('${SUITE_BG}')` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/55" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* SVG Distortion Filters */}
      <svg className="w-0 h-0 absolute">
        <filter id="water-distortion">
          <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" result="noise">
            <animate attributeName="baseFrequency" values="0.01; 0.02; 0.01" dur="3s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="25" xChannelSelector="R" yChannelSelector="G">
            <animate attributeName="scale" values="0; 40; 0" dur="3s" repeatCount="indefinite" />
          </feDisplacementMap>
        </filter>
      </svg>


      {/* Debug Position Panel */}
      {showDebug && (
        <div className="fixed top-4 left-4 z-[9999] bg-black/80 text-white p-4 rounded-xl text-xs max-h-screen overflow-y-auto w-64 pointer-events-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm">Position Debug</h3>
          </div>
          
          <div className="mb-4 border-b-2 border-amber-500 pb-4">
            <button
              onClick={() => {
                setBillsAvailable(prev => prev + 5);
                setTotalEarnedBills(prev => prev + 5);
              }}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-3 rounded shadow transition-colors mb-4"
            >
              + 지폐 5장 추가
            </button>
          </div>

          <div className="mb-4 border-b-2 border-amber-500 pb-2">
            <div className="font-bold mb-1 text-amber-400">Global Spacing (Overlap)</div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-12">Horiz (X)</label>
              <input 
                type="range" min="-100" max="100" 
                value={globalSpacing.x}
                onChange={e => setGlobalSpacing(prev => ({ ...prev, x: Number(e.target.value) }))}
                className="w-full"
              />
              <span className="w-8 text-right">{globalSpacing.x}</span>
            </div>
            <div className="flex gap-2 items-center">
              <label className="w-12">Vert (Y)</label>
              <input 
                type="range" min="-150" max="100" 
                value={globalSpacing.y}
                onChange={e => setGlobalSpacing(prev => ({ ...prev, y: Number(e.target.value) }))}
                className="w-full"
              />
              <span className="w-8 text-right">{globalSpacing.y}</span>
            </div>
          </div>

          <div className="mb-4 border-b-2 border-cyan-500 pb-2">
            <div className="font-bold mb-1 text-cyan-400">Duck Y Position</div>
            <div className="flex gap-2 items-center">
              <label className="w-12">Y (px)</label>
              <input 
                type="range" min="-200" max="100" 
                value={duckOffset.y}
                onChange={e => setDuckOffset({ y: Number(e.target.value) })}
                className="w-full"
              />
              <span className="w-8 text-right">{duckOffset.y}</span>
            </div>
          </div>

          <div className="mb-4 border-b-2 border-fuchsia-500 pb-2">
            <div className="font-bold mb-1 text-fuchsia-400">Morse Machine</div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-12 text-[10px]">Horiz (X)</label>
              <input 
                type="range" min="-500" max="500" 
                value={morseOffset.x}
                onChange={e => setMorseOffset(prev => ({ ...prev, x: Number(e.target.value) }))}
                className="w-full"
              />
              <span className="w-8 text-right">{morseOffset.x}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-12 text-[10px]">Vert (Y)</label>
              <input 
                type="range" min="-500" max="500" 
                value={morseOffset.y}
                onChange={e => setMorseOffset(prev => ({ ...prev, y: Number(e.target.value) }))}
                className="w-full"
              />
              <span className="w-8 text-right">{morseOffset.y}</span>
            </div>
            <div className="flex gap-2 items-center mt-2">
              <input 
                type="checkbox" 
                checked={morseFlip}
                onChange={e => setMorseFlip(e.target.checked)}
                className="cursor-pointer"
              />
              <label className="text-[10px] cursor-pointer" onClick={() => setMorseFlip(!morseFlip)}>Flip Horizontally</label>
            </div>
          </div>

          <div className="mb-4 border-b-2 border-green-500 pb-2">
            <div className="font-bold mb-1 text-green-400">Morse Signals</div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-12 text-[10px]">Horiz (X)</label>
              <input 
                type="range" min="-500" max="500" 
                value={morseSignalOffset.x}
                onChange={e => setMorseSignalOffset(prev => ({ ...prev, x: Number(e.target.value) }))}
                className="w-full"
              />
              <span className="w-8 text-right">{morseSignalOffset.x}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-12 text-[10px]">Vert (Y)</label>
              <input 
                type="range" min="-500" max="500" 
                value={morseSignalOffset.y}
                onChange={e => setMorseSignalOffset(prev => ({ ...prev, y: Number(e.target.value) }))}
                className="w-full"
              />
              <span className="w-8 text-right">{morseSignalOffset.y}</span>
            </div>
          </div>

          {FACILITIES.map(fac => (
            <div key={`debug-${fac.id}`} className="mb-2 border-b border-gray-700 pb-2">
              <div className="font-bold mb-1">{fac.name}</div>
              <div className="flex gap-2 items-center mb-1">
                <label className="w-4">X</label>
                <input 
                  type="range" min="-150" max="150" 
                  value={offsets[fac.id].x}
                  onChange={e => setOffsets(prev => ({ ...prev, [fac.id]: { ...prev[fac.id], x: Number(e.target.value) } }))}
                  className="w-full"
                />
                <span className="w-8 text-right">{offsets[fac.id].x}</span>
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-4">Y</label>
                <input 
                  type="range" min="-150" max="150" 
                  value={offsets[fac.id].y}
                  onChange={e => setOffsets(prev => ({ ...prev, [fac.id]: { ...prev[fac.id], y: Number(e.target.value) } }))}
                  className="w-full"
                />
                <span className="w-8 text-right">{offsets[fac.id].y}</span>
              </div>
            </div>
          ))}

          <button 
            className="mt-2 bg-blue-600 w-full py-1 rounded"
            onClick={() => {
              console.log(JSON.stringify(offsets, null, 2));
              alert("Offsets logged to console");
            }}
          >
            Log Offsets
          </button>
        </div>
      )}


      {/* Permanent Rising Water with Titanic Duck */}
      {hasWater && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ duration: 2.5, ease: "easeOut" }}
          className="fixed bottom-0 left-0 w-full h-[15vh] z-[50] pointer-events-none"
        >
          {/* Calm, Realistic Panning Waves */}
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            
            {/* Wave Layer 1 (Back, slow) */}
            <motion.div 
              animate={{ backgroundPositionX: ['0px', '1000px'] }} 
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 w-full h-full"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 100'%3E%3Cpath d='M0,40 Q250,10 500,40 T1000,40 L1000,150 L0,150 Z' fill='rgba(6,182,212,0.3)'/%3E%3C/svg%3E")`,
                backgroundSize: '1000px 100%',
                backgroundRepeat: 'repeat-x'
              }}
            />

            {/* Wave Layer 2 (Middle, reverse) */}
            <motion.div 
              animate={{ backgroundPositionX: ['1000px', '0px'] }} 
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 w-full h-full"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 100'%3E%3Cpath d='M0,55 Q250,35 500,55 T1000,55 L1000,150 L0,150 Z' fill='rgba(8,145,178,0.4)'/%3E%3C/svg%3E")`,
                backgroundSize: '1000px 100%',
                backgroundRepeat: 'repeat-x'
              }}
            />

            {/* Wave Layer 3 (Front, fast) */}
            <motion.div 
              animate={{ backgroundPositionX: ['0px', '1000px'] }} 
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 w-full h-full"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 100'%3E%3Cpath d='M0,70 Q250,55 500,70 T1000,70 L1000,150 L0,150 Z' fill='rgba(34,211,238,0.5)'/%3E%3C/svg%3E")`,
                backgroundSize: '1000px 100%',
                backgroundRepeat: 'repeat-x'
              }}
            />
            
            {/* Base water mass to ensure bottom is covered on all screens */}
            <div className="absolute bottom-0 left-0 w-full h-[30%] bg-cyan-400" />
          </div>
        </motion.div>
      )}

      {/* Titanic Duck in front of hair overlay */}
      {hasWater && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ duration: 2.5, ease: "easeOut" }}
          className="fixed bottom-0 left-0 w-full h-[15vh] z-[200] pointer-events-none"
        >
          {/* Duck sitting on top of the water, floating back and forth */}
          <motion.div
            animate={isDraggingDuck ? { y: 0 } : { 
              x: ['-10vw', '10vw'],
              y: [0, -15, 0]
            }}
            transition={{ 
              x: { duration: 5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className={`absolute left-1/2 -translate-x-1/2 z-[20] pointer-events-auto ${showDebug ? 'border-4 border-red-500 bg-red-500/20' : ''}`}
            style={{ top: `${duckOffset.y}px` }}
          >
            {/* Draggable Duck Wrapper (Yellow Box) */}
            <motion.div
              drag
              dragConstraints={containerRef}
              dragElastic={0.8}
              onDragStart={() => { duckFall.current?.stop(); setIsDraggingDuck(true); }}
              onDragEnd={handleDuckDragEnd}
              style={{ y: duckDragY }}
              className={`relative flex justify-center ${showDebug ? 'border-2 border-yellow-500' : ''}`}
            >
              <motion.img 
                ref={duckRef}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.8 }}
                animate={isDraggingDuck ? { rotate: 0 } : { rotate: [-10, 10, -10] }}
                transition={{ rotate: { duration: 5, repeat: Infinity, ease: "easeInOut" } }}
                src={isDuckDamaged ? "/spend/titanic_duck_damaged.webp" : (isHairInWater && fallingHairs.length > 0 ? "/spend/titanic_duck_yuck.webp" : "/spend/titanic_duck.webp")} 
                alt="Titanic Rubber Duck" 
                draggable={false}
                className="w-24 md:w-32 h-auto drop-shadow-[0_15px_15px_rgba(0,0,0,0.4)] pointer-events-auto cursor-grab active:cursor-grabbing relative z-10" 
              />

              {/* Splashes spawned at the base of the yellow duck */}
              {duckSplashes.map(splashId => (
                <div key={splashId} className="absolute left-1/2 bottom-0 pointer-events-none z-[110]">
                {/* Base impact ripple */}
                <motion.div 
                  initial={{ scale: 0.2, opacity: 1, x: '-50%', y: '-50%' }}
                  animate={{ scale: 4, opacity: 0, x: '-50%', y: '-50%' }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="absolute w-24 h-8 border-4 border-cyan-300 rounded-[100%] opacity-0 shadow-[0_0_15px_cyan]"
                />
                <motion.div 
                  initial={{ scale: 0, opacity: 0.8, x: '-50%', y: '-50%' }}
                  animate={{ scale: 5, opacity: 0, x: '-50%', y: '-50%' }}
                  transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
                  className="absolute w-32 h-12 border-2 border-white rounded-[100%] opacity-0 bg-cyan-100/30"
                />
                
                {/* Water Droplets */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (Math.PI / 12) * i + Math.PI; // Spread upwards (PI to 2PI)
                  const velocity = Math.random() * 100 + 50;
                  const tx = Math.cos(angle) * velocity * 1.5;
                  const ty = Math.sin(angle) * velocity;
                  const isLarge = Math.random() > 0.7;
                  
                  return (
                    <motion.div
                      key={i}
                      initial={{ x: 0, y: 0, scale: isLarge ? 1.5 : 0.8, opacity: 1 }}
                      animate={{ 
                        x: tx, 
                        y: [0, ty, ty + 250], // Shoot up, then fall way down
                        scale: 0,
                        opacity: [1, 1, 0]
                      }}
                      transition={{ 
                        duration: 1.2,
                        times: [0, 0.4, 1],
                        ease: ["easeOut", "easeIn"],
                      }}
                      className="absolute w-3 h-4 bg-gradient-to-b from-white to-cyan-300 rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%] shadow-lg"
                      style={{
                        clipPath: 'polygon(50% 0%, 100% 70%, 50% 100%, 0% 70%)',
                        left: -6, // center the droplet 
                        top: -8
                      }}
                    />
                  )
                })}
              </div>
            ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {/* Permanent Giant Bubble */}
      {hasGiantBubble && (
        <motion.div
          ref={bubbleRef}
          drag
          dragConstraints={containerRef}
          dragElastic={0.7}
          whileHover={{ scale: 1.05 }}
          whileTap={{ 
            scaleX: 1.1, 
            scaleY: 0.9, 
            cursor: "grabbing",
            transition: { type: "spring", stiffness: 400, damping: 10 } 
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            y: [0, 400, -200, 250, -150, 0],
            x: [0, -500, 300, -400, 200, 0]
          }}
          transition={{ 
            scale: { duration: 2, ease: "easeOut" },
            opacity: { duration: 2, ease: "easeOut" },
            y: { duration: 50, repeat: Infinity, ease: "linear" },
            x: { duration: 60, repeat: Infinity, ease: "linear" }
          }}
          className="fixed top-1/4 right-1/4 z-[2] rounded-full cursor-grab transition-colors duration-1000"
          style={{
            width: 450,
            height: 450,
            background: isBubbleYellow 
              ? 'radial-gradient(150% 150% at 30% 30%, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.1) 30%, rgba(253, 224, 71, 0.4) 60%, rgba(234, 179, 8, 0.5) 80%, rgba(255, 255, 255, 100%))'
              : 'radial-gradient(150% 150% at 30% 30%, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.1) 30%, rgba(173, 216, 230, 0.25) 60%, rgba(255, 182, 193, 0.35) 80%, rgba(255, 255, 255, 100%))',
            boxShadow: isBubbleYellow
              ? 'inset 0 0 30px rgba(255,255,255,0.8), 0 0 20px rgba(234,179,8,0.5)'
              : 'inset 0 0 30px rgba(255,255,255,0.8), 0 0 15px rgba(255,255,255,0.3)',
            backdropFilter: 'blur(3px)'
          }}
        />
      )}

      {/* VFX Layers */}
      {activeEffect === 'bath' && (
        <div className="fixed inset-0 pointer-events-none z-[5] overflow-hidden">
          {Array.from({ length: 80 }).map((_, i) => {
            // Screen-covering bubbles that pop
            const size = Math.random() * 300 + 100; 
            const left = Math.random() * 120 - 10; 
            const top = Math.random() * 120 - 10; 
            const delay = Math.random() * 0.8; // Staggered appearance and popping
            const duration = 2.5; 
            
            return (
              <motion.div
                key={`bubble-${i}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: [0, 1, 1.05, 1.05, 1.2, 0], // Grow, stay, slightly expand, pop!
                  opacity: [0, 1, 1, 1, 0, 0] // Appear, stay visible, instantly disappear
                }}
                transition={{ 
                  duration: duration, 
                  delay: delay,
                  times: [0, 0.15, 0.4, 0.8, 0.85, 1], // Timing of the keyframes
                  ease: "easeInOut"
                }}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: size,
                  height: size,
                  left: `${left}%`,
                  top: `${top}%`,
                  background: 'radial-gradient(150% 150% at 30% 30%, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.2) 30%, rgba(173, 216, 230, 0.3) 60%, rgba(255, 182, 193, 0.4) 80%, rgba(255, 255, 255, 0.7) 100%)',
                  boxShadow: 'inset 0 0 20px rgba(255,255,255,0.9), 0 0 10px rgba(255,255,255,0.4)',
                  backdropFilter: 'blur(4px)'
                }}
              />
            );
          })}
        </div>
      )}
      
      {activeEffect === 'pool' && rippleOrigin && (
        <div className="fixed inset-0 pointer-events-none z-[5] overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={`ripple-${i}`}
              initial={{ 
                scale: 0, 
                opacity: 0.8,
                x: '-50%',
                y: '-50%'
              }}
              animate={{ 
                scale: [0, 8 + i * 2], 
                opacity: [0.8, 0] 
              }}
              transition={{ 
                duration: 2.5, 
                delay: i * 0.4, 
                ease: "easeOut" 
              }}
              className="absolute rounded-full border-4 border-cyan-400 bg-cyan-500/10"
              style={{
                width: 200,
                height: 200,
                left: rippleOrigin.x,
                top: rippleOrigin.y,
                boxShadow: '0 0 50px rgba(6, 182, 212, 0.8), inset 0 0 30px rgba(6, 182, 212, 0.5)'
              }}
            />
          ))}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 bg-cyan-500 mix-blend-overlay"
          />
        </div>
      )}

      {activeEffect === 'massage' && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: [0, 0.2, 0, 0.4, 0] }} transition={{ duration: 0.5, repeat: 5 }}
          className="fixed inset-0 bg-yellow-400/20 mix-blend-overlay pointer-events-none z-[5]"
        />
      )}

      {/* 클릭한 자리에 떨어지는 번개: 매번 모양이 다른 실제 번개처럼 */}
      {lightningStrikes.map(strike => (
        <LightningBolt key={strike.id} x={strike.x} y={strike.y} w={typeof window !== 'undefined' ? window.innerWidth : 1280} h={typeof window !== 'undefined' ? window.innerHeight : 720} />
      ))}

      {/* Header */}
      <div className="w-full max-w-4xl text-center z-10 pointer-events-none">
        <h2 className="text-2xl md:text-3xl font-serif text-amber-100 mb-3 drop-shadow-sm">
          {question.title}
        </h2>
        <p className="text-slate-300 font-sans text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
          {question.subtitle}
        </p>
      </div>

      {/* Map Area */}
      <div 
        className="relative w-full max-w-5xl flex flex-col xl:flex-row justify-center items-center mt-8 z-30 gap-16 pointer-events-none transition-all duration-1000"
        style={{ filter: activeEffect === 'pool' ? 'url(#water-distortion)' : 'none' }}
      >
        
        {/* 회전 선반(시설) + 오른쪽의 오리 사무장 */}
        <div className="flex w-full items-end justify-center gap-6 px-4">
          {/* 지폐: 시설 왼쪽에 둔다. 여기서 시설로 끌어다 놓는다 */}
          <div className="hidden shrink-0 flex-col items-center gap-3 self-center md:flex">
            <motion.div
              className="max-w-[14rem] rounded-full border border-amber-500/30 bg-black/40 px-4 py-2 text-center text-sm font-bold text-amber-300 backdrop-blur-sm pointer-events-none"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              지폐를 끌어서 시설에 놓으세요
            </motion.div>
            {renderBills(true)}
            {isMd && renderBag(true)}
          </div>
          <FacilityWheel
            items={facilities}
            index={facIndex}
            onIndex={(i) => {
              setFacIndex(i);
              // 쉬지 않고(10초 안 간격) 계속 돌리면 소개 대신 사무장이 한마디 한다
              const now = Date.now();
              wheelSpins.current = now - wheelLastAt.current < 10000 ? wheelSpins.current + 1 : 1;
              wheelLastAt.current = now;
              const w = purserWheelLine(wheelSpins.current);
              if (w) purserSay(w.line, w.pose, 4800);
              else if (billsAvailable <= 0) purserSay(purserBroke(), 'palms', 4200); // 돈이 없는데 둘러볼 때
              else purserSay(purserIntro(facilities[i].id, lostGamble.current, isChild), purserIntroPose(facilities[i].id), 4800);
            }}
            hoveredId={hoveredDropZone}
            activeEffect={activeEffect}
            setRef={(id, el) => { dropZoneRefs.current[id] = el; }}
            disabled={isGamblingMode}
          >
                  {/* Souvenir Pop Animation (Interactive Draggable) */}
                  <AnimatePresence>
                    {souvenirItems.filter(i => !i.isStuck).map((item) => (
                      <motion.img
                        key={item.id}
                        src={item.img}
                        data-no-wheel
                        data-souvenir-id={item.id}
                        style={{ filter: charged[item.id] ? 'drop-shadow(0 0 8px #bcd0ff) drop-shadow(0 0 20px #6f93ff) brightness(1.5)' : undefined }}
                        drag={true}
                        dragMomentum={false}
                        onDragStart={() => {
                          if (item.img.includes('shop1') || item.img.includes('shop2')) setHeldKnife(item.id); // 칼과 찻잔은 쥐고 있는 동안 빙빙 돈다
                          if (item.isFloating) setSouvenirItems(prev => prev.map(i => i.id === item.id ? { ...i, isFloating: false } : i));
                          if (item.isStuck) {
                            setSouvenirItems(prev => prev.map(i => i.id === item.id ? { ...i, isStuck: false } : i));
                          }
                        }}
                        onDrag={handleSouvenirDrag}
                        onDragEnd={(e, info) => handleSouvenirDragEnd(e, info, item.id)}
                        initial={{ scale: 0, x: item.startX || 0, y: item.startY || 0, opacity: 1 }}
                        animate={item.isHit ? {
                          scale: [1, 1.3, 0.9, 1],
                          x: item.targetX,
                          y: item.targetY,
                          rotate: [item.rotation - 15, item.rotation + 15, item.rotation],
                        } : item.isFloating ? {
                          scale: 1,
                          x: item.targetX,
                          y: [item.targetY - 5, item.targetY + 7, item.targetY - 5],
                          rotate: [item.rotation - 7, item.rotation + 7, item.rotation - 7],
                        } : {
                          scale: 1,
                          x: item.targetX,
                          y: item.targetY,
                          rotate: heldKnife === item.id ? [item.rotation, item.rotation + 360] : item.rotation,
                        }}
                        whileHover={item.isStuck ? {} : { scale: 1.15 }}
                        whileDrag={item.isStuck ? {} : { scale: 1.25, zIndex: 300 }}
                        transition={item.isFloating ? { y: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }, default: { duration: 0.5 } } : heldKnife === item.id ? { rotate: { duration: 0.55, repeat: Infinity, ease: 'linear' }, default: { duration: 0.15 } } : item.isHit ? { duration: 0.4, type: "tween" } : item.isThrown ? { duration: 0.2, ease: "linear" } : { duration: 0.7, type: "spring", bounce: 0.4 }}
                        className={`absolute top-1/2 left-1/2 -ml-12 -mt-12 w-24 h-24 object-contain pointer-events-auto ${item.isStuck ? 'z-[100]' : 'cursor-grab active:cursor-grabbing z-[200]'}`}
                      />
                    ))}
                  </AnimatePresence>

                  {/* Teacup Shards */}
                  <AnimatePresence>
                    {shards.map(shard => (
                      <motion.img
                        key={shard.id}
                        src="/spend/shop2.webp"
                        initial={{ x: shard.x, y: shard.y, scale: 1, opacity: 1, rotate: 0 }}
                        animate={{ 
                          x: shard.x + shard.vx, 
                          y: shard.y + shard.vy + 200, // fall down
                          scale: 0.3,
                          opacity: 0,
                          rotate: (Math.random() - 0.5) * 720
                        }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute top-1/2 left-1/2 -ml-12 -mt-12 w-24 h-24 object-contain pointer-events-none z-[250]"
                        style={{ clipPath: shard.clip }}
                      />
                    ))}
                  </AnimatePresence>
          </FacilityWheel>
          {winFx && <WinShower key={winFx.key} net={winFx.net} exact={winFx.exact} />}
          <DuckPurser line={purserLineText} lineKey={purserKey} pose={purserPose} shock={purserShock} peek={peek} glow={hoveredDropZone === 'duck'} onPoke={() => { if (Date.now() < purserSeqUntil.current) return; const p = purserPoke(runIndex); if (p.follow) purserSayAll(p, p.follow); else purserSay(p.line, p.pose, 3800); }} />
        </div>
      </div>

      {/* Fixed Interactive Elements Container */}
        <div className="fixed bottom-8 w-full max-w-6xl px-8 flex justify-between items-end z-20 pointer-events-none" style={{ left: '50%', transform: 'translateX(-50%)' }}>
          
          {/* 내 가방: 좁은 화면에서만 예전 자리(오른쪽)에 둔다. 넓은 화면에서는 지폐 아래(왼쪽 열) */}
          {!isMd && renderBag(false)}
      </div>

      {/* Inventory Area */}
      <motion.div 
        className="md:hidden text-center text-sm md:text-base text-amber-300 font-bold bg-black/40 py-2 px-4 rounded-full border border-amber-500/30 backdrop-blur-sm z-50 mb-2 mt-8 pointer-events-none"
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        지폐를 드래그해서 원하는 시설에 투자하세요!
      </motion.div>
      <div className="md:hidden w-full">{renderBills(false)}</div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 pointer-events-none z-[1]">
        <ProgressLine />
      </div>

      {/* Back Button */}
      {onBack && (
        <button 
          onClick={onBack}
          className="absolute top-8 left-8 text-white/70 hover:text-white flex items-center gap-2 transition-colors z-[100]"
        >
          <span className="text-sm font-sans tracking-widest uppercase drop-shadow-md">Back</span>
        </button>
      )}

      {/* 도박장 창 뒤에서 내다보는 오리 (창과 같은 쌓임 맥락에 있어야 창 뒤로 숨는다) */}
      <PurserPeek show={peek} />

      {/* 선상 도박장 (money/CasinoModal) */}
      <AnimatePresence>
        {isGamblingMode && (
          <CasinoModal
            key="casino"
            bills={billsAvailable}
            state={gamblingState}
            result={gamblingResult}
            guess={gamblingGuess}
            target={targetDistance}
            gain={gamblingGain}
            streak={gamblingStreak}
            tier={gamblingTier}
            shipPath={shipPath}
            swordHit={swordHit}
            fireworks={winFx}
            onPick={handlePick}
            onTier={(t) => { setGamblingTier(t); playSound('snap'); }}
            onBet={handleGambleSubmit}
            onAgain={handleGambleAgain}
            onClose={closeGambleResult}
          />
        )}
      </AnimatePresence>

      {/* 전신 반대편에서 기다리는 오리: 엉덩이를 흔들다가 날아오는 신호를 숙여 피한다 */}
      {hasTelegraph && <DodgeDuck spot={spot} enter={colleagueIn} />}

      {/* Morse Telegraph UI */}
      <AnimatePresence>
        {hasTelegraph && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] pointer-events-none flex flex-col justify-center overflow-hidden"
          >
            <style>{`@keyframes machine-jolt { 0%,100% { transform: translate(0,0) } 20% { transform: translate(-3px,2px) } 40% { transform: translate(3px,-2px) } 60% { transform: translate(-2px,-2px) } 80% { transform: translate(2px,3px) } }`}</style>
            {/* Signals Flying Left */}
            <div 
              className="absolute bottom-[200px] w-full flex items-center pr-[350px]"
              style={{
                transform: `translate(${morseSignalOffset.x}px, ${morseSignalOffset.y}px)`
              }}
            >
              {/* Origin Point Debug Dot */}
              {showDebug && (
                <div className="absolute right-0 w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_red] z-[200]" />
              )}

              <AnimatePresence>
                {morseSignals.map((signal) => (
                  <motion.div
                    key={signal.id}
                    data-id={signal.id}
                    initial={{ x: 0, opacity: 1 }}
                    animate={{ x: '-100vw', opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0 } }}
                    transition={{ duration: 2, ease: "linear" }}
                    className="morse-signal absolute right-0 flex items-center justify-center"
                  >
                    {signal.type === 'dot' ? (
                      <div className="w-6 h-6 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.85)]" />
                    ) : (
                      <div className="w-24 h-6 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.85)]" />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Morse Machine (Right Side) */}
            <div 
              className="absolute right-0 bottom-8 z-[100] pointer-events-none"
              style={{
                transform: `translate(${morseOffset.x}px, ${morseOffset.y}px)`
              }}
            >
              <motion.div 
                initial={{ x: 200, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 200, opacity: 0 }}
                className="pointer-events-auto select-none"
                onPointerDown={handleMorsePointerDown}
                onPointerUp={handleMorsePointerUp}
                onPointerLeave={handleMorsePointerUp}
              >
                <img 
                  id="morse-machine-image"
                  src={isMorsePressed ? "/spend/morse-pressed.webp" : "/spend/morse.webp"} 
                  alt="Morse Machine" 
                  draggable={false}
                  className="h-96 w-auto object-contain cursor-pointer drop-shadow-2xl transition-all"
                  style={{
                    transform: morseFlip ? 'scaleX(-1)' : 'none',
                    animation: shorting ? 'machine-jolt .12s linear infinite' : undefined,
                    filter: shorting ? 'brightness(1.6) drop-shadow(0 0 14px #8fb4ff) drop-shadow(0 0 30px #5b86ff)' : undefined,
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 시설 상호작용의 화면 효과 (money/InteractionOverlays) */}
      <BubblePops pops={bubblePops} />
      <WaterZap zap={waterZap} />

      {/* Morse Hit Explosions */}
      {morseExplosions.map(ex => (
        <div key={ex.id} className="fixed z-[300] pointer-events-none" style={{ left: ex.x, top: ex.y }}>
          {/* Debug Marker */}
          {showDebug && (
             <div className="absolute w-6 h-6 bg-purple-500 rounded-full border-4 border-white -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_purple] z-10" />
          )}
          
          {/* Main Flash */}
          <motion.div 
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute w-12 h-12 border-4 border-amber-300 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_20px_rgba(251,191,36,0.9)]"
          />
          
          {/* Spreading Particles */}
          {Array.from({ length: 6 }).map((_, i) => {
             const angle = (Math.PI * 2 / 6) * i;
             const distance = 80 + Math.random() * 40;
             return (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ 
                    x: Math.cos(angle) * distance, 
                    y: Math.sin(angle) * distance, 
                    opacity: 0,
                    scale: 0
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute w-3 h-3 bg-amber-100 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.9)] -translate-x-1/2 -translate-y-1/2"
                />
             )
          })}
        </div>
      ))}

      {/* Global Barber Scissors & Hair Overlay */}
      {hasScissors && (
        <div className="fixed inset-0 z-[150] pointer-events-none overflow-hidden" style={{ cursor: 'none' }}>
          <style>{`
            /* Hide default cursor everywhere when hasScissors is active */
            body, *, button, a, input {
              cursor: none !important;
            }
          `}</style>

          {/* Custom Cursor (Scissors) */}
          <div 
            className="absolute pointer-events-none z-[160] transition-transform duration-75"
            style={{
              left: mousePos.x,
              top: mousePos.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <img 
              src={isScissorClosed ? "/spend/scissor.webp" : "/spend/scissor-open.webp"} 
              alt="scissor cursor" 
              className="w-48 md:w-64 h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
              style={{ transform: isScissorClosed ? 'rotate(-15deg)' : 'rotate(0deg)' }}
            />
          </div>
          
          {/* Visual Hit Point Debug (Red Dot) */}
          {showDebug && (
            <div 
              className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white z-[170] pointer-events-none shadow-[0_0_10px_red]"
              style={{
                left: mousePos.x - 53,
                top: mousePos.y,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
          
          {/* Top Attached Hairs */}
          {hairs.map((hair, i) => (
            <motion.div 
              key={hair.id}
              className="absolute top-0 overflow-hidden pointer-events-none origin-top"
              initial={{ y: -hair.height, rotate: 0 }}
              animate={{ 
                y: 0,
                rotate: [-2 - (i % 2), 2 + (i % 2), -2 - (i % 2)]
              }}
              transition={{ 
                y: { duration: 0.8 + (i * 0.05), ease: "easeOut" },
                rotate: { duration: 4 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }
              }}
              style={{
                left: `${hair.xPercent}%`,
                width: `${hair.width}px`,
                height: `${hair.cutY}px`,
              }}
            >
              <img 
                src={hair.src} 
                alt="hair"
                draggable={false}
                className="pointer-events-none select-none"
                style={{ width: '100%', height: `${hair.height}px` }} 
              />
            </motion.div>
          ))}
          
          {/* Falling Snippets */}
          <AnimatePresence>
            {fallingHairs.map(hair => {
              const waterY = typeof window !== 'undefined' ? window.innerHeight * 0.95 : 800;
              return (
              <motion.div 
                key={hair.id}
                initial={{ y: hair.cutY, opacity: 1, rotate: 0, x: 0 }}
                animate={hasWater ? {
                  y: [hair.cutY, waterY, waterY, waterY],
                  x: [0, 0, 0, (Math.random() - 0.5) * 100],
                  opacity: [1, 1, 0.5, 0.5],
                  rotate: [0, 0, 0, (Math.random() - 0.5) * 30]
                } : {
                  y: [hair.cutY, (typeof window !== 'undefined' ? window.innerHeight * 1.5 : 1500)],
                  opacity: 1,
                  rotate: [0, (Math.random() - 0.5) * 180],
                  x: 0
                }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={hasWater ? { 
                  duration: 20, 
                  times: [0, 0.03, 0.05, 1], 
                  ease: ["easeIn", "easeOut", "linear"] 
                } : { 
                  duration: 1.5, 
                  ease: "easeIn" 
                }}
                className="absolute overflow-hidden pointer-events-none"
                style={{
                  left: `${hair.xPercent}%`,
                  width: `${hair.width}px`,
                  height: `${hair.height}px`,
                }}
              >
                <img 
                  src={hair.src} 
                  alt="falling hair"
                  draggable={false}
                  className="pointer-events-none select-none"
                  style={{ width: '100%', height: `${hair.originalHeight}px`, transform: `translateY(-${hair.cutY}px)` }} 
                />
              </motion.div>
            )})}
          </AnimatePresence>
        </div>
      )}

      {/* 사용법 시범: 지폐 한 장이 시설로 끌려가는 모습 */}
      <AnimatePresence>
        {demo && (
          <>
            <motion.div
              key={`demo-${demo.n}`}
              aria-hidden
              className="pointer-events-none fixed z-[140]"
              style={{ left: demo.sx, top: demo.sy, marginLeft: -96, marginTop: -48 }}
              initial={{ opacity: 0, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: [0, 1, 1, 1, 0], x: [0, 0, demo.dx, demo.dx, demo.dx], y: [0, -8, demo.dy, demo.dy, demo.dy], scale: [1, 1.15, 1.15, 1.02, 0.85] }}
              transition={{ duration: 2.9, times: [0, 0.12, 0.62, 0.86, 1], ease: 'easeInOut' }}
            >
              <img src="/spend/bill.webp" alt="" draggable={false} className="w-48 h-auto opacity-90 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]" />
              {/* 손가락으로 누른 자리를 나타내는 원 */}
              <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-white/25 shadow-[0_0_14px_rgba(255,255,255,0.7)]" />
            </motion.div>
            <motion.div
              key={`demo-ring-${demo.n}`}
              aria-hidden
              className="pointer-events-none fixed z-[139] h-24 w-24 rounded-full border-4 border-amber-300"
              style={{ left: demo.sx + demo.dx - 48, top: demo.sy + demo.dy - 48 }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.5, 1, 1.5] }}
              transition={{ delay: 1.7, duration: 0.9, ease: 'easeOut' }}
            />
          </>
        )}
      </AnimatePresence>

      {/* 총에 맞았을 때: 사망 카드가 나온 뒤 처음부터 다시 시작한다 */}
      {dead && <DeathCard soft onDone={restartJourney} />}

    </div>
  );
}
