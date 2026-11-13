'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { RendererProps } from '@/engine/renderers';
import { unlock } from '@/engine/achievements';
import { playThud, playSplash, playFireworkBurst, playGlassRattle, startMurmur } from '@/lib/synth';
import { pTimeout, pClear, type PTimer } from '@/lib/pausableTimeout';
import { useQuizStore } from '@/store/quizStore';
import { createSternScene, type SternScene, type Mood } from './sink/sternScene';
import RailPov from './sink/RailPov';

/**
 * W1 "난간에 매달린 두 사람": 침몰하는 배의 옆모습 위에서 곁의 승객(노라)과 나누는 다섯 번의 대화.
 * 같은 버튼을 되풀이하지 않는다. 단계마다 승객이 다른 말을 걸고, 그 단계에만 있는 선택지 셋이 나오며,
 * 선택지마다 나의 말과 승객의 대답이 따로 있다. 단계가 넘어갈 때마다 갑판이 더 가팔라진다.
 * 어느 단계에서든 난간을 놓을 수 있고(그때 승객이 외치는 말도 단계마다 다르다), 가만히 있으면 승객이 침묵에 답한다.
 *
 * 규칙: 신뢰(처음 2)와 손.
 *  - 떨어질 때 손을 잡았고 신뢰가 3 이상이면 함께 떨어진다. 손은 잡았지만 신뢰가 낮으면 내가 손을 뿌리친다. 손을 잡지 않았으면 혼자 떨어진다.
 *  - 신뢰가 −3 이하로 내려가면 승객이 먼저 난간을 놓는다. 그 뒤에는 혼자 남은 마지막 단계로 간다.
 * 결과는 예전과 같은 모양으로 W2 에 넘긴다: w1 { trust, hand, lies, truths, holds, curses, gone, outcome, how }.
 *
 * 그림은 두 가지 컷을 오간다.
 *  - 넓은 컷(sink/sternScene.ts): 받은 배 그림으로 그리는 침몰. 단계가 바뀔 때마다 배 전체를 보여 준다(깜빡임, 정전, 두 동강).
 *  - 가까운 컷(sink/RailPov.tsx): 난간을 붙든 내 눈. 대화가 오가는 동안 손으로 연기한다.
 */

// ── 대본 ──────────────────────────────────────────────────────────────

interface St { letter: boolean; trust: number; hand: boolean; lies: number; truths: number; holds: number; curses: number; gone: boolean }
type Kind = 'lie' | 'truth' | 'hold' | 'curse' | 'kind' | 'cold' | 'jump';
interface Choice {
  id: string;
  label: string;
  hint: string;
  kind: Kind;
  trust: number;
  /** 나의 말 (없으면 말없이 행동한다) */
  me?: string;
  /** 행동 지문 */
  note?: string;
  /** 승객의 대답 */
  her?: string;
  mood?: Mood;
  /** 노라가 어머니께 쓴 편지를 내 주머니에 넣어 준다 */
  letter?: boolean;
  /** 이 선택으로 난간을 놓는다(jump) / 대답 뒤 손이 미끄러진다(forced) */
  end?: 'jump' | 'forced';
}
interface Beat {
  /** 단계가 시작될 때의 지문 */
  note: string;
  ask: (s: St) => string;
  choices: (s: St) => Choice[];
  /** 가만히 있을 때 승객이 하는 말 */
  silence: string;
  /** 이 단계에서 난간을 놓을 때 내가 하는 말 */
  jumpMe: string;
  /** 내가 혼자 떨어질 때 승객이 외치는 말 */
  cry: string;
}

