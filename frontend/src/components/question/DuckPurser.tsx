'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { playStamp, playAbacus } from '@/lib/synth';

/**
 * 오리 사무장: 돈 쓰기 단계의 안내자. 고지식하고 뻔뻔한 신사 말투로 지출마다 한마디 한다.
 * 낮 단계에서만 쓴다. 밤 장면에는 나오지 않는다(없다는 것 자체가 분위기를 바꾼다).
 * 좁은 화면에서는 자리가 없어 숨긴다.
 */
const POSES = ['idle', 'greet', 'receive', 'ledger', 'stamp', 'calc', 'point', 'refuse', 'shrug', 'bow'] as const;
export type PurserPose = (typeof POSES)[number];
/** 한 장짜리 그림이 있는 포즈 (stamp 와 calc 는 여러 컷이 이어진다) */
const STILL_POSES = POSES.filter((p) => p !== 'stamp' && p !== 'calc');

/**
 * 주판 계산 컷: 근엄하게 훑어보다(0) 중얼거리며 튕기고(1) 흡족하게 웃는다(2).
 * 컷 사이는 광류로 만든 중간 컷 두 장씩으로 이어 부드럽게 움직인다 (tools/build_purser_calc.py).
 * 순서: 0 → 1 → 0 → 1 → 2 (손가락이 오가다 흡족한 표정으로 멈춘다)
 */
const CALC_FILES = ['0', '01_a', '01_b', '1', '12_a', '12_b', '2'] as const;
const CALC_STEPS: [number, number][] = [ // [컷 번호, 나타나는 시각 ms]
  [0, 0], [1, 90], [2, 180], [3, 270],
  [3, 540], [2, 620], [1, 700], [0, 780],
  [0, 900], [1, 980], [2, 1060], [3, 1140],
  [3, 1420], [4, 1500], [5, 1580], [6, 1660],
];
const CALC_CLICKS = [270, 780, 1140, 1660]; // 알이 부딪히는 순간(소리)

/** 도장 찍기 애니메이션 컷 (순서대로: 들고 → 더 높이 → 장부로 내림 → 찍음) */
const STAMP_FRAMES = [0, 1, 2, 3] as const;
const STAMP_AT = [0, 150, 310, 470]; // 각 컷이 나타나는 시각(ms)

/** 말풍선 크기(px): 글자가 읽히도록 크게 잡는다 */
const BUBBLE_W = 400;
const BUBBLE_H = Math.round((BUBBLE_W * 596) / 985);

