'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { MACHINE_CFG, subscribeMachine, machineVersion } from '@/components/result/machineConfig';

/**
 * 결과 화면 아래의 단말기 본체. 부품 그림을 코드에서 조립한다 (public/ui/machine/):
 *   base.webp(빈 2단 본체), cap_{ivory,kakao,amber}_{up,down}.webp(키캡, 색은 같은 그림에 색을 입힌 것),
 *   glyph_*.png(키 위에 얹는 로고 마스크), toggle_{a,n,b}.webp(토글 레버), lamp.webp(유리 덮개 램프).
 * 윗단의 틈(id="card-slot")에서 결과지·궁합 쪽지·승객 카드가 위로 솟아 나오고, 아랫단의 키로 공유한다.
 *
 * 본체 그림은 두 겹으로 그린다: 틈 중심선 위쪽은 뒤층(DeckBack, 결과지·쪽지 아래), 나머지는 앞층(MachineBase, 쪽지 위)이라
 * 카드가 덱 뒤에서 나타나 틈을 지나 올라오는 것처럼 보인다. 부품은 모두 앞층에 놓인다.
 * 좌표는 본체 그림(1642x640) 기준이고 cqw(본체 폭의 1%)로 크기가 따라 변한다.
 */

export const PHOS = '#8dffc4';
const IW = 1624;
const IH = 579;
const SLIT = { x0: 390, x1: 1241, y0: 63, y1: 88 };
const SLIT_Y = ((SLIT.y0 + SLIT.y1) / 2) / IH; // 틈 중심선
const MW = 'min(1000px, 98vw)'; // 본체가 화면에서 차지하는 폭

export type KeyId = 'kakao' | 'insta' | 'x' | 'threads' | 'link' | 'save' | 'send';
type Tone = 'ivory' | 'kakao' | 'amber';

// 키캡 그림(458x430 up, 458x346 down)의 윗면 중심 (up 상자 기준 비율). 눌리면 윗면이 아래로 내려온다
const CAP_AR = 430 / 458;
const FACE_UP = { x: 0.52, y: 0.27 };
const FACE_DOWN = { x: 0.5, y: 0.47 };

interface KeyDef { id: KeyId; aria: string; glyph: string; cx: number; bottom: number; w: number; tone: Tone }
// 배치 원칙: 아랫단 면(x 70~1540, y 235~490)을 세 구역으로 나눈다. 왼쪽은 상태(램프), 가운데는 공유(SNS 큰 키 4개 한 줄 + 그 아래 보조 키 2개를 기둥에 맞춰),
// 오른쪽은 출력 형식(표시창, 레버, 저장 키). 키는 같은 기준선에 정렬하고 간격을 같게 둔다. 값은 machineConfig 에서 디버그 패널로 바꾼다.
function keyDefs(): KeyDef[] {
  const B = MACHINE_CFG.bigKeys, S = MACHINE_CFG.smallKeys, V = MACHINE_CFG.save;
  const col = (i: number) => B.x + (i - 1.5) * (B.gap ?? 210);
  return [
    { id: 'kakao', aria: '카카오톡 공유', glyph: 'kakao', cx: col(0), bottom: B.y, w: B.w, tone: 'kakao' },
    { id: 'insta', aria: '인스타그램에 공유', glyph: 'insta', cx: col(1), bottom: B.y, w: B.w, tone: 'ivory' },
    { id: 'x', aria: 'X(트위터)에 공유', glyph: 'x', cx: col(2), bottom: B.y, w: B.w, tone: 'ivory' },
    { id: 'threads', aria: '스레드에 공유', glyph: 'threads', cx: col(3), bottom: B.y, w: B.w, tone: 'ivory' },
    { id: 'link', aria: '링크 복사', glyph: 'link', cx: col(1) + S.x, bottom: S.y, w: S.w, tone: 'ivory' },
    { id: 'send', aria: '친구에게 내 결과 보내기', glyph: 'send', cx: col(2) + S.x, bottom: S.y, w: S.w, tone: 'amber' },
    { id: 'save', aria: '이미지 저장', glyph: 'download', cx: V.x, bottom: V.y, w: V.w, tone: 'ivory' },
  ];
}

