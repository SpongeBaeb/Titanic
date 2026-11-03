'use client';

import { soundManager } from './sound';

// 음원 파일 없이 Web Audio 로 만드는 짧은 효과음. 프로젝트 규칙에 따라 음소거가 기본이고,
// 음소거를 해제하지 않으면 아무 소리도 나지 않는다(파일 요청도 없다).
let audio: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined' || soundManager.getMuteState()) return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audio ??= new Ctor();
    if (audio.state === 'suspended') void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function noise(c: AudioContext, seconds: number): AudioBufferSourceNode {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

/** 시계 초침 같은 짧은 틱 */
export function playTick() {
  const c = ctx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = 1900;
  g.gain.setValueAtTime(0.025, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.03);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.04);
}

/** 카메라 셔터: 두 번의 짧은 잡음 */
export function playShutter() {
  const c = ctx();
  if (!c) return;
  [0, 0.07].forEach((offset, i) => {
    const n = noise(c, 0.05);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = i === 0 ? 2500 : 1500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.12, c.currentTime + offset);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + offset + 0.05);
    n.connect(f).connect(g).connect(c.destination);
    n.start(c.currentTime + offset);
  });
}

/** 낮고 묵직한 쿵 소리 (흔들림 연출과 함께) */
export function playThud() {
  const c = ctx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.25);
  g.gain.setValueAtTime(0.25, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.3);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.32);
}
