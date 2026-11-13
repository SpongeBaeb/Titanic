'use client';

/**
 * 왼쪽에 늘어진 도르래 밧줄: 누르고 버티면 줄이 풀리며 아래로 내려가고(구명정도 같이 내려간다), 놓으면 멈춘다.
 * 끝의 매듭이 손잡이다. 줄은 위에서 드리운 채 느리게 흔들리고, 당기는 동안에는 팽팽하게 떨린다.
 * 무대 좌표(1376x768)로 그리며, 꼬임 무늬는 구명정 줄과 같은 패턴(#q7Twist)을 쓴다.
 */
export const HAUL = { x: 24, y0: 566, rise: 520 } as const; // x 는 무대 가로 %, y0 는 배경판 좌표(줄 끝 매듭의 높이: '구명정 내리기' 버튼 바로 위), rise 는 줄이 풀려 흘러내리는 총 거리
const W = 1376;
const H = 768;

export function haulY(progress: number) {
  void progress;
  return HAUL.y0; // 줄 끝은 버튼 자리에 그대로 있고, 줄이 풀리는 것은 꼬임 무늬가 아래로 흘러내리는 것으로 보인다
}

export default function HaulRope({ progress, pulling }: { progress: number; pulling: boolean }) {
  const x = (HAUL.x / 100) * W;
  const y = haulY(progress);
  const feed = HAUL.rise * progress; // 풀려 내려간 줄의 길이: 꼬임 무늬가 이만큼 아래로 흘러내린다
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ filter: 'brightness(.9) saturate(.85)' }}>
      <style>{`
        @keyframes q7HaulSway { 0% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.4deg); } 100% { transform: rotate(-1.2deg); } }
        @keyframes q7HaulTense { 0% { transform: rotate(-.25deg) translateX(-1px); } 50% { transform: rotate(.3deg) translateX(1.2px); } 100% { transform: rotate(-.25deg) translateX(-1px); } }
        @media (prefers-reduced-motion: reduce) { .q7-haul { animation: none !important; } }
      `}</style>
      <defs>
        {/* 구명정 줄(#q7Twist)과 같은 꼬임 무늬. 줄이 풀리면 무늬가 위로 흘러 올라가 줄이 도르래 쪽으로 끌려 올라가는 것으로 보인다(구명정이 내려가면 반대편 줄은 올라간다) */}
        <pattern id="q7HaulTwist" width="8.4" height="8.4" patternUnits="userSpaceOnUse" patternTransform={`translate(0 ${(-(feed % 8.4)).toFixed(2)}) rotate(-38)`}>
          <rect width="8.4" height="8.4" fill="none" />
          <rect x="0" y="0" width="2.3" height="8.4" fill="#0e0905" />
          <rect x="2.3" y="0" width="1.6" height="8.4" fill="#2a2013" opacity="0.7" />
          <rect x="4.1" y="0" width="1.3" height="8.4" fill="#8d7a56" opacity="0.5" />
          <rect x="5.4" y="0" width="1.0" height="8.4" fill="#3a2e1d" opacity="0.6" />
        </pattern>
      </defs>
      <g className="q7-haul" style={{ transformOrigin: `${x}px -20px`, animation: pulling ? 'q7HaulTense .16s ease-in-out infinite' : 'q7HaulSway 4.6s ease-in-out infinite' }}>
        {/* 그림자 */}
        <line x1={x + 2} y1={-20} x2={x + 2} y2={y} stroke="#05080d" strokeOpacity={0.5} strokeWidth={9} strokeLinecap="round" />
        {/* 밧줄 바탕, 꼬임 무늬, 빛 */}
        <line x1={x} y1={-20} x2={x} y2={y} stroke="#6b583f" strokeWidth={8} strokeLinecap="round" />
        <line x1={x} y1={-20} x2={x} y2={y} stroke="url(#q7HaulTwist)" strokeWidth={8} strokeLinecap="round" />
        <line x1={x - 1.6} y1={-20} x2={x - 1.6} y2={y} stroke="#d8c59c" strokeOpacity={0.4} strokeWidth={1.6} />
        {/* 손잡이 매듭 */}
        <ellipse cx={x} cy={y + 10} rx={11} ry={14} fill="#4a3b27" stroke="#1c140c" strokeWidth={2} />
        <ellipse cx={x - 3} cy={y + 6} rx={4} ry={5} fill="#b6a07a" opacity={0.45} />
        {/* 매듭 아래로 늘어진 끝 */}
        <line x1={x} y1={y + 22} x2={x + 2} y2={y + 52} stroke="#5a4930" strokeWidth={6} strokeLinecap="round" />
      </g>
    </svg>
  );
}