const cq = (n: number) => `${(n / IW) * 100}cqw`;

/** 사출구 가운데의 화면 좌표 (카드가 이 점에서 출발한다) */
export function slotCenter(): { x: number; y: number } {
  if (typeof document === 'undefined') return { x: 0, y: 0 };
  const el = document.getElementById('card-slot');
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight - 220 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const box = (clip: string, z: number): CSSProperties => ({
  position: 'fixed',
  left: '50%',
  bottom: `calc(${MW} * -0.004)`, // 새 틀은 아랫면이 막혀 있어 황동 앞띠가 화면 끝에 닿을 만큼만 내린다
  width: MW,
  aspectRatio: `${IW} / ${IH}`,
  transform: 'translateX(-50%)',
  backgroundImage: "url('/ui/machine/base.webp')",
  backgroundSize: '100% 100%',
  clipPath: clip,
  pointerEvents: 'none',
  zIndex: z,
});

/**
 * 윗면의 화면빛: 기계 윗판 모양(먼 쪽이 살짝 좁은 판)을 따라 번지고, 가장자리로 갈수록 곡선으로 옅어진다.
 * 결과지가 화면을 가리면 그 가린 폭만큼 빛이 줄어든다(가장자리는 번지게). 결과지가 화면 밖으로 나가면 다시 밝아진다.
 */
function TopGlow() {
  useSyncExternalStore(subscribeMachine, machineVersion, machineVersion);
  const G = MACHINE_CFG.glow;
  const k = (G.alpha ?? 100) / 100;
  const taper = G.taper ?? 3;
  const outer = useRef<HTMLDivElement>(null);
  // 결과지(id="result-paper")가 화면을 가린 정도에 맞춰 판 위 가로 방향의 빛을 줄인다
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = outer.current;
      const paper = document.getElementById('result-paper');
      if (el) {
        let mask = 'none';
        if (paper) {
          const g = el.getBoundingClientRect();
          const p = paper.getBoundingClientRect();
          // 화면(뷰포트)에서 실제로 보이는 결과지의 높이 비율 -> 가린 정도
          const vis = Math.max(0, Math.min(p.bottom, window.innerHeight) - Math.max(p.top, 0));
          const cover = Math.min(1, vis / (window.innerHeight * 0.55));
          const x0 = p.left - g.left, x1 = p.right - g.left;
          if (cover > 0.02 && x1 > 0 && x0 < g.width) {
            const f = g.width * 0.06; // 번지는 폭
            const a = 1 - 0.88 * cover; // 가린 곳에 남는 빛
            mask = `linear-gradient(to right, #000 0px, #000 ${Math.max(0, x0 - f)}px, rgba(0,0,0,${a}) ${x0 + f}px, rgba(0,0,0,${a}) ${x1 - f}px, #000 ${x1 + f}px, #000 100%)`;
          }
        }
        el.style.maskImage = mask;
        el.style.webkitMaskImage = mask;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <motion.div
      ref={outer}
      aria-hidden
      className="absolute"
      style={{ left: cq(G.x), top: cq(G.y), width: cq(G.w), height: cq(G.h ?? 124), mixBlendMode: 'screen', pointerEvents: 'none' }}
      animate={{ opacity: [0.75, 1, 0.75] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div
        className="absolute inset-0"
        style={{
          clipPath: `polygon(${taper}% 0, ${100 - taper}% 0, 100% 100%, 0 100%)`,
          background: `radial-gradient(ellipse 58% 130% at 50% 0%, rgba(110,255,185,${0.26 * k}) 0%, rgba(100,235,170,${0.13 * k}) 42%, rgba(60,200,140,${0.04 * k}) 78%, rgba(0,0,0,0) 100%)`,
          WebkitMaskImage: 'linear-gradient(to right, transparent 0, #000 9%, #000 91%, transparent 100%), linear-gradient(to bottom, #000 0, #000 55%, transparent 100%)',
          maskImage: 'linear-gradient(to right, transparent 0, #000 9%, #000 91%, transparent 100%), linear-gradient(to bottom, #000 0, #000 55%, transparent 100%)',
          WebkitMaskComposite: 'source-in',
          maskComposite: 'intersect',
        }}
      />
    </motion.div>
  );
}

/**
 * 뒤층: 틈 중심선 위쪽(덱 윗면의 먼 가장자리)과 윗면의 화면빛.
 * 인쇄가 끝나기 전에는 결과지와 쪽지가 이 층 위로 솟아 나오고, 끝난 뒤에는 이 층이 맨 위로 올라와
 * 결과지를 포함한 스크롤되는 모든 내용이 기계 뒤로 들어가 있는 것처럼 보인다.
 */
export function DeckBack({ settled }: { settled: boolean }) {
  return (
    <div aria-hidden style={{ ...box(`inset(0 0 ${(1 - SLIT_Y) * 100}% 0)`, settled ? 90 : 75), containerType: 'inline-size' }}>
      <TopGlow />
    </div>
  );
}

export default function MachineBase({ busy, keysOn, ratio, onKey, onToggleRatio }: { busy: boolean; keysOn: boolean; ratio: string; onKey: (id: KeyId) => void; onToggleRatio: () => void }) {
  const front = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useSyncExternalStore(subscribeMachine, machineVersion, machineVersion); // 디버그 패널에서 부품 위치를 바꾸면 다시 그린다
  const C = MACHINE_CFG;
  useEffect(() => setMounted(true), []);

  // 기계 높이를 알린다 (결과지 아래 여백과 팝업 여백이 이 값을 쓴다)
  useEffect(() => {
    const el = front.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--machine-h', `${Math.max(0, window.innerHeight - el.getBoundingClientRect().top)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener('resize', set);
    return () => { ro.disconnect(); window.removeEventListener('resize', set); root.style.removeProperty('--machine-h'); };
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <>
      {/* 앞층: 본체 그림에서 틈 중심선 위쪽을 뺀 부분. 부품은 이 위에 놓인다 */}
      <div ref={front} className="machine-dim" style={{ ...box(`inset(${SLIT_Y * 100}% 0 0 0)`, 130), containerType: 'inline-size' }}>
        <TopGlow />
        {/* 사출구: 카드가 출발하는 점. 출력 중에는 틈에서 빛이 샌다 */}
        <div id="card-slot" className="absolute" style={{ left: cq(SLIT.x0), width: cq(SLIT.x1 - SLIT.x0), top: cq(SLIT.y0), height: cq(SLIT.y1 - SLIT.y0) }}>
          <motion.span
            className="absolute inset-x-3 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
            style={{ background: PHOS, boxShadow: `0 0 12px 2px ${PHOS}` }}
            animate={{ opacity: busy ? [0.2, 0.85, 0.2] : 0 }}
            transition={{ duration: 0.7, repeat: busy ? Infinity : 0 }}
          />
        </div>

        {/* 상태: 위의 초록 램프는 전원, 아래 호박색 램프는 출력. 인쇄하는 동안 깜박이다가 다 나오면 켜진 채로 있다 */}
        <Lamp cx={C.lampGreen.x} bottom={C.lampGreen.y} w={C.lampGreen.w} tone="green" on blink={false} />
        <Lamp cx={C.lampAmber.x} bottom={C.lampAmber.y} w={C.lampAmber.w} tone="amber" on={keysOn || busy} blink={busy && !keysOn} />
        <Engrave x={C.lampGreen.x + C.lampGreen.w / 2 + 12} y={C.lampGreen.y - 38} text="PWR" />
        <Engrave x={C.lampAmber.x + C.lampAmber.w / 2 + 12} y={C.lampAmber.y - 38} text="OUT" />

        {/* 공유 구역 이름: 결과가 나오기 전에는 대기 표시 */}
        <Engrave x={C.bigKeys.x - 90} y={C.bigKeys.y - 146} text={keysOn ? 'SHARE' : 'STANDBY'} wide={180} center />

        {/* 출력 형식: 표시창은 판 위에 눕혀 놓인 것처럼 기울여 앉히고, 그 아래 레버가 4:5 와 9:16 을 바꾼다 */}
        <div aria-hidden className="absolute" style={{ left: cq(C.lcd.x - C.lcd.w / 2), top: cq(C.lcd.y - C.lcd.w * 740 / 923), width: cq(C.lcd.w), height: cq(C.lcd.w * 740 / 923), transform: `perspective(520px) rotateY(${C.lcd.rotY ?? 0}deg) rotateX(${C.lcd.tilt ?? 46}deg) rotateZ(${C.lcd.rotZ ?? 0}deg)`, transformOrigin: '50% 100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ui/machine/lcd.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full" />
          <span className="absolute flex flex-col items-center justify-center overflow-hidden" style={{ left: '14%', top: '19.6%', width: '71.5%', height: '58%' }}>
            <span className="font-mono" style={{ fontSize: cq(8), letterSpacing: '0.35em', color: 'rgba(141,255,196,.5)' }}>CARD</span>
            <span className="font-mono font-bold tabular-nums" style={{ fontSize: cq(24), lineHeight: 1.1, color: keysOn ? PHOS : 'rgba(141,255,196,.22)', textShadow: keysOn ? `0 0 ${cq(9)} rgba(120,255,190,.85)` : 'none' }}>{ratio}</span>
          </span>
        </div>
        <button
          type="button"
          aria-label={`카드 크기 ${ratio} (누르면 바꿈)`}
          disabled={!keysOn}
          onClick={onToggleRatio}
          className="absolute outline-none"
          style={{ left: cq(C.lever.x - C.lever.w * 0.64), top: cq(C.lever.y - C.lever.w * 1.04), width: cq(C.lever.w * 1.28), height: cq(C.lever.w * 1.04), pointerEvents: keysOn ? 'auto' : 'none', cursor: 'pointer' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/ui/machine/toggle_${ratio === '4:5' ? 'a' : 'b'}.webp`} alt="" draggable={false} className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{ width: cq(C.lever.w), filter: keysOn ? undefined : 'brightness(.6)' }} />
        </button>

        {/* 키 */}
        {keyDefs().map((k) => (
          <Key key={k.id} def={k} disabled={!keysOn} onPress={() => onKey(k.id)} />
        ))}
      </div>
      <style>{`
        .machine-dim { filter: drop-shadow(0 -8px 16px rgba(0,0,0,.5)); }
        html[data-modal] .machine-dim { filter: brightness(.42) drop-shadow(0 -8px 16px rgba(0,0,0,.5)); }
        .mk:focus-visible { outline: 2px solid ${PHOS}; outline-offset: 3px; border-radius: 12px; }
        .mk .mk-up, .mk .mk-down, .mk .mk-glyph { transition: opacity 60ms linear, transform 60ms ease-out; }
        .mk .mk-down { opacity: 0; }
        .mk:active .mk-up { opacity: 0; }
        .mk:active .mk-down { opacity: 1; }
        .mk:active .mk-glyph { transform: translate(-50%, -50%) translateY(var(--sink)) perspective(260px) rotateX(58deg); }
        .mk:not(:disabled):hover .mk-up { filter: brightness(1.1); }
      `}</style>
    </>,
    document.body,
  );
}

/** 눌리는 키: 위쪽 그림과 눌린 그림을 같은 자리에 겹쳐 두고, 누르는 동안 눌린 그림을 보인다. 윗면의 로고도 같이 내려간다 */
function Key({ def, disabled, onPress }: { def: KeyDef; disabled: boolean; onPress: () => void }) {
  const { cx, bottom, w, tone } = def;
  const h = w * CAP_AR;
  const gs = w * 0.5; // 로고 크기 (윗면에 눕혀 놓으므로 세로로 눌려 보인다)
  return (
    <button
      type="button"
      aria-label={def.aria}
      title={def.aria}
      disabled={disabled}
      onClick={onPress}
      className="mk absolute outline-none"
      style={{ left: cq(cx - w / 2), top: cq(bottom - h), width: cq(w), height: cq(h), pointerEvents: disabled ? 'none' : 'auto', cursor: 'pointer', ['--sink' as string]: `${((FACE_DOWN.y - FACE_UP.y) * h / IW) * 100}cqw` } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mk-up absolute inset-0 h-full w-full" src={`/ui/machine/cap_${tone}_up.webp`} alt="" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mk-down absolute bottom-0 left-0 w-full" style={{ height: '80.5%' }} src={`/ui/machine/cap_${tone}_down.webp`} alt="" draggable={false} />
      <span
        aria-hidden
        className="mk-glyph absolute"
        style={{
          left: `${FACE_UP.x * 100}%`,
          top: `${FACE_UP.y * 100}%`,
          width: cq(gs),
          height: cq(gs),
          transform: 'translate(-50%, -50%) perspective(260px) rotateX(58deg)',
          background: tone === 'kakao' ? '#2a1c04' : '#2a1d0a',
          opacity: 0.8,
          mixBlendMode: 'multiply',
          WebkitMaskImage: `url('/ui/machine/glyph_${def.glyph}.png')`,
          maskImage: `url('/ui/machine/glyph_${def.glyph}.png')`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
    </button>
  );
}

/** 판에 새긴 작은 글자(황동에 음각한 듯 어둡게) */
function Engrave({ x, y, text, wide = 80, center = false }: { x: number; y: number; text: string; wide?: number; center?: boolean }) {
  return (
    <p aria-hidden className="absolute font-mono" style={{ left: cq(x), top: cq(y), width: cq(wide), fontSize: cq(13), letterSpacing: '0.32em', textAlign: center ? 'center' : 'left', color: 'rgba(196,158,88,.5)', textShadow: '0 1px 0 rgba(0,0,0,.7), 0 -1px 0 rgba(255,225,160,.12)', transform: 'perspective(300px) rotateX(58deg)', transformOrigin: center ? '50% 50%' : '0 50%' }}>{text}</p>
  );
}

/** 표시등: 꺼진 그림과 켜진 그림(유리 안쪽에 빛을 넣은 것)을 겹쳐 두고, 켜지면 아주 약한 빛무리만 더한다. blink 면 깜박인다 */
function Lamp({ cx, bottom, w, tone, on, blink }: { cx: number; bottom: number; w: number; tone: 'green' | 'amber'; on: boolean; blink: boolean }) {
  const h = w * (467 / 533);
  const glow = tone === 'green' ? '70,255,140' : '255,150,30';
  return (
    <div aria-hidden className="absolute" style={{ left: cq(cx - w / 2), top: cq(bottom - h), width: cq(w), height: cq(h) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ui/machine/lamp_off.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full" />
      <motion.div className="absolute inset-0" animate={{ opacity: !on ? 0 : blink ? [1, 0.15, 1] : 1 }} transition={blink ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.7 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/ui/machine/lamp_${tone}.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
        <span className="absolute rounded-[50%]" style={{ left: '-10%', top: '-14%', width: '120%', height: '80%', opacity: 0.3, background: `radial-gradient(ellipse, rgba(${glow},.55) 0%, rgba(${glow},0) 66%)`, mixBlendMode: 'screen', pointerEvents: 'none' }} />
      </motion.div>
    </div>
  );
}
