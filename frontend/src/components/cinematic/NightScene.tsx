'use client';

import CinematicPanel from './CinematicPanel';
import { demoScenes } from '@/engine/demoScenes';
import type { CineOption } from '@/engine/cinematic';
import type { Ctx } from '@/engine/types';

interface Props {
  /** 장면 패널 id (예: 'N1') */
  cineId: string;
  ctx: Ctx;
  timerEnabled: boolean;
  onChoose: (option: CineOption, ms: number) => void;
}

/** 실제 게임 흐름 안에서 밤 장면(N1~N3)을 보여 주는 얇은 어댑터. 시간 자원은 extras.spent 에 누적된다. */
export default function NightScene({ cineId, ctx, timerEnabled, onChoose }: Props) {
  const idx = demoScenes.findIndex((c) => c.id === cineId);
  const scene = demoScenes[idx];
  if (!scene) return null;
  const spent = typeof ctx.extras?.spent === 'number' ? ctx.extras.spent : 0;
  const next = demoScenes[idx + 1];
  const full: Ctx = { ...ctx, elapsed: scene.at + spent };

  return (
    <div className="min-h-screen flex items-center justify-center px-3 py-6">
      <CinematicPanel
        scene={scene}
        ctx={full}
        elapsed={scene.at + spent}
        nextElapsed={(o) => (next ? next.at + spent + (o.timeCost ?? 0) : undefined)}
        timerEnabled={timerEnabled}
        onChoose={onChoose}
      />
    </div>
  );
}
