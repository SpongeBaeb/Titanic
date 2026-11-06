'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuizStore } from '@/store/quizStore';
import { restartJourney } from '@/lib/session';
import { unlock, onDogEnding, DOG_ENDING_KEYS } from '@/engine/achievements';
import { captainBond, tomBond } from '@/engine/scenes';

/**
 * 강아지 시점 분기의 결말 카드. 백엔드의 승객 매칭과 무관하게 이 화면에서 끝난다.
 * 마지막 선택(DQ5)과 앞에서 쌓은 관계(소년 선원 톰, 늙은 개 캡틴)가 결말을 가른다. (문구는 초안, 역사 검토 전)
 */
type Answers = Record<string, unknown>;

export interface DogEnding {
  key: 'reunion' | 'miracle' | 'unheard' | 'stranger' | 'withTom' | 'withCaptain' | 'guilt';
  title: string;
  lines: string[];
  survived: boolean;
  /** 결말 그림 (아직 없는 결말은 비워 둔다) */
  img?: string;
  /** 같은 결말의 두 번째 그림: 시간이 지나면 바뀐다 */
  img2?: string;
  shape?: 'wide' | 'tall';
}

export function dogEnding(a: Answers): DogEnding {
  const cap = captainBond(a);
  const tom = tomBond(a);
  const bark = a.dogNight === 'bark';
  switch (a.dogFinal) {
    case 'leap':
      return {
        key: 'reunion',
        title: '라벤더 향 속으로',
        survived: true,
        img: '/bg/dog_end_reunion.webp',
        shape: 'wide',
        lines: [
          '당신은 어둠을 가르며 뛰었고, 익숙한 외투가 당신을 받아 안았습니다.',
          '구명정이 노 젓는 소리와 함께 멀어지는 동안, 주인은 단 한 번도 당신의 이름 부르기를 멈추지 않았습니다.',
          ...(cap ? ['멀어지는 갑판 위에서는 캡틴의 낮은 울음이 오래도록 들렸습니다.'] : []),
        ],
      };
    case 'call':
      return tom && bark
        ? {
            key: 'miracle',
            title: '멈춘 구명정',
            survived: true,
            img: '/bg/dog_end_miracle.webp',
            img2: cap ? '/bg/dog_end_captainsaved.webp' : undefined,
            shape: 'tall',
            lines: [
              '당신의 외침이 어둠을 찢었습니다. 노 젓는 소리가 멎었습니다.',
              '갑판에서 톰의 목소리가 울렸습니다. "여기 개가 있어요! 멈춰요!"',
              '구명정이 천천히 뱃머리를 돌렸습니다. 당신은 톰의 팔에서 낯선 손으로, 그리고 라벤더 향 속으로 건네졌습니다.',
              ...(cap ? ['톰이 숨을 몰아쉬며 캡틴의 목줄을 건넸고, 라벤더 외투의 주인은 큰 개를 놓치지 않으려 두 팔로 끌어안았습니다.'] : []),
              '이것은 기록에는 없는, 당신들만의 결말입니다.',
            ],
          }
        : {
            key: 'unheard',
            title: '닿지 않은 목소리',
            survived: false,
            img: '/bg/dog_end_unheard.webp',
            shape: 'wide',
            lines: [
              '당신은 목이 쉬도록 짖었지만, 노 젓는 소리는 멈추지 않았습니다.',
              '갑판의 소란 속에서 작은 목소리는 묻혔고, 라벤더 향은 점점 멀어졌습니다.',
              '마지막으로 맡은 것은 여전히, 그 향이었습니다.',
            ],
          };
    case 'accept':
      return {
        key: 'stranger',
        title: '낯선 외투 속에서',
        survived: true,
        img: '/bg/dog_end_stranger.webp',
        shape: 'tall',
        lines: [
          '당신을 안은 것은 주인이 아니었습니다. 하지만 외투는 따뜻했고, 구명정 위에서 낯선 손이 밤새 당신의 등을 쓸어 주었습니다.',
          '멀어지는 갑판에서 톰이 손을 흔들었습니다. 그는 끝까지 당신을 뒤돌아보지 않았습니다. 그래야 당신이 울지 않을 테니까요.',
          '날이 밝으면 당신은 라벤더 향을 다시 찾기로 마음먹습니다.',
        ],
      };
    case 'return':
      return {
        key: 'withTom',
        title: '마지막 한 사람',
        survived: false,
        img: '/bg/dog_end_tom.webp',
        shape: 'wide',
        lines: [
          '당신은 낯선 품을 뿌리치고 톰의 팔로 뛰어내렸습니다.',
          '톰은 웃는 얼굴로 당신의 귀 뒤를 긁어 주었습니다. "바보 같은 녀석."',
          '기울어 가는 갑판 위에서, 소년과 개는 서로의 체온으로 마지막까지 버텼습니다.',
        ],
      };
    case 'turn':
      return {
        key: 'withCaptain',
        title: '끝까지 곁에 있던 개',
        survived: false,
        img: '/bg/dog_end_captain.webp',
        shape: 'tall',
        lines: [
          '당신은 캡틴의 곁에 앉았습니다. 늙은 에어데일은 아무 말 없이 당신의 머리에 턱을 얹었습니다.',
          '기울어 가는 갑판에서 두 개는 서로의 체온으로 버텼습니다.',
          '마지막 순간까지, 당신은 혼자가 아니었습니다.',
        ],
      };
    case 'abandon':
    default:
      return {
        key: 'guilt',
        title: '돌아보지 못한 눈',
        survived: true,
        img: '/bg/dog_end_guilt.webp',
        shape: 'wide',
        lines: [
          '당신은 구명정으로 뛰었고, 낯선 손이 당신을 받아 올렸습니다.',
          '구명정이 멀어지는 동안 당신은 한 번도 뒤를 돌아보지 못했습니다. 갑판 위에서 낮고 긴 울음소리가 오래도록 들렸습니다.',
          '당신은 살아남았습니다. 그리고 그 울음소리를 평생 기억할 것입니다.',
        ],
      };
  }
}