const BEATS: Beat[] = [
  {
    note: '갑판이 기울기 시작합니다. 곁에 주저앉은 젊은 여자가 외투 앞섶을 두 손으로 움켜쥔 채 당신을 올려다봅니다.',
    ask: () => '구명선이… 곧 우리를 구하러 되돌아오겠지요?',
    choices: () => [
      { id: 'b1-lie', kind: 'lie', trust: 1, mood: 'calm', label: '“자리가 비었으니 반드시 돌아옵니다.”', hint: '모르는 일을 아는 것처럼 말합니다.', me: '네. 자리가 비었으니 반드시 돌아옵니다. 조금만 버티면 됩니다.', her: '…그렇죠. 그럴 줄 알았어요. 고마워요.' },
      { id: 'b1-truth', kind: 'truth', trust: -1, mood: 'sob', label: '“돌아오지 않습니다.”', hint: '돌아오면 그 배도 뒤집힙니다.', me: '아니요. 돌아오면 사람들이 매달려 다 같이 뒤집힙니다. 그들도 압니다.', her: '…알고 있었어요. 그래도 누가 소리 내어 말해 주길 바랐나 봐요.' },
      { id: 'b1-curse', kind: 'curse', trust: -2, mood: 'afraid', label: '“그걸 왜 나한테 묻습니까!”', hint: '참았던 말이 터져 나옵니다.', me: '…젠장, 그걸 내가 어떻게 압니까! 나도 못 탔단 말입니다!', her: '…미안해요. 무서워서, 아무나 붙잡고 묻고 싶었어요.' },
    ],
    silence: '…대답이 없으시네요. 괜찮아요. 저도 답을 알 것 같으니까요.',
    jumpMe: '…먼저 갑니다. 미안합니다.',
    cry: '잠깐만요! 아직 대답도 안 했잖아요…!',
  },
  {
    note: '갑판이 더 가팔라집니다. 승객의 구두가 젖은 나무 위에서 미끄러집니다.',
    ask: (s) => (s.trust >= 2 ? '손이 얼어서 감각이 없어요. 난간이… 자꾸 빠져나가요. 막내가 이러면 늘 내가 손을 잡아 줬는데.' : '…신경 쓰지 마세요. 혼자 버틸게요. 동생들 앞에서도 늘 그랬으니까요. 아, 손이…!'),
    choices: () => [
      { id: 'b2-hold', kind: 'hold', trust: 2, mood: 'calm', label: '한 손을 내밀어 붙잡는다.', hint: '대답 대신 체온을 건넵니다.', note: '당신이 한 손을 뻗어 승객의 손목을 붙잡습니다.', her: '…손이 따뜻하네요. 우리 어머니 손도 이랬어요. 말은 안 해도.' },
      { id: 'b2-teach', kind: 'kind', trust: 1, mood: 'calm', label: '“팔꿈치를 난간에 걸어요.”', hint: '버티는 법을 일러 줍니다.', me: '손가락으로 쥐지 말고 팔꿈치를 난간에 걸어요. 팔 전체로 버티는 겁니다.', her: '…이렇게요? 아, 정말이네요. 동생들한테도 가르쳐 줬어야 했는데.' },
      { id: 'b2-away', kind: 'cold', trust: -1, mood: 'afraid', label: '못 본 척 고개를 돌린다.', hint: '내 손 하나도 벅찹니다.', note: '당신은 난간만 바라봅니다. 옆에서 숨이 가빠집니다.', her: '…괜찮아요. 우리 집에서도 그랬어요. 다들 자기 손 하나도 벅찼거든요.' },
    ],
    silence: '…괜찮아요. 혼자서도 버틸 수 있어요. 늘 그랬으니까요.',
    jumpMe: '더는 못 버팁니다. 물이 더 높아지기 전에 가겠습니다.',
    cry: '안 돼요, 혼자 두지 마요…!',
  },
  {
    note: '배의 불빛이 깜빡입니다. 승객이 떨리는 목소리로 말을 겁니다.',
    ask: (s) => (s.trust >= 2 ? '나는 노라예요. 클레어에서 왔어요. …뉴욕에 가면 뭘 하려고 했어요?' : '…노라예요, 내 이름. 모르는 사람 옆에서 끝나기는 싫어서요. 당신은 뉴욕에 왜 가려 했어요?'),
    choices: () => [
      { id: 'b3-dream', kind: 'kind', trust: 1, mood: 'calm', label: '“일자리를 구하려 했습니다.”', hint: '있는 그대로 말합니다.', me: '일자리를 구하려 했습니다. 대단한 건 아니고, 그게 다였어요.', her: '나는 언니네 빵집에서 일하기로 했어요. 우리 어머니가 구운 빵만큼은 못하겠지만, 아침마다 온 거리에 빵 냄새가 난대요.' },
      { id: 'b3-lie', kind: 'lie', trust: 1, mood: 'calm', label: '“도착하면 같이 항구를 걸읍시다.”', hint: '오지 않을 내일을 약속합니다.', me: '도착하면 같이 항구를 걸읍시다. 당신 언니네 가게까지 바래다 드리죠.', her: '…그럼 첫 빵은 내가 살게요. 약속한 거예요.' },
      { id: 'b3-cold', kind: 'truth', trust: -1, mood: 'sob', label: '“이제 와서 무슨 소용입니까.”', hint: '뉴욕은 오지 않습니다.', me: '이제 와서 그게 무슨 소용입니까. 우리는 뉴욕에 가지 못합니다.', her: '…그러네요. 그래도 말하고 나니까 조금 덜 추워요.' },
    ],
    silence: '…말하기 싫으면 안 해도 돼요. 나 혼자 떠들게요. 빵집 얘기예요.',
    jumpMe: '불이 꺼지기 전에 가겠습니다. …몸조심하세요, 노라.',
    cry: '기다려요! 아직 빵집 얘기가 안 끝났어요…!',
  },
  {
    note: '불이 한꺼번에 꺼집니다. 별빛과 비명만 남습니다.',
    ask: () => '불이… 꺼졌어요. 아무것도 안 보여요. …거기 있어요?',
    choices: (s) => [
      { id: 'b4-here', kind: 'kind', trust: 1, mood: 'calm', label: '“여기 있습니다. 바로 옆에.”', hint: '목소리로 자리를 알립니다.', me: '여기 있습니다. 바로 옆에. 어디 안 갑니다.', her: '…목소리가 들리니까 됐어요. 계속 말해 줘요, 아무 말이나. …사실은요, 가기 싫었어요. 처음부터.' },
      s.hand
        ? { id: 'b4-squeeze', kind: 'hold', trust: 2, mood: 'calm', label: '잡은 손을 더 세게 쥔다.', hint: '말 대신 손으로 답합니다.', note: '당신이 잡은 손에 힘을 줍니다.', her: '…아파요. 그런데 그게 좋아요. 아직 느껴지니까. …나, 가기 싫었어요.' }
        : { id: 'b4-find', kind: 'hold', trust: 2, mood: 'calm', label: '어둠 속을 더듬어 손을 찾는다.', hint: '늦었지만 손을 내밉니다.', note: '당신이 어둠 속을 더듬어 차가운 손을 찾아 쥡니다.', her: '…찾았네요. 이번에는 놓지 말아요. 나, 사실 가기 싫었어요. 아무한테도 말 안 했는데.' },
      { id: 'b4-curse', kind: 'curse', trust: -2, mood: 'afraid', label: '“제발 조용히 좀 해요!”', hint: '참았던 말이 터져 나옵니다.', me: '제발 조용히 좀 해요! 당신 목소리 때문에 힘이 다 빠집니다!', her: '…그래요. 이제 안 물을게요.' },
    ],
    silence: '…대답이 없네요. 그래도 숨소리는 들려요. 그거면 돼요.',
    jumpMe: '어차피 아무것도 안 보이니, 지금 가겠습니다.',
    cry: '어디 갔어요? …거기 있어요? 대답해요!',
  },
  {
    note: '선미가 하늘로 솟습니다. 발밑 저 아래에서 검은 물이 올라옵니다.',
    ask: (s) => (s.hand && s.trust >= 3 ? '물이 올라와요. …떨어질 때, 같이 떨어져 줄래요? 그리고 부탁이 하나 있어요.' : s.trust >= 2 ? '물이 올라와요. …끝이네요. 마지막으로 뭐라고 말 좀 해 줘요.' : '물이 올라와요. …이제는 각자 운에 맡기는 거죠.'),
    choices: (s) => [
      s.hand
        ? s.trust >= 3
          ? { id: 'b5-three', kind: 'kind', trust: 1, mood: 'calm', end: 'jump', letter: true, label: '“셋에 같이 놓는 겁니다.”', hint: '끌려가기 전에, 함께 뜁니다.', me: '셋에 같이 놓는 겁니다. 숨을 크게 들이쉬고, 배에서 멀리 뛰어요.', note: '노라가 외투 안감을 뜯어 접힌 종이 한 통을 당신 주머니에 밀어 넣습니다.', her: '이건 꼭 엄마에게 전달됐으면 해서요. 부탁드려요. 엄마가 준 편지는 아직 못 열었지만… 이건 내가 먼저 보내야 해서요. 하나. 둘—' }
          : { id: 'b5-three', kind: 'kind', trust: 1, mood: 'calm', end: 'jump', label: '“셋에 같이 놓는 겁니다.”', hint: '끌려가기 전에, 함께 뜁니다.', me: '셋에 같이 놓는 겁니다. 숨을 크게 들이쉬고, 배에서 멀리 뛰어요.', her: '…알았어요. 하나. 둘—' }
        : { id: 'b5-three-late', kind: 'hold', trust: 1, mood: 'calm', end: 'jump', label: '손을 내밀며 “셋에 같이 놓읍시다.”', hint: '마지막에야 손을 내밉니다.', me: '손 줘요. 셋에 같이 놓는 겁니다.', her: '…이제야 손을 주네요. 하나. 둘—' },
      { id: 'b5-lie', kind: 'lie', trust: 1, mood: 'calm', end: 'forced', label: '“물은 금방 익숙해집니다.”', hint: '마지막 거짓말입니다.', me: '물은 금방 익숙해집니다. 저 불빛까지 헤엄만 치면 돼요.', her: '…거짓말. 그래도 고마워요. 끝까지 그렇게 말해 줘서.' },
      { id: 'b5-truth', kind: 'truth', trust: 0, mood: 'calm', end: 'forced', label: '“무섭습니다. 저도요.”', hint: '처음으로 내 얘기를 합니다.', me: '…무섭습니다. 저도요. 아까부터 계속 무서웠습니다.', her: '…그 말이 제일 듣고 싶었어요. 나만 그런 게 아니라서 다행이에요. 엄마한테도 이렇게 말할걸.' },
    ],
    silence: '…끝까지 말이 없네요. 괜찮아요. 옆에 있어 준 걸로 됐어요.',
    jumpMe: '…갑니다.',
    cry: '…그래요. 먼저 가요. 곧 따라갈게요. 엄마한테… 아니에요.',
  },
];

