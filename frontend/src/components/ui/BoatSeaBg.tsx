'use client';

import BgLights from '@/components/ui/BgLights';

/**
 * B1 (구명정에 오른 뒤): 바다·하늘과 배를 따로 그린 두 겹 배경.
 * 수평선과 별은 거의 가만히 있고, 노가 걸린 배만 물결에 흔들린다 (노 걸이, 랜턴, 바닥 물까지 배와 같이 움직인다).
 * 랜턴 불빛(BgLights)도 배 쪽에 얹어 같이 흔들린다. 그림은 public/bg/boat_sea_plate.webp, boat_sea_boat.webp.
 * 모션 줄이기 설정이면 쓰지 않고(QuizContainer 가 한 장짜리 boat_sea.webp 를 쓴다) 흔들리지 않는다.
 */
export const BOAT_SEA_URL = '/bg/boat_sea.webp';

const CSS = `
@keyframes boatRock {
  0% { transform: rotate(-1.4deg) translateY(-7px) scale(1.07); }
  50% { transform: rotate(1.4deg) translateY(7px) scale(1.07); }
  100% { transform: rotate(-1.4deg) translateY(-7px) scale(1.07); }
}
@keyframes seaDrift {
  0% { transform: translate(-6px, 0) scale(1.03); }
  50% { transform: translate(6px, -2px) scale(1.03); }
  100% { transform: translate(-6px, 0) scale(1.03); }
}
`;

export default function BoatSeaBg({ opacity, out }: { opacity: number; out: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{CSS}</style>
      {/* 바다·하늘: 아주 느리게 미끄러진다 */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/bg/boat_sea_plate.webp')", animation: 'seaDrift 12s ease-in-out infinite' }} />
      {/* 배: 가운데 아래를 중심으로 좌우로 기울고 위아래로 오르내린다 */}
      <div className="absolute inset-0" style={{ transformOrigin: '50% 70%', animation: 'boatRock 5.6s ease-in-out infinite' }}>
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/bg/boat_sea_boat.webp')" }} />
        <BgLights url={BOAT_SEA_URL} opacity={opacity} out={out} />
      </div>
    </div>
  );
}
