'use client';

import { useQuizStore } from '@/store/quizStore';
import { scenes, sceneIds, CHAPTERS } from '@/engine/scenes';

/**
 * 챕터(탑승 / 항해 / 그날 밤) 단위 진행 표시.
 * 분기로 장면 수가 사람마다 달라져도 거짓이 되지 않도록 "n/8" 대신 챕터 안의 위치로 채운다.
 */
export default function ProgressLine() {
  const currentStep = useQuizStore((s) => s.currentStep);
  const scene = scenes[currentStep];
  if (!scene) return null;

  const inChapter = sceneIds.filter((id) => scenes[id].chapter === scene.chapter);
  const within = (inChapter.indexOf(currentStep) + 1) / inChapter.length;

  return (
    <div className="w-full flex items-center gap-4" role="progressbar" aria-label="진행 상황"
      aria-valuetext={`${CHAPTERS[scene.chapter]} 챕터`}>
      <div className="text-brass font-title text-sm tracking-wide whitespace-nowrap">
        {CHAPTERS[scene.chapter]}
      </div>
      <div className="flex-1 flex items-center gap-2">
        {CHAPTERS.map((name, i) => {
          const fill = i < scene.chapter ? 100 : i === scene.chapter ? within * 100 : 0;
          return (
            <div key={name} className="relative flex-1 h-[2px] bg-dim/30">
              <div
                className="absolute top-0 left-0 h-full bg-brass transition-all duration-700 ease-out"
                style={{ width: `${fill}%` }}
              />
              {i === scene.chapter && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brass shadow-[0_0_8px_rgba(184,154,91,0.8)] transition-all duration-700 ease-out"
                  style={{ left: `calc(${fill}% - 3px)` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
