import { ReviewSummary } from '../model';
import { AppState } from '../reducer';
import { getScreen } from '../route/selectors';

import { QueuedCard } from './reducer';
import { ReviewPhase } from './review-phase';

export const getReviewProgress = (state: AppState) => {
  let failedCards = 0;
  let completedCards = 0;
  let unreviewedCards = 0;

  const { queue } = state.review;
  for (const item of queue) {
    switch (item.status) {
      case 'passed':
        completedCards++;
        break;

      case 'failed':
        failedCards++;
        break;

      default:
        unreviewedCards++;
        break;
    }
  }

  return { failedCards, completedCards, unreviewedCards };
};

export const getReviewPhase = (state: AppState) => state.review.phase;

// We only care about available cards if we are looking at the review screen
// and we are in the idle or complete state.
export const getNeedAvailableCards = (state: AppState) =>
  getScreen(state) === 'review' &&
  [ReviewPhase.Idle, ReviewPhase.Complete].includes(getReviewPhase(state));

export const getAvailableCards = (state: AppState) =>
  state.review.availableCards;
export const getSavingProgress = (state: AppState) =>
  state.review.savingProgress;

export const getReviewState = (state: AppState) => (state ? state.review : {});

const getHistorySummary = (
  queue: ReadonlyArray<QueuedCard>
): ReviewSummary['history'] => {
  return queue
    .filter(item => item.status === 'passed' || item.status === 'failed')
    .map(item => {
      const result: ReviewSummary['history'][0] = {
        id: item.card.id,
        status: item.status as 'passed' | 'failed',
      };
      if (item.previousProgress) {
        result.previousProgress = item.previousProgress;
      }
      return result;
    });
};

export const getReviewSummary = (state: AppState): ReviewSummary => ({
  maxCards: state.review.maxCards,
  maxNewCards: state.review.maxNewCards,
  history: getHistorySummary(state.review.queue),
});
