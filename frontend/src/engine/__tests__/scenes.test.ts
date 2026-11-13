import { describe, it, expect } from 'vitest';
import { scenes, sceneIds, RESULT, PROLOGUE } from '../scenes';
import { nextSceneId } from '../resolve';
import { traitsFromPicks, samplePicks, encodeAxes, traitsFromAxes } from '../traits';
import type { Ctx } from '../types';

const ctx = (over: Partial<Ctx> = {}): Ctx => ({ answers: {}, flags: {}, picks: [], run: 1, extras: {}, ...over });
// 분기 함수가 볼 만한 상황들: 어느 상황에서도 없는 장면으로 보내면 안 된다
const CASES: Ctx[] = [
  ctx(),
  ctx({ extras: { night: true } }),
  ctx({ extras: { boarded: true } }),
  ctx({ extras: { boarded: false } }),
  ctx({ extras: { boarded: false, grip: { fail: true } } }),
  ctx({ answers: { companion: 'dog' }, flags: { dog: true } }),
  ctx({ answers: { ageGroup: '0-9' }, extras: { age: 6 } }),
  ctx({ run: 2 }),
];
const valid = (id: string) => id === RESULT || id === PROLOGUE || id in scenes;

describe('장면 지도', () => {
  it('장면의 이름표(id)가 자리와 같다', () => {
    for (const id of sceneIds) expect(scenes[id].id).toBe(id);
  });

  it('다음 장면과 이전 장면이 모두 있는 장면이다', () => {
    for (const id of sceneIds) {
      const s = scenes[id];
      for (const c of CASES) expect(valid(nextSceneId(s, c)), `${id} 의 다음 장면`).toBe(true);
      const prev = (s as { prev?: unknown }).prev;
      if (typeof prev === 'string') expect(valid(prev), `${id} 의 이전 장면`).toBe(true);
    }
  });

  it('어느 장면에서 출발해도 결과 화면에 닿는다 (돌고 도는 길이 없다)', () => {
    for (const start of sceneIds) for (const c of CASES) {
      let at = start, steps = 0;
      while (at !== RESULT && steps < 40) { at = nextSceneId(scenes[at], c); steps++; }
      expect(at, `${start} 에서 출발`).toBe(RESULT);
    }
  });
});

describe('성향 점수', () => {
  it('선택이 없으면 계산하지 않는다', () => {
    expect(traitsFromPicks([])).toBeNull();
    expect(traitsFromPicks([{ scene: '없는장면', value: 'x' }])).toBeNull();
  });

  it('여섯 축이 0에서 100 사이이고 유형 이름이 나온다', () => {
    const r = traitsFromPicks(samplePicks(), 60);
    expect(r).not.toBeNull();
    expect(r!.axes).toHaveLength(6);
    for (const v of r!.axes) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    expect(r!.type.ko.length).toBeGreaterThan(0);
  });

  it('같은 장면을 두 번 거치면 마지막 선택만 쓴다', () => {
    const picks = samplePicks();
    const again = [...picks, picks[0]];
    expect(traitsFromPicks(again)!.axes).toEqual(traitsFromPicks(picks)!.axes);
  });

  it('공유 링크 표기를 다시 읽으면 같은 육각형이 나온다', () => {
    const r = traitsFromPicks(samplePicks())!;
    const back = traitsFromAxes(encodeAxes(r.axes))!;
    expect(back.axes).toEqual(r.axes.map((n) => Math.round(n)));
    expect(traitsFromAxes('1-2-3')).toBeNull();
    expect(traitsFromAxes('1-2-3-4-5-999')).toBeNull();
    expect(traitsFromAxes(null)).toBeNull();
  });
});
