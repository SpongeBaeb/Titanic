import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { estimateAdjusted, isChildAge, ageOf, swimChance, swimStart, w2Chance, storyAlive, storyLine, SWIM } from '../boarding';
import { submitBody } from '@/lib/submit';

const base = { sex: 'female', pclass: 3 }; // 어림 확률 50: 어떤 보정을 더해도 1~99 안에 있다

describe('어림 확률', () => {
  it('언제나 1에서 99 사이', () => {
    for (const sex of ['male', 'female']) for (const pclass of [1, 2, 3]) for (const finalAction of ['yield_seat', 'me_first', 'secure_mine', 'yield_weak', 'observe', undefined])
      for (const rumorAction of ['check_escape', 'follow_crowd', undefined]) {
        const p = estimateAdjusted({ sex, pclass, finalAction, rumorAction }, { lifebuoy: true });
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(99);
      }
  });

  it('보정값이 서버(survival_engine.py)와 같다', () => {
    const py = fs.readFileSync(path.resolve(__dirname, '../../../../backend/engine/survival_engine.py'), 'utf8');
    const server: Record<string, number> = {};
    for (const m of py.matchAll(/== ["'](\w+)["']:\s*\r?\n\s*score_modifier ([+-])= (\d+)/g)) server[m[1]] = (m[2] === '-' ? -1 : 1) * Number(m[3]);
    const buoy = /answers\.get\(["']lifebuoy["']\):\s*\r?\n\s*score_modifier \+= (\d+)/.exec(py);
    expect(Object.keys(server).length).toBeGreaterThanOrEqual(8);
    const p0 = estimateAdjusted(base, {});
    for (const k of ['check_escape', 'check_crew', 'calm_others', 'follow_crowd']) expect(estimateAdjusted({ ...base, rumorAction: k }, {}) - p0, k).toBe(server[k]);
    for (const k of ['yield_seat', 'me_first', 'secure_mine', 'yield_weak']) expect(estimateAdjusted({ ...base, finalAction: k }, {}) - p0, k).toBe(server[k]);
    expect(estimateAdjusted({ ...base, finalAction: 'observe' }, {}) - p0).toBe(0);
    expect(estimateAdjusted(base, { lifebuoy: true }) - p0).toBe(Number(buoy?.[1]));
  });

  it('나이: 정확한 나이가 구간보다 먼저, 11세 이하는 어린이', () => {
    expect(ageOf({ ageGroup: '30-39' }, {})).toBe(35);
    expect(ageOf({ ageGroup: '30-39' }, { age: 8 })).toBe(8);
    expect(isChildAge(11)).toBe(true);
    expect(isChildAge(12)).toBe(false);
    expect(isChildAge(undefined)).toBe(false);
  });
});

describe('헤엄(W2)', () => {
  it('헤엄칠수록 확률이 내려가고 바닥(0.2) 밑으로는 안 내려간다', () => {
    for (const a of [0, 30, 100]) {
      let prev = Infinity;
      for (let k = 0; k < 40; k++) {
        const p = swimChance(a, k);
        expect(p).toBeLessThanOrEqual(prev);
        expect(p).toBeGreaterThanOrEqual(0.2);
        prev = p;
      }
    }
    expect(swimChance(100, 0)).toBeCloseTo(SWIM.base + SWIM.slope);
    expect(swimChance(250, 0)).toBe(swimChance(100, 0)); // 범위를 벗어난 값은 잘린다
  });

  it('끝까지(8번) 헤엄쳤을 때 전체 확률이 기획 범위 안: 낮으면 약 10%, 높으면 약 30%', () => {
    const total = (a: number) => { let miss = 1; for (let k = 0; k < 8; k++) miss *= 1 - swimChance(a, k) / 100; return (1 - miss) * 100; };
    expect(total(0)).toBeGreaterThan(6);
    expect(total(0)).toBeLessThan(13);
    expect(total(100)).toBeGreaterThan(22);
    expect(total(100)).toBeLessThan(34);
  });

  it('난간에서의 일이 출발 조건에 반영된다', () => {
    expect(swimStart({ w1: { how: 'jump' } }).stamina).toBe(100);
    expect(swimStart({ w1: { how: 'forced' } }).stamina).toBe(100 - SWIM.forcedCost);
    expect(swimStart({ grip: { fail: true }, w1: { how: 'jump' } }).stamina).toBe(100 - SWIM.slipCost);
    const t = swimStart({ w1: { outcome: 'together', holds: 1, how: 'jump' } });
    expect(t.together).toBe(true);
    expect(t.bonus).toBeCloseTo(0.5 + SWIM.togetherBonus);
    expect(t.costMul).toBeCloseTo(SWIM.togetherMul);
    expect(swimStart({ lifebuoy: true, w1: {} }).costMul).toBeCloseTo(SWIM.buoyMul);
    expect(swimStart({ w1: { curses: 2, truths: 1 } }).bonus).toBeCloseTo(-0.8);
  });

  it('죽음의 방식: 능동적일수록 조금 높다', () => {
    for (const a of [0, 50, 100]) {
      expect(w2Chance('swim', a)).toBeGreaterThan(w2Chance('jump', a));
      expect(w2Chance('jump', a)).toBeGreaterThan(w2Chance('sink', a));
    }
  });
});

describe('결과에 남는 이야기', () => {
  it('탑승 판정이 있으면 이야기를 따르고, 없으면 확률 절반으로 정한다', () => {
    expect(storyAlive({ boarded: true }, 1)).toBe(true);
    expect(storyAlive({ boarded: false }, 99)).toBe(false);
    expect(storyAlive({ boarded: false, w2Survived: true }, 1)).toBe(true);
    expect(storyAlive({}, 50)).toBe(true);
    expect(storyAlive({}, 49.9)).toBe(false);
    expect(storyAlive({}, null)).toBe(false);
  });

  it('노라의 편지가 결과 한 줄에 남는다', () => {
    expect(storyLine({})).toBeNull();
    expect(storyLine({ boarded: false, w2Survived: true, w1: { letter: 'given' } })).toContain('편지');
    expect(storyLine({ boarded: false, w2Survived: true, letterLost: true, w1: { letter: 'given' } })).toContain('떠내려갔습니다');
    expect(storyLine({ boarded: false, w1: { letter: 'given' } })).toContain('가라앉았습니다');
    expect(storyLine({ boarded: false, w1: { outcome: 'gone' } })).toContain('먼저 손을 놓았습니다');
    expect(storyLine({ boarded: false, w1: {} })).toBe('돌아오지 못했습니다');
  });
});

describe('서버로 보내는 값', () => {
  it('서버가 읽는 키만 보낸다: 뒤쪽 장면의 선택이 섞이지 않는다', () => {
    const body = submitBody({ sex: 'male', pclass: 2, finalAction: 'observe', lastWords: 'together', lastWay: 'swim', dogScent: 'trust' }, { lifebuoy: true, age: 31, w1: {} });
    expect(body).toEqual({ sex: 'male', pclass: 2, finalAction: 'observe', lifebuoy: true, age: 31 });
  });
});
