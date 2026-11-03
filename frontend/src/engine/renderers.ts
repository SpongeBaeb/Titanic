import type { ComponentType } from 'react';
import type { Question } from '@/data/questions';
import type { RendererId } from './types';
import GenderView from '@/components/question/GenderView';
import AgeView from '@/components/question/AgeView';
import CompanionCamera from '@/components/question/CompanionCamera';
import StaircaseView from '@/components/question/StaircaseView';
import MoneyMinigameView from '@/components/question/MoneyMinigameView';
import QuestionView from '@/components/question/QuestionView';

export interface RendererProps {
  question: Question;
  onAnswer: (value: string, extra?: Record<string, unknown>) => void;
  onBack: () => void;
}

// 전용 화면은 그대로 쓰고, 'cinematic' 은 E3 단계에서는 기존 QuestionView 와 같다.
export const renderers: Record<RendererId, ComponentType<RendererProps>> = {
  gender: GenderView,
  age: AgeView,
  companion: CompanionCamera,
  staircase: StaircaseView,
  money: MoneyMinigameView,
  cinematic: QuestionView,
};
