'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useAnimationFrame } from 'framer-motion';
import SpeechBubble from './SpeechBubble';
import Mist from './Mist';
import { boatSwayDeg, PIVOT } from './ropeConfig';
import PulleyRopes, { type RopeDrive } from './PulleyRopes';
import HullRope from './HullRope';
import { OfficerBoat, useOfficerStates, eyesOnCanvas, type Face } from './officer';

/** 배경판(q7/deck_sea + deck_fg.webp, 1376x768)의 가로세로 비율. 무대 안의 모든 위치는 이 그림에 대한 % 다 */
export const STAGE_RATIO = 1376 / 768;

// ── 배경판 좌표(1376x768)로 적은 구명정과 줄의 기하 ──
const W = 1376;
const H = 768;
// 줄이 구명정에 걸리는 고리(선미 왼쪽, 이물 오른쪽 위)와 도르래 자리는 ropeConfig.ts 에 있다 (디버그 패널에서 조정)
/** 랜턴이 놓인 빈자리 */
const GLOW = { x: 926, y: 345 };
/** 구명정의 빈자리 (무대 %) */
const SEAT = { x: (GLOW.x / W) * 100, y: (GLOW.y / H) * 100 };

/**
 * 장교의 시선: 머리 둘레의 부드러운 한 덩어리를 커서 쪽으로 살짝 밀어 구부린다(변위 필터).
 * 머리 중심이 가장 많이 움직이고 목과 어깨로 갈수록 줄어, 복사본을 얹을 때처럼 머리가 두 개로 겹쳐 보이지 않는다.
 * 머리 부분의 원본은 마스크로 지우고 그 자리에 구부린 그림만 보인다. 머리 자리는 상태 그림마다 officer.tsx 의 HEAD 에 적혀 있다.
 */
/**
 * 장교의 눈동자: 눈동자 둘레의 아주 작은 덩어리만 아이(또는 커서) 쪽으로 밀어 움직인다(변위 필터).
 * 눈이 크게 나오는 상태(officer.tsx 의 EYES)에서만 쓴다. 머리 전체를 돌리면 눈동자가 그대로여서 어색했다.
 * 눈 둘레의 원본은 마스크로 지우고 그 자리에 움직인 그림만 보인다.
 */
const GAZE = { rm: 9, rb: 5, dx: 2.1, dy: 1.3 }; // 마스크 반지름, 변형이 일어나는 반지름(배경판 단위), 눈동자가 움직이는 최대 거리 px

/** 갑판에 선 아이: 갑판은 위에서 비스듬히 내려다본 시점이라, 머리 쪽이 가까워 커 보이게 위를 앞으로 기울이고(rotateX), 세로선이 아래쪽 한 점으로 모이는 것에 맞춰 살짝 오른쪽으로 눕힌다 */
const STAND_ROTX = -16;
const STAND_TILT = 3;
/** 구명정에 앉은 아이의 자리 (무대 %, 아이의 가운데): 장교 왼쪽의 빈 바닥 */
const SEATED_POS = { x: 47, y: 44.5, h: 31 }; // 가로 널빤지(장교 왼쪽) 끝에 걸터앉아 발이 바닥 쪽으로 늘어진다
const SEATED_ASPECT = 362 / 638; // 앉은 아이 그림(q7/child_seated.webp)의 가로/세로
const SEATED = { left: `${SEATED_POS.x}%`, top: `${SEATED_POS.y}%`, height: `${SEATED_POS.h}%` };

/** 결정에 따라 카메라가 움직인다 */
const CAMERA: Record<string, { scale: number; rotate: number }> = {
  me_first: { scale: 1.3, rotate: -2 },
  secure_mine: { scale: 1.18, rotate: -2 },
  yield_weak: { scale: 1.1, rotate: -2 },
  yield_seat: { scale: 1.05, rotate: -3 },
  observe: { scale: 1.08, rotate: -2 },
};