export default function DogResultView() {
  const answers = useQuizStore((s) => s.answers);
  const ending = dogEnding(answers as Answers);
  const [shot, setShot] = useState(0); // 두 번째 그림으로 넘어갔는가

  const [seenCount, setSeenCount] = useState(0);
  useEffect(() => {
    unlock('good-dog');
    if (ending.key === 'miracle') unlock('dog-miracle');
    setSeenCount(onDogEnding(ending.key)); // 본 결말을 기록한다 (일곱 가지를 모두 보면 업적)
  }, [ending.key]);

  useEffect(() => {
    if (!ending.img2) return;
    const t = setTimeout(() => setShot(1), 1000 + ending.lines.length * 1100);
    return () => clearTimeout(t);
  }, [ending.img2, ending.lines.length]);

  const text = (
    <div className={ending.img ? 'text-center md:text-left' : 'text-center'}>
      <p className="font-sans text-xs uppercase tracking-[0.3em] text-muted-ivory/70">A small passenger</p>
      <h2 className="mt-3 font-title text-4xl text-amber-100 drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]">{ending.title}</h2>
      <div className={`my-6 h-px w-2/3 bg-amber-200/30 ${ending.img ? 'mx-auto md:mx-0' : 'mx-auto'}`} />
      <div className="space-y-4">
        {ending.lines.map((line, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 1.1, duration: 0.9 }}
            className="break-keep font-serif text-base leading-8 text-slate-100 [text-shadow:0_2px_12px_rgba(0,0,0,0.85)]"
          >
            {line}
          </motion.p>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 + ending.lines.length * 1.1, duration: 1 }}
        className="mt-8 break-keep font-sans text-xs leading-6 text-slate-300/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]"
      >
        타이타닉호에는 열두 마리쯤의 개가 탔다고 전해지며, 그중 구명정으로 살아남은 개는 세 마리뿐이었다고 알려져 있습니다.
        <br />
        (자료마다 다릅니다. 톰과 캡틴은 지어낸 인물입니다.)
        {seenCount > 0 && (
          <>
            <br />
            <span className="mt-2 inline-block tracking-widest text-amber-200/70">
              지금까지 본 결말 {seenCount} / {DOG_ENDING_KEYS.length}
            </span>
          </>
        )}
      </motion.p>
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2 + ending.lines.length * 1.1, duration: 1 }}
        onClick={restartJourney}
        className="mt-10 border border-slate-500 bg-black/30 px-8 py-3 text-sm tracking-widest text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
      >
        새로운 여정 시작하기
      </motion.button>
    </div>
  );

  const imgs = [ending.img, ending.img2].filter(Boolean) as string[];

  // 가로 그림: 화면 전체 배경으로 깔고 글을 그 위에 올린다 (천천히 다가가는 카메라)
  if (ending.img && ending.shape === 'wide') {
    return (
      <div className="relative flex min-h-[80vh] items-center justify-center px-6 py-12 md:justify-end md:pr-[7vw]">
        <motion.img
          src={ending.img}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none fixed inset-0 h-full w-full select-none object-cover"
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 0.8, scale: 1.08 }}
          transition={{ opacity: { duration: 2 }, scale: { duration: 24, ease: 'linear' } }}
        />
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/75" />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }} className="relative z-10 w-full max-w-md">
          {text}
        </motion.div>
      </div>
    );
  }

  // 세로 그림: 그림을 액자처럼 옆에 놓는다 (좁은 화면에서는 위에)
  if (ending.img && ending.shape === 'tall') {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }} className="flex w-full max-w-4xl flex-col items-center gap-8 md:flex-row md:gap-12">
          <div
            className="relative shrink-0 overflow-hidden"
            style={{ height: 'min(46vh, 520px)', aspectRatio: '3 / 4', border: '2px solid rgba(200,165,100,0.7)', boxShadow: '0 18px 50px rgba(0,0,0,0.7), 0 0 0 5px rgba(10,8,6,0.6)', borderRadius: 6 }}
          >
            {imgs.map((src, i) => (
              <motion.img
                key={src}
                src={src}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full select-none object-cover"
                initial={{ opacity: i === 0 ? 0 : 0, scale: 1 }}
                animate={{ opacity: i === shot ? 1 : 0, scale: 1.06 }}
                transition={{ opacity: { duration: 1.6 }, scale: { duration: 20, ease: 'linear' } }}
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">{text}</div>
        </motion.div>
      </div>
    );
  }

  // 그림이 없는 경우: 글만
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }} className="w-full max-w-md">
        {text}
      </motion.div>
    </div>
  );
}
