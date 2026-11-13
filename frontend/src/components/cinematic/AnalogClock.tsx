'use client';

import { useEffect, useState } from 'react';
import { playTick } from '@/lib/synth';
import { COLLISION_MIN_OF_DAY, SINK_AFTER_MIN, wallClock } from '@/engine/cinematic';

interface Props {
  /** 충돌 후 경과 분 (소수 가능) */
  elapsed: number;
  size: number;
  /** 침몰 시각의 붉은 표식. 석양처럼 아직 모를 때는 끈다 */
  sinkMark?: boolean;
}

// 시계가 한 화면에 둘 이상 떠도 같은 초의 틱 소리는 한 번만 낸다
let lastTickAt = 0;

const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  // 서버/클라이언트의 부동소수점 표기 차이로 하이드레이션 경고가 나지 않게 소수 둘째 자리로 맞춘다
  return { x: Math.round((50 + r * Math.cos(a)) * 100) / 100, y: Math.round((50 + r * Math.sin(a)) * 100) / 100 };
};
const round = (n: number) => Math.round(n * 100) / 100;

/** 황동 선내 시계 사진(문자판) 위에 바늘만 코드로 얹는다. 초침은 경과 분의 소수부에 실제 1초 단위 똑딱임을 더해 돈다. */
export default function AnalogClock({ elapsed, size, sinkMark = true }: Props) {
  // 게임 속 시간이 멈춰 있어도 초침은 실제 1초마다 한 칸씩 똑딱인다
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTicks((n) => n + 1);
      const now = Date.now();
      if (now - lastTickAt > 500) { lastTickAt = now; playTick(); } // 음소거 기본: 해제 전에는 소리 없음
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const t = COLLISION_MIN_OF_DAY + elapsed; // 하루 중 분
  const minuteDeg = round((t % 60) * 6);
  const secondDeg = Math.round(((((t * 60 + ticks) % 60) + 60) % 60) * 6);
  const hourDeg = round(((t / 60) % 12) * 30);
  const sinkMinute = ((COLLISION_MIN_OF_DAY + SINK_AFTER_MIN) % 60) * 6; // 침몰 시각의 분침 위치
  const mark = [polar(sinkMinute, 28.2), polar(sinkMinute, 33)];

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`선내 시계 ${wallClock(elapsed)}`}
      className="drop-shadow-[0_2px_10px_rgba(0,0,0,.8)]"
    >
      <image href="/clock/dial.webp" x="0" y="0" width="100" height="100" />
      {/* 침몰 시각이 가리키는 분침 위치 */}
      {sinkMark && <line x1={mark[0].x} y1={mark[0].y} x2={mark[1].x} y2={mark[1].y} stroke="#C8352B" strokeWidth="1.8" strokeLinecap="round" />}
      <g transform={`rotate(${hourDeg} 50 50)`} fill="#1c2128" stroke="#B79F71" strokeWidth="0.35" strokeLinejoin="round">
        <path d="M50 26 L54.6 37.5 L51.6 39 L51.8 55 L48.2 55 L48.4 39 L45.4 37.5 Z" />
      </g>
      <g transform={`rotate(${minuteDeg} 50 50)`} fill="#1c2128" stroke="#0a0d11" strokeWidth="0.2">
        <path d="M50 17.5 L51.1 50 L51.3 56 L48.7 56 L48.9 50 Z" />
      </g>
      <g transform={`rotate(${secondDeg} 50 50)`} stroke="#C8352B" strokeLinecap="round">
        <line x1="50" y1="59" x2="50" y2="14" strokeWidth="0.5" />
        <circle cx="50" cy="57" r="1.1" fill="#C8352B" strokeWidth="0" />
      </g>
      <circle cx="50" cy="50" r="2.3" fill="#B79F71" stroke="#6f5a2c" strokeWidth="0.4" />
      <circle cx="50" cy="50" r="0.8" fill="#3a2f18" />
    </svg>
  );
}