export default function DuckPurser({ line, lineKey, pose = 'idle', onPoke, armed = false, firing = false }: { line: string | null; lineKey: number; pose?: PurserPose; onPoke?: () => void; armed?: boolean; firing?: boolean }) {
  // 도장 포즈일 때는 정지 이미지 대신 4컷이 이어져 움직인다. 마지막 컷에서 "쿵" 소리와 함께 멈춘다.
  const [stampFrame, setStampFrame] = useState(0);
  // 가만히 있을 때도 가끔 주판을 튕긴다 (대사가 없는 idle 에서만)
  const [flick, setFlick] = useState(0);
  useEffect(() => {
    if (pose !== 'idle') return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => { t = setTimeout(() => { setFlick((n) => n + 1); next(); }, 9000 + Math.random() * 6000); };
    next();
    return () => clearTimeout(t);
  }, [pose]);
  const [flickOn, setFlickOn] = useState(false);
  useEffect(() => {
    if (!flick) return;
    setFlickOn(true);
    const t = setTimeout(() => setFlickOn(false), 2700);
    return () => clearTimeout(t);
  }, [flick]);
  const shown: PurserPose = pose === 'idle' && flickOn ? 'calc' : pose;
  const [calcFrame, setCalcFrame] = useState(0);
  useEffect(() => {
    if (shown !== 'calc') return;
    setCalcFrame(0);
    const ts = [
      ...CALC_STEPS.map(([f, ms]) => setTimeout(() => setCalcFrame(f), ms)),
      ...CALC_CLICKS.map((ms, i) => setTimeout(() => playAbacus(i === CALC_CLICKS.length - 1), ms)),
    ];
    return () => ts.forEach(clearTimeout);
  }, [shown, lineKey]);
  useEffect(() => {
    if (pose !== 'stamp') return;
    setStampFrame(0);
    const ts = STAMP_AT.map((ms, i) => setTimeout(() => { setStampFrame(i); if (i === STAMP_FRAMES.length - 1) playStamp(); }, ms));
    return () => ts.forEach(clearTimeout);
  }, [pose, lineKey]);

  return (
    <div className="pointer-events-none relative hidden shrink-0 flex-col items-center md:flex">
      {/* 말풍선 자리: 오리 머리 위에 높이를 따로 잡아 둔다. 제목 쪽으로 넘어가 겹치는 일이 없다 */}
      <div className="relative z-20" style={{ width: 0, height: BUBBLE_H - 36 }}>
      <AnimatePresence mode="wait">
        {line && (
          <motion.div
            key={lineKey}
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute z-20"
            style={{ width: BUBBLE_W, aspectRatio: '985 / 596', left: -Math.round(BUBBLE_W * 0.873), bottom: -36 }}
            role="status"
            aria-live="polite"
          >
            <img src="/ui/ui_speech_bubble_gold.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full drop-shadow-[0_8px_12px_rgba(0,0,0,0.6)]" />
            {/* 말풍선 안쪽(투명 구멍) 위치에 남색 판과 글자를 얹는다 */}
            <div className="absolute rounded-[16px] bg-[#0a1630]/95" style={{ left: '4.6%', right: '4.2%', top: '6.8%', height: '67%' }} />
            <p className="absolute flex items-center justify-center px-[7%] text-center font-serif text-[18px] leading-snug text-bright-brass" style={{ left: '4.6%', right: '4.2%', top: '6.8%', height: '67%' }}>
              {line}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* 포즈 이미지는 모두 같은 크기·위치의 캔버스라 바꿔도 흔들리지 않는다. 겹쳐 두고 투명도로 전환한다 */}
      <button
        type="button"
        data-duck
        onClick={onPoke}
        aria-label="오리 사무장에게 말 걸기"
        className="pointer-events-auto relative z-10 cursor-pointer drop-shadow-[0_14px_16px_rgba(0,0,0,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bright-brass"
        style={{ aspectRatio: '655 / 1114', height: 'min(46vh, 440px)' }}
      >
        {STILL_POSES.map((p) => (
          <img
            key={p}
            src={`/spend/purser_${p}.webp`}
            alt={p === shown ? '오리 사무장' : ''}
            aria-hidden={p !== shown}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain transition-opacity duration-200"
            style={{ opacity: p === shown ? 1 : 0 }}
          />
        ))}
        {/* 주판 컷: 중간 컷이 있어서 바로 바꿔도 부드럽다. 컷이 바뀔 때 겹쳐 흐려지면 오히려 깜빡이므로 전환 시간을 두지 않는다 */}
        {CALC_FILES.map((f, i) => (
          <img
            key={`calc-${f}`}
            src={`/spend/purser_calc_${f}.webp`}
            alt={shown === 'calc' && calcFrame === i ? '오리 사무장' : ''}
            aria-hidden={!(shown === 'calc' && calcFrame === i)}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ opacity: shown === 'calc' && calcFrame === i ? 1 : 0, transition: shown === 'calc' ? 'none' : 'opacity 200ms' }}
          />
        ))}
        {STAMP_FRAMES.map((i) => (
          <img
            key={`stamp-${i}`}
            src={`/spend/purser_stamp_${i}.webp`}
            alt={pose === 'stamp' && stampFrame === i ? '오리 사무장' : ''}
            aria-hidden={!(pose === 'stamp' && stampFrame === i)}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ opacity: pose === 'stamp' && stampFrame === i ? 1 : 0 }}
          />
        ))}
        {/* 권총: 아직 그림이 없어서 코드로 그린 임시 소품이다(정식 포즈 시트가 오면 교체한다) */}
        {armed && (
          <svg viewBox="0 0 120 70" className="pointer-events-none absolute z-10" style={{ right: '-6%', top: '47%', width: '46%', transform: 'rotate(-8deg)' }} aria-hidden>
            <path d="M8 18h74l8 6h20v14H90l-4 6H66l-4 22H44l6-22H8z" fill="#2a2d33" stroke="#0b0c0f" strokeWidth="3" strokeLinejoin="round" />
            <path d="M12 22h66" stroke="#585c66" strokeWidth="2" />
            {firing && (
              <g>
                <circle cx="112" cy="31" r="14" fill="#ffe9a8" opacity="0.95" />
                <path d="M104 31l22-14-6 14 6 14z" fill="#ff9f43" />
              </g>
            )}
          </svg>
        )}
      </button>
    </div>
  );
}

