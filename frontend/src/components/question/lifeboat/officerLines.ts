import type { Face } from './officer';

/**
 * 구명정 장교의 대사 (장교_대사_목록.md). 한 상황에 둘 이상이면 돌려 쓴다.
 * face 는 그 대사를 할 때의 표정이다. 없으면 지금 상황의 표정을 그대로 쓴다.
 */
export interface Line { t: string; face?: Face }
const L = (t: string, face?: Face): Line => ({ t: `“${t}”`, face });

export const LINES = {
  // A. 처음 만났을 때
  openFemale: [L('어서 오십시오. 여자분과 아이부터입니다.', 'calm'), L('이쪽입니다, 손을 주십시오.', 'calm')],
  openMale: [L('선생, 이 배는 여자와 아이가 먼저입니다.', 'doubt'), L('죄송하지만 순서를 지켜 주십시오.', 'doubt')],
  // B. 선택지 위에 마우스를 올렸을 때
  hoverSeat: [L('자리는 있습니다. 하지만 순서가 있습니다.')],
  hoverHand: [L('잡으십시오! 끌어올리겠습니다.', 'calm')],
  hoverChild: [L('그 아이를 이쪽으로 주십시오.', 'receive')],
  hoverPulley: [L('…구명정을 내려 보내시겠습니까.', 'pity')],
  // C. 남은 시간
  time14: [L('결정하십시오. 오래 기다릴 수 없습니다.', 'doubt')],
  time8: [L('배를 내려야 합니다! 서두르십시오!', 'urgent'), L('시간이 없습니다!', 'urgent')],
  time3: [L('더는 못 기다립니다!', 'urgent')],
  time0: [L('…알겠습니다. 내리겠습니다.', 'pity'), L('무사하시기를 빕니다.', 'pity')],
  // D. 빈자리 연타
  blockMale: [L('여자와 아이부터입니다!', 'block'), L('물러서십시오, 선생!', 'block'), L('이 배는 아직 당신 차례가 아닙니다.', 'angry')],
  pushedIn: [L('어머니가 자랑스러워 하시겠소...', 'angry'), L('더 세게 당신!! 미친 거야?', 'angry'), L('…당신 이름을 기억해 두겠습니다.', 'angry')],
  seatFemale: [L('어서, 이쪽으로!', 'relief')],
  seatFemaleDone: [L('잘 오셨습니다. 앉으십시오.', 'relief')],
  // E. 장교의 손
  pullStart: [L('놓지 마십시오!', 'pull'), L('조금만 더!', 'pull')],
  pullDone: [L('됐습니다! 앉으십시오.', 'relief')],
  pullRelease: [L('손을 놓으면 안 됩니다! 다시 잡으십시오!', 'urgent'), L('놓지 마십시오! 끝까지 잡으십시오!', 'urgent')],
  // F. 아이
  childLift: [L('이쪽입니다! 천천히, 조심하십시오.', 'receive'), L('아이를 이리 주십시오.', 'receive')],
  childInBoat: [L('받았습니다. 이제 당신도 어서!', 'relief'), L('…고맙습니다. 아이는 제가 지키겠습니다.', 'relief')],
  childInBoatMale: [L('아이는 받았습니다. 하지만 당신은 아닙니다.', 'doubt')],
  childBackOnDeck: [L('아이를 안전한 데 두십시오. 서두르지 마십시오.', 'doubt')],
  childToSea: [L('당신!! 미친 거야?!', 'urgent')],
  childDropped: [L('무슨 짓이야!!!', 'angry')],
  // 도르래
  pulleyWithChild: [L('…알겠습니다. 내리겠습니다.', 'pity')],
  pulleyChildOnDeck: [L('아직 아이가 있소!', 'urgent')],
  pulleyChildOnDeck2: [L('아직 아이가 있소! 멈추십시오!', 'urgent')],
  pulleyRelease: [L('계속 내려 주십시오!', 'pity')],
  pulleyReleaseChild: [L('아이를 먼저 태우십시오!', 'urgent')],
  // G. 결정 직후
  decideHand: [L('붙잡았습니다. 이제 괜찮습니다.', 'relief')],
  decideSeatFemale: [L('자리는 충분합니다. 앉으십시오.', 'relief')],
  decideSeatMale: [L('…올라타셨군요. 이 일은 잊지 않겠습니다.', 'angry')],
  decideChild: [L('아이는 맡겠습니다.', 'relief')],
  decidePulley: [L('근처 배가 올 겁니다. 버티십시오.', 'pity')],
  // 난간 장면(WB): Q7 에서 한 말을 되풀이하지 않고 다른 말을 한다
  bridgeLeave: [L('죄송합니다…', 'pity')],
  bridgeLeaveChild: [L('아이는 제가 지키겠습니다. 부디…', 'pity')],
  bridgeLeavePushed: [L('선택은 당신이 했습니다.', 'angry')],
  bridgeLeave2: [L('하느님의 가호가 있기를.', 'pity')],
  bridgeTilt: [L('…구조선을 기다리십시오. 반드시 옵니다.', 'pity')],
  decideTimeout: [L('…죄송합니다. 더는 기다릴 수 없었습니다.', 'pity')],
} satisfies Record<string, Line[]>;

const counters = new Map<string, number>();
/** 같은 상황의 대사를 차례로 돌려 쓴다 */
export function pick(key: keyof typeof LINES): Line {
  const list = LINES[key];
  const n = counters.get(key) ?? 0;
  counters.set(key, n + 1);
  return list[n % list.length];
}