/** 승객이 먼저 난간을 놓은 뒤, 혼자 남은 마지막 단계 */
const SOLO: Choice[] = [
  { id: 's-follow', kind: 'jump', trust: 0, end: 'jump', label: '뒤따라 난간을 놓는다.', hint: '물소리가 난 쪽으로.', me: '…기다려요.' },
  { id: 's-call', kind: 'cold', trust: 0, end: 'forced', label: '아래를 향해 소리쳐 부른다.', hint: '아래는 캄캄합니다.', me: '이봐요! …대답해요!', note: '대답은 없습니다. 당신의 손가락이 하나씩 펴집니다.' },
  { id: 's-cling', kind: 'cold', trust: 0, end: 'forced', label: '끝까지 매달린다.', hint: '아무 말도 하지 않습니다.', note: '당신은 난간에 이마를 댑니다. 쇠가 얼음처럼 찹니다. 손에서 힘이 빠져나갑니다.' },
];
const SOLO_NOTE = '난간에는 당신 혼자 남았습니다.';
const GONE_HER = '…그래요. 내가 짐이었군요.';
const GONE_NOTE = '옆의 손이 난간에서 풀립니다. 외투 앞섶을 쥐고 있던 손이 가슴께를 한 번 누르고 사라집니다. 잠시 뒤, 아래에서 짧은 물소리가 납니다.';
const SLIP_NOTE = '손아귀에서 힘이 빠집니다. 난간이 손바닥에서 미끄러져 나갑니다.';
/** 가만히 있을 때까지 기다리는 시간(초) */
const SILENCE_S = 20;