interface Props {
  /** 아이를 들고 있는 중이면 아이의 자리(무대 %, 아이의 가운데). 놓으면 null */
  carry?: { x: number; y: number } | null;
  /** 아이가 바다에 떨어지는 중 */
  fall?: boolean;
  /** 결정한 선택 (없으면 고르는 중) */
  choice: string | null;
  /** 장교의 표정 */
  face?: Face;
  /** 장교가 보는 방향(-1~1): 커서나 들고 있는 아이 쪽. x 는 오른쪽이 +, y 는 아래가 + */
  gaze?: { x: number; y: number };
  /** 구명정이 아래로 내려간 정도(0~1): 가만히 있는 동안 자리가 사라진다 */
  lower?: number;
  /** 배가 천천히 기우는 중인가 */
  tilting?: boolean;
  /** 멈춘 사진으로 쓸 때: 움직임 없이 결정 직후의 모습만 그린다 */
  frozen?: boolean;
  /** 아이가 구명정에 앉아 있는가 (아직 결정하기 전에도 앉아 있다) */
  childSeated?: boolean;
  /** 구명정에 붙은 선택지 자리: 구명정이 흔들리고 내려가는 대로 함께 움직인다 */
  boatChildren?: ReactNode;
  /** 장교의 말풍선 글 (없으면 풍선이 없다). key 가 바뀌면 새 풍선 */
  speech?: { text: string; key: number } | null;
  children?: ReactNode;
}

/**
 * Q7 의 무대. 고르는 장면과 결과의 '그날 밤의 사진'이 같은 그림을 쓴다.
 * 배경판(갑판·데빗·바다)과 구명정을 층으로 나눠, 구명정이 두 도르래에 매달려 시계추처럼 흔들리고 줄이 따라 움직인다.
 * 줄은 그림이 아니라 코드로 그린다: 어두운 그림자, 밧줄 색 바탕, 꼬임 무늬, 잔섬유 하이라이트를 겹쳐 질감을 낸다.
 */
