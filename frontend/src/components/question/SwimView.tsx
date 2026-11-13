'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, animate } from 'framer-motion';
import type { RendererProps } from '@/engine/renderers';
import { unlock } from '@/engine/achievements';
import { SWIM, swimChance, swimStart, estimateAdjusted } from '@/engine/boarding';
import { playSplash, playThud } from '@/lib/synth';
import { createSwimSea, type SwimSea } from './swim/swimSea';

/**
 * W2 "바다에서 헤엄치기": 눈높이가 수면에 닿은 1인칭. 멀리 구명선의 불빛 하나가 보인다.
 * 선택지는 "헤엄친다"와 "가라앉는다" 둘뿐이다. 헤엄칠 때마다 체력이 닳고 구명정에 닿을 확률을 한 번 굴리며, 굴릴수록 확률이 내려간다.
 * 제한 시간은 없고 체력이 한계다. 체력이 다하면 저절로 가라앉는다. 규칙의 숫자는 engine/boarding.ts 의 SWIM 에 있다.
 * 화면 속 대상을 눌러 하는 행동: 숨 고르기(물결 원이 가장 클 때), 외투 벗기(길게 누름), 나뭇조각 잡기, 불빛을 향해 소리치기.
 * 바다는 swim/swimSea.ts 가 그린다: 받은 밤하늘 그림 아래에 셰이더로 일렁이는 수면을 그리고, 팔이 물을 칠 때마다 첨벙거림을 얹는다.
 */

const IS_DEV = process.env.NODE_ENV === 'development';
const BREATH_MS = 2200; // 숨 고르기 물결 원이 한 번 커졌다 줄어드는 시간
/** 수평선의 화면 높이 비율 */
const HORIZON = 0.47;
/** 팔 그림의 크기(화면 높이에 대한 비율)와, 그림 안에서 손끝이 있는 자리 */
const ARM_VH = 58;
const HAND = { x: 0.2, y: 0.19 };
/** 손이 물을 치는 화면 자리 (오른손 기준. 왼손은 좌우를 뒤집는다) */
const SLAP = { x: 0.6, y: 0.63 };
/** 손이 실제로 물에 닿는 화면 자리(오른손 기준. 왼손은 좌우 반전): 물보라는 팔이 아니라 여기서 터져야 손과 어긋나지 않는다 */
const SPLASH = { x: 0.64, y: 0.745 };
/** 팔 한 번에서 손이 물에 닿는 때와, 물을 다 당긴 때(전체에 대한 비율) */
const HIT_AT = 0.36;
const PULL_END = 0.86;
/** 물을 당기는 동안 손이 옮겨 가는 거리(화면 높이에 대한 비율, 오른손 기준): 바깥 아래, 곧 몸 쪽으로 */
const PULL = { dx: 0.17, dy: 0.3 };

type End = 'reached' | 'spent' | 'sink';

