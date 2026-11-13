'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useAnimationControls } from 'framer-motion';
import type { Option } from '@/data/questions';
import type { RendererProps } from '@/engine/renderers';
import AnalogClock from '@/components/cinematic/AnalogClock';
import { wallClock } from '@/engine/cinematic';
import { playShutter, playThud, playSplash, playSqueak, playRatchet } from '@/lib/synth';
import HandCursor from '@/components/ui/HandCursor';
import DeathCard from '@/components/ui/DeathCard';
import { unlock } from '@/engine/achievements';
import { restartJourney } from '@/lib/session';
import LifeboatStage, { STAGE_RATIO } from './lifeboat/LifeboatStage';
import type { Face } from './lifeboat/officer';
import { LINES, pick, type Line } from './lifeboat/officerLines';
import HaulRope, { HAUL } from './lifeboat/HaulRope';
import { useQuizStore } from '@/store/quizStore';
import { ageOf } from '@/engine/boarding';

/**
 * Q7 "02:05, 마지막 자리" (프로토타입, 마지막장면_결과_연출_기획.md 3장).
 * 글 상자를 고르는 대신 화면 속 대상에 직접 손을 쓴다. 선택마다 입력이 다르다:
 *  - 빈자리: 빠르게 연타 (성인 남성은 장교가 '여자와 아이부터'라며 막아 네 번 밀쳐야 오른다. 오르면 '밀치고 오른 사람')
 *  - 장교의 손: 손을 누른 채 구명정 안으로 끌어당긴다
 *  - 뒤로 물러서기: 눌러서 멀리 끌어내려 물러선다
 *  - 가만히 보기: 아무것도 하지 않는다. 기다리는 동안 구명정이 실제로 내려가고 20초 뒤 자리가 사라진다
 *  - 아이: 눌러서 두 손으로 들어 구명정에 옮긴다
 * 결정한 순간의 화면이 플래시와 함께 멈추고, 그 사진이 결과 화면의 첫 장면(LedgerReveal)이 된다.
 *
 * 그림: 바다 q7/deck_sea, 갑판 q7/deck_fg, 구명정과 장교 q7/boat_officer(기본), 표정·행동별 통짜 그림 q7/officer/<상태>.webp 가 있으면 그것으로 바꿔 끼운다(줄은 코드로 그린다), 아이 q7/child_back.
 * 마우스 대신 양손(HandCursor)이 보인다. 누르면 두 손이 주먹을 쥔다.
 * 다른 대상은 누르고 1초 버티면 결정되고, 아이는 눌러서 들어 올려 구명정(빈 자리 주변)에 놓으면 '아이를 태운다'로 결정된다.
 * 아이를 구명정도 갑판도 아닌 바다에 놓으면 게임오버 (FRIENDLY FIRE 류의 수칙 문구, 사망 카드와 같은 RESET).
 */

/** 아이를 바다에 놓았을 때 나오는 수칙 문구 (딱딱한 공문서 말투, 매번 하나가 나온다) */
const OVERBOARD = [
  { ko: '승객을 임의로 바다에 내려놓는 행위는 용납되지 않습니다.', en: 'UNAUTHORIZED DISPOSAL OF PASSENGERS WILL NOT BE TOLERATED.' },
  { ko: '화이트 스타 라인은 기록을 위해 분명히 밝힙니다. “그가 던진 건 어린아이였습니다.”', en: 'THE WHITE STAR LINE STATES FOR THE RECORD: WHAT HE THREW WAS A CHILD.', source: '화이트 스타 라인 장교 일지 中' },
  { ko: '약자 보호 수칙 위반. 이 항해는 여기서 종료됩니다.', en: 'PASSENGER CONDUCT VIOLATION: CHILD OVERBOARD. VOYAGE TERMINATED.' },
  { ko: '이번 일은 사고로 분류하지 않겠습니다.', en: 'THIS WILL NOT BE CLASSIFIED AS AN ACCIDENT.' },
] as const;
/** 아이를 놓은 자리가 어디인지 (무대 % 좌표): 구명정 안(타원), 갑판(오른쪽 아래), 그 밖은 바다 */
const inBoat = (x: number, y: number) => ((x - 60) / 28) ** 2 + ((y - 47) / 19) ** 2 <= 1;
const onDeck = (x: number, y: number) => x >= 68 && y >= 38;

