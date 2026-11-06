'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useAnimationFrame, animate, PanInfo } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Question } from '@/data/questions';
import ProgressLine from '@/components/ui/ProgressLine';
import ClassicButton from '@/components/ui/ClassicButton';
import FacilityWheel from '@/components/question/FacilityWheel';
import DuckPurser, { purserGreeting, purserLast, purserLine, purserPoke, purserIntro, purserIntroPose, type PurserPose } from '@/components/question/DuckPurser';
import { useQuizStore } from '@/store/quizStore';
import DeathCard from '@/components/ui/DeathCard';
import { restartJourney } from '@/lib/session';
import { unlock } from '@/engine/achievements';
import { playGunshot } from '@/lib/synth';

interface MoneyMinigameViewProps {
  question: Question;
  onAnswer: (value: string, extra?: Record<string, unknown>) => void;
  onBack: () => void;
}

const FACILITIES = [
  { id: 'gamble', name: '선상 도박', img: '/spend/icon_gamble.webp', color: 'bg-red-900/40 border-red-500/50' },
  { id: 'barber', name: '이발소', img: '/spend/icon_barber.webp', color: 'bg-orange-900/40 border-orange-500/50' },
  { id: 'massage', name: '전기 마사지', img: '/spend/icon_massage.webp', color: 'bg-yellow-900/40 border-yellow-500/50' },
  { id: 'telegraph', name: '무선 전신', img: '/spend/icon_telegraph.webp', color: 'bg-slate-900/40 border-slate-500/50' },
  { id: 'bath', name: '목욕탕', img: '/spend/icon_bath.webp', color: 'bg-teal-900/40 border-teal-500/50' },
  { id: 'pool', name: '수영장', img: '/spend/icon_pool.webp', color: 'bg-blue-900/40 border-blue-500/50' },
  { id: 'souvenir', name: '기념품 구입', img: '/spend/icon_souvenir.webp', color: 'bg-pink-900/40 border-pink-500/50' },
];

// 도박 범위: 좁게 맞출수록 확률은 낮고 보상은 크다 (기댓값이 거의 0이 되도록 맞춤)
// 확률은 480~550 해리 71개 값 중 범위에 드는 비율. 보상은 순이익 지폐 수.
const GAMBLE_TIERS = [
  { id: 'safe', name: '안전', tol: 17, net: 2, odds: '약 49%', zone: 'bg-green-500/35' },
  { id: 'mid', name: '보통', tol: 8, net: 3, odds: '약 24%', zone: 'bg-yellow-400/40' },
  { id: 'risky', name: '위험', tol: 2, net: 12, odds: '약 7%', zone: 'bg-red-500/45' },
] as const;
type GambleTierId = (typeof GAMBLE_TIERS)[number]['id'];
// 결과 공개 연출: 배가 정답 주변을 오가며 점점 좁혀 든다
const REVEAL_MS = 5200;
// 종이 지도 그림에서 실제 종이 부분(테두리 바깥 여백 제외), 트랙 상자 대비 %
const SWORD_W = 44; // 칼 이미지(640x1173) 표시 너비(px)
const PAPER = { l: 5, r: 5, t: 16, b: 16 };
const REVEAL_TIMES = [0, 0.28, 0.5, 0.7, 0.86, 1];
const TICK_AT = [300, 700, 1150, 1650, 2200, 2800, 3450, 4150, 4800];

