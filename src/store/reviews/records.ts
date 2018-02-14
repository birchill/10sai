export const REVIEW_PREFIX = 'review-';

export interface ReviewRecord {
  _id: string;
  _rev?: string;
  reviewTime: number;
  maxCards: number;
  maxNewCards: number;
  completed: number;
  newCardsCompleted: number;
  history: string[];
  failedCardsLevel1: string[];
  failedCardsLevel2: string[];
}
