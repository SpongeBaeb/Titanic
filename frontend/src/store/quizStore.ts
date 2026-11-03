import { create } from 'zustand';
import type { AnswerKey, Flags, Pick } from '@/engine/types';
import { PROLOGUE } from '@/engine/scenes';

/** 장면 id. 'PROLOGUE' / 'RESULT' 는 예약어, 나머지는 engine/scenes.ts 의 id */
export type QuizStep = string;

interface Answers {
  embarked?: string; // S, C, Q
  sex?: string; // male, female
  ageGroup?: string; // 10세 미만, 10~17세...
  companion?: string; // 혼자, 연인, 친구, 가족
  pclass?: number; // 1, 2, 3
  fareIntent?: string; // luxury, balance, save
  purpose?: string; // experience, stability, change
  rumorAction?: string; // calm_others, check_crew, check_escape, follow_crowd
  finalAction?: string; // yield_seat, yield_weak, secure_mine, me_first, observe
}

interface Snapshot {
  step: QuizStep;
  answers: Answers;
  flags: Flags;
  picks: Pick[];
  extras: Record<string, unknown>;
}

interface QuizState {
  currentStep: QuizStep;
  answers: Answers;
  /** 이야기가 기억하는 사건 (점수와 무관, 장면 분기·문장 변형용) */
  flags: Flags;
  picks: Pick[];
  /** 숫자·목록 부가 기록 (예: Q4에서 가방에 담은 물건) */
  extras: Record<string, unknown>;
  /** 뒤로 가기용: 각 장면에 들어오기 직전의 상태 */
  history: Snapshot[];
  /** 이 판의 회차 (1부터). 저장된 기억은 마운트 후 setRun 으로 반영 */
  runIndex: number;
  setRun: (run: number) => void;
  setAnswer: (key: AnswerKey, value: any) => void;
  /** 답을 기록하고 다음 장면으로 이동 (뒤로 가기 기록을 남긴다) */
  advance: (opts: { next: QuizStep; key?: AnswerKey; value?: any; sets?: Flags; extras?: Record<string, unknown> }) => void;
  /** 직전 상태로 복원. 기록이 없으면(바로가기로 진입) fallback 장면으로 */
  back: (fallback: QuizStep) => void;
  /** 기록 없이 이동 (개발용 바로가기, 공유 링크) */
  nextStep: (next: QuizStep) => void;
  resetQuiz: () => void;
  showDebug: boolean;
  toggleDebug: () => void;
}

export const useQuizStore = create<QuizState>((set, get) => ({
  currentStep: PROLOGUE,
  answers: {},
  flags: {},
  picks: [],
  extras: {},
  history: [],
  runIndex: 1,
  setRun: (run) => set({ runIndex: run }),
  showDebug: false,
  setAnswer: (key, value) =>
    set((state) => ({ answers: { ...state.answers, [key]: value } })),
  advance: ({ next, key, value, sets, extras }) =>
    set((state) => {
      const snap: Snapshot = {
        step: state.currentStep, answers: state.answers, flags: state.flags, picks: state.picks, extras: state.extras,
      };
      return {
        currentStep: next,
        answers: key ? { ...state.answers, [key]: value } : state.answers,
        flags: sets ? { ...state.flags, ...sets } : state.flags,
        extras: extras ? { ...state.extras, ...extras } : state.extras,
        picks: key ? [...state.picks, { scene: state.currentStep, value: String(value) }] : state.picks,
        history: [...state.history, snap],
      };
    }),
  back: (fallback) => {
    const { history } = get();
    const prev = history[history.length - 1];
    if (!prev) { set({ currentStep: fallback }); return; }
    set({
      currentStep: prev.step, answers: prev.answers, flags: prev.flags,
      picks: prev.picks, extras: prev.extras, history: history.slice(0, -1),
    });
  },
  nextStep: (next) => set({ currentStep: next }),
  resetQuiz: () => set({ currentStep: PROLOGUE, answers: {}, flags: {}, picks: [], extras: {}, history: [] }),
  toggleDebug: () => set((state) => ({ showDebug: !state.showDebug })),
}));
