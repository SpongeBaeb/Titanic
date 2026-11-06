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

/** 다른 모듈(배경 소리 등)이 같은 AudioContext 를 쓰도록 내보낸다. 음소거 중에는 null */
export function audioCtx(): AudioContext | null {
  return ctx();
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

/** 전신기 레버가 한 칸 넘어가는 래칫 소리: 짧은 금속 클릭과 낮은 걸림음 */
export function playRatchet() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const n = noise(c, 0.04);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 3200;
  f.Q.value = 2.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  n.connect(f).connect(g).connect(c.destination);
  n.start(t);
  const o = c.createOscillator();
  const og = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.06);
  og.gain.setValueAtTime(0.07, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(og).connect(c.destination);
  o.start(t);
  o.stop(t + 0.08);
}

/** 증기 배출 소리: 고역 잡음이 빠르게 올라왔다 서서히 잦아든다 */
export function playSteamHiss(power = 1) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const dur = 0.55 + 0.5 * power;
  const n = noise(c, dur + 0.1);
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.setValueAtTime(1800, t);
  f.frequency.linearRampToValueAtTime(3600, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09 * power, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f).connect(g).connect(c.destination);
  n.start(t);
}

/** 프린터가 전보를 뽑는 소리: 한 줄씩 끊어 가며 치-직 하고 긁는 소리, 끝에 종 (steps·dur 는 화면의 종이 움직임과 같은 박자) */
export function playTelegramPrint(steps = 8, dur = 3) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime;
  for (let i = 1; i <= steps; i++) {
    // 종이가 밀려 올라가는 구간(각 박자의 뒤쪽 45%)에 긁는 소리
    const ts = t0 + ((i - 1 + 0.55) / steps) * dur;
    const len = (0.45 / steps) * dur;
    const n = noise(c, len + 0.02);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1500, ts);
    f.frequency.exponentialRampToValueAtTime(3600, ts + len);
    f.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, ts);
    g.gain.exponentialRampToValueAtTime(0.16, ts + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ts + len);
    n.connect(f).connect(g).connect(c.destination);
    n.start(ts);
    // 활자 타격: 같은 구간의 짧은 클릭 몇 번
    for (let k = 0; k < 5; k++) {
      const tc = ts + (k / 5) * len + (Math.random() - 0.5) * 0.01;
      const cn = noise(c, 0.012);
      const cf = c.createBiquadFilter();
      cf.type = 'highpass';
      cf.frequency.value = 2200;
      const cg = c.createGain();
      cg.gain.setValueAtTime(0.09, tc);
      cg.gain.exponentialRampToValueAtTime(0.0001, tc + 0.012);
      cn.connect(cf).connect(cg).connect(c.destination);
      cn.start(tc);
    }
  }
  const t = t0 + dur + 0.1;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = 1760;
  g.gain.setValueAtTime(0.07, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.72);
}

/** 버튼이 밑에서 올라오는 모터 소리: 낮게 시작해 점점 높아지는 위이잉 */
export function playServoRise(duration = 0.7) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(380, t + duration);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(500, t);
  f.frequency.linearRampToValueAtTime(1800, t + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.08);
  g.gain.setValueAtTime(0.07, t + duration - 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.04);
  o.connect(f).connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + duration + 0.06);
}

/** 올라온 버튼이 딱 맞물려 활성화되는 소리: 짧은 금속 딸깍과 맑은 한 음 */
export function playPop() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const n = noise(c, 0.03);
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 2400;
  const g = c.createGain();
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  n.connect(f).connect(g).connect(c.destination);
  n.start(t);
  const o = c.createOscillator();
  const og = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(620, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.06);
  og.gain.setValueAtTime(0.1, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(og).connect(c.destination);
  o.start(t);
  o.stop(t + 0.2);
}

/** 사진기에서 사진이 밀려 나오는 소리: 작은 모터가 세 번 끊어 돌며 윙-윙-윙 */
export function playPhotoEject() {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime;
  for (let i = 0; i < 3; i++) {
    const ts = t0 + 0.0 + ((i + 0.5) / 3) * 1.7;
    const len = (0.5 / 3) * 1.7;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, ts);
    o.frequency.linearRampToValueAtTime(190, ts + len);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, ts);
    g.gain.exponentialRampToValueAtTime(0.07, ts + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, ts + len);
    o.connect(f).connect(g).connect(c.destination);
    o.start(ts);
    o.stop(ts + len + 0.02);
  }
}