const HOLD_MS = 1000;
/** 구명정에 붙은 선택지(구명정이 흔들리고 내려가는 대로 따라간다) */
const BOAT_SPOTS = new Set(['me_first', 'secure_mine']);
const TAP_WINDOW_MS = 1600; // 연타 사이가 이보다 길면 처음부터 다시
const PULL_MS = 1150; // 장교가 내 손을 끌어당겨 구명정 안으로 올리는 데 걸리는 시간 (누르고 버티면 끌려 올라간다)
const HAUL_STROKE = 0.17; // 한 손이 한 번 쥐고 올라가는 거리 (무대 높이에 대한 비율)
const HAUL_OUT = 96; // 내려오는 손이 줄에서 옆으로 벌어지는 거리(px): 주먹 너비보다 크게 둔다
const HAUL_BAND = 0.69; // 아래 손이 줄을 쥔 채 가장 낮게 내려가는 높이 (무대 높이에 대한 비율). 줄 끝 매듭(버튼 바로 위)보다 위라서 손은 늘 매듭 위의 줄을 쥔다
const CRANK_MS = 4200; // 도르래 내리기: 누르고 버티면 이 시간 만에 구명정이 끝까지 내려간다 (가만히 기다리는 20초보다 훨씬 빠르다)
/** 대상마다 어떻게 해야 하는지 (아래 안내) */
const HOW: Record<string, string> = {
  me_first: '빈자리를 빠르게 여러 번 눌러 올라타세요',
  secure_mine: '장교의 손을 누르고 버티세요. 끌려 올라갑니다',
  yield_seat: '밧줄을 누르고 버티세요. 구명정이 훨씬 빨리 내려갑니다',
  observe: '아무것도 하지 않고 기다리세요',
};
const LIMIT_S = 20;
const REACTION_MS = 1500;
/** 2시 5분: 충돌(23:40) 후 145분 */
const ELAPSED = 145;

/** 화면 속 대상의 자리(무대 %)와 짧은 이름 */
const SPOTS: Record<string, { x: number; y: number; tag: string }> = {
  me_first: { x: 42, y: 47, tag: '빈자리' }, // 구명정 왼쪽의 빈 바닥
  secure_mine: { x: 54, y: 33, tag: '장교의 손' },
  yield_seat: { x: HAUL.x, y: 78, tag: '구명정 내리기' }, // 구명정 왼쪽 아래의 어두운 물 위에 고정한다. 늘어진 밧줄이 이 버튼 바로 위까지 내려와 있고, 누르고 버티면 줄이 풀리며 구명정이 내려간다
  observe: { x: 18, y: 55, tag: '가만히 보기' },
};

