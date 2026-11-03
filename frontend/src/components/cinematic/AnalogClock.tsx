import { COLLISION_MIN_OF_DAY, SINK_AFTER_MIN, wallClock } from '@/engine/cinematic';

interface Props {
  /** 충돌 후 경과 분 (소수 가능) */
  elapsed: number;
  size: number;
  /** 큰 크기에서만 로마 숫자를 그린다 */
  numerals?: boolean;
  /** 침몰 시각의 붉은 표식. 석양처럼 아직 모를 때는 끈다 */
  sinkMark?: boolean;
}

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  // 서버/클라이언트의 부동소수점 표기 차이로 하이드레이션 경고가 나지 않게 소수 둘째 자리로 맞춘다
  return { x: Math.round((50 + r * Math.cos(a)) * 100) / 100, y: Math.round((50 + r * Math.sin(a)) * 100) / 100 };
};

/** 1912년 선내 시계 느낌의 황동 아날로그 시계. 초침은 두지 않는다. */
export default function AnalogClock({ elapsed, size, numerals = false, sinkMark = true }: Props) {
  const t = COLLISION_MIN_OF_DAY + elapsed; // 하루 중 분
  const minuteDeg = (t % 60) * 6;
  const hourDeg = ((t / 60) % 12) * 30;
  const sinkMinute = ((COLLISION_MIN_OF_DAY + SINK_AFTER_MIN) % 60) * 6; // 침몰 시각의 분침 위치
  const mark = [polar(sinkMinute, 36), polar(sinkMinute, 45)];

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`선내 시계 ${wallClock(elapsed)}`}
      className="drop-shadow-[0_2px_10px_rgba(0,0,0,.8)]"
    >
      <circle cx="50" cy="50" r="48" fill="#0B1820" stroke="#B89A5B" strokeWidth="3" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#B89A5B" strokeOpacity=".4" strokeWidth="0.6" />
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0;
        const a = polar(i * 6, 42);
        const b = polar(i * 6, major ? 37 : 40);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#D4B878" strokeOpacity={major ? 0.9 : 0.4} strokeWidth={major ? 1.2 : 0.5} />;
      })}
      {/* 침몰 시각이 가리키는 분침 위치 */}
      {sinkMark && <line x1={mark[0].x} y1={mark[0].y} x2={mark[1].x} y2={mark[1].y} stroke="#E8685A" strokeWidth="2.4" strokeLinecap="round" />}
      {numerals && ROMAN.map((r, i) => {
        const p = polar(i * 30, 29);
        return (
          <text key={r} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="7" fill="#F1EBDD" fillOpacity=".85" fontFamily="var(--font-display), serif">{r}</text>
        );
      })}
      <line x1="50" y1="50" x2={polar(hourDeg, 22).x} y2={polar(hourDeg, 22).y} stroke="#F1EBDD" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="50" x2={polar(minuteDeg, 35).x} y2={polar(minuteDeg, 35).y} stroke="#D4B878" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2.6" fill="#B89A5B" />
    </svg>
  );
}