/** 목줄이 팽팽해지다 툭 끊어지는 소리: 삐걱거리며 높아지는 긴장음 뒤에 짧은 파열음과 낮은 울림 */
export function playLeashSnap() {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime;
  // 팽팽해지는 소리 (약 1.9초)
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(70, t0);
  o.frequency.exponentialRampToValueAtTime(240, t0 + 1.85);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(260, t0);
  lp.frequency.exponentialRampToValueAtTime(1400, t0 + 1.85);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 1.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);
  o.connect(lp).connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + 1.95);
  // 끊어지는 순간
  const ts = t0 + 1.9;
  const n = noise(c, 0.12);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.28, ts);
  ng.gain.exponentialRampToValueAtTime(0.0001, ts + 0.12);
  n.connect(hp).connect(ng).connect(c.destination);
  n.start(ts);
  const th = c.createOscillator();
  th.type = 'sine';
  th.frequency.setValueAtTime(140, ts);
  th.frequency.exponentialRampToValueAtTime(48, ts + 0.35);
  const tg = c.createGain();
  tg.gain.setValueAtTime(0.18, ts);
  tg.gain.exponentialRampToValueAtTime(0.0001, ts + 0.4);
  th.connect(tg).connect(c.destination);
  th.start(ts);
  th.stop(ts + 0.42);
}

/** 분위기(Q3)에서 한 공간을 고를 때의 짧은 소리: 1등은 맑은 종소리, 2등은 괘종시계 두 번, 3등은 바이올린이 올라가는 한 음 */
export function playRoomChoose(kind: string) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime;
  const tone = (type: OscillatorType, f0: number, f1: number, at: number, len: number, vol: number, lp = 4000) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0 + at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + at + len);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
    o.connect(f).connect(g).connect(c.destination);
    o.start(t0 + at);
    o.stop(t0 + at + len + 0.05);
  };
  if (kind === '1') {
    tone('sine', 880, 880, 0, 1.4, 0.09);
    tone('sine', 1318, 1318, 0.18, 1.5, 0.07);
    tone('sine', 1760, 1760, 0.36, 1.4, 0.04);
  } else if (kind === '2') {
    tone('sine', 196, 196, 0, 1.2, 0.1, 900);
    tone('sine', 196, 196, 0.55, 1.4, 0.1, 900);
  } else {
    tone('sawtooth', 330, 494, 0, 0.7, 0.05, 1600);
    tone('sawtooth', 497, 497, 0.55, 0.5, 0.035, 1600);
  }
}


// ── Q5 갑판 장면 ──────────────────────────────────────────────

/** 샴페인 코르크가 "펑" 하고 튀는 소리 */
export function playCorkPop() {
  playPop();
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const n = noise(c, 0.5);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(5200, t);
  f.frequency.exponentialRampToValueAtTime(900, t + 0.45);
  const g = c.createGain();
  g.gain.setValueAtTime(0.05, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  n.connect(f).connect(g).connect(c.destination);
  n.start(t + 0.02);
}

/** 폭죽이 터지는 소리: 낮은 울림과 자잘한 탁탁 소리. delay 초 뒤에 */
export function playFireworkBurst(delay = 0, power = 1) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + delay;
  const thump = c.createOscillator();
  const tg = c.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(110, t);
  thump.frequency.exponentialRampToValueAtTime(38, t + 0.35);
  tg.gain.setValueAtTime(0.22 * power, t);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  thump.connect(tg).connect(c.destination);
  thump.start(t);
  thump.stop(t + 0.5);
  const n = noise(c, 0.9);
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 3200;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < 14; i++) g.gain.setValueAtTime(0.05 * power * (1 - i / 16), t + 0.05 + i * 0.045 + Math.random() * 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  n.connect(f).connect(g).connect(c.destination);
  n.start(t);
}

/** 별을 하나 이을 때 울리는 맑은 종소리 (index 마다 음이 올라간다) */
export function playStarChime(index = 0) {
  const c = ctx();
  if (!c) return;
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 987.77, 1174.66, 1318.51];
  const f = scale[index % scale.length];
  const t = c.currentTime;
  for (const [mul, vol] of [[1, 0.06], [2.01, 0.02]] as const) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f * mul;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 1.9);
  }
}

