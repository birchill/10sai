/**
 * A card.
 */
export interface Card {
  _id: string;
  question: string;
  answer: string;
  keywords: string[];
  tags: string[];
  starred: boolean;
  created: number;
  modified: number;
  progress: Progress;
}

/**
 * The review progress of a card.
 */
export interface Progress {
  level: number;
  reviewed: Date | null;
}

/**
 * An in-progress review.
 */
export interface Review {
  reviewTime: Date;
  maxCards: number;
  maxNewCards: number;
  completed: number;
  newCardsCompleted: number;
  history: string[];
  failedCardsLevel1: string[];
  failedCardsLevel2: string[];
}
