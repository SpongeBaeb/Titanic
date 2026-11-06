'use client';

import { useEffect, useRef, useState } from 'react';
import ScrollCue from '@/components/ui/ScrollCue';
import { motion } from 'framer-motion';
import type { Question } from '@/data/questions';
import ProgressLine from '@/components/ui/ProgressLine';
import { playPop } from '@/lib/synth';
import { useQuizStore } from '@/store/quizStore';

interface Props {
  question: Question;
  onAnswer: (value: string) => void;
  onBack: () => void;
}

/** 말하는 인물: 장면마다 이야기에서 말을 거는 쪽의 초상을 보여 준다 */
interface Speaker {
  name: string;
  role: string;
  src: string;
}
const TOM: Speaker = { name: '톰', role: '개집을 맡은 소년 선원', src: '/dog/tom.webp' };
const CAPTAIN: Speaker = { name: '캡틴', role: '늙은 에어데일', src: '/dog/captain.webp' };
function speakerFor(qid: string, a: Record<string, unknown>): Speaker | null {
  if (qid === 'DQ1') return TOM; // 트랩에서 당신을 들어 올린 소년
  if (qid === 'DQ2' || qid === 'DQ3') return CAPTAIN; // 개집의 늙은 개가 말을 건다
  if (qid === 'DQ5') return a.dogDeck === 'tom' ? TOM : a.dogDeck === 'captain' ? CAPTAIN : null;
  return null;
}

/** 귀여운 강아지 발바닥: 큰 발바닥 살과 동그란 발가락 네 개 */
function Paw({ pressed, active }: { pressed: boolean; active: boolean }) {
  const fur = active ? '#f6e3b4' : '#e9d3a2';
  const pad = active ? '#e8a7a0' : '#d9a79a';
  return (
    <svg viewBox="0 0 64 64" width="38" height="38" aria-hidden className="shrink-0" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }}>
      {/* 털 모양 바탕 */}
      <ellipse cx="32" cy="42" rx="19" ry="16" fill={fur} />
      <ellipse cx="13" cy="28" rx="7.6" ry="9.4" fill={fur} transform="rotate(-18 13 28)" />
      <ellipse cx="25" cy="17" rx="7.6" ry="9.8" fill={fur} transform="rotate(-6 25 17)" />
      <ellipse cx="39" cy="17" rx="7.6" ry="9.8" fill={fur} transform="rotate(6 39 17)" />
      <ellipse cx="51" cy="28" rx="7.6" ry="9.4" fill={fur} transform="rotate(18 51 28)" />
      {/* 말랑한 발바닥 살 */}
      <path d="M32 33c-6.6 0-12.6 5.6-12.6 11 0 4 3 6.4 6.4 6.4 2.4 0 3.6-1 6.2-1s3.8 1 6.2 1c3.4 0 6.4-2.4 6.4-6.4C44.6 38.6 38.6 33 32 33z" fill={pad} />
      <ellipse cx="14" cy="28" rx="3.6" ry="4.6" fill={pad} transform="rotate(-18 14 28)" />
      <ellipse cx="25.4" cy="18" rx="3.6" ry="4.8" fill={pad} transform="rotate(-6 25.4 18)" />
      <ellipse cx="38.6" cy="18" rx="3.6" ry="4.8" fill={pad} transform="rotate(6 38.6 18)" />
      <ellipse cx="50" cy="28" rx="3.6" ry="4.6" fill={pad} transform="rotate(18 50 28)" />
      {/* 눌렸을 때 반짝 */}
      {pressed && <circle cx="32" cy="40" r="3" fill="#fff" opacity="0.55" />}
    </svg>
  );
}

/**
 * 강아지 시점 분기의 선택 화면: 보기를 한 줄에 하나씩 놓고, 줄마다 앞에 강아지 발을 둔다.
 * 마우스를 올리면 발이 통통 튀고, 고르면 발이 꾹 눌린다. 키보드 1·2·3 으로도 고를 수 있다.
 */
