'use client';

import { useQuizStore } from '@/store/quizStore';
import { scenes, sceneIds, CHAPTERS } from '@/engine/scenes';

/**
 * 챕터(탑승 / 항해 / 그날 밤) 단위 진행 표시.
 * 분기로 장면 수가 사람마다 달라져도 거짓이 되지 않도록 "n/8" 대신 챕터 안의 위치로 채운다.
 */
export default function ProgressLine({ led = false }: { led?: boolean }) {
  const currentStep = useQuizStore((s) => s.currentStep);
  const night = useQuizStore((s) => !!s.extras.night);
  const scene = scenes[currentStep];
  if (!scene) return null;

  const inChapter = sceneIds.filter((id) => scenes[id].chapter === scene.chapter && (night || !scenes[id].nightOnly));
  const within = (inChapter.indexOf(currentStep) + 1) / inChapter.length;

  return (
    <div className={`w-full flex items-center ${led ? 'gap-2' : 'gap-4'}`} role="progressbar" aria-label="진행 상황"
      aria-valuetext={`${CHAPTERS[scene.chapter]} 챕터`}>
      <div
        className={led ? 'font-mono text-[10px] font-bold tracking-[0.2em] whitespace-nowrap text-[#ffb347]/85' : 'text-brass font-title text-sm tracking-wide whitespace-nowrap'}
        style={led ? { textShadow: '0 0 5px rgba(255,150,30,0.8)' } : undefined}
      >
        {CHAPTERS[scene.chapter]}
      </div>
      <div className="flex-1 flex items-center gap-2">
        {CHAPTERS.map((name, i) => {
          const fill = i < scene.chapter ? 100 : i === scene.chapter ? within * 100 : 0;
          return (
            <div key={name} className={`relative flex-1 ${led ? 'h-[3px] bg-[rgba(255,170,60,0.16)]' : 'h-[2px] bg-dim/30'}`}>
              <div
                className={`absolute top-0 left-0 h-full transition-all duration-700 ease-out ${led ? 'bg-[#ffb347]' : 'bg-brass'}`}
                style={{ width: `${fill}%`, boxShadow: led ? '0 0 5px rgba(255,150,30,0.85)' : undefined }}
              />
              {i === scene.chapter && !led && (
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