/** 멀리서 들려오는 고래 울음: 낮은 소리가 길게 오르내린다 */
export function playWhaleCall() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const lfo = c.createOscillator();
  const lg = c.createGain();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(190, t + 1.4);
  o.frequency.exponentialRampToValueAtTime(85, t + 3.2);
  lfo.frequency.value = 5;
  lg.gain.value = 6;
  lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.13, t + 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
  o.connect(g).connect(c.destination);
  o.start(t);
  lfo.start(t);
  o.stop(t + 3.5);
  lfo.stop(t + 3.5);
}

/** 큰 물보라 소리 */
export function playSplash(delay = 0) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + delay;
  const n = noise(c, 1.4);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3800, t);
  f.frequency.exponentialRampToValueAtTime(380, t + 1.2);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  n.connect(f).connect(g).connect(c.destination);
  n.start(t);
}

// ── Q6 소문 장면 ──────────────────────────────────────────────

/** 정적 속에서 유리잔이 달그락거리는 소리 (엔진이 멎은 직후) */
export function playGlassRattle() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 6; i++) {
    const at = t + i * 0.09 + Math.random() * 0.05;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = 2300 + Math.random() * 900;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.03 * (1 - i / 8), at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    o.connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + 0.3);
  }
}

export interface Murmur {
  /** 0~1 */
  level: (v: number) => void;
  /** -1(왼쪽) ~ 1(오른쪽) */
  pan: (p: number) => void;
  stop: () => void;
}

/** 멀리서 웅성거리는 사람들 소리: 말소리 대역의 잡음을 느리게 떨리게 한다. 음소거 중에는 null */
export function startMurmur(): Murmur | null {
  const c = ctx();
  if (!c) return null;
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const master = c.createGain();
  master.gain.value = 0;
  const pan = c.createStereoPanner();
  master.connect(pan).connect(c.destination);
  const lfos: OscillatorNode[] = [];
  for (const [f, q, rate, depth] of [[620, 1.1, 4.3, 0.5], [1250, 1.8, 6.9, 0.45], [2300, 2.4, 9.1, 0.3]] as const) {
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const am = c.createGain();
    am.gain.value = 0.5;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = rate;
    lg.gain.value = depth * 0.5;
    lfo.connect(lg).connect(am.gain);
    lfo.start();
    lfos.push(lfo);
    src.connect(bp).connect(am).connect(master);
  }
  src.start();
  return {
    level: (v) => master.gain.setTargetAtTime(Math.max(0, v) * 0.22, c.currentTime, 0.6),
    pan: (p) => pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, p)), c.currentTime, 0.2),
    stop: () => {
      master.gain.setTargetAtTime(0, c.currentTime, 0.2);
      window.setTimeout(() => {
        try { src.stop(); lfos.forEach((l) => l.stop()); } catch { /* 이미 멈춤 */ }
      }, 900);
    },
  };
}

// ── 오리 이스터에그 ───────────────────────────────────────────

/** 권총 소리: 날카로운 폭음 + 낮은 울림. 피나 폭력을 암시하지 않는 짧은 효과음 */
export function playGunshot() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const n = noise(c, 0.35);
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 900;
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  n.connect(f).connect(g).connect(c.destination);
  n.start(t);
  const o = c.createOscillator();
  const og = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
  og.gain.setValueAtTime(0.4, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(og).connect(c.destination);
  o.start(t);
  o.stop(t + 0.55);
}

/** 멀어지는 심장 박동 (사망 장면): 두 번씩 느려지며 끊긴다 */
export function playFadingHeartbeat() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  [0, 0.28, 1.1, 1.42, 2.4, 2.75, 4.0].forEach((d, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = 55;
    const at = t + d;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.22 * (1 - i * 0.11), at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
    o.connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + 0.3);
  });
}

/** 장부에 도장을 찍는 소리: 짧고 묵직한 "쿵" + 종이 스치는 소리 */
export function playStamp() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.14);
  g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.22);
  const n = noise(c, 0.1);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1800;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.1, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  n.connect(f).connect(ng).connect(c.destination);
  n.start(t);
}
