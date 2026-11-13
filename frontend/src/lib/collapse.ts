import { playThud } from '@/lib/synth';

/**
 * 1인칭으로 "털썩" 쓰러지는 연출: 게임 화면 전체가 내 시점이 되어 무릎이 꺾이고, 눈높이가 바닥으로 떨어진 뒤,
 * 눈꺼풀이 감기듯 위아래에서 어둠이 닫힌다. 총에 맞았을 때, 성난 승객들에게 맞았을 때 쓴다.
 *
 * 화면을 그림으로 찍어 움직이는 게 아니라, 게임 화면의 루트 요소(#game-root)에 변형과 흐림을 걸어서 지금 보이는 장면(WebGL 포함)이 그대로 쓰러진다.
 * 사망 카드는 이 요소 바깥(document.body)에 그려야 같이 기울지 않는다.
 * 모션 줄이기 설정이면 움직임 없이 짧게 어두워지기만 한다.
 */
const ROOT_ID = 'game-root';
const LIDS_ID = 'collapse-lids';
const TOTAL = 2600; // 눈꺼풀이 다 닫히는 시각(ms)

let running: Promise<void> | null = null;

export function playCollapse(): Promise<void> {
  if (running) return running;
  const root = document.getElementById(ROOT_ID);
  const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.background = '#000'; // 장면 바깥이 비쳐도 검게

  // 눈꺼풀 (위/아래에서 닫힌다)
  const lids = document.createElement('div');
  lids.id = LIDS_ID;
  lids.setAttribute('aria-hidden', 'true');
  lids.style.cssText = 'position:fixed;inset:0;z-index:8999;pointer-events:none';
  const lid = (top: boolean) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:0;right:0;${top ? 'top:0' : 'bottom:0'};height:52%;background:linear-gradient(${top ? 'to bottom' : 'to top'},#000 82%,rgba(0,0,0,0));transform:translateY(${top ? '-100%' : '100%'})`;
    return d;
  };
  const lidTop = lid(true);
  const lidBot = lid(false);
  lids.append(lidTop, lidBot);
  document.body.appendChild(lids);

  if (reduce || !root) {
    lidTop.animate([{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }], { duration: 400, fill: 'forwards' });
    lidBot.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 400, fill: 'forwards' });
    running = new Promise((r) => setTimeout(r, 450));
    return running;
  }

  // 화면이 "쓰러지는" 게 아니라 눈높이가 바닥으로 떨어지는 느낌이 나게 한다: 장면을 크게 돌리지 않고(최대 약 20도),
  // 화면이 위로 쏠리며 확대돼서 바닥이 눈앞으로 달려드는 것처럼 보인다. 확대로 모서리가 가려지고, 가장자리는 어둠으로 덮는다.
  root.style.transformOrigin = '50% 50%';
  root.animate(
    [
      { offset: 0, transform: 'none', filter: 'none', easing: 'ease-out' },
      { offset: 0.1, transform: 'translateY(1vh) rotate(1deg) scale(1.03)', filter: 'none', easing: 'ease-in' }, // 맞은 충격
      { offset: 0.35, transform: 'translateY(-6vh) rotate(-4deg) scale(1.12)', filter: 'blur(.5px) saturate(.8)', easing: 'ease-in' }, // 무릎이 꺾인다
      { offset: 0.65, transform: 'translateY(-22vh) rotate(-12deg) scale(1.5)', filter: 'blur(2px) grayscale(.5)', easing: 'ease-in' }, // 바닥이 달려든다
      { offset: 0.82, transform: 'translateY(-34vh) rotate(-18deg) scale(1.9)', filter: 'blur(4px) grayscale(.8)', easing: 'ease-out' }, // 바닥에 닿는다
      { offset: 0.88, transform: 'translateY(-31vh) rotate(-16deg) scale(1.85)', filter: 'blur(4px) grayscale(.85)', easing: 'ease-in' }, // 살짝 튄다
      { offset: 1, transform: 'translateY(-36vh) rotate(-20deg) scale(2)', filter: 'blur(6px) grayscale(1) brightness(.5)' },
    ],
    { duration: 2000, fill: 'forwards' },
  );
  // 가장자리가 어둠으로 좁혀 온다 (터널 시야)
  const vig = document.createElement('div');
  vig.style.cssText = 'position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at 50% 55%,rgba(0,0,0,0) 15%,rgba(0,0,0,.75) 60%,#000 100%)';
  lids.prepend(vig);
  vig.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1500, delay: 200, easing: 'ease-in', fill: 'forwards' });
  const ts: ReturnType<typeof setTimeout>[] = [];
  ts.push(setTimeout(playThud, 1640)); // 바닥에 닿는 순간
  ts.push(setTimeout(playThud, 1800)); // 튀어 오른 뒤 한 번 더 (작게)
  ts.push(setTimeout(() => {
    lidTop.animate([{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }], { duration: 900, easing: 'ease-in', fill: 'forwards' });
    lidBot.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 900, easing: 'ease-in', fill: 'forwards' });
  }, 1600));
  running = new Promise((r) => ts.push(setTimeout(r, TOTAL)));
  return running;
}

/** 쓰러진 화면과 눈꺼풀을 걷어낸다 (사망 카드가 끝나고 새로 시작하기 전에 부른다) */
export function clearCollapse() {
  running = null;
  document.getElementById(LIDS_ID)?.remove();
  const root = document.getElementById(ROOT_ID);
  if (root) {
    root.getAnimations().forEach((a) => a.cancel());
    root.style.transformOrigin = '';
  }
  document.documentElement.style.overflow = '';
  document.documentElement.style.background = '';
}
