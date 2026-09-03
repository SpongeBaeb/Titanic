import { create } from 'zustand';

export type QuizStep = 'PROLOGUE' | 'Q0' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7' | 'RESULT';

interface QuizState {
  currentStep: QuizStep;
  answers: {
    embarked?: string; // S, C, Q
    sex?: string; // male, female
    ageGroup?: string; // 10세 미만, 10~17세...
    companion?: string; // 혼자, 연인, 친구, 가족
    pclass?: number; // 1, 2, 3
    fareIntent?: string; // luxury, balance, save
    purpose?: string; // experience, stability, change
    rumorAction?: string; // calm_others, check_crew, check_escape, follow_crowd
    finalAction?: string; // yield_seat, yield_weak, secure_mine, me_first, observe
  };
  setAnswer: (key: keyof QuizState['answers'], value: any) => void;
  nextStep: (next: QuizStep) => void;
  resetQuiz: () => void;
  showDebug: boolean;
  toggleDebug: () => void;
}

export const useQuizStore = create<QuizState>((set) => ({
  currentStep: 'PROLOGUE',
  answers: {},
  showDebug: false,
  setAnswer: (key, value) => 
    set((state) => ({ answers: { ...state.answers, [key]: value } })),
  nextStep: (next) => set({ currentStep: next }),
  resetQuiz: () => set({ currentStep: 'PROLOGUE', answers: {} }),
  toggleDebug: () => set((state) => ({ showDebug: !state.showDebug })),
}));
