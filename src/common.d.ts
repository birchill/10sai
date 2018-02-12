// This is probably not how you are supposed to use .d.ts files but I'm using it
// here just to avoid having to import Card etc. everywhere.

/**
 * A card.
 */
export interface Card {
  _id: string;
  question: string;
  answer: string;
  created: string;
  modified: string;
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
