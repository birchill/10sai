import { Review, ReviewCardStatus } from '../model';
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
    switch (item.state) {
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
): Review['history'] => {
  return queue
    .filter(item => item.state === 'passed' || item.state === 'failed')
    .map(item => {
      const result: Review['history'][0] = {
        id: item.card.id,
        status:
          item.state === 'passed'
            ? ReviewCardStatus.Passed
            : ReviewCardStatus.Failed,
      };
      if (item.previousProgress) {
        result.previousProgress = item.previousProgress;
      }
      return result;
    });
};

export const getReviewSummary = (state: AppState): Review => ({
  maxCards: state.review.maxCards,
  maxNewCards: state.review.maxNewCards,
  history: getHistorySummary(state.review.queue),
});
