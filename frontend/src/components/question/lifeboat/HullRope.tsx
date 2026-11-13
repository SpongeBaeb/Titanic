'use client';

import { useRef } from 'react';
import { useAnimationFrame } from 'framer-motion';
import { BOAT } from './officer';
import { boatSwayDeg } from './ropeConfig';

/**
 * 구명정 뱃전에 걸려 아래로 늘어진 밧줄. 구명정 그림(q7/officer/*.webp, boat_officer.webp)에서는 지우고 코드로 다시 그린다.
 * 구명정이 도르래에 매달려 흔들리면 줄은 곧바로 따라가지 못하고 늦게, 끝으로 갈수록 더 크게 출렁인다(두 겹의 느린 스프링).
 * 구명정 그림과 같은 좌표계(배경판 1376x768)에서 구명정 그룹 안에 놓이므로 구명정과 함께 움직이고 내려간다.
 */
// 그림(1363x784) 좌표로 잰 줄의 중심선: 뱃전 위를 넘어 아래로 곧게 드리운다
const PX = [[668, 438], [680, 432], [690, 432], [698, 442], [701, 460], [703, 500], [702, 550], [701, 600], [700, 650], [699, 700], [699, 784]] as const;
const sx = BOAT.w / 1363;
const sy = BOAT.h / 784;
const PTS = PX.map(([x, y]) => ({ x: BOAT.x + x * sx, y: BOAT.y + y * sy }));
const TOP_Y = PTS[3].y; // 뱃전 위를 넘은 뒤부터 늘어진다: 이 아래부터 흔들린다
const LEN = PTS[PTS.length - 1].y + 12 - TOP_Y;
const W = 7; // 줄 굵기 (배경판 px)

function pathAt(a1: number, a2: number): string {
  // a1: 윗부분 각도(라디안), a2: 끝부분이 더 늦게 따라와 생기는 추가 휘어짐
  const pts = PTS.map((p) => {
    const d = Math.max(0, p.y - TOP_Y);
    const t = Math.min(1, d / LEN);
    const dx = a1 * d + a2 * LEN * t * t;
    return `${(p.x + dx).toFixed(2)} ${p.y.toFixed(2)}`;
  });
  // 점을 부드럽게 잇는다
  return `M ${pts[0]} ` + pts.slice(1).map((q) => `L ${q}`).join(' ');
}

export default function HullRope({ sway = true }: { sway?: boolean }) {
  const refs = useRef<(SVGPathElement | null)[]>([]);
  const st = useRef({ a: 0, av: 0, b: 0, bv: 0, last: 0 });
  useAnimationFrame((t) => {
    const s = st.current;
    const sec = t / 1000;
    const dt = Math.min(0.05, Math.max(0.001, sec - (s.last || sec - 0.016)));
    s.last = sec;
    // 구명정이 기울면 줄은 그 반대 쪽으로 처지려 한다: 목표를 -각도로 두고, 위쪽(a)과 끝쪽(b)이 서로 다른 스프링으로 늦게 따라간다
    const th = sway ? (boatSwayDeg(sec) * Math.PI) / 180 : 0;
    const wob = 0.012 * Math.sin(sec * 1.7) + 0.008 * Math.sin(sec * 2.9 + 1);
    const targetA = -th * 0.55 + wob;
    const accA = 22 * (targetA - s.a) - 5.2 * s.av;
    s.av += accA * dt; s.a += s.av * dt;
    const targetB = s.a * 1.8;
    const accB = 13 * (targetB - s.b) - 2.6 * s.bv;
    s.bv += accB * dt; s.b += s.bv * dt;
    const d = pathAt(s.a, s.b - s.a * 0.9);
    for (const el of refs.current) el?.setAttribute('d', d);
  });
  const d0 = pathAt(0, 0);
  return (
    <g aria-hidden>
      <defs>
        {/* 구명정을 매단 도르래 줄(PulleyRopes)과 같은 색과 꼬임 무늬: 바탕 #4b3e2b, 어두운 꼬임, 옅은 빛 */}
        <pattern id="q7HullTwist" width="8.4" height="8.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <rect width="8.4" height="8.4" fill="none" />
          <rect x="0" y="0" width="2.3" height="8.4" fill="#0e0905" />
          <rect x="2.3" y="0" width="1.6" height="8.4" fill="#2a2013" opacity="0.7" />
          <rect x="4.1" y="0" width="1.3" height="8.4" fill="#8d7a56" opacity="0.5" />
          <rect x="5.4" y="0" width="1.0" height="8.4" fill="#3a2e1d" opacity="0.6" />
        </pattern>
      </defs>
      {/* 그림자, 바탕, 꼬임, 빛 */}
      <path ref={(el) => { refs.current[0] = el; }} d={d0} fill="none" stroke="#05080d" strokeOpacity={0.45} strokeWidth={W + 2} strokeLinecap="round" strokeLinejoin="round" transform="translate(1.4 1.2)" />
      <path ref={(el) => { refs.current[1] = el; }} d={d0} fill="none" stroke="#4b3e2b" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
      <path ref={(el) => { refs.current[2] = el; }} d={d0} fill="none" stroke="url(#q7HullTwist)" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
      <path ref={(el) => { refs.current[3] = el; }} d={d0} fill="none" stroke="#bda77b" strokeOpacity={0.3} strokeWidth={1.2} strokeLinecap="round" transform="translate(-1.5 0)" />
    </g>
  );
}
