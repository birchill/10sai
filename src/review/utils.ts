import { Card } from '../model';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Returns the number of days until the card will next be due if it passed with
// the given confidence.
export function getReviewInterval({
  card,
  confidence,
  reviewTime,
  jitter = 1,
}: {
  card: Card;
  confidence: number;
  reviewTime: Date;
  jitter?: number;
}): number {
  if (card.progress.level && card.progress.due) {
    const reviewedIntervalInDays =
      (reviewTime.getTime() - card.progress.due.getTime()) / MS_PER_DAY +
      card.progress.level;
    const nextIntervalInDays = reviewedIntervalInDays * 2 * confidence * jitter;

    return Math.max(nextIntervalInDays, 0.5);
  }

  // New / reset card: Review in 12 hours' time
  return 0.5 * confidence * jitter;
}
