export const CARD_PREFIX = 'card-';
export const NOTE_PREFIX = 'note-';
export const PROGRESS_PREFIX = 'progress-';
export const REVIEW_PREFIX = 'review-';

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

export interface NoteContent {
  keywords?: string[];
  content: string;
  created: number;
  modified: number;
}

export interface ReviewContent {
  reviewTime: number;
  maxCards: number;
  maxNewCards: number;
  completed: number;
  newCardsCompleted: number;
  history: string[];
  failedCardsLevel1: string[];
  failedCardsLevel2: string[];
}
