// 업적 옆에 돋아나는 잎 달린 가지. 줄기가 자라고 잎이 하나씩 펴진다. 한 번 그려지면 그대로 남는다.
const STYLE = `
@keyframes sprig-stem { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
@keyframes sprig-leaf { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .sprig-stem, .sprig-leaf { animation: none !important; stroke-dashoffset: 0 !important; transform: none !important; opacity: 1 !important } }
`;

// 줄기를 따라 번갈아 나는 잎: [줄기 위 높이, 잎이 향하는 각도]
const LEAVES: [number, number][] = [
  [70, -150], [60, -30], [50, -150], [40, -30], [30, -150], [20, -30], [11, -150],
];

interface Props {
  /** 왼쪽 가지는 좌우를 뒤집는다 */
  flip?: boolean;
  /** 자라기 시작하는 시간(초) */
  delay?: number;
  className?: string;
}

export default function Sprig({ flip = false, delay = 0, className = '' }: Props) {
  return (
    <svg
      viewBox="0 0 30 84"
      className={className}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      fill="currentColor"
      aria-hidden
    >
      <style>{STYLE}</style>
      <path
        className="sprig-stem"
        d="M15 82 C 14 60, 16 30, 15 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        style={{ animation: `sprig-stem 1.1s ease-out ${delay}s both` }}
      />
      {LEAVES.map(([y, angle], i) => (
        <g key={i} transform={`translate(15 ${y}) rotate(${angle})`}>
          <path
            className="sprig-leaf"
            d="M0 0 C 4 -4.2, 10 -4.2, 13 0 C 10 4.2, 4 4.2, 0 0 Z"
            style={{ animation: `sprig-leaf .5s ease-out ${delay + 0.5 + i * 0.12}s both` }}
          />
        </g>
      ))}
    </svg>
  );
}