/** 시설별 첫 대사. 같은 시설을 또 쓰면 REPEAT 대사가 나온다. */
const FIRST: Record<string, string> = {
  pool: '수영장이오. 오리가 수영장을 운영한다고 놀라지 마시오. 업계 상식이오.',
  barber: '머리는 깎되 부리는 건드리지 마시오. 규정이오.',
  massage: '전기요법은 과학이오. 두려워 말고 앉으시오.',
  telegraph: '무선 전신이오. 소식은 늦게 도착하는 법이니 서두르지 마시오.',
  bath: '목욕탕이오. 깃털이 젖는 것은 직업상 문제없소.',
  souvenir: '기념품이오. 정가요. 흥정은 받지 않소.',
  gamble: '도박이라. 나는 권하지 않소. 다만 말리지도 않겠소.',
};
const REPEAT = ['또 오셨소. 단골이 되시겠소?', '세 번째요. 장부에 굵게 적어 두겠소.', '이쯤이면 이 선박의 주주라 불러 드려야겠소.'];

/** 선반을 돌려 시설이 가운데에 올 때 하는 대사 (시설별 첫 대사를 그대로 쓴다) */
/** 시설이 가운데에 올 때의 포즈 */
export const purserIntroPose = (id: string): PurserPose => (id === 'gamble' ? 'refuse' : id === 'souvenir' ? 'shrug' : 'point');
export const purserIntro = (id: string) => FIRST[id] ?? '살펴보시오. 선택은 손님의 몫이오.';

/** 오리를 눌렀을 때 나오는 아무 말 대사와 포즈 */
const POKE = [
  '나를 찌르지 마시오. 이 제복은 대여품이 아니오.',
  '질문은 환영하오. 대답은 보장하지 않소.',
  '시간은 금이오. 특히 이 배에서는.',
  '나는 근무 중이오. 간식은 사절이오.',
  '이 배는 가라앉지 않소. 내가 보증하오. 서면은 곤란하오.',
  '그 손가락은 어디서 소독했소?',
  '팁은 받지 않소. 다만 거절도 하지 않소.',
  '꽥. ...실례했소. 직업병이오.',
  '장부에 적어 두겠소. 당신이 나를 불렀다고.',
  '구명정 이야기라면 나중에 합시다. 아직 이르오.',
  '오리라서 놀랐소? 당신이 타임머신에서 내렸을 때만큼은 아닐 것이오.',
];
const POKE_POSES: PurserPose[] = ['idle', 'shrug', 'refuse', 'point', 'ledger', 'greet', 'calc', 'calc'];

// ── 눈치 ──────────────────────────────────────────────────────────
// 오리는 아무것도 모르는 척하지만, 처음부터 어렴풋이 이상함을 느끼고, 항해를 거듭할수록 낌새를 챈다.
// 회차(run)가 오를수록 눈치 채는 대사가 늘고 또렷해진다. 1회차에도 가볍게 흘리는 말이 두 줄 섞여 있다.
const HINT_FIRST = [
  '오늘 밤은 어쩐지 바다가 너무 조용하오. …평소에도 조용했던가?',
  '선원들이 구명정 도르래에 기름을 치고 있더이다. 점검일이겠지. 아마도.',
  '구두는 편한 걸 신으셨소? …그냥 묻는 것이오.',
];
/** 2회차 이상: 어디서 본 듯한 느낌 */
const HINT_DEJAVU = [
  '어디서 본 얼굴이오. …아니오, 오늘 처음 근무요. 그럴 리 없소.',
  '방금 이 대화, 해 본 것 같지 않소?',
  '당신 지출 습관, 어디서 본 것 같소. 장부에는 없는데 말이오.',
];
/** 3회차 이상: 의심 */
const HINT_SUSPECT = [
  '나는 오리지만 기억력은 좋소. 당신 얼굴은 분명 어딘가에서…',
  '이번엔 다른 걸 사 보시오. 같은 영수증은 지겹소.',
  '당신은 이 배의 결말을 아는 얼굴이오. …나도 눈치는 있소.',
];
/** 5회차 이상: 알고 있다는 것을 숨기지 않는다 */
const HINT_KNOWING = [
  '내 장부에 당신 이름이 여러 줄 적혀 있소. 쓴 기억은 없는데 말이오.',
  '구명정 이야기, 이제 나중으로 미루지 않겠소. …나도 이유는 모르오.',
  '당신은 알고 있소. 나도 알 것 같소. 서로 모르는 척합시다.',
];
/** 오래 찔러 본 사람만 만나는 숨은 대사 (6번째부터 세 줄이 차례로) */
const SECRET = [
  '…손님, 하나만 말하겠소. 오리는 기압에 민감하오.',
  '오늘 밤은 얼음 냄새가 나오.',
  '이 말은 장부에 적지 않겠소. 어차피 아무도 믿지 않을 테니.',
];
const SECRET_AT = 6;
let pokeCount = 0;
let lastPoke = '';

