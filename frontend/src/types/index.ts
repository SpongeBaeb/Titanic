export interface HistoricalMatch {
  name: string;
  pclass: number;
  sex: string;
  survived: boolean;
  match_percentage: number;
  story: string;
}

export interface QuizResultResponse {
  status: string;
  id?: string;
  statistical_probability: number;
  adjusted_probability: number;
  persona: string;
  historical_match: HistoricalMatch;
  worst_match?: HistoricalMatch;
  opposite_match?: HistoricalMatch;
}
