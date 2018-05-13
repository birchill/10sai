export const CARD_PREFIX = 'card-';
export const PROGRESS_PREFIX = 'progress-';

export interface CardContent {
  question: string;
  answer: string;
  keywords?: string[];
  tags?: string[];
  starred?: boolean;
  created: number;
  modified: number;
}

export interface ProgressContent {
  level: number;
  reviewed: number | null;
}