export default function SwimView({ onAnswer, extras, answers }: RendererProps) {
  const reduce = useReducedMotion();
  const ex = useMemo(() => extras ?? {}, [extras]);
  const adj = typeof ex.boardP === 'number' ? ex.boardP : estimateAdjusted(answers ?? {}, ex);
  // 처음 들어왔을 때의 조건으로 고정한다
  const [start] = useState(() => swimStart(ex));
  // 노라가 어머니께 쓴 편지를 받았다면 주머니 속에 있다. 외투를 벗으면 편지도 떠내려간다
  const [hasLetter] = useState(() => ((ex.w1 ?? {}) as { letter?: string }).letter === 'given');
  const [heldFail, setHeldFail] = useState(false); // 노라를 안은 그림이 없으면 자리표시로 대신한다
  const [stamina, setStamina] = useState(start.stamina);
  const [strokes, setStrokes] = useState(0);
  const [far, setFar] = useState(0); // 부유물에서 쉬어 구명선과 멀어진 만큼(단계)
  const [coatOff, setCoatOff] = useState(false);
  const [coatProg, setCoatProg] = useState(0); // 외투 단추를 푼 정도(0~1)
  const [sinkProg, setSinkProg] = useState(0); // 가라앉기를 누르고 있는 정도(0~1)
  const sinkTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [plank, setPlank] = useState<'none' | 'afloat' | 'used'>('none');
  const [shout, setShout] = useState(false); // 다음 한 번에 소리친 효과가 붙는다
  const [breath, setBreath] = useState<'none' | 'open' | 'good' | 'bad'>('none');
  const [busy, setBusy] = useState(true);
  const [end, setEnd] = useState<End | null>(null);
  const [note, setNote] = useState<string | null>(start.together ? (hasLetter ? '곁에서 노라의 숨소리가 들립니다. 주머니 속에서 종이가 젖어 가는 것이 느껴집니다.' : '곁에서 그 사람의 숨소리가 들립니다. 손을 놓지 않았습니다.') : '물이 얼음처럼 가슴을 조입니다. 멀리 불빛 하나가 보입니다.');
  const breathAt = useRef(0);
  const coatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);
  const glRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const sea = useRef<SwimSea | null>(null);
  const lid = useMotionValue(0); // 눈꺼풀이 감긴 정도(0 활짝, 1 꽉 감김)
  const topLid = useRef<SVGPathElement>(null);
  const botLid = useRef<SVGPathElement>(null);
  const tiredRef = useRef(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); }, []);
  useEffect(() => () => { timers.current.forEach(clearTimeout); if (coatTimer.current) clearInterval(coatTimer.current as unknown as number); if (sinkTimer.current) clearInterval(sinkTimer.current); }, []);
  useEffect(() => {
    if (!reduce) playSplash();
    later(() => setBusy(false), reduce ? 300 : 1600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 바다 엔진
  useEffect(() => {
    if (!glRef.current || !fxRef.current) return;
    const sc = createSwimSea(glRef.current, fxRef.current, { reduce: !!reduce, skyUrl: '/swim/sea_plate.webp', horizon: HORIZON });
    sea.current = sc;
    // 물에 떨어진 직후: 눈앞에서 한 번 크게 첨벙인다
    const t0 = setTimeout(() => sc.splash(0.5, 0.7, 1.5), 250);
    return () => { clearTimeout(t0); sc.destroy(); sea.current = null; };
  }, [reduce]);

  const tired = 1 - Math.max(0, stamina) / 100; // 0(멀쩡) ~ 1(한계)
  useEffect(() => { tiredRef.current = tired; });
  const cold = Math.min(1, (strokes * (coatOff ? SWIM.coatCold : 1)) / 9);
  const near = Math.max(0, Math.min(1, (strokes - far) / 8)); // 구명선이 가까워진 정도
  // 팔 한 번의 빠르기: 지칠수록 느려진다. 오른손이 먼저 물을 치고 왼손이 뒤따른다
  const armDur = 1.05 + tired * 0.9;
  const leftDelay = 0.62 + tired * 0.45;
  const idleDur = 1.7 + tired * 1.3; // 허우적거리는 팔 한 번의 길이: 지칠수록 느려진다
  // 눈꺼풀 모양: 가운데가 가장 많이 내려오고 눈꼬리(양끝)는 덜 내려온다. 아래 눈꺼풀은 위보다 덜 올라온다
  useEffect(() => {
    const draw = (v: number) => {
      const mid = v * 56, corner = v * 20; // 위 눈꺼풀이 내려온 높이(%)
      const bMid = v * 46, bCorner = v * 16; // 아래 눈꺼풀이 올라온 높이(%)
      const ct = mid * 1.28 - corner * 0.28, cb = bMid * 1.28 - bCorner * 0.28;
      topLid.current?.setAttribute('d', `M-6 -4 L106 -4 L106 ${corner.toFixed(2)} C 76 ${ct.toFixed(2)}, 24 ${ct.toFixed(2)}, -6 ${corner.toFixed(2)} Z`);
      botLid.current?.setAttribute('d', `M-6 104 L106 104 L106 ${(100 - bCorner).toFixed(2)} C 76 ${(100 - cb).toFixed(2)}, 24 ${(100 - cb).toFixed(2)}, -6 ${(100 - bCorner).toFixed(2)} Z`);
    };
    draw(lid.get());
    return lid.on('change', draw);
  }, [lid]);
  // 눈이 중간중간 감긴다: 평소에는 짧게 깜빡이고, 지칠수록 더 자주, 더 오래 감겼다 뜬다
  useEffect(() => {
    if (reduce || end) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const tr = tiredRef.current;
      const heavy = Math.random() < 0.15 + tr * 0.6;
      if (heavy) {
        const closed = 0.72 + tr * 0.28;
        animate(lid, [0, closed, closed, 0], { duration: 1.0 + tr * 0.8, times: [0, 0.3, 0.55, 1], ease: 'easeInOut' });
      } else {
        animate(lid, [0, 0.62, 0], { duration: 0.34, times: [0, 0.42, 1], ease: 'easeInOut' });
      }
      timer = setTimeout(loop, (3200 + Math.random() * 4200) * (1 - tr * 0.45));
    };
    timer = setTimeout(loop, 2500);
    return () => clearTimeout(timer);
  }, [reduce, end, lid]);
  useEffect(() => { sea.current?.setLight(0.63, near); }, [near]);
  useEffect(() => { if (shout) sea.current?.flash(); }, [shout]);
  useEffect(() => { if (end === 'sink' || end === 'spent') sea.current?.sink(); }, [end]);
  useEffect(() => {
    if (strokes <= 0) return;
    const hit = armDur * HIT_AT * 1000;
    const pd = armDur * (PULL_END - HIT_AT);
    const a = setTimeout(() => { sea.current?.splash(SPLASH.x, SPLASH.y, 0.85); sea.current?.pull(SPLASH.x, SPLASH.y, PULL.dx, PULL.dy, pd, 1); if (!reduce) { playSplash(); playThud(); } }, hit);
    const b = start.together ? undefined : setTimeout(() => { sea.current?.splash(1 - SPLASH.x, SPLASH.y, 0.8); sea.current?.pull(1 - SPLASH.x, SPLASH.y, -PULL.dx, PULL.dy, pd, 0.95); if (!reduce) { playSplash(); playThud(); } }, hit + leftDelay * 1000);
    return () => { clearTimeout(a); if (b) clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);
  // 허우적거리는 사이에도 팔이 물에 닿을 때마다 작게 첨벙인다
  const idleRef = useRef(idleDur);
  useEffect(() => { idleRef.current = idleDur; });
  useEffect(() => {
    if (reduce || busy || end) return;
    const dur = idleRef.current;
    const cycle = dur * 1000;
    const hit = cycle * HIT_AT;
    const pd = dur * (PULL_END - HIT_AT);
    const ts: ReturnType<typeof setTimeout>[] = [];
    const once = () => {
      ts.push(setTimeout(() => { sea.current?.splash(SPLASH.x, SPLASH.y, 0.3); sea.current?.pull(SPLASH.x, SPLASH.y, PULL.dx, PULL.dy, pd, 0.32); }, hit));
      if (!start.together) ts.push(setTimeout(() => { sea.current?.splash(1 - SPLASH.x, SPLASH.y, 0.3); sea.current?.pull(1 - SPLASH.x, SPLASH.y, -PULL.dx, PULL.dy, pd, 0.32); }, hit + cycle * 0.5));
    };
    once();
    const c = setInterval(once, cycle);
    return () => { ts.forEach(clearTimeout); clearInterval(c); };
  }, [busy, end, reduce]);
  const chance = swimChance(adj, strokes + far, start.bonus + (shout ? SWIM.shoutBonus : 0));

  const finish = useCallback((how: End, p: number, n: number) => {
    if (done.current) return;
    done.current = true;
    setEnd(how);
    setBusy(true);
    setBreath('none');
    if (how === 'reached') {
      // 닿았다: 바다 위의 구명정이 눈앞까지 다가오고(셰이더), 곧 구명정이 화면을 가득 채운 그림으로 이어져 손이 닿고 끌어올려진다
      setNote('노 젓는 소리가 가까워집니다.');
      sea.current?.setLight(0.63, 1);
      later(() => setNote('누군가 당신의 옷깃을 움켜쥡니다.'), (reduce ? 0.35 : 1) * 5600);
      if (p <= 3) unlock('meant-to-be');
    } else if (how === 'spent') {
      setNote('팔이 더는 올라가지 않습니다.');
      unlock('last-arm');
    } else {
      setNote('당신은 팔을 멈춥니다.');
    }
    const extra = { w2: how === 'sink' ? 'sink' : 'swim', w2Survived: how === 'reached', swim: { strokes: n, chance: Math.round(p * 10) / 10, coatOff }, letterLost: hasLetter && coatOff };
    later(() => onAnswer(how === 'sink' ? 'sink' : 'swim', extra), how === 'reached' ? (reduce ? 1800 : 9000) : reduce ? 900 : 5200);
  }, [coatOff, hasLetter, later, onAnswer, reduce]);

  // 체력은 헤엄치지 않는 동안에도 서서히 줄어든다: 차가운 물에서 가만히 있어도 몸이 식는다 (외투를 벗으면 더 빨리 식는다). 바닥나면 저절로 가라앉는다
  const live = useRef<{ stamina: number; busy: boolean; finish: (how: End, p: number, n: number) => void; chance: number; strokes: number } | null>(null);
  useEffect(() => { live.current = { stamina, busy, finish, chance, strokes }; });
  // 개발용: 콘솔에서 __swimReach() 로 구명정에 닿는 연출을 바로 본다
  useEffect(() => {
    if (!IS_DEV) return;
    Object.assign(window, { __swimReach: (how: End = 'reached') => live.current?.finish(how, 5, 3) });
  }, []);
  useEffect(() => {
    if (end) return;
    const id = setInterval(() => {
      if (document.hidden || done.current) return;
      const L = live.current;
      if (!L) return;
      const nv = Math.max(0, L.stamina - 0.9 * (coatOff ? 1.3 : 1));
      setStamina(nv);
      if (nv <= 0 && !L.busy) L.finish('spent', L.chance, L.strokes);
    }, 1000);
    return () => clearInterval(id);
  }, [end, coatOff]);

  const swim = () => {
    if (busy || end) return;
    const mul = breath === 'good' ? SWIM.breathGood : breath === 'bad' ? SWIM.breathBad : 1;
    const cost = SWIM.cost * start.costMul * (coatOff ? SWIM.coatMul : 1) * mul;
    const left = stamina - cost;
    const n = strokes + 1;
    const p = chance;
    setBusy(true);
    setBreath('none');
    setNote(n === 1 && start.together ? '한 팔로 노라를 안고 헤엄칩니다. 팔이 무겁습니다.' : null);
    setStamina(left);
    setStrokes(n);
    setShout(false);
    if (!reduce) playSplash();
    if (n > 5) unlock('one-more');
    // 힘이 빠질수록 한 번의 팔 동작이 느려진다
    later(() => {
      if (Math.random() * 100 < p) { finish('reached', p, n); return; }
      if (left <= 0) { finish('spent', p, n); return; }
      if (n === 2) setPlank((v) => (v === 'none' ? 'afloat' : v));
      setNote(n === 1 ? '불빛은 아직 멉니다.' : left < 30 ? '손끝의 감각이 사라집니다.' : left < 60 ? '숨이 가빠집니다. 불빛이 흔들립니다.' : '불빛이 조금 가까워진 것 같습니다.');
      breathAt.current = performance.now();
      setBreath('open');
      setBusy(false);
    }, reduce ? 500 : 1300 + tired * 1300);
  };

  /** 물결 원이 가장 클 때 누르면 숨이 골라져 다음 헤엄이 덜 닳는다 */
  const takeBreath = () => {
    if (breath !== 'open' || end) return;
    const ph = ((performance.now() - breathAt.current) % BREATH_MS) / BREATH_MS; // 0.5 에서 가장 크다
    const good = Math.abs(ph - 0.5) <= (reduce ? 0.3 : 0.18);
    setBreath(good ? 'good' : 'bad');
    setNote(good ? '숨이 골라집니다.' : '물을 삼켰습니다.');
  };

  const grabPlank = () => {
    if (plank !== 'afloat' || busy || end) return;
    setPlank('used');
    setStamina((s) => Math.min(100, s + SWIM.plankRest));
    setFar((f) => f + 1);
    setNote('나뭇조각에 매달려 숨을 돌립니다. 그사이 불빛이 조금 멀어졌습니다.');
    unlock('driftwood');
    if (!reduce) playThud();
  };

  const callOut = () => {
    if (shout || busy || end) return;
    setShout(true);
    setStamina((s) => s - SWIM.shoutCost);
    setNote('“여기요! 여기 사람이 있어요!” 불빛이 한 번 깜빡입니다.');
  };

  /** 외투 단추를 하나씩 푼다: 누르고 있는 동안 진행이 차오르고, 다 차면 외투가 벗겨져 떠내려간다. 놓으면 단추가 도로 잠긴다 */
  const COAT_MS = 1500;
  const coatDown = () => {
    if (coatOff || busy || end) return;
    if (coatTimer.current) clearInterval(coatTimer.current as unknown as number);
    if (hasLetter) setNote('주머니에 노라의 편지가 있습니다.');
    const t0 = Date.now();
    coatTimer.current = setInterval(() => {
      const q = Math.min(1, (Date.now() - t0) / COAT_MS);
      setCoatProg(q);
      if (q >= 1) {
        if (coatTimer.current) clearInterval(coatTimer.current as unknown as number);
        coatTimer.current = null;
        setCoatOff(true);
        setNote(hasLetter ? '외투와 함께 편지가 떠내려갑니다.' : '젖은 외투를 벗어 던집니다. 몸이 가벼워지고, 추위가 더 깊이 파고듭니다.');
        if (!reduce) playSplash();
      }
    }, 40) as unknown as ReturnType<typeof setTimeout>;
  };
  const coatUp = () => {
    if (coatTimer.current) clearInterval(coatTimer.current as unknown as number);
    coatTimer.current = null;
    if (!coatOff) setCoatProg(0);
  };

  /** 가라앉기: 한 번 눌러서는 끝나지 않는다. 누르고 있는 동안 선이 차오르고, 다 차면 팔을 멈춘다 */
  const SINK_MS = 1300;
  const sinkDown = () => {
    if (busy || end) return;
    if (sinkTimer.current) clearInterval(sinkTimer.current);
    const t0 = Date.now();
    sinkTimer.current = setInterval(() => {
      const q = Math.min(1, (Date.now() - t0) / SINK_MS);
      setSinkProg(q);
      if (q >= 1) {
        if (sinkTimer.current) clearInterval(sinkTimer.current);
        sinkTimer.current = null;
        const L = live.current;
        if (L) L.finish('sink', L.chance, L.strokes);
      }
    }, 40);
  };
  const sinkUp = () => {
    if (sinkTimer.current) clearInterval(sinkTimer.current);
    sinkTimer.current = null;
    if (!done.current) setSinkProg(0);
  };

  /** 팔 한 쌍의 한쪽: 오른팔 그림을 쓰고, 왼팔은 좌우를 뒤집는다. 손끝이 물을 치는 자리(SLAP)에 오도록 놓는다 */
  const armEl = (side: number, o: { dur: number; delay: number; loop: boolean }) => {
    const kind = coatOff ? 'bare' : 'coat';
    const pos = { top: `calc(${SLAP.y * 100}% - ${HAND.y * ARM_VH}vh)`, width: `${ARM_VH}vh`, height: `${ARM_VH}vh` };
    const edge = `calc(${SLAP.x * 100}% - ${HAND.x * ARM_VH}vh)`;
    const hitAt = HIT_AT;
    const rep = o.loop ? { repeat: Infinity } : {};
    const T = [0, hitAt, hitAt + 0.08, PULL_END, 1];
    return (
      <div key={side} className="absolute" style={{ ...pos, ...(side ? { right: edge, transform: 'scaleX(-1)' } : { left: edge }) }}>
        <motion.div className="absolute inset-0"
          style={{ transformOrigin: '20% 19%', WebkitMaskImage: 'linear-gradient(to left, transparent 2%, #000 24%)', maskImage: 'linear-gradient(to left, transparent 2%, #000 24%)' }}
          initial={{ x: '26%', y: '66%', rotate: 14, scale: 1.16, opacity: 0 }}
          animate={{ x: ['26%', '0%', '1%', '29%', '36%'], y: ['66%', '-3%', '3%', '52%', '68%'], rotate: [14, 0, 2, -9, -12], scale: [1.16, 0.92, 0.94, 1.34, 1.46], opacity: [0, 1, 1, 0.92, 0] }}
          transition={{ duration: o.dur, delay: o.delay, times: T, ease: ['easeOut', 'linear', 'easeIn', 'linear'], ...rep }}>
          <motion.img src={`/swim/arm_${kind}_1.png`} alt="" draggable={false} className="absolute inset-0 h-full w-full" style={{ filter: 'brightness(.78) saturate(.85)' }}
            initial={{ opacity: 1 }} animate={{ opacity: [1, 1, 0, 0] }} transition={{ duration: o.dur, delay: o.delay, times: [0, hitAt + 0.03, hitAt + 0.1, 1], ...rep }} />
          <motion.img src={`/swim/arm_${kind}_2.png`} alt="" draggable={false} className="absolute inset-0 h-full w-full" style={{ filter: 'brightness(.78) saturate(.85)' }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1, 1] }} transition={{ duration: o.dur, delay: o.delay, times: [0, hitAt + 0.03, hitAt + 0.1, 1], ...rep }} />
        </motion.div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-10 select-none overflow-hidden bg-[#02060c]">
      {/* 바다(셰이더)와 첨벙거림 */}
      <canvas ref={glRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0">
        {/* 멀리 구명선의 불빛 (누르면 소리쳐 부른다) */}
        <button type="button" aria-label="불빛을 향해 소리친다" onClick={callOut} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 p-6" style={{ left: '63%', top: `${46 - near * 1.5}%`, cursor: shout || busy ? 'default' : 'pointer' }}>
          <span className="block h-6 w-6" />
          {!shout && !busy && !end && !reduce && (
            <motion.span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-100/60"
              animate={{ scale: [0.6, 1.9], opacity: [0.55, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }} />
          )}
        </button>
        {/* 수면 위에 떠 있는 것들 */}
        <div className="absolute inset-x-0 bottom-0 top-[47%]">
          {/* 나뭇조각: 침몰한 배에서 떨어져 나온 타다 남은 목재. 수면에 낮게 떠 천천히 흔들리고, 잡으면 곁에서 물에 가라앉는다 */}
          {plank !== 'none' && (
            <motion.button type="button" onClick={grabPlank} disabled={plank !== 'afloat'} aria-label="나뭇조각을 잡는다" className="absolute z-10" style={{ left: '8%', top: '22%', width: 'clamp(190px, 27vw, 380px)', cursor: plank === 'afloat' ? 'pointer' : 'default' }}
              initial={{ opacity: 0, x: -60 }}
              animate={plank === 'afloat'
                ? { opacity: 1, x: [0, 8, 0], y: [0, -4, 0], rotate: [-1.5, 0.8, -1.5] }
                : { opacity: 0, x: -18, y: 26, rotate: -4 }}
              transition={plank === 'afloat'
                ? { opacity: { duration: 1.4 }, x: { duration: 6, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' } }
                : { duration: 1.8, ease: 'easeIn' }}>
              {/* 물에 잠긴 아랫부분은 어둡게 흐려지고, 둘레에 물결이 번진다 */}
              <span aria-hidden className="absolute -inset-x-3 bottom-[-6%] h-[26%] rounded-[50%] bg-[#6fa0c0]/10 blur-md" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/swim/plank.webp" alt="" draggable={false} className="relative block w-full"
                style={{ filter: 'brightness(.62) saturate(.8) contrast(1.05)', WebkitMaskImage: 'linear-gradient(to bottom, #000 62%, transparent 96%)', maskImage: 'linear-gradient(to bottom, #000 62%, transparent 96%)' }} />
            </motion.button>
          )}
          {/* 함께 떨어진 노라: 왼팔로 가슴에 안고, 오른팔 하나로만 헤엄친다 */}
        </div>
      </div>

      {/* 안겨 있는 노라: 내 가슴께 왼쪽 아래에서 고개를 떨구고 안겨 있다. 내가 헤엄칠 때마다 함께 흔들리고, 지칠수록 더 처진다 */}
      {start.together && !end && (
        <motion.div aria-hidden className="pointer-events-none absolute z-[7]" style={{ left: '-2%', bottom: '-4%', width: 'min(52vw, 62vh)' }}
          animate={reduce ? undefined : { y: [0, -5 - tired * 6, 0], rotate: [-1, 1 + tired * 2, -1] }} transition={{ duration: 3.4 + tired * 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          {heldFail ? (
            <div className="relative h-[34vh] w-full">
              <span className="absolute bottom-0 left-[18%] block h-[18vh] w-[22vh] rounded-t-full bg-[#0b0f16]" />
              <span className="absolute bottom-[14vh] left-[24%] block h-[7vh] w-[7vh] rounded-full bg-[#b9b3a2]/70" />
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/swim/nora_held.webp" alt="" draggable={false} onError={() => setHeldFail(true)} className="block w-full" style={{ filter: `brightness(${0.7 - tired * 0.12}) saturate(.8)`, WebkitMaskImage: 'linear-gradient(to top, #000 70%, transparent 100%)', maskImage: 'linear-gradient(to top, #000 70%, transparent 100%)' }} />
          )}
        </motion.div>
      )}

      {/* 팔 동작: 헤엄칠 때마다 크게 한 번 */}
      {strokes > 0 && !reduce && (
        <div key={strokes} aria-hidden className="pointer-events-none absolute inset-0">
          {(start.together ? [0] : [0, 1]).map((side) => armEl(side, { dur: armDur, delay: side * leftDelay, loop: false }))}
        </div>
      )}
      {/* 허우적거림: 헤엄치는 사이에도 팔은 쉬지 않고 물을 헤집는다. 지칠수록 느리고 힘이 없다 */}
      {!reduce && !busy && !end && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {(start.together ? [0] : [0, 1]).map((side) => armEl(side, { dur: idleDur, delay: side * idleDur * 0.5, loop: true }))}
        </div>
      )}

      {/* 첨벙거림: 팔 위에 그려져 물방울이 팔을 덮는다 */}
      <canvas ref={fxRef} aria-hidden className="pointer-events-none absolute inset-0 z-[5] h-full w-full" />

      {/* 입김: 차가운 물 위에서 내쉬는 숨이 하얗게 피어올라 흩어진다. 지칠수록, 추울수록 더 자주, 더 짙게 */}
      {!reduce && <BreathVapor tired={tired} cold={cold} />}

      {/* 숨 고르기: 수면에 번지는 큰 파문. 안쪽에서 커지는 물결이 바깥의 가는 고리와 만날 때(가장 환할 때) 누른다 */}
      {breath === 'open' && !end && (
        <button type="button" onClick={takeBreath} aria-label="숨을 고른다" className="absolute bottom-[21%] left-1/2 z-20 h-[13vh] w-[min(60vw,460px)] -translate-x-1/2">
          {/* 맞추어야 할 고리 */}
          <span aria-hidden className="absolute left-1/2 top-1/2 h-[92%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-sky-100/35" />
          {/* 커졌다 줄어드는 물결: 가장 클 때가 눌러야 할 때 */}
          {[0, 1].map((i) => (
            <motion.span key={i} aria-hidden className="absolute left-1/2 top-1/2 h-[92%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-sky-100"
              animate={{ scale: [0.3, 1, 0.3], opacity: [0.18, 1, 0.18], boxShadow: ['0 0 0 rgba(190,225,255,0)', '0 0 34px rgba(200,230,255,.95)', '0 0 0 rgba(190,225,255,0)'] }}
              transition={{ duration: BREATH_MS / 1000, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }} />
          ))}
        </button>
      )}

      {/* 눈꺼풀: 중간중간 위아래에서 감겼다 뜬다. 일직선이 아니라 눈 모양으로 가운데가 내려오고 눈꼬리 쪽은 덜 내려오며, 닫히면 두 눈꺼풀이 살짝 휜 선으로 만난다 */}
      {!reduce && (
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-[12] h-full w-full" style={{ filter: 'blur(3px)' }}>
          <defs>
            <linearGradient id="q7LidTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#010307" /><stop offset="100%" stopColor="#06080d" /></linearGradient>
          </defs>
          <path ref={topLid} d="M-6 -4 L106 -4 L106 -4 L-6 -4 Z" fill="url(#q7LidTop)" />
          <path ref={botLid} d="M-6 104 L106 104 L106 104 L-6 104 Z" fill="#010307" />
        </svg>
      )}

      {/* 추위(푸른 기)와 힘이 빠지며 좁아지는 시야 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ background: '#2a6fc0', mixBlendMode: 'soft-light', opacity: cold * 0.55 }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 transition-all duration-1000"
        style={{ background: `radial-gradient(ellipse at 55% 48%, transparent ${Math.round(46 - tired * 34)}%, rgba(1,3,7,${0.6 + tired * 0.38}) ${Math.round(82 - tired * 30)}%, #010307 100%)` }} />

      {IS_DEV && <p className="pointer-events-none absolute left-3 top-14 z-20 text-[10px] text-slate-500/70">[dev] 다음 헤엄 {chance.toFixed(1)}% · {strokes}번 · 체력 {Math.round(stamina)}</p>}

      {/* 외투: 몸에 걸친 젖은 외투. 길게 누르면 단추가 하나씩 풀리고, 다 풀리면 벗겨져 떠내려간다 */}
      {!end && !coatOff && (
        <div className="absolute bottom-4 left-4 z-20 w-[min(22vw,132px)]">
          <button type="button" aria-label="젖은 외투를 벗는다 (길게 누름)" onPointerDown={coatDown} onPointerUp={coatUp} onPointerLeave={coatUp} onPointerCancel={coatUp} className="group relative block w-full text-left outline-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/swim/coat.webp" alt="" draggable={false} className="block w-full transition-transform duration-300 group-active:scale-[1.04]"
              style={{ opacity: 0.4 + coatProg * 0.3, filter: `brightness(${0.62 + coatProg * 0.25}) saturate(.8)`, transform: `rotate(${-3 - coatProg * 4}deg)` }} />
            {/* 단추를 푼 정도: 황동 단추 다섯 개가 차례로 밝아진다 */}
            <span className="mt-1.5 flex items-center justify-center gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full transition-all duration-150" style={{ background: coatProg > i / 5 ? '#d9b46a' : 'rgba(226,232,240,.28)', boxShadow: coatProg > i / 5 ? '0 0 8px rgba(230,190,100,.8)' : 'none' }} />
              ))}
            </span>
          </button>
        </div>
      )}
      {/* 벗은 외투: 물 위로 떠내려가며 천천히 젖어 가라앉는다 */}
      {coatOff && (
        <motion.img aria-hidden src="/swim/coat.webp" alt="" draggable={false} className="pointer-events-none absolute z-[11] w-[min(22vw,132px)]"
          style={{ filter: 'brightness(.6) saturate(.8)', left: '1%', bottom: '3%', WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)', maskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)' }}
          initial={{ opacity: 0.7, x: 0, y: 0, rotate: -7, scale: 1 }}
          animate={{ opacity: 0, x: '210%', y: '-210%', rotate: 38, scale: 0.55 }}
          transition={{ duration: reduce ? 0.6 : 6.5, ease: 'easeOut' }} />
      )}

      {/* 자막 */}
      <div className="pointer-events-none absolute inset-x-0 top-[24%] z-40 flex justify-center px-8">
        <AnimatePresence mode="wait">
          {note && (
            <motion.p key={note} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              className="max-w-[30ch] break-keep text-center font-serif text-[15px] leading-relaxed tracking-wide text-slate-100/90 md:text-[17px]" style={{ textShadow: '0 1px 12px rgba(0,0,0,.95), 0 0 2px rgba(0,0,0,.8)' }}>{note}</motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* 조작: 가운데 고리 하나. 고리의 둘레가 남은 체력이고, 누르면 한 번 헤엄친다. 설명 글은 없다 */}
      {!end && (() => {
        const C = 2 * Math.PI * 34;
        const left = Math.max(0, Math.min(1, stamina / 100));
        const low = stamina < 30;
        return (
          <>
            <motion.button type="button" disabled={busy} onClick={swim} aria-label="헤엄친다" className="group absolute bottom-[4.5%] left-1/2 z-20 h-[84px] w-[84px] -translate-x-1/2 rounded-full outline-none"
              style={{ cursor: busy ? 'default' : 'pointer' }}
              animate={{ opacity: busy ? 0.4 : 1, scale: busy ? 0.94 : 1 }} transition={{ duration: 0.35 }} whileTap={busy ? undefined : { scale: 0.9 }}>
              {/* 누를 수 있을 때: 수면의 물결처럼 고리가 번져 나간다 */}
              {!busy && !reduce && (
                <motion.span aria-hidden className="absolute inset-0 rounded-full border border-sky-100/50" animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }} />
              )}
              <span aria-hidden className="absolute inset-[7px] rounded-full bg-[#04101a]/55 backdrop-blur-[3px] transition-colors duration-300 group-hover:bg-[#0a2233]/60" />
              <svg aria-hidden viewBox="0 0 84 84" className="absolute inset-0 h-full w-full -rotate-90">
                <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(226,232,240,.16)" strokeWidth="1.5" />
                <circle cx="42" cy="42" r="34" fill="none" stroke={low ? '#e0705a' : '#e6edf3'} strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray={`${C * left} ${C}`} style={{ transition: 'stroke-dasharray .7s ease, stroke .5s', filter: `drop-shadow(0 0 5px ${low ? 'rgba(224,112,90,.8)' : 'rgba(200,228,255,.7)'})` }} />
              </svg>
              <span className="relative block font-serif text-[15px] tracking-[0.28em] text-sky-50" style={{ paddingLeft: '0.28em', textShadow: '0 0 12px rgba(190,225,255,.7)' }}>헤엄</span>
            </motion.button>
            {/* 가라앉기: 구석의 희미한 글자. 실수로 끝나지 않게, 누르고 있어야 선이 차오른다 */}
            <button type="button" disabled={busy} aria-label="가라앉는다 (길게 누름)" onPointerDown={sinkDown} onPointerUp={sinkUp} onPointerLeave={sinkUp} onPointerCancel={sinkUp}
              className="group absolute bottom-[6.5%] right-5 z-20 px-2 py-3 outline-none" style={{ cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.25 : 1, touchAction: 'none' }}>
              <span className="block font-serif text-[12px] tracking-[0.3em] text-slate-300/55 transition-colors duration-300 group-hover:text-slate-100/90" style={{ color: sinkProg > 0 ? 'rgba(241,245,249,.95)' : undefined }}>가라앉는다</span>
              <span aria-hidden className="mt-1.5 block h-px w-full bg-slate-300/20">
                <span className="block h-px bg-slate-100" style={{ width: `${sinkProg * 100}%`, boxShadow: '0 0 6px rgba(226,232,240,.8)' }} />
              </span>
            </button>
          </>
        );
      })()}

      {/* 끝(닿은 쪽): 다가온 구명정이 화면을 가득 채우고, 위에서 내려온 손과 내 손이 맞닿아 몸이 끌려 올라간다. 어두워지며 결과로 넘어간다 */}
      {end === 'reached' && (() => {
        const k = reduce ? 0.35 : 1;
        const kind = coatOff ? 'bare' : 'coat';
        return (
          <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
            initial={{ y: '0%', scale: 1 }} animate={{ y: '7%', scale: 1.1 }} transition={{ delay: 6.9 * k, duration: 2.2 * k, ease: 'easeIn' }}>
            {/* 구명정: 먼 불빛이 커지다가 바다 위에서 배의 옆면이 눈앞에 가득 찬다. 아래에서 올라오듯 크게 다가온다 */}
            <motion.img src="/swim/end_reached.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '52% 50%', transformOrigin: '50% 82%' }}
              initial={{ opacity: 0, scale: 1.32, y: '4%' }} animate={{ opacity: 1, scale: 1.02, y: '0%' }} transition={{ delay: 2.4 * k, duration: 2.6 * k, ease: [0.2, 0.6, 0.25, 1] }} />
            {/* 호수면에서 올라온 내 팔: 위에서 내려온 손 쪽으로 뻗는다 (손끝이 구명정 사람의 손끝 아래에 오게 놓는다) */}
            <div className="absolute" style={{ top: `calc(64% - ${HAND.y * ARM_VH}vh)`, left: `calc(49% - ${HAND.x * ARM_VH}vh)`, width: `${ARM_VH}vh`, height: `${ARM_VH}vh` }}>
              <motion.div className="absolute inset-0" style={{ transformOrigin: '90% 95%', WebkitMaskImage: 'linear-gradient(to left, transparent 2%, #000 24%)', maskImage: 'linear-gradient(to left, transparent 2%, #000 24%)' }}
                initial={{ x: '24%', y: '80%', rotate: 12, opacity: 0 }} animate={{ x: '0%', y: '-2%', rotate: 0, opacity: 1 }} transition={{ delay: 4.7 * k, duration: 1.4 * k, ease: 'easeOut' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/swim/arm_${kind}_1.png`} alt="" draggable={false} className="absolute inset-0 h-full w-full" style={{ filter: 'brightness(.72) saturate(.85)' }} />
                {/* 맞닿으면 손이 움켜쥔다 */}
                <motion.img src={`/swim/arm_${kind}_2.png`} alt="" draggable={false} className="absolute inset-0 h-full w-full" style={{ filter: 'brightness(.72) saturate(.85)' }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 6.3 * k, duration: 0.25 }} />
              </motion.div>
            </div>
            {/* 맞닿는 순간 랜턴 빛이 번쩍 흔들린다 */}
            <motion.div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 52% 36%, rgba(255,200,120,.38), transparent 55%)', mixBlendMode: 'screen' }}
              initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 0.9, 0.3] }} transition={{ delay: 0, duration: 7.2 * k, times: [0, 0.82, 0.88, 1] }} />
          </motion.div>
        );
      })()}
      {end === 'reached' && (
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-40 bg-[#010307]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 7.6 * (reduce ? 0.35 : 1), duration: 1.3 * (reduce ? 0.35 : 1) }} />
      )}

      {/* 끝(못 닿은 쪽): 어두워진다 */}
      {end && end !== 'reached' && (
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-[#010307]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0.6 : 1.3, delay: 1.5 }}>
          <motion.img src="/swim/end_under.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '50% 30%' }}
            initial={{ scale: 1.12 }} animate={{ scale: 1.0, y: ['0%', '-4%'] }} transition={{ duration: 5, ease: 'easeOut' }} />
        </motion.div>
      )}
    </div>
  );
}

/**
 * 입김: 눈높이가 수면에 닿은 사람이 차가운 밤공기에 내쉬는 숨. 화면 아래 가운데에서 하얀 김이 피어올라 위로 번지며 흩어진다.
 * 지칠수록, 추울수록 더 자주 내쉬고 더 짙다. 한 번의 김은 흐릿한 덩어리 몇 개가 서로 다른 속도로 퍼지는 것으로 그린다.
 */
function BreathVapor({ tired, cold }: { tired: number; cold: number }) {
  const [puffs, setPuffs] = useState<{ id: number; dx: number; big: number }[]>([]);
  const idRef = useRef(0);
  const live = useRef({ tired, cold });
  useEffect(() => { live.current = { tired, cold }; });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const { tired: t, cold: c } = live.current;
      const id = ++idRef.current;
      setPuffs((p) => [...p.slice(-3), { id, dx: (Math.random() - 0.5) * 60, big: 0.8 + t * 0.5 + c * 0.3 }]);
      timer = setTimeout(loop, (4600 - t * 1800 - c * 700) * (0.8 + Math.random() * 0.4));
    };
    timer = setTimeout(loop, 1800);
    return () => clearTimeout(timer);
  }, []);
  const strength = 0.11 + cold * 0.1 + tired * 0.08; // 숨은 희미하게: 아주 추울 때만 눈에 띈다
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-[40%] overflow-hidden">
      {puffs.map((p) => (
        <motion.div key={p.id} className="absolute bottom-0 left-1/2" style={{ x: p.dx }}
          initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.7, 0] }} transition={{ duration: 4.2, times: [0, 0.3, 0.6, 1], ease: 'easeInOut' }}
          onAnimationComplete={() => setPuffs((q) => q.filter((z) => z.id !== p.id))}>
          {/* 입에서 새어 나온 숨: 짧게 피어올라 옆으로 번지며 천천히 흩어진다. 한 줄기로 솟지 않게 덩이마다 방향과 속도가 다르다 */}
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="absolute block rounded-full"
              style={{ left: -60 * p.big, bottom: -30, width: 120 * p.big, height: 80 * p.big, background: `radial-gradient(ellipse at 50% 50%, rgba(214,228,240,${strength + 0.05}) 0%, rgba(214,228,240,${strength * 0.5}) 45%, rgba(214,228,240,0) 74%)`, filter: 'blur(18px)' }}
              initial={{ y: 8, x: 0, scaleX: 0.5, scaleY: 0.5 }}
              animate={{ y: -(60 + i * 34) * p.big, x: (i - 1) * 46 * p.big + p.dx * 0.4, scaleX: 1.5 + i * 0.5, scaleY: 1.1 + i * 0.25 }}
              transition={{ duration: 4.0, delay: i * 0.18, ease: [0.2, 0.6, 0.3, 1] }} />
          ))}
        </motion.div>
      ))}
    </div>
  );
}