function pickPoke(run: number): string {
  // 회차가 높을수록 눈치 대사를 더 자주 고른다
  const tiers: string[][] = [];
  if (run >= 5) tiers.push(HINT_KNOWING);
  if (run >= 3) tiers.push(HINT_SUSPECT);
  if (run >= 2) tiers.push(HINT_DEJAVU);
  const hintChance = run >= 2 ? Math.min(0.75, 0.35 + (run - 2) * 0.12) : 0.18;
  let pool: string[];
  if (tiers.length && Math.random() < hintChance) {
    // 높은 회차의 대사일수록 가중치를 준다
    const t = tiers[Math.floor(Math.random() * Math.random() * tiers.length)];
    pool = t;
  } else if (run === 1 && Math.random() < 0.18) {
    pool = HINT_FIRST;
  } else {
    pool = POKE;
  }
  let line = pool[Math.floor(Math.random() * pool.length)];
  if (line === lastPoke) line = pool[(pool.indexOf(line) + 1) % pool.length];
  return line;
}

/** run: 지금이 몇 번째 항해인가(1부터) */
export function purserPoke(run = 1): { line: string; pose: PurserPose } {
  pokeCount += 1;
  if (pokeCount >= SECRET_AT && pokeCount < SECRET_AT + SECRET.length) {
    lastPoke = SECRET[pokeCount - SECRET_AT];
    return { line: lastPoke, pose: pokeCount === SECRET_AT + SECRET.length - 1 ? 'bow' : 'shrug' };
  }
  const line = pickPoke(run);
  lastPoke = line;
  return { line, pose: POKE_POSES[Math.floor(Math.random() * POKE_POSES.length)] };
}

export const PURSER_GREETING = '말하는 오리라 두렵다니요? 당신은 타임머신을 타고 왔잖소.';
/** 첫 인사: 회차가 오를수록 이미 아는 사이처럼 변한다 */
export function purserGreeting(run = 1): string {
  if (run >= 5) return '내 장부에 당신 이름이 여러 줄 적혀 있소. 쓴 기억은 없는데 말이오.';
  if (run >= 4) return '당신, 매번 같은 표정으로 오시오. 이 배의 결말을 아는 사람처럼.';
  if (run === 3) return '세 번째 아니오? 아니오, 세 번째일 리가 없소. 나는 오늘 처음 근무요.';
  if (run === 2) return '또 오셨소? 처음 뵙는 얼굴인데 어째서 이렇게 낯익소.';
  return PURSER_GREETING;
}
/** 가방(저축)에 넣을 때: 산 것이 아니라 아낀 것이므로 구매 대사를 쓰지 않는다 */
const BAG = [
  '가방에 넣으셨소. 현명하오. 안 쓴 돈은 영수증이 없소.',
  '또 넣으셨소. 가방이 든든해지는 소리가 나오.',
  '그 가방은 내가 지켜보겠소. 임무는 아니오만.',
];
export const PURSER_LAST_BAG = '마지막 한 장까지 가방에 들어갔소. 영수증은 필요 없겠소.';
export const PURSER_LAST = '계산이 끝났소. 후회는 영수증에 포함되지 않소.';
/** 마지막 지출 뒤의 대사: 1회차에도 가볍게 일러 두고, 회차가 오를수록 이번 밤이 다르게 끝나길 바란다 */
export function purserLast(run = 1, bag = false): string {
  if (run >= 3) return bag ? '가방은 단단히 챙기시오. 이번 밤은 다르게 끝나길 바라오.' : '또 같은 계산이오. 이번 밤은 다르게 끝나길 바라오.';
  if (run === 2) return bag ? '이번에도 가방이오? …그래도 좋소. 단단히 챙기시오.' : '계산이 끝났소. 이번에도 같은 가방이오? …그래도 좋소.';
  return bag ? '가방은 단단히 챙겨 두시오. 쓸 일이 없기를 바랄 뿐이오.' : '계산이 끝났소. 오늘 밤은 일찍 쉬지 마시오. 내 직감일 뿐이오.';
}

/** 지폐를 쓴 순간의 대사. 시설 소개는 이미 선반을 돌릴 때 했으므로 첫 이용은 짧은 확인만 한다. */
const ACK = ['받았소. 장부에 적겠소.', '확인했소. 영수증은 없소.', '거래 성립이오. 환불은 없소.'];
export function purserLine(facilityId: string, timesBefore: number): string {
  if (facilityId === 'mybag') return BAG[Math.min(timesBefore, BAG.length - 1)];
  if (timesBefore > 0) return REPEAT[Math.min(timesBefore - 1, REPEAT.length - 1)];
  if (facilityId === 'gamble') return '장부에 적어 두겠소. 행운은 보장하지 않소.';
  return ACK[Math.floor(Math.random() * ACK.length)];
}
