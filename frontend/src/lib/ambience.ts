'use client';

import { soundManager } from './sound';
import { audioCtx } from './synth';

/**
 * 배경 소리: 항해 내내 깔려 있다가 Q6에서 끊기는 엔진 소리와 바다 소리.
 * 음원 파일 없이 Web Audio 로 합성한다. 음소거가 기본이므로 소리를 켜기 전에는 아무 소리도 나지 않는다.
 *
 *   interior : 선실·홀 안(먹먹한 엔진)      deck : 갑판(엔진은 멀고 바다 소리가 섞임)
 *   hold     : Q6 입장 직후, 엔진 유지(RumorView 가 cutEngine 으로 끊는다)
 *   quiet    : 엔진이 멎은 뒤. 이 뒤로 엔진은 돌아오지 않는다(뒤로 가기로 앞 장면에 가면 복원)
 */
export type Mix = 'interior' | 'deck' | 'hold' | 'quiet';

export const ENGINE_EVENT = 'titanic:engine';

const LEVEL: Record<Mix, { engine: number; lp: number; sea: number }> = {
  interior: { engine: 0.075, lp: 220, sea: 0.012 },
  deck: { engine: 0.05, lp: 420, sea: 0.06 },
  hold: { engine: 0.05, lp: 420, sea: 0.06 },
  quiet: { engine: 0, lp: 420, sea: 0.02 },
};

interface Graph {
  master: GainNode;
  engine: GainNode;
  lp: BiquadFilterNode;
  sea: GainNode;
}

let graph: Graph | null = null;
let mix: Mix = 'interior';
let engineOn = true; // 소리를 껐더라도 "엔진이 돌고 있는 상태"는 기록한다(화면의 맥박 연출이 같은 상태를 쓴다)
let hidden = false;

function brownBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

function build(c: AudioContext): Graph {
  const master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);

  // 엔진: 낮은 잡음 + 38Hz·52Hz 사인의 맥놀이, 느린 박동(피스톤)
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = LEVEL.interior.lp;
  const pulse = c.createGain();
  pulse.gain.value = 0.8;
  const engine = c.createGain();
  engine.gain.value = 0;
  lp.connect(pulse).connect(engine).connect(master);

  const nb = c.createBufferSource();
  nb.buffer = brownBuffer(c, 4);
  nb.loop = true;
  const ng = c.createGain();
  ng.gain.value = 0.6;
  nb.connect(ng).connect(lp);
  nb.start();

  for (const [f, v] of [[38, 0.55], [52.3, 0.35]] as const) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.value = v;
    o.connect(g).connect(lp);
    o.start();
  }
  const lfo = c.createOscillator();
  const lg = c.createGain();
  lfo.frequency.value = 1.15;
  lg.gain.value = 0.2;
  lfo.connect(lg).connect(pulse.gain);
  lfo.start();

  // 바다: 느리게 오르내리는 낮은 잡음
  const sb = c.createBufferSource();
  sb.buffer = brownBuffer(c, 6);
  sb.loop = true;
  const slp = c.createBiquadFilter();
  slp.type = 'lowpass';
  slp.frequency.value = 700;
  const sea = c.createGain();
  sea.gain.value = 0;
  sb.connect(slp).connect(sea).connect(master);
  sb.start();
  const wave = c.createOscillator();
  const wg = c.createGain();
  wave.frequency.value = 0.11;
  wg.gain.value = 260;
  wave.connect(wg).connect(slp.frequency);
  wave.start();

  return { master, engine, lp, sea };
}

function apply(fast = false) {
  const c = audioCtx(); // 음소거 중에는 null
  const muted = soundManager.getMuteState();
  if (!c || muted) {
    if (graph) graph.master.gain.setTargetAtTime(0, graph.master.context.currentTime, 0.05);
    return;
  }
  graph ??= build(c);
  const t = c.currentTime;
  const lv = LEVEL[mix];
  graph.master.gain.setTargetAtTime(hidden ? 0 : 1, t, 0.3);
  graph.engine.gain.setTargetAtTime(engineOn ? lv.engine : 0, t, fast ? 0.08 : 1.6);
  graph.lp.frequency.setTargetAtTime(lv.lp, t, 1.2);
  graph.sea.gain.setTargetAtTime(lv.sea, t, 1.6);
}

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ENGINE_EVENT, { detail: { on: engineOn } }));
}

/** 장면이 바뀔 때 부른다 */
export function setMix(next: Mix) {
  if (mix === next && next !== 'hold') return;
  mix = next;
  const on = next !== 'quiet';
  const changed = on !== engineOn;
  engineOn = on;
  apply();
  if (changed) emit();
}

/** Q6: 엔진이 뚝 끊긴다 (잡음이 나지 않도록 아주 짧게 내린다) */
export function cutEngine() {
  mix = 'quiet';
  engineOn = false;
  apply(true);
  emit();
}

export function isEngineOn() {
  return engineOn;
}

/** 소리를 켜고 끌 때, 그리고 첫 상호작용 때 부른다 */
export function refreshAmbience() {
  apply();
}

// 첫 클릭·터치 후에야 소리가 나올 수 있다(브라우저 정책). 탭이 숨겨지면 멈춘다.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => refreshAmbience(), { passive: true });
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    apply();
  });
}