export default function LifeboatStage({ choice, tilting, frozen, carry, fall, lower = 0, gaze, face = 'calm', boatChildren, childSeated, speech, children }: Props) {
  const cam = choice ? CAMERA[choice] ?? CAMERA.observe : null;
  const giveChild = !!childSeated || choice === 'yield_weak';
  const noTrans = { duration: 0 };
  const seatGone = choice === 'yield_weak' || choice === 'yield_seat';

  const have = useOfficerStates();
  const boatRef = useRef<SVGGElement>(null);
  const drive = useRef<RopeDrive>({ th: 0, bob: 0 }); // 구명정의 흔들림과 내려간 정도: 줄(PulleyRopes)이 이 값대로 걸린다
  const glowRef = useRef<SVGEllipseElement>(null);
  const shadeRef = useRef<SVGEllipseElement>(null); // 시간이 흐를수록 그림 속 랜턴 위로 어둠이 덮인다
  const dispX = useRef<SVGFEDisplacementMapElement>(null);
  const dispY = useRef<SVGFEDisplacementMapElement>(null);
  const spotsRef = useRef<HTMLDivElement>(null);
  const eyes = eyesOnCanvas(face, have);
  const live = useRef({ seatGone, choice: !!choice, frozen: !!frozen, glow: 0.7, lower, gx: 0, gy: 0, tx: 0, ty: 0 });
  useEffect(() => {
    live.current.seatGone = seatGone;
    live.current.choice = !!choice;
    live.current.frozen = !!frozen;
    live.current.lower = lower;
    live.current.tx = gaze?.x ?? 0;
    live.current.ty = gaze?.y ?? 0;
  });

  // 구명정은 4.8초쯤 한 번 오가고, 작은 흔들림이 겹쳐 규칙적으로 보이지 않는다. 빈자리 빛은 랜턴처럼 불규칙하게 일렁인다
  useAnimationFrame((t) => {
    const st = live.current;
    if (st.frozen) return;
    const s = t / 1000;
    const th = boatSwayDeg(s) * (Math.PI / 180);
    const bob = 2.5 * Math.sin((2 * Math.PI * s) / 2.4) + st.lower * 150; // 내려간 만큼 구명정과 줄 끝이 함께 아래로
    // 시선: 커서 쪽으로 부드럽게 따라간다 (눈이 먼저, 머리가 조금 늦게 움직이는 느낌은 이동 거리 차이로 낸다)
    st.gx += (st.tx - st.gx) * 0.12;
    st.gy += (st.ty - st.gy) * 0.12;
    // 변위 필터: 내용이 +dx 로 움직이려면 표본을 -dx 쪽에서 가져와야 하고, 지도의 가운데 값이 크기의 절반이라 눈금은 -2·dx
    dispX.current?.setAttribute('scale', (-2 * st.gx * GAZE.dx).toFixed(2));
    dispY.current?.setAttribute('scale', (-2 * st.gy * GAZE.dy).toFixed(2));
    if (spotsRef.current) spotsRef.current.style.transform = `translateY(${((bob / H) * 100).toFixed(3)}%) rotate(${((th * 180) / Math.PI).toFixed(3)}deg)`;
    boatRef.current?.setAttribute('transform', `translate(0 ${bob.toFixed(2)}) rotate(${((th * 180) / Math.PI).toFixed(3)} ${PIVOT.x} ${PIVOT.y})`);
    drive.current.th = th;
    drive.current.bob = bob;
    const target = st.seatGone ? 0.2 : st.lower > 0 ? Math.max(0.12, 0.8 - st.lower) : st.choice ? 1 : 0.72 + 0.22 * Math.sin((2 * Math.PI * s) / 2.2) + 0.07 * Math.sin((2 * Math.PI * s) / 0.63 + 2);
    // 구명정이 내려가거나 시간이 갈수록(lower) 랜턴이 어두워지고, 거의 다 내려가면 꺼질 듯 깜빡인다
    const flick = !st.choice && st.lower > 0.72 ? 0.62 + 0.38 * Math.abs(Math.sin(s * 19) * Math.sin(s * 7.3 + 1)) : 1;
    st.glow += (target * flick - st.glow) * (flick < 1 ? 0.35 : 0.08);
    glowRef.current?.setAttribute('opacity', st.glow.toFixed(3));
    shadeRef.current?.setAttribute('opacity', (st.choice ? 0 : 0.9 * Math.pow(Math.min(1, st.lower * 1.15), 1.3) * (flick < 1 ? 0.8 + 0.2 * flick : 1)).toFixed(3));
  });

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${STAGE_RATIO}` }}>
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: `${SEAT.x}% ${SEAT.y}%` }}
        initial={frozen && cam ? cam : { scale: 1.06, rotate: 0 }}
        animate={cam ?? (tilting ? { scale: 1.06, rotate: -2 } : { scale: 1.06, rotate: 0 })}
        transition={frozen ? noTrans : cam ? { duration: 1.4, ease: [0.3, 0, 0.2, 1] } : { duration: 20, ease: 'linear' }}
      >
        {/* 배경판: 갑판, 데빗, 도르래, 바다. 구명정은 따로 얹는다 */}
        <img src="/q7/deck_sea.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ filter: 'brightness(.92) saturate(.88) contrast(1.05)' }} />

        {/* 바다 위로 흐르는 안개 (구명정 뒤) */}
        <Mist />

        {/* 구명정과 줄: 두 도르래에 매달려 흔들린다 */}
        <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ filter: 'brightness(.92) saturate(.88) contrast(1.05)' }}>
          <defs>
            <radialGradient id="q7SeatGlow">
              <stop offset="0%" stopColor="rgb(255,205,120)" stopOpacity="0.8" />
              <stop offset="48%" stopColor="rgb(255,170,70)" stopOpacity="0.3" />
              <stop offset="75%" stopColor="rgb(255,150,50)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="q7LanternShade">
              <stop offset="0%" stopColor="rgb(4,9,18)" stopOpacity="0.92" />
              <stop offset="62%" stopColor="rgb(4,9,18)" stopOpacity="0.72" />
              <stop offset="100%" stopColor="rgb(4,9,18)" stopOpacity="0" />
            </radialGradient>
            {eyes && (
              <>
                {/* 눈 둘레: 안쪽은 움직인 그림만, 바깥쪽은 원본만 보이게 서로 반대로 지우는 마스크 */}
                <radialGradient id="q7EyeIn">
                  <stop offset="0%" stopColor="#fff" />
                  <stop offset="60%" stopColor="#fff" />
                  <stop offset="100%" stopColor="#000" />
                </radialGradient>
                <radialGradient id="q7EyeOut">
                  <stop offset="0%" stopColor="#000" />
                  <stop offset="60%" stopColor="#000" />
                  <stop offset="100%" stopColor="#fff" />
                </radialGradient>
                <mask id="q7EyeInMask" maskUnits="userSpaceOnUse" x={-200} y={-200} width={W + 400} height={H + 400}>
                  {eyes.map((e, i) => <circle key={i} cx={e.x} cy={e.y} r={GAZE.rm} fill="url(#q7EyeIn)" />)}
                </mask>
                <mask id="q7EyeOutMask" maskUnits="userSpaceOnUse" x={-200} y={-200} width={W + 400} height={H + 400}>
                  <rect x={-200} y={-200} width={W + 400} height={H + 400} fill="#fff" />
                  {eyes.map((e, i) => <circle key={i} cx={e.x} cy={e.y} r={GAZE.rm} fill="url(#q7EyeOut)" />)}
                </mask>
                {/* 눈동자를 미는 변위 필터: 종 모양 지도(q7/gaze_map.png)를 두 눈에 하나씩 놓고 가로·세로를 따로 민다 */}
                <filter id="q7EyeWarp" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" x={Math.min(...eyes.map((e) => e.x)) - GAZE.rm} y={Math.min(...eyes.map((e) => e.y)) - GAZE.rm} width={Math.max(...eyes.map((e) => e.x)) - Math.min(...eyes.map((e) => e.x)) + GAZE.rm * 2} height={Math.max(...eyes.map((e) => e.y)) - Math.min(...eyes.map((e) => e.y)) + GAZE.rm * 2}>
                  <feFlood floodColor="rgb(128,128,128)" result="neutral" />
                  {eyes.map((e, i) => (
                    <feImage key={i} href="/q7/gaze_map.webp" x={e.x - GAZE.rb} y={e.y - GAZE.rb} width={GAZE.rb * 2} height={GAZE.rb * 2} preserveAspectRatio="none" result={`bump${i}`} />
                  ))}
                  <feMerge result="map">
                    <feMergeNode in="neutral" />
                    {eyes.map((_, i) => <feMergeNode key={i} in={`bump${i}`} />)}
                  </feMerge>
                  <feDisplacementMap ref={dispX} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="B" result="moved" />
                  <feDisplacementMap ref={dispY} in="moved" in2="map" scale="0" xChannelSelector="B" yChannelSelector="G" />
                </filter>
              </>
            )}
          </defs>
          <g ref={boatRef}>
            {/* 장교: 눈동자가 크게 보이는 상태에서는 눈 둘레만 원본을 지우고 그 자리에 움직인 눈동자 그림을 보인다 */}
            {eyes ? (
              <>
                <g mask="url(#q7EyeOutMask)"><OfficerBoat face={face} have={have} all /></g>
                <g mask="url(#q7EyeInMask)"><g filter="url(#q7EyeWarp)"><OfficerBoat face={face} have={have} /></g></g>
              </>
            ) : (
              <OfficerBoat face={face} have={have} all />
            )}
            {/* 구명정 옆으로 늘어진 밧줄: 그림에서 지우고 코드로 그려, 구명정이 흔들리면 늦게 따라 출렁인다 */}
            <HullRope sway={!frozen} />
            {/* 그림 속 랜턴 위로 덮이는 어둠: 시간이 갈수록 짙어져 랜턴이 꺼져 가는 것처럼 보인다 */}
            <ellipse ref={shadeRef} cx={GLOW.x} cy={GLOW.y + 4} rx={46} ry={58} fill="url(#q7LanternShade)" opacity={0} />
            {/* 비어 있는 자리: 유일하게 따뜻한 빛 (랜턴 둘레에 번진다) */}
            <ellipse
              ref={glowRef}
              cx={GLOW.x}
              cy={GLOW.y}
              rx={105}
              ry={46}
              transform={`rotate(13 ${GLOW.x} ${GLOW.y})`}
              fill="url(#q7SeatGlow)"
              opacity={frozen ? (seatGone ? 0.25 : 0.95) : 0.7}
              style={{ mixBlendMode: 'screen' }}
            />
          </g>
        </svg>
        {/* 도르래 줄: 구명정보다 앞, 갑판과 데빗보다는 뒤. 데빗과 갑판 난간이 줄을 가린다 */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ filter: 'brightness(.92) saturate(.88) contrast(1.05)' }}>
          <PulleyRopes drive={drive} />
        </svg>
        {/* 갑판과 데빗: 구명정보다 앞(위)에 있어, 구명정이 흔들려도 갑판을 뚫고 나오지 않는다 */}
        <img src="/q7/deck_fg.webp" alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ filter: 'brightness(.92) saturate(.88) contrast(1.05)' }} />
        {/* 맨 앞에 아주 옅은 안개 한 겹 */}
        <Mist front />

        {/* 장교는 구명정 그림 속에 타고 있다: 손을 내밀고 빈자리 쪽을 본다 */}

        {/* 아이: 갑판에 서 있다가, 두 손으로 들어 올리면 손을 따라오고, 구명정 빈자리에 앉거나 바다로 떨어진다. 가운데 기준 좌표(left, top)로 움직인다 */}
        {(() => {
          const HOME = { left: '86.5%', top: '72.5%', height: '40%' }; // 갑판 위, 오른쪽 바닥에 발이 닿는 자리
          const target = carry ? (fall ? { left: `${carry.x}%`, top: `${carry.y + 32}%`, height: '30%' } : { left: `${carry.x}%`, top: `${carry.y}%`, height: '40%' })
              : HOME;
          const carrying = !!carry && !giveChild;
          return (
            <>
            {/* 발밑 그림자: 갑판 바닥에 닿아 있다는 느낌 (갑판은 위에서 비스듬히 내려다본 시점이라 납작한 타원) */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute rounded-[50%]"
              style={{ left: HOME.left, top: '92.5%', width: '12%', height: '2.6%', x: '-50%', y: '-50%', rotate: -14, background: 'radial-gradient(ellipse at center, rgba(0,0,0,.75) 0%, rgba(0,0,0,.45) 45%, rgba(0,0,0,0) 72%)', filter: 'blur(3px)' }}
              animate={{ opacity: carrying || giveChild ? 0 : 1 }}
              transition={{ duration: 0.25 }}
            />
            <motion.img
              data-child
              src={carrying ? '/q7/child_lifted.webp' : '/q7/child_back.webp'}
              alt=""
              draggable={false}
              className="absolute"
              style={{ transformOrigin: '50% 50%', filter: carrying ? 'brightness(.9) saturate(.8) contrast(1.04) drop-shadow(0 10px 10px rgba(0,0,0,.5))' : 'brightness(.8) saturate(.72) contrast(1.05)', zIndex: carrying ? 40 : undefined }}
              initial={{ ...HOME, x: '-50%', y: '-50%' }}
              animate={{ ...target, x: '-50%', y: '-50%', opacity: fall || giveChild ? 0 : 1, rotate: carrying && !fall ? [0, -3, 3, 0] : STAND_TILT, rotateX: carrying ? 0 : STAND_ROTX, transformPerspective: 700 }}
              transition={frozen || giveChild ? noTrans : carrying && !fall ? { left: { duration: 0 }, top: { duration: 0 }, height: { duration: 0.18 }, rotate: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } } : fall ? { duration: 0.9, ease: 'easeIn' } : { duration: 1.1, ease: 'easeInOut' }}
            />
            </>
          );
        })()}
        {/* 밤의 푸른 색조: 배경판과 구명정뿐 아니라 갑판에 선 아이에게도 같이 입힌다 (아이를 들어 올리는 동안은 가까이 있어 이 색조 위에 그려진다) */}
        <div aria-hidden className="absolute inset-0" style={{ background: 'rgba(14,32,62,0.16)', mixBlendMode: 'multiply' }} />
        {/* 구명정에 붙은 선택지: 구명정과 같이 흔들리고 내려간다 */}
        <div ref={spotsRef} className="pointer-events-none absolute inset-0 z-30" style={{ transformOrigin: `${(PIVOT.x / W) * 100}% ${(PIVOT.y / H) * 100}%` }}>
          {boatChildren}
          {/* 장교의 말풍선: 장교 머리 위, 구명정과 같이 움직인다 */}
          <AnimatePresence>
            {speech && <SpeechBubble key={speech.key} text={speech.text} x={53} y={34} shout={face === 'angry' || face === 'urgent' || face === 'block'} fear={face === 'pity'} />}
          </AnimatePresence>
          {/* 구명정에 태운 아이(앉은 그림): 구명정과 같이 흔들리고 내려간다. 장교 왼쪽에 앉고, 아랫도리는 뱃전에 가려진다.
              밤의 푸른 색조로 어둡게 하고, 오른쪽 랜턴 쪽 가장자리에만 따뜻한 빛이 닿게 한다 */}
          {giveChild && (
            <motion.div
              aria-hidden
              className="absolute"
              style={{ aspectRatio: `${SEATED_ASPECT}`, clipPath: 'inset(0 0 6% 0)' }}
              initial={frozen ? { ...SEATED, x: '-50%', y: '-50%' } : { left: `${carry?.x ?? SEATED_POS.x}%`, top: `${carry?.y ?? SEATED_POS.y}%`, height: '40%', x: '-50%', y: '-50%' }}
              animate={{ left: `${SEATED_POS.x}%`, top: `${SEATED_POS.y}%`, height: `${SEATED_POS.h}%`, x: '-50%', y: '-50%' }}
              transition={frozen ? noTrans : { duration: 0.9, ease: 'easeInOut' }}
            >
              <img src="/q7/child_seated.webp" alt="" draggable={false} className="h-full w-full" style={{ filter: 'brightness(.66) saturate(.6) contrast(1.06) hue-rotate(-6deg)' }} />
              {/* 랜턴 쪽(오른쪽)에서 오는 따뜻한 빛: 아이 모양 안쪽에만 얹는다 */}
              <div
                className="absolute inset-0"
                style={{
                  WebkitMaskImage: 'url(/q7/child_seated.webp)', maskImage: 'url(/q7/child_seated.webp)', WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
                  background: 'linear-gradient(to right, rgba(255,170,80,0) 35%, rgba(255,175,90,0.42) 100%)', mixBlendMode: 'screen',
                }}
              />
              {/* 밤의 푸른 색조 */}
              <div className="absolute inset-0" style={{ WebkitMaskImage: 'url(/q7/child_seated.webp)', maskImage: 'url(/q7/child_seated.webp)', WebkitMaskSize: '100% 100%', maskSize: '100% 100%', background: 'rgba(14,32,62,0.22)', mixBlendMode: 'multiply' }} />
            </motion.div>
          )}
        </div>
      </motion.div>
      {children}
    </div>
  );
}
