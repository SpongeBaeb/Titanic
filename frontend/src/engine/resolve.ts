import type { Ctx, SceneDef } from './types';
import { scenes, RESULT } from './scenes';
import { questionsData } from '@/data/questions';

export function nextSceneId(scene: SceneDef, ctx: Ctx): string {
  return typeof scene.next === 'function' ? scene.next(ctx) : scene.next;
}

export function bgFor(sceneId: string, answers: Ctx['answers']): string | undefined {
  const bg = questionsData[sceneId]?.bgImage;
  return typeof bg === 'function' ? bg(answers) : bg;
}

/** 장면에 들어가기 전에 받아 둘 이미지 목록 */
export function assetsFor(sceneId: string, answers: Ctx['answers']): string[] {
  const out: string[] = [];
  const bg = bgFor(sceneId, answers);
  if (bg) out.push(bg);
  const scene = scenes[sceneId];
  if (scene) {
    out.push(...(scene.assets ?? []));
    if (scene.preloadOptionBg) {
      questionsData[sceneId]?.options.forEach(o => { if (o.bgImage) out.push(o.bgImage); });
    }
  } else if (sceneId === RESULT) {
    out.push('/bg/collasping.webp');
  }
  return out.filter(Boolean);
}