type Who = 'me' | 'her' | 'note';
interface Line { who: Who; text: string }

export default function SinkSideView({ question, onAnswer }: RendererProps) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<SternScene | null>(null);

  const st = useRef<St>({ letter: false, trust: 2, hand: false, lies: 0, truths: 0, holds: 0, curses: 0, gone: false });
  const beatRef = useRef(0);
  const done = useRef(false);
  const [beat, setBeat] = useState(0);
  const [line, setLine] = useState<Line | null>(null);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [falling, setFalling] = useState(false);
  const [fallMs, setFallMs] = useState(1600);
  const [named, setNamed] = useState(false); // 승객이 이름을 말한 뒤에는 이름표가 바뀐다
  const [solo, setSolo] = useState(false);
  const [card, setCard] = useState(true); // 장면을 여는 자막
  // 가까운 컷(1인칭)에 넘기는 값
  const [pov, setPov] = useState(false);
  const [povHand, setPovHand] = useState(false);
  const [povMood, setPovMood] = useState<Mood>('afraid');
  const [povGone, setPovGone] = useState(false);
  const [povTogether, setPovTogether] = useState(false);
  const [kickKey, setKickKey] = useState(0);
  const [squeezeKey, setSqueezeKey] = useState(0);
  const povTimer = useRef<PTimer | null>(null);
  /** 넓은 컷을 sec 초 보여 준 뒤 가까운 컷으로 돌아온다 */
  const showWide = (sec: number) => {
    if (povTimer.current) pClear(povTimer.current);
    setPov(false);
    povTimer.current = pTimeout(() => { if (!done.current) setPov(true); }, sec * 1000);
  };

  const timers = useRef<PTimer[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(pTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(pClear), []);

  // ── 대사 재생: 한 줄씩 보이고, 대화 상자를 누르면 다음 줄로 넘어간다 ──
  const queue = useRef<Line[]>([]);
  const after = useRef<(() => void) | null>(null);
  const lineTimer = useRef<PTimer | null>(null);
  const silenceTimer = useRef<PTimer | null>(null);
  const stepRef = useRef<() => void>(() => {});
  const silentRef = useRef<() => void>(() => {});
  const step = () => {
    if (lineTimer.current) pClear(lineTimer.current);
    const next = queue.current.shift();
    if (!next) {
      const fn = after.current;
      after.current = null;
      fn?.();
      return;
    }
    setLine(next);
    lineTimer.current = pTimeout(() => stepRef.current(), 1700 + next.text.length * 62);
  };
  const play = (lines: Line[], then: () => void) => {
    queue.current = lines.slice();
    after.current = then;
    step();
  };
  useEffect(() => () => {
    if (lineTimer.current) pClear(lineTimer.current);
    if (silenceTimer.current) pClear(silenceTimer.current);
    if (povTimer.current) pClear(povTimer.current);
  }, []);

  const outcomeOf = (): 'together' | 'let_go' | 'alone' | 'gone' => {
    const s = st.current;
    if (s.gone) return 'gone';
    if (s.hand) return s.trust >= 3 ? 'together' : 'let_go';
    return 'alone';
  };

  /** 난간에서 떨어진다 */
  const finish = (how: 'jump' | 'forced') => {
    if (done.current) return;
    done.current = true;
    if (lineTimer.current) pClear(lineTimer.current);
    if (silenceTimer.current) pClear(silenceTimer.current);
    const s = st.current;
    const out = outcomeOf();
    const i = Math.min(beatRef.current, BEATS.length - 1);
    setChoices(null);
    setFalling(true);
    setPovTogether(out === 'together');
    // 손이 난간에서 떨어지는 것을 내 눈으로 본 뒤, 멀리서 떨어지는 두 점을 본다
    if (povTimer.current) pClear(povTimer.current);
    later(() => setPov(false), reduce ? 0 : 640);
    const drop = scene.current?.fall(out === 'together') ?? 1.6; // 수면에 닿을 때까지(초): 선미가 높이 솟을수록 길다
    if (!reduce) playThud();
    if (out === 'together') setLine({ who: 'note', text: s.letter ? '두 사람의 손이 난간에서 함께 떨어집니다. 당신의 주머니에서 종이가 한 번 바스락거립니다.' : '두 사람의 손이 난간에서 함께 떨어집니다.' });
    if (out === 'let_go') {
      setLine({ who: 'note', text: '떨어지는 순간, 당신은 잡고 있던 손을 뿌리칩니다.' });
      later(() => setLine({ who: 'her', text: BEATS[i].cry }), 1100);
    }
    if (out === 'alone') setLine({ who: 'her', text: BEATS[i].cry });
    if (out === 'gone') setLine({ who: 'note', text: '당신의 손이 난간에서 떨어집니다.' });
    if (out === 'let_go') unlock('let-go-hand');
    if (out === 'together') {
      unlock('fell-together');
      if (s.lies > 0) unlock('white-lie');
    }
    setFallMs(drop * 1000);
    // 성향 점수는 결말(함께 / 뿌리침 / 혼자 / 노라가 먼저)을 선택값으로 쓴다. 떨어진 방식(how)은 w1 안에 그대로 남긴다
    later(() => onAnswer(out, { w1: { ...s, letter: s.letter ? 'given' : 'none', outcome: out, how } }), drop * 1000 + (reduce ? 600 : 1700));
  };

  const armSilence = () => {
    if (silenceTimer.current) pClear(silenceTimer.current);
    silenceTimer.current = pTimeout(() => silentRef.current(), SILENCE_S * 1000);
  };

  const startBeat = (i: number) => {
    const s = st.current;
    const b = BEATS[i];
    beatRef.current = i;
    setBeat(i);
    setChoices(null);
    const wide = scene.current?.setBeat(i) ?? 0;
    if (wide > 0) showWide(wide);
    if (i >= 2) setNamed(true);
    play([{ who: 'note', text: b.note }, { who: 'her', text: b.ask(s) }], () => {
      setChoices(b.choices(s));
      armSilence();
    });
  };

  const startSolo = () => {
    beatRef.current = BEATS.length - 1;
    setBeat(BEATS.length - 1);
    setSolo(true);
    play([{ who: 'note', text: SOLO_NOTE }], () => { setChoices(SOLO); armSilence(); });
  };

  /** 대답이 끝난 뒤: 승객이 손을 놓는지, 내 손이 미끄러지는지, 다음 단계로 가는지 */
  const afterReply = (end?: 'jump' | 'forced') => {
    const s = st.current;
    if (end === 'jump') { finish('jump'); return; }
    if (!s.gone && s.trust <= -3) {
      play([{ who: 'her', text: GONE_HER }], () => {
        s.gone = true;
        s.hand = false;
        scene.current?.herLetGo();
        setPovGone(true);
        if (!reduce) playThud();
        unlock('last-word');
        play([{ who: 'note', text: GONE_NOTE }], startSolo);
      });
      return;
    }
    if (end === 'forced' || beatRef.current >= BEATS.length - 1) {
      play([{ who: 'note', text: SLIP_NOTE }], () => finish('forced'));
      return;
    }
    startBeat(beatRef.current + 1);
  };

  const choose = (c: Choice) => {
    if (done.current || !choices) return;
    if (silenceTimer.current) pClear(silenceTimer.current);
    setChoices(null);
    const s = st.current;
    s.trust += c.trust;
    if (c.kind === 'lie') s.lies += 1;
    if (c.kind === 'truth') s.truths += 1;
    if (c.letter) s.letter = true;
    if (c.kind === 'hold') { if (s.hand) setSqueezeKey((v) => v + 1); s.holds += 1; s.hand = true; scene.current?.setHand(true); setPovHand(true); }
    if (c.kind === 'curse') { s.curses += 1; scene.current?.kick(); setKickKey((v) => v + 1); unlock('bit-tongue'); }
    if (c.mood) { scene.current?.setMood(c.mood); setPovMood(c.mood); }
    const lines: Line[] = [];
    if (c.me) lines.push({ who: 'me', text: c.me });
    if (c.note) lines.push({ who: 'note', text: c.note });
    if (c.her) lines.push({ who: 'her', text: c.her });
    play(lines, () => afterReply(c.end));
  };

  /** 어느 단계에서든 난간을 놓을 수 있다 */
  const letGo = () => {
    if (done.current || !choices) return;
    if (silenceTimer.current) pClear(silenceTimer.current);
    setChoices(null);
    play([{ who: 'me', text: BEATS[beatRef.current].jumpMe }], () => finish('jump'));
  };

  /** 가만히 있으면 승객이 침묵에 답하고 다음 단계로 넘어간다 */
  const silent = () => {
    if (done.current) return;
    setChoices(null);
    if (st.current.gone) { play([{ who: 'note', text: SLIP_NOTE }], () => finish('forced')); return; }
    scene.current?.setMood('afraid');
    setPovMood('afraid');
    play([{ who: 'note', text: '당신은 아무 말도 하지 않습니다.' }, { who: 'her', text: BEATS[beatRef.current].silence }], () => afterReply());
  };

  // 타이머가 늘 최신 함수를 부르도록 맞춘다
  useEffect(() => { stepRef.current = step; silentRef.current = silent; });

  // 장면이 열리면 제목을 잠깐 보인 뒤 첫 단계를 시작한다
  useEffect(() => {
    later(() => startBeat(0), reduce ? 900 : 3000);
    later(() => setCard(false), reduce ? 1400 : 4200);
    // 배 전체를 보여 주고 선미로 다가간 뒤, 난간을 붙든 내 눈으로 넘어간다
    povTimer.current = pTimeout(() => { if (!done.current) setPov(true); }, reduce ? 1600 : 8400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 그림: 캔버스 엔진을 만들고, 엔진이 알려 주는 순간에 소리를 낸다 ──
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const murmur = startMurmur();
    murmur?.level(0.35);
    const sc = createSternScene(cv, {
      reduce: !!reduce,
      isPaused: () => useQuizStore.getState().debugPause,
      onRocket: () => playFireworkBurst(0, 0.7),
      onBlackout: () => { playThud(); murmur?.level(0.8); },
      onGroan: () => playGlassRattle(),
      onBreak: () => { playThud(); playGlassRattle(); playFireworkBurst(0, 0.5); },
      onSplash: () => playSplash(),
    });
    scene.current = sc;
    return () => { sc.destroy(); murmur?.stop(); scene.current = null; };
  }, [reduce]);

  const herName = named ? '노라' : '곁의 승객';
  const canSkip = !choices && !falling && line !== null;

  return (
    <div className="fixed inset-0 z-10 select-none overflow-hidden bg-[#02050b]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <RailPov show={pov} beat={beat} hand={povHand} mood={povMood} gone={povGone} falling={falling} together={povTogether} kickKey={kickKey} squeezeKey={squeezeKey} reduce={!!reduce} />

      {/* 장면을 여는 자막 */}
      <AnimatePresence>
        {card && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.1 }} className="pointer-events-none absolute inset-x-0 top-[13%] z-30 text-center">
            <p className="font-serif text-[13px] tracking-[0.5em] text-slate-200/90" style={{ textShadow: '0 1px 8px #000' }}>1912년 4월 15일 · 오전 2시 5분</p>
            <p className="mt-2 text-[11px] tracking-[0.35em] text-slate-400" style={{ textShadow: '0 1px 8px #000' }}>북대서양 · 북위 41도 43분</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 어둡게: 위아래 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-black/25 via-transparent to-black/80" />

      {/* 대화 상자: 대사 한 줄과, 그 단계의 선택지. 그림 아래쪽에 따로 자리를 잡아 서로 겹치지 않는다 */}
      <div className="absolute inset-x-0 bottom-0 z-40 px-3 pb-4 sm:px-6 sm:pb-6">
        <div className="mx-auto w-full max-w-3xl rounded-xl border border-amber-200/25 bg-black/80 shadow-[0_-10px_40px_rgba(0,0,0,.6)] backdrop-blur-sm">
          <div
            role={canSkip ? 'button' : undefined}
            tabIndex={canSkip ? 0 : undefined}
            onClick={() => { if (canSkip) step(); }}
            onKeyDown={(e) => { if (canSkip && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); step(); } }}
            className={`relative min-h-[104px] px-4 pb-3 pt-3 sm:px-6 ${canSkip ? 'cursor-pointer' : ''}`}
          >
            <div className="mb-1 flex items-center justify-between text-[11px] tracking-widest text-slate-400">
              <span>{solo ? '혼자 남은 난간' : `난간에서 · ${beat + 1} / ${BEATS.length}`}</span>
              {canSkip && <span className="animate-pulse text-amber-100/60">눌러서 넘기기 ▸</span>}
            </div>
            <AnimatePresence mode="wait">
              {line ? (
                <motion.div key={line.who + line.text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} role="status" aria-live="polite">
                  {line.who !== 'note' && (
                    <p className={`mb-0.5 text-xs font-bold tracking-wider ${line.who === 'me' ? 'text-amber-200' : 'text-sky-200'}`}>{line.who === 'me' ? '나' : herName}</p>
                  )}
                  <p className={`break-keep leading-relaxed ${line.who === 'note' ? 'text-sm italic text-slate-300' : 'font-serif text-[17px] text-slate-50 sm:text-lg'}`}>
                    {line.who === 'note' ? line.text : `“${line.text}”`}
                  </p>
                </motion.div>
              ) : (
                <motion.div key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                  <p className="font-serif text-lg font-bold text-red-200">{question.title}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {choices && !falling && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="border-t border-white/10 px-3 pb-3 pt-2 sm:px-5">
              {/* 가만히 있을 수 있는 시간 */}
              <div className="mb-2 h-0.5 w-full overflow-hidden rounded bg-white/10" aria-hidden>
                <motion.div key={`${beat}-${solo}`} className="h-full origin-left bg-amber-200/60" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: SILENCE_S, ease: 'linear' }} />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => choose(c)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm leading-snug transition-colors ${c.end === 'jump' && solo ? 'border-red-300/50 bg-red-950/50 text-red-100 hover:bg-red-900/60' : 'border-amber-200/35 bg-white/5 text-slate-100 hover:border-amber-200 hover:bg-amber-200/15'}`}
                  >
                    <span className="block break-keep font-bold">{c.label}</span>
                    <span className="mt-0.5 block break-keep text-[11px] text-slate-300/80">{c.hint}</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">가만히 있으면 말없이 지나갑니다.</span>
                {!solo && (
                  <button type="button" onClick={letGo} className="rounded border border-red-300/40 px-3 py-1 text-xs text-red-200/90 hover:bg-red-950/60">
                    난간을 놓고 뛰어내린다
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* 떨어지는 순간: 화면이 어두워진다. 마지막 대사는 그 위에 남는다 */}
      <AnimatePresence>
        {falling && !reduce && <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-black" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 0.96] }} transition={{ duration: fallMs / 1000 + 1.6, times: [0, (fallMs / 1000 + 0.5) / (fallMs / 1000 + 1.6), 1] }} />}
      </AnimatePresence>
    </div>
  );
}
