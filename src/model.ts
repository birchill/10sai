/**
 * A card.
 */
export interface Card {
  id: string;
  front: string;
  back: string;
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
  // null for a new card
  due: Date | null;
}

/**
 * An in-progress review.
 */
export interface Review {
  maxCards: number;
  maxNewCards: number;
  completed: number;
  newCardsCompleted: number;
  history: string[];
  failed: string[];
}

/**
 * A summary of how many cards are available for review.
 */
export interface AvailableCards {
  newCards: number;
  overdueCards: number;
}

/**
 * A note.
 */
export interface Note {
  id: string;
  keywords: string[];
  content: string;
  created: number;
  modified: number;
}
