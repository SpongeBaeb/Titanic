'use client';

import { useEffect, useState } from 'react';

/**
 * 구명정의 장교. 표정과 행동마다 장교가 탄 구명정 전체를 통짜 그림으로 따로 받는다(q7/officer/<상태>.webp).
 * 그림이 있는 상태는 그 그림으로 바꿔 끼우고(부드럽게 섞임), 아직 없는 상태는 기본 그림(q7/boat_officer.webp)을 그대로 쓴다.
 * 그림은 모두 같은 구도(1376x768 전체, 구명정이 프레임을 가득 채움)로 받는다. 배경판 위 BOAT 자리에 늘여 그린다.
 */
export type Face = 'calm' | 'urgent' | 'angry' | 'relief' | 'doubt' | 'pity' | 'block' | 'receive' | 'pull';
export const FACES: Face[] = ['calm', 'urgent', 'angry', 'relief', 'doubt', 'pity', 'block', 'receive', 'pull'];

/** 기본 그림: 장교가 손을 내민 구명정 (상태 그림이 없을 때) */
export const BASE_SRC = '/q7/boat_officer.webp';
export const stateSrc = (f: Face) => `/q7/officer/${f}.webp`;
/** 구명정 그림이 배경판 위에 놓이는 자리 (배경판 1376x768 좌표) */
export const BOAT = { x: 316, y: 162, w: 865, h: 498 };

/** 받아 둔 상태 그림이 무엇인지 알아낸다 (없는 파일은 조용히 건너뛴다) */
export function useOfficerStates(): Set<Face> {
  const [have, setHave] = useState<Set<Face>>(() => new Set());
  useEffect(() => {
    let alive = true;
    for (const f of FACES) {
      const im = new Image();
      im.onload = () => { if (alive) setHave((s) => (s.has(f) ? s : new Set(s).add(f))); };
      im.src = stateSrc(f);
    }
    return () => { alive = false; };
  }, []);
  return have;
}

/**
 * 장교가 탄 구명정 한 장을 그린다. all 이면 받아 둔 상태 그림을 모두 올려 두고 현재 상태만 보이게 한다(바꿀 때 부드럽게 섞인다).
 * 현재 상태의 그림이 없으면 기본 그림이 보인다. all 이 아니면 지금 보일 그림 한 장만 그린다(시선 레이어의 복사본처럼 가벼워야 할 때).
 */
export function OfficerBoat({ face, have, all = false }: { face: Face; have: Set<Face>; all?: boolean }) {
  const hasCur = have.has(face);
  const common = { x: BOAT.x, y: BOAT.y, width: BOAT.w, height: BOAT.h, preserveAspectRatio: 'none' as const };
  if (!all) return <image href={hasCur ? stateSrc(face) : BASE_SRC} {...common} />;
  return (
    <g>
      <image href={BASE_SRC} {...common} style={{ opacity: hasCur ? 0 : 1, transition: 'opacity 0.14s linear' }} />
      {FACES.filter((f) => have.has(f)).map((f) => (
        <image key={f} href={stateSrc(f)} {...common} style={{ opacity: f === face ? 1 : 0, transition: 'opacity 0.14s linear' }} />
      ))}
    </g>
  );
}

/**
 * 장교의 머리 자리 (상태 그림 1363x784 좌표). 그림마다 머리 위치가 달라서 따로 적는다.
 * 시선 효과(머리가 커서 쪽으로 살짝 돌아감)가 이 자리를 중심으로 일어난다.
 */
export const HEAD: Record<Face | 'base', { x: number; y: number }> = {
  base: { x: 868, y: 102 },
  calm: { x: 868, y: 102 },
  doubt: { x: 865, y: 102 },
  urgent: { x: 857, y: 112 },
  angry: { x: 866, y: 97 },
  relief: { x: 868, y: 98 },
  block: { x: 870, y: 98 },
  receive: { x: 900, y: 205 },
  pull: { x: 845, y: 122 },
  pity: { x: 864, y: 104 },
};
/** 상태 그림의 폭·높이 (원본 픽셀). 머리 자리를 배경판 좌표로 바꿀 때 쓴다 */
export const STATE_PX = { w: 1363, h: 784 };
/** 머리 자리를 배경판(1376x768) 좌표로 */
export const headOnCanvas = (face: Face, have: Set<Face>) => {
  const h = have.has(face) ? HEAD[face] : HEAD.base;
  return { x: BOAT.x + (h.x / STATE_PX.w) * BOAT.w, y: BOAT.y + (h.y / STATE_PX.h) * BOAT.h };
};

/**
 * 눈동자가 크게 보이는 상태의 눈 위치 (상태 그림 1363x784 좌표). 여기 적힌 상태에서만 눈동자가 아이나 커서를 따라간다.
 * 아이를 받으려 몸을 숙인 receive 그림은 얼굴이 크게 나와 눈동자를 움직일 수 있다. 다른 그림은 눈이 너무 작아 쓰지 않는다.
 */
export const EYES: Partial<Record<Face, { x: number; y: number }[]>> = {
  receive: [{ x: 876.7, y: 190 }, { x: 922, y: 203.3 }],
};
/** 눈 위치를 배경판(1376x768) 좌표로. 눈동자 효과를 쓰지 않는 상태(그림이 없거나 EYES 에 없음)는 null */
export const eyesOnCanvas = (face: Face, have: Set<Face>) => {
  const e = have.has(face) ? EYES[face] : undefined;
  return e ? e.map((p) => ({ x: BOAT.x + (p.x / STATE_PX.w) * BOAT.w, y: BOAT.y + (p.y / STATE_PX.h) * BOAT.h })) : null;
};
