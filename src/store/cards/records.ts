export const CARD_PREFIX = 'card-';
export const PROGRESS_PREFIX = 'progress-';

export interface CardRecord {
  _id: string;
  _rev?: string;
  question: string;
  answer: string;
  created: string;
  modified: string;
}

export interface ProgressRecord {
  _id: string;
  _rev?: string;
  level: number;
  reviewed: number | null;
}
