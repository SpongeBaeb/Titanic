import type { ComponentType } from 'react';
import type { Question } from '@/data/questions';
import type { RendererId } from './types';
import GenderView from '@/components/question/GenderView';
import AgeView from '@/components/question/AgeView';
import CompanionCamera from '@/components/question/CompanionCamera';
import StaircaseView from '@/components/question/StaircaseView';
import MoneyMinigameView from '@/components/question/MoneyMinigameView';
import QuestionView from '@/components/question/QuestionView';
import DogChoiceView from '@/components/question/DogChoiceView';
import DogIntroView from '@/components/question/DogIntroView';
import DeckView from '@/components/question/DeckView';
import RumorView from '@/components/question/RumorView';

export interface RendererProps {
  question: Question;
  onAnswer: (value: string, extra?: Record<string, unknown>) => void;
  onBack: () => void;
  /** 앞 장면에서 남긴 값(예: 구명환을 챙겼는지) */
  extras?: Record<string, unknown>;
}

// 전용 화면은 그대로 쓰고, 'cinematic' 은 E3 단계에서는 기존 QuestionView 와 같다.
export const renderers: Record<Exclude<RendererId, 'night'>, ComponentType<RendererProps>> = {
  gender: GenderView,
  age: AgeView,
  companion: CompanionCamera,
  staircase: StaircaseView,
  money: MoneyMinigameView,
  cinematic: QuestionView,
  dog: DogChoiceView,
  dogintro: DogIntroView,
  deck: DeckView,
  rumor: RumorView,
};
