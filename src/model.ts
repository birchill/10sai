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
 * A missing card.
 */
export type CardPlaceholder = {
  id: string;
  status: 'missing';
};

export function isCardPlaceholder(
  a: Card | CardPlaceholder
): a is CardPlaceholder {
  return (a as CardPlaceholder).status === 'missing';
}

/**
 * A representation of a review containing just the information that should be
 * stored and synchronized.
 */
export interface ReviewSummary {
  maxCards: number;
  maxNewCards: number;
  history: Array<{
    id: string;
    status: ReviewCardStatus;
    previousProgress?: Progress;
  }>;
}

export const enum ReviewCardStatus {
  Passed,
  Failed,
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