export default function DogChoiceView({ question, onAnswer, onBack }: Props) {
  const answers = useQuizStore((st) => st.answers) as Record<string, unknown>;
  const speaker = speakerFor(question.id, answers);
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const choose = (value: string) => {
    if (picked) return;
    setPicked(value);
    playPop();
    timer.current = setTimeout(() => onAnswer(value), 520);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < question.options.length) choose(question.options[i].value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, picked]);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 py-12">
      <ScrollCue />
      <button onClick={onBack} className="group fixed left-4 top-3 md:bottom-8 md:left-8 md:top-auto z-50 flex items-center text-slate-300 transition-colors hover:text-amber-300">
        <span className="mr-2 transition-transform group-hover:-translate-x-1">←</span>
        <span className="font-sans text-sm uppercase tracking-widest">Back</span>
      </button>

      <div className="mb-10 mt-4">
        <ProgressLine />
      </div>

      <div className="mb-8 flex flex-1 flex-col justify-center">
        <div className={`flex gap-5 ${speaker ? 'flex-col-reverse items-start sm:flex-row sm:items-end' : 'flex-col'}`}>
          <div className="min-w-0 flex-1">
            <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="mb-5 font-title text-2xl font-bold leading-relaxed text-ivory [text-shadow:0_2px_14px_rgba(0,0,0,0.8)] md:text-3xl">
              {question.title}
            </motion.h2>
            {question.subtitle && (
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="break-keep font-sans text-base leading-loose text-muted-ivory [text-shadow:0_1px_10px_rgb(0_0_0/0.85)]">
                {question.subtitle}
              </motion.p>
            )}
          </div>
          {speaker && (
            <motion.figure
              key={speaker.name}
              initial={{ opacity: 0, x: 24, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="m-0 flex shrink-0 flex-col items-center self-center sm:self-end"
              aria-label={`${speaker.name}, ${speaker.role}`}
            >
              <div
                className="relative overflow-hidden"
                style={{
                  width: 132,
                  height: 168,
                  borderRadius: '66px 66px 14px 14px',
                  border: '2px solid rgba(200,165,100,0.75)',
                  background: 'radial-gradient(ellipse at 50% 30%, rgba(60,45,25,0.85), rgba(10,8,6,0.92))',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.65), inset 0 0 18px rgba(0,0,0,0.6), 0 0 0 4px rgba(10,8,6,0.55)',
                }}
              >
                <img src={speaker.src} alt="" draggable={false} className="absolute bottom-0 left-1/2 h-[112%] w-auto max-w-none -translate-x-1/2 select-none object-contain" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))' }} />
              </div>
              <figcaption className="mt-2 text-center font-serif leading-tight text-[#f1deaa] [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
                <span className="block text-sm">{speaker.name}</span>
                <span className="block text-[10px] tracking-wider text-[#d9c590]/80">{speaker.role}</span>
              </figcaption>
            </motion.figure>
          )}
        </div>
      </div>

      <ul className="mb-8 flex w-full flex-col gap-3" role="list">
        {question.options.map((o, i) => {
          const isHover = hover === o.id;
          const isPicked = picked === o.value;
          return (
            <motion.li key={o.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: picked && !isPicked ? 0.35 : 1, x: 0 }} transition={{ duration: 0.5, delay: 0.25 + i * 0.12 }}>
              <button
                type="button"
                onClick={() => choose(o.value)}
                onMouseEnter={() => setHover(o.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(o.id)}
                onBlur={() => setHover(null)}
                disabled={!!picked}
                className="group flex w-full items-center gap-4 rounded-[14px] border px-4 py-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/70"
                style={{
                  background: isHover || isPicked ? 'rgba(30,20,10,0.78)' : 'rgba(10,8,6,0.62)',
                  borderColor: isHover || isPicked ? 'rgba(236,205,140,0.7)' : 'rgba(200,170,110,0.28)',
                  backdropFilter: 'blur(3px)',
                  boxShadow: isHover || isPicked ? '0 6px 22px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,230,170,0.08)' : '0 4px 14px rgba(0,0,0,0.4)',
                }}
              >
                <motion.span
                  animate={isPicked ? { scale: [1, 0.78, 0.9], rotate: [0, -8, -4] } : isHover ? { y: [0, -5, 0, -3, 0], rotate: [0, -10, 8, -4, 0] } : { y: 0, rotate: 0 }}
                  transition={isPicked ? { duration: 0.3 } : { duration: 0.7, repeat: isHover ? Infinity : 0, repeatDelay: 0.25 }}
                  className="flex"
                >
                  <Paw pressed={isPicked} active={isHover || isPicked} />
                </motion.span>
                <span className="break-keep font-serif text-[17px] leading-snug text-[#f4ead2] [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
                  {o.label}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