export default function MoneyMinigameView({ question, onAnswer, onBack }: MoneyMinigameViewProps) {
  // State
  const [facIndex, setFacIndex] = useState(0); // 회전 선반에서 가운데에 온 시설
  const [billsAvailable, setBillsAvailable] = useState(5);
  const [billsInBag, setBillsInBag] = useState(0);
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
  const [gamblingGain, setGamblingGain] = useState(0); // 이번 판 순이익
  const [shipPath, setShipPath] = useState<number[]>([]); // 배가 오가는 지점(해리)
  const gambleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [targetSpendCount, setTargetSpendCount] = useState(0);
  const [isTargetUnlocked, setIsTargetUnlocked] = useState(false);

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
  const [isDraggingDuck, setIsDraggingDuck] = useState(false);
  const [hasLightningAbility, setHasLightningAbility] = useState(false);
  const [hasTelegraph, setHasTelegraph] = useState(false);
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
  const targetLastResetTime = useRef<number>(0);

  // Barber & Souvenir VFX State
  const [hasScissors, setHasScissors] = useState(false);
  const [hairs, setHairs] = useState<{ id: number, xPercent: number, width: number, height: number, cutY: number, src: string, isMagic: boolean }[]>([]);
  const [fallingHairs, setFallingHairs] = useState<{ id: number, xPercent: number, width: number, height: number, cutY: number, originalHeight: number, src: string }[]>([]);
  const [souvenirItems, setSouvenirItems] = useState<{ id: number, img: string, targetX: number, targetY: number, rotation: number, isHit?: boolean, isThrown?: boolean, isStuck?: boolean, startX?: number, startY?: number, stuckX?: number, stuckY?: number }[]>([]);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isScissorClosed, setIsScissorClosed] = useState(false);
  const [targetHit, setTargetHit] = useState(false);
  const [isHairInWater, setIsHairInWater] = useState(false);
  const [morseExplosions, setMorseExplosions] = useState<{ id: number, x: number, y: number }[]>([]);
  const [morseHitOffsetPercent, setMorseHitOffsetPercent] = useState(56);
  
  // Target Zombification State
  const [targetHitCount, setTargetHitCount] = useState(0);
  const targetWalkX = useMotionValue(0);
  const [targetState, setTargetState] = useState<'normal' | 'zombie_bucket' | 'zombie' | 'retreating'>('normal');
  const [bucketOffset, setBucketOffset] = useState({ x: -10, y: -90, rotate: 0, scale: 1.2 });
  const [showQuestionMark, setShowQuestionMark] = useState(false);

  // Gamble UI Debug State
  const [gmbWidth, setGmbWidth] = useState(64);
  const [gmbMaxWidth, setGmbMaxWidth] = useState(60);
  const [gmbPadTop, setGmbPadTop] = useState(5.75);
  const [gmbPadBottom, setGmbPadBottom] = useState(4.75);
  const [gmbPadX, setGmbPadX] = useState(2.5);
  const [gmbTitleMb, setGmbTitleMb] = useState(1.5);
  const [gmbTextMb, setGmbTextMb] = useState(5);
  const [gmbTrackMb, setGmbTrackMb] = useState(2.5);
  const [gmbTrackWidth, setGmbTrackWidth] = useState(51);
  const [gmbTrackHeight, setGmbTrackHeight] = useState(5);



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

  // Morse Signal Collision Detection
  useEffect(() => {
    if (!hasTelegraph) return;
    
    let frameId: number;
    const checkCollisions = () => {
      // Prevent hits from ghost DOM elements immediately after resetting
      if (Date.now() - targetLastResetTime.current < 500) {
        frameId = requestAnimationFrame(checkCollisions);
        return;
      }

      if (isTargetUnlocked && dropZoneRefs.current['target'] && targetState !== 'retreating') {
        const targetRect = dropZoneRefs.current['target']!.getBoundingClientRect();
        const signals = document.querySelectorAll('.morse-signal');
        
        signals.forEach(sig => {
          const rect = sig.getBoundingClientRect();
          // Wait until the signal's front edge (left) reaches the customizable hit offset of the target
          const targetCenterX = targetRect.left + (targetRect.width * (morseHitOffsetPercent / 100));
          if (rect.left < targetCenterX && rect.right > targetRect.left && rect.top < targetRect.bottom && rect.bottom > targetRect.top) {
             const id = Number(sig.getAttribute('data-id'));
             if (id && !sig.hasAttribute('data-hit')) {
               sig.setAttribute('data-hit', 'true'); // Prevent double triggers
               
               const hitX = rect.left;
               const hitY = rect.top + rect.height / 2;
               const hitId = Date.now() + Math.random();
               
               setMorseExplosions(prev => [...prev, { id: hitId, x: hitX, y: hitY }]);
               setTimeout(() => {
                 setMorseExplosions(prev => prev.filter(e => e.id !== hitId));
               }, 1000);

               setMorseSignals(prev => {
                 if (prev.some(s => s.id === id)) {
                   setTargetHitCount(c => c + 1); // Increment hit count
                   setTargetHit(true);
                   setTimeout(() => setTargetHit(false), 500);
                   return prev.filter(s => s.id !== id); // Remove the hit signal
                 }
                 return prev;
               });
             }
          }
        });
      }
      frameId = requestAnimationFrame(checkCollisions);
    };
    
    frameId = requestAnimationFrame(checkCollisions);
    return () => cancelAnimationFrame(frameId);
  }, [hasTelegraph, isTargetUnlocked, morseHitOffsetPercent, targetState]);

  // Target Zombification Phase Evaluation
  useEffect(() => {
    if (targetHitCount >= 13) {
      setTargetState('retreating');
    } else if (targetHitCount >= 8) {
      setTargetState('zombie');
    } else if (targetHitCount >= 3) {
      setTargetState('zombie_bucket');
    } else {
      setTargetState('normal');
    }
  }, [targetHitCount]);

  // Target Movement & Collision Loop
  useEffect(() => {
    if (targetState === 'normal') {
      targetWalkX.set(0);
      return;
    }
    
    let frameId: number;
    const loop = () => {
      if (targetState === 'retreating') {
         const next = targetWalkX.get() - 4; // retreat speed
         if (next <= 0) {
            targetWalkX.set(0);
            setTargetHitCount(0); // Trigger reset to normal
            setMorseSignals([]); // Clear leftover signals to prevent instant ghost hits
            setSouvenirItems(prev => prev.filter(i => !i.isStuck)); // Clear stuck items
            targetLastResetTime.current = Date.now(); // 500ms invulnerability
         } else {
            targetWalkX.set(next);
            frameId = requestAnimationFrame(loop);
         }
      } else if (targetState === 'zombie' || targetState === 'zombie_bucket') {
         targetWalkX.set(targetWalkX.get() + 0.8); // walk speed
         
         // Check collision with Morse Machine
         const targetEl = dropZoneRefs.current['target'];
         const morseEl = document.getElementById('morse-machine-image');
         if (targetEl && morseEl) {
           const tRect = targetEl.getBoundingClientRect();
           const mRect = morseEl.getBoundingClientRect();
           if (tRect.right > mRect.left + 50) { // Slight overlap before collision
             setShowQuestionMark(true);
             setTargetHitCount(13); // Force retreat
             setTimeout(() => setShowQuestionMark(false), 2000);
           }
         }
         
         frameId = requestAnimationFrame(loop);
      }
    };
    
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [targetState]);

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
    
    const type: 'dot' | 'dash' = duration < 200 ? 'dot' : 'dash';
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

  const handleDrag = (event: any, info: any) => {
    const hoveredId = checkCollision(info.point.x, info.point.y);
    setHoveredDropZone(hoveredId);
  };

  const handleSouvenirDrag = (e: any, info: PanInfo) => {
    const id = checkCollision(info.point.x, info.point.y);
    setHoveredDropZone((id === 'mybag' || id === 'target') ? id : null);
  };

  const shatterTeacup = (x: number, y: number, itemId: number) => {
    playSound('glass');
    setTargetHit(true);
    setTimeout(() => setTargetHit(false), 500);

    const newShards = [
      { id: Date.now() + 1, x, y, clip: 'polygon(0 0, 50% 20%, 30% 50%, 0 30%)', vx: -150, vy: -100 },
      { id: Date.now() + 2, x, y, clip: 'polygon(50% 20%, 100% 0, 100% 40%, 60% 60%)', vx: 150, vy: -150 },
      { id: Date.now() + 3, x, y, clip: 'polygon(30% 50%, 60% 60%, 80% 100%, 10% 90%)', vx: -80, vy: 150 },
      { id: Date.now() + 4, x, y, clip: 'polygon(100% 40%, 100% 100%, 80% 100%, 60% 60%)', vx: 180, vy: 100 },
      { id: Date.now() + 5, x, y, clip: 'polygon(0 30%, 30% 50%, 10% 90%, 0 100%)', vx: -180, vy: 50 }
    ];
    setShards(prev => [...prev, ...newShards]);
    setSouvenirItems(prev => prev.filter(i => i.id !== itemId));

    setTimeout(() => {
      setShards(prev => prev.filter(s => !newShards.find(ns => ns.id === s.id)));
    }, 1000);
  };

  // ── 오리 이스터에그: 기념품 가게의 칼로 오리 사무장을 두 번 위협하면 ──
  // 첫 번째는 경고(권총이 나온다), 두 번째는 발사. 총에 맞으면 사망 카드 뒤에 처음부터 다시 시작한다.
  const [duckArmed, setDuckArmed] = useState(false);
  const [duckFiring, setDuckFiring] = useState(false);
  const [dead, setDead] = useState(false);
  const knifeThreats = useRef(0);
  const knifeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const THREATS = [
    '…그 칼, 정중히 내려놓으시오. 나는 비상용 장비가 있소. 한 번만 말하겠소.',
    '손님, 그것은 영수증에 포함되지 않소. 내려놓는 편이 건강에 좋소.',
    '제복 안쪽에는 비상용 계산기가 있소. 아주 묵직한 것이오.',
  ];
  const onKnifeAtDuck = () => {
    if (dead) return;
    knifeThreats.current += 1;
    if (knifeTimer.current) clearTimeout(knifeTimer.current);
    if (knifeThreats.current === 1) {
      setDuckArmed(true);
      purserSay(THREATS[Math.floor(Math.random() * THREATS.length)], 'refuse', 5200);
      // 잠시 칼을 거두면 오리도 물러선다
      knifeTimer.current = setTimeout(() => {
        knifeThreats.current = 0;
        setDuckArmed(false);
        purserSay('…방금은 못 본 걸로 하겠소. 장부에도 적지 않겠소.', 'shrug', 4200);
      }, 14000);
    } else {
      setDuckFiring(true);
      playGunshot();
      purserSay('…경고는 한 번이면 충분했소.', 'refuse', 1500);
      unlock('duck-gun');
      setTimeout(() => setDead(true), 420);
    }
  };
  useEffect(() => () => { if (knifeTimer.current) clearTimeout(knifeTimer.current); }, []);
  // 개발 서버에서만: 브라우저 콘솔에서 위협을 시험할 수 있게 한다
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') (window as unknown as { __duck?: unknown }).__duck = { threat: () => onKnifeAtDuck(), stamp: () => purserSay('도장 시험이오. 받았소.', 'stamp', 3500) };
  });

  const handleSouvenirDragEnd = (e: any, info: PanInfo, itemId: number) => {
    const droppedId = checkCollision(info.point.x, info.point.y);
    setHoveredDropZone(null);
    
    const item = souvenirItems.find(i => i.id === itemId);
    if (!item) return;

    // 칼(shop1)을 오리 사무장 위에서 놓으면 위협이 된다
    if (item.img.includes('shop1')) {
      const duck = document.querySelector('[data-duck]')?.getBoundingClientRect();
      if (duck && info.point.x >= duck.left && info.point.x <= duck.right && info.point.y >= duck.top && info.point.y <= duck.bottom) {
        onKnifeAtDuck();
        return;
      }
    }

    const newX = item.targetX + info.offset.x;
    const newY = item.targetY + info.offset.y;

    // Check throwing mechanic (High Velocity)
    const speed = Math.hypot(info.velocity.x, info.velocity.y);
    if ((item.img.includes('shop1') || item.img.includes('shop2')) && speed > 200) {
      const dx = info.velocity.x / speed;
      const dy = info.velocity.y / speed;
      
      let hitTargetId: number | null = null;
      let hitRelX = 0;
      let hitRelY = 0;
      let hitStuckX = 0;
      let hitStuckY = 0;
      
      const targetEl = dropZoneRefs.current['target'];
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        // Target absolute center on screen
        const targetCenterX = rect.left + rect.width * (debugHitX / 100);
        const targetCenterY = rect.top + rect.height * (debugHitY / 100);
        
        const swordScreenX = info.point.x;
        const swordScreenY = info.point.y;
        
        const vx = targetCenterX - swordScreenX;
        const vy = targetCenterY - swordScreenY;
        const t_proj = vx * dx + vy * dy;
        
        if (t_proj > 0) {
          const px = swordScreenX + t_proj * dx;
          const py = swordScreenY + t_proj * dy;
          const distToLine = Math.hypot(targetCenterX - px, targetCenterY - py);
          const R = rect.width * debugHitRadius; // Exact visual bullseye radius relative to width
          
          if (distToLine < R) { // Exact circle hit
            hitTargetId = 999;
            const t_hit = t_proj - Math.sqrt(R * R - distToLine * distToLine);
            
            // The exact hit point relative to the throw trajectory
            hitRelX = newX + t_hit * dx;
            hitRelY = newY + t_hit * dy;

            // The exact hit point in screen coordinates
            const hitScreenX = swordScreenX + t_hit * dx;
            const hitScreenY = swordScreenY + t_hit * dy;
            
            // The relative offset from the target's bullseye
            hitStuckX = hitScreenX - targetCenterX;
            hitStuckY = hitScreenY - targetCenterY;
          }
        }
      }

      if (hitTargetId) {
        // Thrown and HIT!
        const throwAngle = Math.atan2(dy, dx) * 180 / Math.PI;

        if (item.img.includes('shop2')) {
          setSouvenirItems(prev => prev.map(i => {
            if (i.id === itemId) return { ...i, targetX: hitRelX, targetY: hitRelY, rotation: throwAngle, isThrown: true };
            return i;
          }));
          setTimeout(() => shatterTeacup(hitRelX, hitRelY, itemId), 150);
          return;
        }

        setSouvenirItems(prev => prev.map(i => {
          if (i.id === itemId) return { ...i, targetX: hitRelX, targetY: hitRelY, stuckX: hitStuckX, stuckY: hitStuckY, rotation: throwAngle + 45, isThrown: true };
          return i;
        }));
        
        setTimeout(() => {
          playSound('scissors');
          setTargetHit(true);
          setSouvenirItems(prev => prev.map(i => {
            if (i.id === itemId) return { ...i, isStuck: true, isThrown: false }; // Keep exactly the same rotation
            return i;
          }));
          
          setTimeout(() => setTargetHit(false), 500);
        }, 150); // Flight delay
        return;
      } else {
        // Thrown and MISS! Fly off screen
        const farX = newX + dx * 2500;
        const farY = newY + dy * 2500;
        
        setSouvenirItems(prev => prev.map(i => {
          if (i.id === itemId) return { ...i, targetX: farX, targetY: farY, rotation: i.rotation + 1080, isThrown: true };
          return i;
        }));
        
        // Respawn from opposite side
        setTimeout(() => {
          setSouvenirItems(prev => {
            const filtered = prev.filter(i => i.id !== itemId);
            const oppositeX = dx > 0 ? -1500 : 1500;
            const oppositeY = dy > 0 ? -1000 : 1000;
            const landX = (Math.random() - 0.5) * 500;
            const landY = -Math.random() * 300 - 150;
            
            return [...filtered, {
              id: Date.now() + Math.random(),
              img: item.img,
              startX: oppositeX,
              startY: oppositeY,
              targetX: landX,
              targetY: landY,
              rotation: item.rotation + 720,
              isThrown: true
            }];
          });
        }, 400);
        return;
      }
    }

    // Direct drop onto target
    if (droppedId === 'target') {
      if (item.img.includes('shop1')) {
        playSound('scissors');
        setTargetHit(true);
        setSouvenirItems(prev => prev.map(i => {
          if (i.id === itemId) return { ...i, isStuck: true, targetX: newX, targetY: newY };
          return i;
        }));
        setTimeout(() => setTargetHit(false), 500);
        return;
      } else if (item.img.includes('shop2')) {
        shatterTeacup(newX, newY, itemId);
        return;
      }
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
    const hoveredId = checkCollision(info.point.x, info.point.y);
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
      setIsTargetUnlocked(true);
      
      const images = ['/spend/shop2.webp', '/spend/shop3.webp', '/spend/shop4.webp'];
      const newItems = [
        { img: '/spend/shop1.webp' }, // guarantee sword
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
    } else if (id === 'target') {
      playSound('scissors');
      setTargetHit(true);
      setTimeout(() => setTargetHit(false), 500);
      setTargetSpendCount(prev => prev + 1);
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
  const purserSay = (text: string, pose: PurserPose = 'idle', ms = 3600) => {
    if (purserTimer.current) clearTimeout(purserTimer.current);
    setPurserLineText(text);
    setPurserPose(pose);
    setPurserKey((k) => k + 1);
    purserTimer.current = setTimeout(() => {
      setPurserLineText(null);
      setPurserPose('idle');
    }, ms);
  };
  useEffect(() => {
    const t = setTimeout(() => purserSay(purserGreeting(runIndex), 'greet', 4800), 1200);
    return () => {
      clearTimeout(t);
      if (purserTimer.current) clearTimeout(purserTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrop = (id: string) => {
    if (billsAvailable <= 0) return;

    if (id === 'mybag') {
      setBillsAvailable(prev => prev - 1);
      setBillsInBag(prev => prev + 1);
      playSound('bag');
      purserSay(billsAvailable === 1 ? purserLast(runIndex, true) : purserLine('mybag', billsInBag), billsAvailable === 1 ? 'bow' : 'stamp');
    } else if (id === 'gamble') {
      // Don't consume bill immediately, open modal
      setIsGamblingMode(true);
      purserSay(purserLine('gamble', gambleCount), 'refuse');
    } else {
      // Regular facilities
      setBillsAvailable(prev => prev - 1);
      setSpentOn(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
      triggerVFX(id);
      purserSay(billsAvailable === 1 ? purserLast(runIndex, false) : purserLine(id, spentOn[id] ?? 0), billsAvailable === 1 ? 'bow' : (spentOn[id] ?? 0) > 0 ? 'ledger' : 'stamp');
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gamblingState !== 'idle') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // 종이 안쪽 영역 기준으로 환산한다
    const inner = (x / rect.width - PAPER.l / 100) / (1 - (PAPER.l + PAPER.r) / 100);
    const distance = Math.round(480 + (Math.max(0, Math.min(1, inner)) * 70));
    setGamblingGuess(distance);
    setSwordHit((n) => n + 1);
    playSound('snap'); // 칼이 꽂히는 소리
  };

  useEffect(() => () => gambleTimers.current.forEach(clearTimeout), []);

  const handleGambleSubmit = () => {
    if (billsAvailable <= 0 || gamblingState !== 'idle') return;

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
      const isExact = won && error <= 1;

      setGamblingResult(isExact ? 'exact' : (won ? 'win' : 'lose'));
      setGamblingState('result');

      if (won) {
        const net = tier.net + streakBefore; // 연승할수록 보상이 1장씩 늘어난다
        setGamblingGain(net);
        setGamblingStreak(streakBefore + 1);
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
        setGamblingGain(-1);
        setGamblingStreak(0);
        playSound('lose');
        setBillsAvailable(prev => prev - 1);
      }
    }, REVEAL_MS));
  };

  const handleGambleCancel = () => {
    gambleTimers.current.forEach(clearTimeout);
    gambleTimers.current = [];
    setIsGamblingMode(false);
    setGamblingState('idle');
    setGamblingStreak(0);
  };

  const closeGambleResult = handleGambleCancel;

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
    setLightningStrikes(prev => [...prev, { id, x: e.clientX, y: e.clientY }]);
    
    // Check lightning collision with duck and bubble
    if (duckRef.current) {
      const rect = duckRef.current.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        setIsDuckDamaged(true);
      }
    }
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
    }, 600);
  };

  // Render draggable bills
  const renderBills = () => {
    const displayCount = Math.min(billsAvailable, 5);
    const hasMore = billsAvailable > 5;
    
    return (
      <div className="relative w-full h-32 flex justify-center items-center mt-12 z-50 pointer-events-none">
        {Array.from({ length: displayCount }).map((_, i) => (
          <motion.div
            key={`bill-${i}`}
            drag
            dragSnapToOrigin
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
            {targetSpendCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 font-bold text-xl drop-shadow-md text-center"
              >
                이상한 소비 습관을 가지셨네요
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <ClassicButton onClick={handleSubmitFinal} className="px-12 text-base">선택 완료</ClassicButton>
            </motion.div>
          </div>
        )}
        {hasMore && (
          <div className="absolute left-1/2 ml-24 bottom-2 bg-red-600 text-white font-bold px-3 py-1 rounded-full border-2 border-white/20 shadow-lg text-sm pointer-events-auto z-[150]">
            x{billsAvailable}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} onClick={handleGlobalClick} className="w-full relative min-h-screen py-12 px-6 overflow-hidden flex flex-col items-center">
      
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
            <div className="font-bold mb-1 text-amber-400">Morse Hit Offset (%)</div>
            <div className="flex gap-2 items-center mb-1">
              <input 
                type="range" min="0" max="100" 
                value={morseHitOffsetPercent}
                onChange={e => setMorseHitOffsetPercent(Number(e.target.value))}
                className="w-full"
              />
              <span className="w-8 text-right">{morseHitOffsetPercent}%</span>
            </div>
          </div>
          
          <div className="mb-4 border-b-2 border-amber-500 pb-2">
            <div className="font-bold mb-1 text-amber-400">Target Bucket Setup</div>
            {['x', 'y', 'rotate', 'scale'].map((axis) => (
              <div key={axis} className="flex gap-2 items-center mb-1">
                <span className="w-12">{axis.toUpperCase()}</span>
                <input 
                  type="range" 
                  min={axis === 'scale' ? "0" : "-360"} 
                  max={axis === 'scale' ? "3" : "360"} 
                  step={axis === 'scale' ? "0.1" : "1"}
                  value={(bucketOffset as any)[axis]} 
                  onChange={e => setBucketOffset(prev => ({ ...prev, [axis]: Number(e.target.value) }))}
                  className="w-full"
                />
                <span className="w-8 text-right">{(bucketOffset as any)[axis]}</span>
              </div>
            ))}
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

          <div className="mb-2 border-b border-gray-700 pb-2">
            <div className="font-bold mb-1 text-amber-400">Gamble Modal UI</div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-16">Width %</label>
              <input type="range" min="50" max="100" value={gmbWidth} onChange={e => setGmbWidth(Number(e.target.value))} className="w-full" />
              <span className="w-8 text-right">{gmbWidth}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-16">MaxW(rem)</label>
              <input type="range" min="20" max="60" value={gmbMaxWidth} onChange={e => setGmbMaxWidth(Number(e.target.value))} className="w-full" />
              <span className="w-8 text-right">{gmbMaxWidth}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-16">Pad Top</label>
              <input type="range" min="0" max="10" step="0.25" value={gmbPadTop} onChange={e => setGmbPadTop(Number(e.target.value))} className="w-full" />
              <span className="w-8 text-right">{gmbPadTop}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-16">Pad Bot</label>
              <input type="range" min="0" max="10" step="0.25" value={gmbPadBottom} onChange={e => setGmbPadBottom(Number(e.target.value))} className="w-full" />
              <span className="w-8 text-right">{gmbPadBottom}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-16">Pad X</label>
              <input type="range" min="0" max="10" step="0.25" value={gmbPadX} onChange={e => setGmbPadX(Number(e.target.value))} className="w-full" />
              <span className="w-8 text-right">{gmbPadX}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-16">Title MB</label>
              <input type="range" min="0" max="5" step="0.25" value={gmbTitleMb} onChange={e => setGmbTitleMb(Number(e.target.value))} className="w-full" />
              <span className="w-8 text-right">{gmbTitleMb}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-16">Text MB</label>
              <input type="range" min="0" max="5" step="0.25" value={gmbTextMb} onChange={e => setGmbTextMb(Number(e.target.value))} className="w-full" />
              <span className="w-8 text-right">{gmbTextMb}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-16">Track MB</label>
              <input type="range" min="0" max="5" step="0.25" value={gmbTrackMb} onChange={e => setGmbTrackMb(Number(e.target.value))} className="w-full" />
              <span className="w-8 text-right">{gmbTrackMb}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-16">Tr Width</label>
              <input type="range" min="30" max="100" step="1" value={gmbTrackWidth} onChange={e => setGmbTrackWidth(Number(e.target.value))} className="w-full" />
              <span className="w-8 text-right">{gmbTrackWidth}</span>
            </div>
            <div className="flex gap-2 items-center mb-1">
              <label className="w-16">Tr Height</label>
              <input type="range" min="1" max="10" step="0.5" value={gmbTrackHeight} onChange={e => setGmbTrackHeight(Number(e.target.value))} className="w-full" />
              <span className="w-8 text-right">{gmbTrackHeight}</span>
            </div>
          </div>
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

      {/* Background Dim for Modal */}
      <AnimatePresence>
        {isGamblingMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[100]"
          />
        )}
      </AnimatePresence>

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

      {/* Permanent Global Lightning Strikes on Click */}
      {lightningStrikes.map(strike => (
        <div key={strike.id} className="fixed inset-0 pointer-events-none z-[100]">
          {/* Main Bolt */}
          <motion.svg
            className="absolute top-0"
            style={{ 
              left: strike.x - 50,
              width: '100px',
              height: `${strike.y}px` 
            }}
            viewBox={`0 0 100 1000`}
            preserveAspectRatio="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0, 1, 0, 0.8, 0] }}
            transition={{ duration: 0.6, times: [0, 0.1, 0.2, 0.3, 0.4, 0.6, 1] }}
          >
            <path
              d="M 50,0 L 20,150 L 70,300 L 10,450 L 80,600 L 30,750 L 60,900 L 50,1000"
              stroke="#fbbf24"
              strokeWidth="6"
              fill="none"
              style={{ filter: 'drop-shadow(0 0 10px #fbbf24) drop-shadow(0 0 20px #fef08a)' }}
            />
            <path
              d="M 50,0 L 70,200 L 20,400 L 90,600 L 10,800 L 50,1000"
              stroke="#ffffff"
              strokeWidth="3"
              fill="none"
              style={{ filter: 'drop-shadow(0 0 5px #ffffff)' }}
            />
          </motion.svg>
          
          {/* White Screen Flash */}
          <motion.div
            className="absolute inset-0 bg-white mix-blend-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0, 0.5, 0] }}
            transition={{ duration: 0.4 }}
          />
        </div>
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
          <FacilityWheel
            items={FACILITIES}
            index={facIndex}
            onIndex={(i) => { setFacIndex(i); purserSay(purserIntro(FACILITIES[i].id), purserIntroPose(FACILITIES[i].id), 4800); }}
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
                        drag={true}
                        dragMomentum={false}
                        onDragStart={() => {
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
                        } : { 
                          scale: 1,
                          x: item.targetX,
                          y: item.targetY,
                          rotate: item.rotation,
                        }}
                        whileHover={item.isStuck ? {} : { scale: 1.15 }}
                        whileDrag={item.isStuck ? {} : { scale: 1.25, zIndex: 300 }}
                        transition={item.isHit ? { duration: 0.4, type: "tween" } : item.isThrown ? { duration: 0.2, ease: "linear" } : { duration: 0.7, type: "spring", bounce: 0.4 }}
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
          <DuckPurser line={purserLineText} lineKey={purserKey} pose={purserPose} armed={duckArmed} firing={duckFiring} onPoke={() => { const p = purserPoke(runIndex); purserSay(p.line, p.pose, 3800); }} />
        </div>
      </div>

      {/* Fixed Interactive Elements Container */}
        <div className="fixed bottom-8 w-full max-w-6xl px-8 flex justify-between items-end z-20 pointer-events-none" style={{ left: '50%', transform: 'translateX(-50%)' }}>
          
          {/* Target (Left) */}
          <AnimatePresence>
            {isTargetUnlocked && (
              <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.3 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.3 }}
                transition={{ type: "spring", bounce: 0.5 }}
              >
                <motion.div 
                  ref={el => { dropZoneRefs.current['target'] = el; }}
                  onClick={handleTargetClick}
                  className={`relative w-64 md:w-96 flex flex-col items-center justify-end gap-2 select-none pointer-events-auto cursor-pointer`}
                  style={{ x: targetWalkX }}
                  animate={{
                    scaleX: targetState === 'retreating' ? -1 : 1,
                    scale: targetHit ? [1, 1.2, 0.9, 1] : hoveredDropZone === 'target' ? 1.1 : 1,
                  }}
                  transition={{ scaleX: { type: 'tween', duration: 0.15 }, scale: { duration: 0.5 } }}
                  draggable={false}
                >
                  {/* Waddling wrapper using pure CSS — no Framer Motion rotate so it can cleanly stop */}
                  <div
                    className={[
                      'relative w-full flex flex-col items-center',
                      !targetHit && (targetState === 'zombie' || targetState === 'zombie_bucket') ? 'target-waddle' : '',
                      !targetHit && targetState === 'retreating' ? 'target-waddle-fast' : '',
                    ].join(' ')}
                  >
                    {/* Question Mark Pop-up */}
                    <AnimatePresence>
                      {showQuestionMark && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0, y: 20, scaleX: targetState === 'retreating' ? -1 : 1 }}
                          animate={{ opacity: 1, scale: 1, y: -40, scaleX: targetState === 'retreating' ? -1 : 1 }}
                          exit={{ opacity: 0, scale: 0 }}
                          className="absolute -top-16 right-0 text-6xl font-black text-red-500 drop-shadow-[0_0_10px_white] z-20"
                        >
                          ?
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Bucket Overlay */}
                    <AnimatePresence>
                      {targetState === 'zombie_bucket' && (
                        <motion.img 
                          initial={{ y: -200, opacity: 0 }}
                          animate={{ y: bucketOffset.y, x: bucketOffset.x, rotate: bucketOffset.rotate, scale: bucketOffset.scale, opacity: 1 }}
                          exit={{ y: 300, opacity: 0, rotate: 180 }}
                          src="/spend/bucket.webp"
                          className="absolute pointer-events-none z-10"
                          style={{ top: '0%', left: '50%' }}
                        />
                      )}
                    </AnimatePresence>

                    <img 
                      src={targetState === 'normal' ? "/spend/target.webp" : "/spend/target_zombified.webp"} 
                      alt="Target" 
                      draggable={false}
                      className="w-full h-auto drop-shadow-xl pointer-events-none"
                    />
                    
                    {/* Stuck Souvenirs (Knives, etc.) */}
                    {souvenirItems.filter(i => i.isStuck).map(item => (
                      <img 
                        key={item.id}
                        src={item.img}
                        className="absolute w-12 h-12 md:w-16 md:h-16 object-contain pointer-events-none z-20"
                        style={{
                          left: `calc(${debugHitX}% + ${item.stuckX}px)`,
                          top: `calc(${debugHitY}% + ${item.stuckY}px)`,
                          transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                          filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.5))'
                        }}
                      />
                    ))}
                    <div className="font-bold text-red-300 text-lg md:text-xl z-10 bg-black/50 px-4 py-2 rounded pointer-events-none opacity-0 select-none">과녁</div>
                  </div>
                  
                  {showDebug && (
                    <div 
                      className="absolute border-4 border-red-500 bg-red-500/30 rounded-full pointer-events-none z-50 shadow-[0_0_10px_red]"
                      style={{
                        width: `${debugHitRadius * 2 * 100}%`,
                        aspectRatio: '1 / 1',
                        top: `${debugHitY}%`,
                        left: `${debugHitX}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    />
                  )}

                  {/* Morse Hit Plane Debug Line */}
                  {showDebug && (
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-yellow-400 z-[60] pointer-events-none"
                      style={{
                        left: `${morseHitOffsetPercent}%`,
                        transform: 'translateX(-50%)',
                        boxShadow: '0 0 10px yellow'
                      }}
                    />
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* My Bag (Right) */}
          <div 
            ref={el => { dropZoneRefs.current['mybag'] = el; }}
            className={`ml-auto w-56 md:w-80 flex flex-col items-center justify-end gap-2 transition-all duration-300 select-none pointer-events-auto cursor-pointer ${hoveredDropZone === 'mybag' ? 'scale-110 drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]' : ''}`}
            draggable={false}
          >
          <img 
            src={hoveredDropZone === 'mybag' ? '/spend/my_bag_open.webp' : '/spend/my_bag.webp'} 
            alt="My Bag" 
            draggable={false}
            className="h-32 w-auto drop-shadow-xl pointer-events-none transition-all"
          />
          <div className="font-bold text-amber-200 text-lg z-10 bg-black/50 px-4 py-2 rounded pointer-events-none opacity-0 select-none">내 가방</div>
        </div>
      </div>

      {/* Inventory Area */}
      <motion.div 
        className="text-center text-sm md:text-base text-amber-300 font-bold bg-black/40 py-2 px-4 rounded-full border border-amber-500/30 backdrop-blur-sm z-50 mb-2 mt-8 pointer-events-none"
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        지폐를 드래그해서 원하는 시설에 투자하세요!
      </motion.div>
      {renderBills()}

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

      {/* Gambling Modal */}
      <AnimatePresence>
        {isGamblingMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] flex flex-col items-center w-full"
            style={{ 
              width: `${gmbWidth}%`,
              maxWidth: `${gmbMaxWidth}rem`,
            }}
          >
            {/* Rotating Comic Book Concentration Lines (Sunburst) */}
            <motion.div
              className="absolute top-1/2 left-1/2 w-[250vw] h-[250vw] -translate-x-1/2 -translate-y-1/2 -z-30 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3, rotate: 360 }}
              transition={{ 
                opacity: { delay: 1, duration: 1.5, ease: "easeOut" },
                rotate: { duration: 40, repeat: Infinity, ease: "linear" } 
              }}
              style={{
                background: `repeating-conic-gradient(
                  from 0deg,
                  rgba(251, 191, 36, 0.25) 0deg 2deg,
                  transparent 2deg 4deg
                )`
              }}
            />
            {/* Title (Outside the table) */}
            <motion.div 
              className="z-50"
              initial={{ y: -250, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
            >
              <motion.div
                className="flex items-center justify-center relative w-64 h-16"
                animate={{ rotate: [2, -2, 2] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                style={{ 
                  marginBottom: `${gmbTitleMb}rem`,
                  transformOrigin: 'center -130px',
                  filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))'
                }}
              >
                {/* Ropes */}
                <div className="absolute left-[15%] bottom-[50%] w-[2px] h-[150px] bg-white border-x-[0.5px] border-slate-400 z-[5]" />
                <div className="absolute right-[15%] bottom-[50%] w-[2px] h-[150px] bg-white border-x-[0.5px] border-slate-400 z-[5]" />

                {/* Label Background */}
                <div className="absolute inset-0 w-full h-full z-0" style={{ backgroundImage: "url('/spend/label.webp')", backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />

                <h3 className="text-3xl font-serif text-amber-100 font-black text-center drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] relative z-10" style={{ transform: 'translateY(-2px)' }}>
                  선상 도박장
                </h3>
              </motion.div>
            </motion.div>

            {/* Background Image Container */}
            <div className="w-full relative flex flex-col justify-center">
              
              {/* Rainbow Glow Mask Layer */}
              <div className="absolute inset-0 w-full h-full -z-20 pointer-events-none" style={{ filter: 'blur(25px)' }}>
                <motion.div 
                  className="w-full h-full opacity-90"
                  animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                  style={{
                    background: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3, #ff0000)',
                    backgroundSize: '200% 200%',
                    WebkitMaskImage: "url('/spend/gamble.webp')",
                    WebkitMaskSize: '100% 100%',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                  }}
                />
              </div>

              {/* Actual Table Image */}
              <img 
                src="/spend/gamble.webp" 
                alt="Gamble Table"
                className="absolute inset-0 w-full h-full object-fill -z-10 pointer-events-none"
              />

              {/* Duck Spectators (Composed with parts & bobbing heads) */}
              <div className="absolute left-[3%] bottom-[5%] w-48 flex flex-col items-center justify-end z-20 pointer-events-none" style={{ filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.5))' }}>
                <motion.div 
                  className="relative w-36 h-36 z-30 -mb-6 origin-bottom"
                  animate={{ rotate: [0, 15, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <img src="/spend/duckhead.webp" alt="Head" className="absolute inset-0 w-full h-full object-contain" />
                </motion.div>
                <img src="/spend/duckbody.webp" alt="Body" className="w-40 h-auto object-contain z-20" />
              </div>

              <div className="absolute right-[3%] bottom-[5%] w-48 flex flex-col items-center justify-end z-20 pointer-events-none" style={{ transform: 'scaleX(-1)', filter: 'drop-shadow(-2px 4px 6px rgba(0,0,0,0.5))' }}>
                <motion.div 
                  className="relative w-36 h-36 z-30 -mb-6 origin-bottom"
                  animate={{ rotate: [0, 15, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut", delay: 0.25 }}
                >
                  <img src="/spend/duckhead.webp" alt="Head" className="absolute inset-0 w-full h-full object-contain" />
                </motion.div>
                <img src="/spend/duckbody_thumbsup.webp" alt="Body" className="w-40 h-auto object-contain z-20" />
              </div>
              <div 
                className="w-full flex flex-col justify-center relative z-10"
                style={{
                  paddingTop: `${gmbPadTop}rem`,
                  paddingBottom: `${gmbPadBottom}rem`,
                  paddingLeft: `${gmbPadX}rem`,
                  paddingRight: `${gmbPadX}rem`,
                }}
              >

            <p className="text-slate-200 text-center text-lg drop-shadow-md" style={{ marginBottom: `${gmbTitleMb}rem` }}>
              타이타닉호의 <strong>일일 항해 거리</strong>를 맞추세요!<br/>
              <span className="text-sm text-slate-400 font-bold">(실제 기록: 480~550 해리 사이 랜덤)</span>
            </p>

            <div className="w-full flex flex-col items-center">
              {/* Track */}
              <div 
                className={`relative ${gamblingState === 'idle' ? 'cursor-pointer hover:brightness-110' : ''}`}
                style={{ 
                  marginBottom: `${gmbTrackMb}rem`,
                  width: `${gmbTrackWidth}%`,
                  height: `${gmbTrackHeight}rem`,
                  backgroundImage: "url('/spend/paper.webp')",
                  backgroundSize: '100% 100%',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
                onClick={handleTrackClick}
              >
                {/* 종이 지도 안쪽 영역: 480~550 눈금, 범위 띠, 칼, 배가 모두 이 영역 기준이다 */}
                <div className="absolute pointer-events-none" style={{ left: `${PAPER.l}%`, right: `${PAPER.r}%`, top: `${PAPER.t}%`, bottom: `${PAPER.b}%` }}>
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 text-white/50 text-xs font-bold">480</div>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 text-white/50 text-xs font-bold">550</div>

                  {/* 선택한 범위: 지도 밖으로 나가지 않게 자른다 */}
                  <div className="absolute inset-0 overflow-hidden">
                    <div
                      className={`absolute top-0 bottom-0 transition-all duration-300 ${GAMBLE_TIERS.find((t) => t.id === gamblingTier)!.zone}`}
                      style={{
                        left: `${((gamblingGuess - 480) / 70) * 100}%`,
                        transform: 'translateX(-50%)',
                        width: `${(GAMBLE_TIERS.find((t) => t.id === gamblingTier)!.tol * 2 / 70) * 100}%`
                      }}
                    />
                  </div>

                  {/* 칼: 위에서 내리꽂힌다. 클릭할 때마다 새로 꽂힌다 */}
                  <div className="absolute z-10" style={{ left: `${((gamblingGuess - 480) / 70) * 100}%`, top: '50%', width: 0, height: 0 }}>
                    <motion.div
                      key={`ring-${gamblingGuess}-${swordHit}`}
                      initial={{ opacity: 0.9, scale: 0.2 }}
                      animate={{ opacity: 0, scale: 2.4 }}
                      transition={{ delay: 0.16, duration: 0.45, ease: 'easeOut' }}
                      className="absolute -left-4 -top-1.5 h-3 w-8 rounded-full border border-amber-200"
                    />
                    <motion.div
                      key={`sword-${gamblingGuess}-${swordHit}`}
                      initial={{ y: -170, opacity: 0, rotate: 199 }}
                      animate={{ y: 0, opacity: 1, rotate: [199, 199, 205, 195, 201, 199] }}
                      transition={{ y: { duration: 0.16, ease: 'easeIn' }, opacity: { duration: 0.05 }, rotate: { delay: 0.16, duration: 0.45 } }}
                      style={{ position: 'absolute', left: -SWORD_W * 0.21, top: -SWORD_W * 1.833 * 0.06, width: SWORD_W, height: SWORD_W * 1.833, transformOrigin: '21% 6%' }}
                    >
                      {/* 기념품샵의 타이타닉 칼. 칼끝이 아래로 가도록 뒤집어 꽂는다 */}
                      <img src="/spend/shop1.webp" alt="칼" className="h-full w-full object-fill drop-shadow-[0_3px_4px_rgba(0,0,0,0.7)]" />
                    </motion.div>
                  </div>
                  <div className="absolute z-10 -translate-x-1/2 rounded bg-black/60 px-1 text-xs text-amber-200" style={{ left: `${((gamblingGuess - 480) / 70) * 100}%`, bottom: '-1.4rem' }}>{gamblingGuess}</div>

                  {/* Ship */}
                  {gamblingState !== 'idle' && (
                    <motion.div
                      initial={{ left: 0 }}
                      animate={{ left: shipPath.map((d) => `${((d - 480) / 70) * 100}%`) }}
                      transition={{ duration: REVEAL_MS / 1000, times: REVEAL_TIMES, ease: 'easeInOut' }}
                      className="absolute top-1/2 -translate-y-1/2 -ml-6 z-20"
                    >
                      <img src="/spend/titanic_duck.webp" alt="Ship" className="w-12 h-12 object-contain drop-shadow-lg" />
                    </motion.div>
                  )}
                </div>
              </div>

            </div>

            <p className={`text-amber-400 font-bold text-center mt-2 transition-opacity ${gamblingState === 'idle' ? 'opacity-100 animate-bounce' : 'opacity-0 pointer-events-none'}`} style={{ marginBottom: `${gmbTitleMb}rem` }}>
              항로를 클릭하여 칼을 꽂으세요
            </p>
            <div className="text-slate-300 text-center" style={{ marginBottom: `${gmbTextMb}rem` }}>
              <div role="radiogroup" aria-label="베팅 범위" className="flex justify-center gap-2">
                {GAMBLE_TIERS.map((t) => {
                  const on = t.id === gamblingTier;
                  return (
                    <button
                      key={t.id}
                      role="radio"
                      aria-checked={on}
                      disabled={gamblingState !== 'idle'}
                      onClick={() => { setGamblingTier(t.id); playSound('snap'); }}
                      className={`min-w-24 rounded-[3px] border px-3 py-1.5 text-center transition-colors disabled:cursor-default ${on ? 'border-bright-brass bg-brass/30 text-bright-brass' : 'border-white/20 bg-black/40 text-slate-300 hover:border-brass'}`}
                    >
                      <span className="block text-sm font-bold">{t.name}</span>
                      <span className="block text-xs">±{t.tol}해리 / +{t.net + (gamblingStreak)}장</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-sm">
                적중 확률 {GAMBLE_TIERS.find((t) => t.id === gamblingTier)!.odds}
                {gamblingStreak > 0 && <span className="ml-2 font-bold text-yellow-400 animate-pulse">{gamblingStreak}연승 중! 보상 +{gamblingStreak}장</span>}
              </div>
            </div>

            </div>
            </div>

            {/* Action Area (Outside the background image) */}
            <div className="w-full mt-6 px-4 min-h-[60px] flex items-center justify-center relative">
              {gamblingState === 'idle' && (
                <div className="flex gap-6 justify-center">
                  <ClassicButton onClick={handleGambleCancel}>베팅 취소</ClassicButton>
                  <ClassicButton onClick={handleGambleSubmit}>목표 확정 (지폐 1장 베팅)</ClassicButton>
                </div>
              )}

              {gamblingState === 'animating' && (
                <div className="absolute inset-0 flex items-center justify-center text-amber-400 animate-pulse font-bold text-xl drop-shadow-lg z-10">
                  과연... 어디에 멈출까?
                </div>
              )}

              {gamblingState === 'result' && (
                <div className="flex flex-col gap-4 w-full text-center z-10 absolute top-0">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    {gamblingResult === 'exact' ? (
                      <div className="text-yellow-400 font-black text-4xl mb-1 drop-shadow-[0_0_15px_rgba(250,204,21,1)] animate-pulse">잭팟!!</div>
                    ) : gamblingResult === 'win' ? (
                      <div className="text-green-400 font-bold text-3xl mb-1 drop-shadow-md">승리! (오차 {Math.abs(gamblingGuess - targetDistance)}해리)</div>
                    ) : (
                      <div className="text-red-400 font-bold text-3xl mb-1 drop-shadow-md">패배... (정답: {targetDistance}해리)</div>
                    )}
                    <p className="text-slate-200 font-bold text-lg mb-2">
                      {gamblingResult === 'exact' ? `정확히 맞혔습니다! 지폐 ${gamblingGain}장을 획득했습니다!` :
                       gamblingResult === 'win' ? `지폐 ${gamblingGain}장을 획득했습니다.${gamblingStreak > 1 ? ` (${gamblingStreak}연승)` : ''}` :
                       Math.abs(gamblingGuess - targetDistance) <= (GAMBLE_TIERS.find((t) => t.id === gamblingTier)!.tol) * 1.5
                         ? `아깝습니다. ${Math.abs(gamblingGuess - targetDistance)}해리 차이로 베팅한 지폐를 잃었습니다.`
                         : '범위를 벗어나 베팅한 지폐를 잃었습니다.'}
                    </p>
                  </motion.div>
                  <div className="flex justify-center gap-6">
                    {billsAvailable > 0 && (
                      <ClassicButton onClick={handleGambleAgain}>
                        {gamblingResult === 'lose' ? '다시 걸기' : `한 번 더 걸기 (+${gamblingStreak}장 보너스)`}
                      </ClassicButton>
                    )}
                    <ClassicButton onClick={closeGambleResult}>창 닫기</ClassicButton>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Morse Telegraph UI */}
      <AnimatePresence>
        {hasTelegraph && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] pointer-events-none flex flex-col justify-center overflow-hidden"
          >
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
                      <div className="w-6 h-6 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
                    ) : (
                      <div className="w-24 h-6 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
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
                    transform: morseFlip ? 'scaleX(-1)' : 'none'
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            className="absolute w-12 h-12 border-4 border-cyan-300 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_20px_cyan]"
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
                  className="absolute w-3 h-3 bg-cyan-100 rounded-full shadow-[0_0_10px_white] -translate-x-1/2 -translate-y-1/2"
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

      {/* 총에 맞았을 때: 사망 카드가 나온 뒤 처음부터 다시 시작한다 */}
      {dead && <DeathCard onDone={restartJourney} />}

    </div>
  );
}