export default function LifeboatView({ question, onAnswer, onBack, extras, answers }: RendererProps) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<Option | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const [decided, setDecided] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [flash, setFlash] = useState(false);
  const [left, setLeft] = useState(LIMIT_S);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdingRef = useRef<string | null>(null);
  const decidedRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const leftRef = useRef(LIMIT_S);
  const timerOn = !extras?.noTimer;
  // 양손(마우스)과 아이 들기
  const [ptr, setPtr] = useState({ x: -200, y: -200 });
  const [grab, setGrab] = useState(false);
  const [carry, setCarry] = useState<{ x: number; y: number } | null>(null);
  const carryRef = useRef(false);
  const [fall, setFall] = useState(false);
  const [over, setOver] = useState<{ ko: string; en: string; source: string } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const bagBills = typeof extras?.bagBills === 'number' ? extras.bagBills : 0;
  // 성인 남성(16세 이상)은 장교가 빈자리에서 막는다: 그날 밤의 '여자와 아이부터'
  const adultMale = answers?.sex !== 'female' && (ageOf((answers ?? {}) as Record<string, unknown>, (extras ?? {}) as Record<string, unknown>) ?? 30) >= 16;
  // 아이를 먼저 태운 사람에게는 장교가 더 이상 막지 않고 손을 내민다
  const [childAboard, setChildAboard] = useState(false);
  const childAboardRef = useRef(false);
  const strict = adultMale; // 장교가 막는 중인가: 아이를 넘겨도 성인 남성은 탈 수 없다 (밀치고 오를 뿐)
  const tapNeed = strict ? 4 : 2;
  // 장교는 여자와 아이에게만 손을 내민다: 16세 이상 남성에게는 '장교의 손' 선택지가 아예 없다 (그날 밤 규칙)
  const options: Option[] = question.options
    .filter((o) => !(o.value === 'secure_mine' && strict) && !(o.value === 'yield_weak'))
    // 뒤로 물러서는 대신 도르래를 내려 구명정을 보내 준다
    .map((o) => (o.value === 'yield_seat' ? { ...o, label: '구명정을 내려 준다', description: '“아직 다른 구명정이 있습니다.” 구명정을 먼저 내려 보낸다.' } : o));
  const [crank, setCrank] = useState(0); // 도르래를 돌린 정도(0~1)
  const crankRef = useRef(0);
  const warnedRef = useRef(false);
  const [haulBox, setHaulBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null); // 밧줄을 당기기 시작할 때의 무대 자리(화면 px)
  const tapRef = useRef({ n: 0, t: 0 });
  const [taps, setTaps] = useState(0);
  const pullRef = useRef<{ value: string; x0: number; y0: number } | null>(null);
  const [pulling, setPulling] = useState<string | null>(null);
  // 장교의 손을 잡으면 내 손(커서)이 구명정 안쪽으로 끌려간다: 끌려가는 정도(0~1)와 끌려갈 화면 좌표
  const [pullProg, setPullProg] = useState(0);
  const [pullTarget, setPullTarget] = useState<{ x: number; y: number } | null>(null);
  const [notice, setNotice] = useState<{ text: string; key: number; face?: Face } | null>(null);
  const sayRef = useRef<(l: Line | string) => void>(() => {});
  const lastSayAt = useRef(0);
  const overChildRef = useRef(false);
  const seaWarnRef = useRef(false);
  const timeFired = useRef({ t14: false, t8: false, t3: false });
  const noticeKey = useRef(0);
  const shake = useAnimationControls();
  const [lowerAt, setLowerAt] = useState(0); // 결정한 순간 구명정이 내려가 있던 정도
  const [pushedIn, setPushedIn] = useState(false);
  const [gaze, setGaze] = useState({ x: 0.15, y: 0.25 }); // 장교가 보는 방향 (커서나 들고 있는 아이)

  const commit = useCallback((value: string, byTimeout = false, extraIn?: Record<string, unknown>) => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    // 아이를 먼저 태운 판: 탄다(빈자리, 장교의 손)는 '내 자리를 확보하고 주변을 돕는다', 물러서거나 가만히 있으면 '아이를 먼저 태운다'로 기록한다
    let extra = extraIn;
    if (childAboardRef.current) {
      extra = { ...(extraIn ?? {}), childBoarded: true };
      if (value === 'me_first' && !strict) value = 'secure_mine';
      else if (value === 'yield_seat' || value === 'observe') value = 'yield_weak';
    }
    // 결정 직후 장교의 한마디
    const sayLater = (l: Line, ms: number) => timers.current.push(setTimeout(() => sayRef.current(l), ms));
    if (byTimeout) { sayRef.current(pick('time0')); sayLater(pick('decideTimeout'), 900); }
    else if (value === 'secure_mine') sayRef.current(pick('decideHand'));
    else if (value === 'me_first') sayRef.current(strict ? pick('pushedIn') : pick('seatFemaleDone'));
    else if (value === 'yield_weak') sayRef.current(pick('decideChild'));
    else if (value === 'yield_seat') sayRef.current(pick('decidePulley'));
    setLowerAt(value === 'observe' || value === 'yield_seat' ? 1 : Math.min(1, Math.max(0, (LIMIT_S - leftRef.current) / LIMIT_S)));
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdingRef.current = null;
    setHolding(null);
    setDecided(value);
    setTimedOut(byTimeout);
    playThud();
    // 탈 수 없는 선택(구명정을 내려 보냄, 가만히 있음, 아이만 태우고 물러섬)은 번쩍임 없이 난간 장면으로 이어진다 (구명정이 내려가던 모습 그대로)
    const quiet = value === 'yield_seat' || value === 'observe' || value === 'yield_weak';
    timers.current.push(setTimeout(() => {
      if (!quiet) { setFlash(true); playShutter(); }
      timers.current.push(setTimeout(() => onAnswer(value, byTimeout || extra ? { ...(byTimeout ? { q7Timeout: true } : {}), ...(extra ?? {}) } : undefined), 160));
    }, REACTION_MS));
  }, [onAnswer, strict]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  // 남은 시간. 탭이 가려지면 멈추고, 누르고 있는 동안에는 시간이 끝나도 기다려 준다
  useEffect(() => {
    if (!timerOn || decided) return;
    const id = window.setInterval(() => {
      if (document.hidden || carryRef.current || useQuizStore.getState().debugPause) return; // 아이를 들고 있는 동안, 디버그 일시정지 중에는 시간이 흐르지 않는다
      setLeft((v) => Math.max(0, v - 0.1));
    }, 100);
    return () => window.clearInterval(id);
  }, [timerOn, decided]);

  useEffect(() => {
    if (timerOn && left <= 0 && !holding && !decided && !carry) commit('observe', true);
  }, [timerOn, left, holding, decided, commit, carry]);

  // 남은 시간에 따라 장교가 재촉한다
  useEffect(() => {
    if (!timerOn || decided || carry || pulling) return;
    const f = timeFired.current;
    if (left <= 3 && !f.t3) { f.t3 = f.t8 = f.t14 = true; sayRef.current(pick('time3')); }
    else if (left <= 8 && !f.t8) { f.t8 = f.t14 = true; sayRef.current(pick('time8')); }
    else if (left <= 14 && !f.t14) { f.t14 = true; sayRef.current(pick('time14')); }
  }, [left, timerOn, decided, carry, pulling]);

  // 심장 소리: 남은 시간이 줄수록 빨라진다
  useEffect(() => { leftRef.current = left; }, [left]);
  useEffect(() => {
    if (decided || reduce) return;
    let t: ReturnType<typeof setTimeout>;
    const beat = () => {
      playThud();
      const l = leftRef.current;
      t = setTimeout(beat, !timerOn || l > 10 ? 1200 : 420 + (l / 10) * 700);
    };
    t = setTimeout(beat, 900);
    return () => clearTimeout(t);
  }, [decided, reduce, timerOn]);

  const startHold = (o: Option) => {
    if (decidedRef.current || o.lock) return;
    holdingRef.current = o.value;
    setHolding(o.value);
    holdTimer.current = setTimeout(() => commit(o.value), HOLD_MS);
  };
  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdingRef.current = null;
    setHolding(null);
  };

  /** 장교와 손의 한마디를 잠깐 보인다 */
  const say = (l: Line | string) => {
    const key = ++noticeKey.current;
    const text = typeof l === 'string' ? l : l.t;
    lastSayAt.current = performance.now();
    setNotice({ text, key, face: typeof l === 'string' ? undefined : l.face });
    timers.current.push(setTimeout(() => setNotice((n) => (n?.key === key ? null : n)), 1900));
  };
  useEffect(() => { sayRef.current = say; });
  const jolt = () => { if (!reduce) shake.start({ x: [0, -16, 12, -7, 0], transition: { duration: 0.45 } }); };

  /** 빈자리: 빠르게 연타한다. 성인 남성은 장교가 막아 네 번째에야 오른다 */
  const tapSeat = (now: number) => {
    if (decidedRef.current || carryRef.current) return;
    const r = tapRef.current;
    r.n = now - r.t > TAP_WINDOW_MS ? 1 : r.n + 1;
    r.t = now;
    setTaps(r.n);
    timers.current.push(setTimeout(() => { if (performance.now() - tapRef.current.t >= TAP_WINDOW_MS - 50) { tapRef.current.n = 0; setTaps(0); } }, TAP_WINDOW_MS));
    if (r.n >= tapNeed) {
      if (strict) setPushedIn(true);
      commit('me_first', false, strict ? { pushedIn: true } : undefined);
      return;
    }
    if (strict) { say(LINES.blockMale[(r.n - 1) % LINES.blockMale.length]); playThud(); jolt(); } else { say(pick('seatFemale')); playSqueak(); }
  };
  /** 장교의 손, 뒤로 물러서기: 누른 채 끌어당기는 동작의 시작 */
  const startPull = (value: string, e: React.PointerEvent) => {
    if (decidedRef.current || carryRef.current) return;
    const p = toStage(e.clientX, e.clientY);
    pullRef.current = { value, x0: p.x, y0: p.y };
    setPulling(value);
    setPullProg(0);
    if (value === 'secure_mine') {
      // 손을 잡는 순간 장교가 확 당긴다: 내 손이 구명정 안쪽으로 끌려가고, 끝까지 버티면 올라탄다
      const r = stageRef.current?.getBoundingClientRect();
      if (r) setPullTarget({ x: r.left + (r.width * 56) / 100, y: r.top + (r.height * 50) / 100 });
      say(pick('pullStart'));
      playRatchet();
      jolt();
    } else if (value === 'yield_seat') {
      // 아이가 아직 갑판에 있는데 구명정을 내리려 하면 장교가 소리친다
      const sb = stageRef.current?.getBoundingClientRect();
      if (sb) setHaulBox({ left: sb.left, top: sb.top, width: sb.width, height: sb.height });
      say(childAboardRef.current ? pick('pulleyWithChild') : pick('pulleyChildOnDeck'));
      if (!childAboardRef.current) { playThud(); jolt(); }
    }
  };

  // 무대 좌표(%)로 바꾼다
  const toStage = (cx: number, cy: number) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100 };
  };
  /** 장교의 머리(아이를 받으려 숙인 모습일 때 무대 약 64.5%, 38%)에서 본 방향. 아이를 든 손(커서)이 가는 쪽을 눈동자가 따라간다 */
  const gazeAt = (p: { x: number; y: number }) => setGaze({ x: Math.max(-1, Math.min(1, (p.x - 64.5) / 22)), y: Math.max(-1, Math.min(1, (p.y - 38) / 22)) });
  const onRootMove = (e: React.PointerEvent) => {
    setPtr({ x: e.clientX, y: e.clientY });
    gazeAt(toStage(e.clientX, e.clientY));
    const sp = toStage(e.clientX, e.clientY);
    if (carryRef.current) {
      setCarry(sp);
      // 아이를 바다 쪽으로 가져가면 장교가 소리친다
      const atSea = !inBoat(sp.x, sp.y) && !onDeck(sp.x, sp.y) && sp.y >= 14;
      if (atSea && !seaWarnRef.current) { seaWarnRef.current = true; say(pick('childToSea')); playThud(); jolt(); }
      if (!atSea) seaWarnRef.current = false;
    } else if (!decidedRef.current && !childAboardRef.current && !pullRef.current) {
      // 아이 위에 손을 올리면 장교가 아이를 달라고 한다
      const c = rootRef.current?.querySelector('[data-child]')?.getBoundingClientRect();
      const over = !!c && e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom;
      if (over && !overChildRef.current && e.timeStamp - lastSayAt.current > 1200) say(pick('hoverChild'));
      overChildRef.current = over;
    }
  };
  const onRootDown = (e: React.PointerEvent) => {
    setPtr({ x: e.clientX, y: e.clientY });
    setGrab(true);
    if (decidedRef.current || carryRef.current || childAboardRef.current) return;
    // 아이 위에서 눌렀으면 두 손으로 번쩍 든다
    const c = rootRef.current?.querySelector('[data-child]')?.getBoundingClientRect();
    if (c && e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom) {
      carryRef.current = true;
      cancelHold();
      setCarry(toStage(e.clientX, e.clientY));
      seaWarnRef.current = false;
      say(pick('childLift'));
      playSqueak();
    }
  };
  /** 아이가 구명정에 앉는다. 장교는 막기를 멈추고 손을 내밀며, 남은 시간을 조금 늘려 준다 */
  const deliverChild = () => {
    if (decidedRef.current || childAboardRef.current) return;
    childAboardRef.current = true;
    carryRef.current = false;
    unlock('child-lifted');
    setChildAboard(true);
    setLeft((v) => Math.max(v, 14));
    say(strict ? pick('childInBoatMale') : pick('childInBoat'));
    playSqueak();
    timers.current.push(setTimeout(() => setCarry(null), 1000));
  };
  const onRootUp = (e: React.PointerEvent) => {
    setGrab(false);
    const pl = pullRef.current;
    if (pl) {
      pullRef.current = null;
      setPulling(null);
      const p = toStage(e.clientX, e.clientY);
      setPullProg(0);
      if (pl.value === 'secure_mine' && inBoat(p.x, p.y)) { commit('secure_mine'); return; }
      if (!decidedRef.current) say(pl.value === 'secure_mine' ? pick('pullRelease') : childAboardRef.current ? pick('pulleyRelease') : pick('pulleyReleaseChild'));
    }
    if (!carryRef.current) return;
    carryRef.current = false;
    const p = toStage(e.clientX, e.clientY);
    if (inBoat(p.x, p.y)) {
      // 구명정에 태웠다: 끝내지 않고, 이제 나도 탈지 다시 고르게 한다
      deliverChild();
    } else if (onDeck(p.x, p.y) || p.y < 14) {
      setCarry(null); // 갑판에 도로 내려놓는다
      say(pick('childBackOnDeck'));
    } else {
      // 바다에 놓았다: 물보라와 함께 게임오버
      decidedRef.current = true;
      setCarry(p);
      setFall(true);
      say(pick('childDropped'));
      playSplash();
      unlock('friendly-fire');
      const o = OVERBOARD[Math.floor(Math.random() * OVERBOARD.length)];
      timers.current.push(setTimeout(() => setOver({ ko: o.ko, en: o.en, source: ('source' in o && o.source) || '화이트 스타 라인 승객 수칙, 제1조' }), 1500));
    }
  };

  // 장교의 손을 누르고 있는 동안 끌려가는 정도를 키운다. 끝까지 버티면 올라탄다
  useEffect(() => {
    if (pulling !== 'secure_mine') return;
    let raf = 0;
    let last = performance.now();
    let p = 0;
    const dur = reduce ? 500 : PULL_MS;
    const tick = (now: number) => {
      p += (now - last) / dur;
      last = now;
      setPullProg(Math.min(1, p));
      if (p >= 1) {
        pullRef.current = null;
        setPulling(null);
        commit('secure_mine');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pulling, reduce, commit]);
  // 처음 구명정 앞에 서면 장교가 먼저 말을 건다 (질문 글과 겹치지 않게 조금 있다가)
  useEffect(() => {
    const t = setTimeout(() => { if (!decidedRef.current) say(adultMale ? pick('openMale') : pick('openFemale')); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 도르래를 누르고 있는 동안 줄이 풀려 구명정이 내려간다. 놓으면 멈춘다. 끝까지 내리면 양보가 결정된다
  useEffect(() => {
    if (pulling !== 'yield_seat') return;
    let raf = 0;
    let last = performance.now();
    let ratchet = 0;
    const dur = reduce ? 900 : CRANK_MS;
    const tick = (now: number) => {
      crankRef.current = Math.min(1, crankRef.current + (now - last) / dur);
      last = now;
      setCrank(crankRef.current);
      if (now - ratchet > 190) { ratchet = now; playRatchet(); }
      // 내리는 중에도 아이가 아직 갑판에 있으면 한 번 더 외친다
      if (crankRef.current > 0.55 && !warnedRef.current && !childAboardRef.current) { warnedRef.current = true; say(pick('pulleyChildOnDeck2')); jolt(); }
      if (crankRef.current >= 1) {
        pullRef.current = null;
        setPulling(null);
        commit('yield_seat');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulling, reduce, commit]);
  // 화면에 보이는 손: 장교에게 잡히면 포인터와 상관없이 구명정 안쪽으로 끌려간다(점점 세게)
  // 도르래 밧줄을 당길 때는 두 손이 밧줄을 잡고 아래로 훑어 내리고 다시 올려 잡기를 되풀이한다 (밧줄을 끌어당기는 손동작)
  // 줄을 풀어 내린다: 두 손이 번갈아 줄을 쥔 채 줄과 같은 속도로 아래로 훑어 내려가고(그동안 줄이 내려가며 구명정이 내려간다), 쥐지 않은 손은 천천히 위로 올라가 다시 잡는다.
  // 손이 줄을 쥐고 내려간 거리의 합이 줄이 내려간 거리와 같도록 계산해, 손이 줄 위에서 미끄러지지 않고 정확히 줄을 풀어 내리는 것으로 보인다
  const haulHands = (() => {
    if (pulling !== 'yield_seat') return null;
    const r = haulBox;
    if (!r) return null;
    const bottom = r.top + r.height * HAUL_BAND; // 줄을 쥔 손이 가장 낮게 내려갔을 때의 자리 (줄 끝 매듭보다 위)
    // 한 손씩 반복한다: 한 손이 아래에서 줄을 쥐고 줄과 같은 속도로 위까지 끌려 올라가면, 줄을 놓고 줄 옆으로 비켜 아래로 내려와 다시 줄을 쥐고 올라간다.
    // 그동안 다른 손이 반 박자 늦게 같은 동작을 해 줄이 끊기지 않고 움직인다. 내려오는 손은 줄에서 옆으로 벌어져 내려오므로 두 손이 교차하거나 겹치지 않는다.
    let D = r.height * HAUL_STROKE; // 한 번 쥐고 올라가는 거리
    D = Math.min(D, bottom - (r.top + 14));
    const drop = (r.height * HAUL.rise) / 768; // 줄이 풀려 흘러내리는 총 길이
    const cycles = (crank * drop) / (2 * D); // 한 손이 한 번 쥐고 내려갔다 올라오는 횟수 (두 손이 번갈아 쥐므로 한 번에 줄이 2D 풀린다)
    const top = bottom - D;
    const sm = (v: number) => v * v * (3 - 2 * v);
    const at = (phase: number, side: 1 | -1) => {
      const p = (cycles + phase) % 1;
      if (p < 0.5) return { x: 0, y: bottom - D * (p / 0.5) }; // 줄을 쥔 채 위로 올라간다 (줄과 같은 속도)
      const t = (p - 0.5) / 0.5;                              // 줄을 놓고 내려온다
      const out = t < 0.18 ? sm(t / 0.18) : t > 0.82 ? sm((1 - t) / 0.18) : 1; // 놓자마자 줄 옆으로 벌어지고, 다시 쥐기 직전에 줄로 돌아온다
      return { x: side * HAUL_OUT * out, y: top + D * sm(t) };        // 줄을 놓고 아래로 내려온다
    };
    const x = r.left + (r.width * HAUL.x) / 100;
    const L = at(0.5, -1); const R = at(0, 1);
    return { left: { x: x + L.x, y: L.y }, right: { x: x + R.x, y: R.y } };
  })();
  const shown = pulling === 'secure_mine' && pullTarget
    ? { x: ptr.x + (pullTarget.x - ptr.x) * pullProg * pullProg, y: ptr.y + (pullTarget.y - ptr.y) * pullProg * pullProg }
    : ptr;

  const urgent = timerOn && left <= 10;
  // 장교의 표정: 지금 하는 일과 남은 시간에 따라 바뀐다
  const face: Face = (() => {
    if (notice?.face) return notice.face; // 지금 하는 말에 맞는 표정
    if (decided) {
      if (decided === 'me_first') return pushedIn ? 'angry' : 'relief';
      if (decided === 'secure_mine') return 'pull';
      if (decided === 'yield_weak') return 'pity'; // 아이만 태우고 남은 사람에게는 안쓰러운 눈빛
      return 'pity'; // 물러서거나 가만히 본 사람에게는 안쓰러운 눈빛
    }
    if (carry) return 'receive'; // 아이를 들고 오는 동안: 팔을 내려 받으려 한다
    if (pulling === 'secure_mine') return 'pull';
    if (pulling === 'yield_seat') return childAboard ? 'pity' : 'urgent'; // 아이가 아직 갑판에 있으면 다급하다
    // 성인 남성에게 장교는 손을 내밀지 않는다: 처음부터 팔을 내린 의심스러운 모습이고, 연타하면 손바닥으로 막다가 화를 낸다. 아이를 먼저 태웠다면 환영하는 손이다
    if (taps > 0) return strict ? (taps <= 2 ? 'block' : 'angry') : 'relief';
    if (timerOn && left <= 8) return 'urgent';
    if (childAboard && !strict) return 'relief';
    if (timerOn && left <= 14) return 'doubt';
    return strict ? 'doubt' : 'calm';
  })();

  // 가만히 있는 동안 구명정이 내려간다: 남은 시간이 줄수록 자리가 멀어진다
  // 도르래를 돌린 만큼은 시간이 흐른 것보다 훨씬 빨리 내려간다
  const lower = decided ? lowerAt : Math.max(crank, timerOn ? Math.min(1, Math.max(0, (LIMIT_S - left) / LIMIT_S)) : 0);

  /** 선택지 위에 올렸을 때 장교의 한마디 (너무 자주 말하지 않는다) */
  const hoverSay = (value: string) => {
    if (decidedRef.current || carryRef.current || pullRef.current || performance.now() - lastSayAt.current < 1200) return;
    if (value === 'me_first') say(pick('hoverSeat'));
    else if (value === 'secure_mine') say(pick('hoverHand'));
    else if (value === 'yield_seat') say(pick('hoverPulley'));
  };
  const renderSpot = (o: Option, i: number) => {
            const spot = SPOTS[o.value];
            if (!spot) return null;
            // 가만히 보기: 시간제한이 있으면 따로 누를 곳이 없다 (아무것도 하지 않는 것이 선택이다)
            if (o.value === 'observe' && timerOn) return null;
            const on = hover?.value === o.value;
            const hold = holding === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-label={`${i + 1}. ${o.label}: ${o.description}${o.lock ? ` (${o.lock})` : ''}`}
                disabled={!!o.lock}
                className="pointer-events-auto absolute z-30 -translate-x-1/2 -translate-y-1/2 outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                onPointerEnter={() => { setHover(o); hoverSay(o.value); }}
                onPointerLeave={() => { setHover((h) => (h?.value === o.value ? null : h)); cancelHold(); }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  setHover(o);
                  if (o.value === 'me_first') tapSeat(e.timeStamp);
                  else if (o.value === 'secure_mine' || o.value === 'yield_seat') startPull(o.value, e);
                  else startHold(o);
                }}
                onPointerUp={cancelHold}
                onPointerCancel={cancelHold}
                onFocus={() => setHover(o)}
                onBlur={() => setHover((h) => (h?.value === o.value ? null : h))}
                // 키보드와 화면 읽기 프로그램은 누르고 버틸 수 없으므로 바로 결정한다
                onClick={(e) => { if (e.detail === 0 && !o.lock) commit(o.value, false, o.value === 'me_first' && strict ? { pushedIn: true } : undefined); }}
              >
                <span className={`relative flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-bold tracking-wide backdrop-blur-sm transition-colors ${on || hold || pulling === o.value || (o.value === 'me_first' && taps > 0) ? 'border-amber-200 bg-amber-200/25 text-amber-50' : 'border-white/30 bg-black/55 text-slate-100'} ${o.lock ? 'opacity-50' : ''}`}>
                  {spot.tag}
                  {/* 누르고 버티는 선택의 진행(가만히 보기 등)과 빈자리 연타의 진행을 작은 점으로 보인다 */}
                  {hold && (
                    <svg className="h-4 w-4 -rotate-90" viewBox="0 0 20 20" aria-hidden>
                      <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="2" />
                      <motion.circle cx="10" cy="10" r="8.5" fill="none" stroke="#fde68a" strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: HOLD_MS / 1000, ease: 'linear' }} />
                    </svg>
                  )}
                  {o.value === 'me_first' && taps > 0 && (
                    <span className="flex gap-0.5" aria-label={`${taps}/${tapNeed}`}>
                      {Array.from({ length: tapNeed }, (_, k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${k < taps ? 'bg-amber-200' : 'bg-white/30'}`} />)}
                    </span>
                  )}
                </span>
              </button>
            );
          };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-10 select-none overflow-hidden bg-[#03060c]"
      style={{ touchAction: 'none', cursor: decided || over ? 'default' : 'none' }}
      onPointerMove={onRootMove}
      onPointerDown={onRootDown}
      onPointerUp={onRootUp}
      onPointerCancel={onRootUp}
    >
      {/* 무대: 화면을 빈틈없이 덮는다. 배가 아주 천천히 기운다 */}
      <div ref={stageRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: `max(100vw, ${100 * STAGE_RATIO}vh)` }}>
        <motion.div animate={shake}>
        <LifeboatStage
          choice={decided}
          tilting={!reduce && !decided}
          carry={carry}
          childSeated={childAboard}
          fall={fall}
          lower={lower}
          gaze={gaze}
          face={face}
          speech={notice}
          boatChildren={!decided ? options.filter((o) => BOAT_SPOTS.has(o.value)).map((o) => renderSpot(o, options.indexOf(o))) : null}
        >
          {!decided && <HaulRope progress={crank} pulling={pulling === 'yield_seat'} />}
          {!decided && options.filter((o) => !BOAT_SPOTS.has(o.value)).map((o) => renderSpot(o, options.indexOf(o)))}
        </LifeboatStage>
        </motion.div>
      </div>

      {/* 위아래를 어둡게 해 글이 잘 보이게 한다. 시간이 줄면 가장자리가 조여 든다 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-black/80 via-transparent to-black/85" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20"
        animate={{ opacity: decided === 'observe' ? 1 : urgent ? 0.85 : 0.35 }}
        transition={{ duration: 1.2 }}
        style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 42%, rgba(0,0,0,0.9) 100%)' }}
      />

      {/* 시계와 질문 */}
      <AnimatePresence>
        {!decided && (
          <motion.div exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-center px-6 pt-5 text-center md:right-auto md:w-[46%] md:items-start md:px-10 md:text-left">
            <div className="flex items-center gap-2">
              <AnalogClock elapsed={ELAPSED} size={44} sinkMark />
              <span className="font-numeric text-sm font-bold text-bright-brass [font-variant-numeric:lining-nums]">{wallClock(ELAPSED)}</span>
            </div>
            <h2 className="mt-2 font-serif text-2xl font-bold text-red-300 md:text-3xl" style={{ textShadow: '0 2px 10px #000' }}>{question.title}</h2>
            <p className="mt-2 max-w-2xl break-keep text-sm leading-relaxed text-slate-200 md:text-base" style={{ textShadow: '0 1px 6px #000' }}>{question.subtitle}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 아래: 지금 바라보는 대상의 뜻, 남은 시간 */}
      <AnimatePresence>
        {!decided && (
          <motion.div exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center px-6 pb-6 text-center">
            <div className="min-h-[3.5rem]">
              {hover ? (
                <>
                  <p className="text-lg font-bold text-amber-100" style={{ textShadow: '0 1px 6px #000' }}>{hover.label}</p>
                  <p className="text-sm text-slate-300" style={{ textShadow: '0 1px 6px #000' }}>{hover.lock ?? hover.description}</p>
                  {HOW[hover.value] && <p className="mt-0.5 text-xs tracking-wide text-amber-200/80" style={{ textShadow: '0 1px 6px #000' }}>{HOW[hover.value]}</p>}
                </>
              ) : (
                <p className="pt-3 text-sm tracking-widest text-slate-400">&nbsp;</p>
              )}
            </div>
            {/* 남은 시간은 화면에 막대로 보이지 않는다: 랜턴이 어두워지고 구명정이 내려가는 것으로 알린다. 화면 읽기 프로그램에는 남은 시간을 그대로 알려 준다 */}
            {timerOn && <span className="sr-only" role="timer" aria-label={`남은 시간 ${Math.ceil(left)}초`} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 결정한 뒤의 한마디 */}
      <AnimatePresence>
        {decided && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-16 z-30 px-6 text-center font-serif text-xl text-slate-100"
            style={{ textShadow: '0 2px 10px #000' }}
          >
            {timedOut ? '당신은 움직이지 않았다.' : decided === 'me_first' && pushedIn ? '당신은 장교의 팔을 밀치며 구명정으로 뛰어올랐다. 뒤에서 누군가 지켜보고 있었다.' : question.options.find((o) => o.value === decided)?.description}
          </motion.p>
        )}
      </AnimatePresence>

      {/* 반향: 가방에 남겨 둔 지폐가 바람에 날아간다. 이제 아무것도 살 수 없다 */}
      {decided && bagBills > 0 && !reduce && (
        <motion.img
          src="/spend/bill.webp"
          alt=""
          aria-hidden
          className="pointer-events-none absolute bottom-10 left-1/2 z-30 w-32"
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0.95 }}
          animate={{ x: -340, y: -300, rotate: -240, opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
      )}

      {/* 키보드와 화면 읽기 프로그램용: 아이를 들 수 없으므로 바로 결정한다 */}
      {!decided && (
        <button type="button" className="sr-only" onClick={() => { if (!carryRef.current) deliverChild(); }}>
          {question.options.find((o) => o.value === 'yield_weak')?.label}
        </button>
      )}

      {/* 마우스 대신 양손 */}
      <HandCursor x={shown.x} y={shown.y} grab={grab} rope={haulHands} visible={!decided && !over && ptr.x > -100} />

      {/* 아이를 바다에 놓은 뒤: 물보라 */}
      {fall && !reduce && (
        <motion.div aria-hidden className="pointer-events-none fixed z-[60] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70" style={{ left: ptr.x, top: ptr.y }} initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 3, opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
      )}

      {over && <DeathCard soft onDone={restartJourney} custom={over} />}

      {onBack && !decided && (
        <button onClick={onBack} className="absolute bottom-6 left-6 z-30 text-sm uppercase tracking-widest text-white/60 hover:text-white">Back</button>
      )}

      {/* 플래시: Q2 의 카메라가 마지막으로 한 번 더 터진다 */}
      {flash && <div aria-hidden className="pointer-events-none fixed inset-0 z-[9998] bg-white" />}
    </div>
  );
}
