// import { createSelector } from 'reselect';

import { Review, ReviewCardStatus } from '../model';
import { AppState } from '../reducer';
import { getScreen } from '../route/selectors';

import { QueuedCard } from './reducer';
import { ReviewPhase } from './review-phase';

/*
const getCurrentCard = (state: AppState) => state.review.currentCard;
const getFailedCards = (state: AppState) => state.review.failed;

const getUnreviewedCards = createSelector(
  [getHeapLength, getCurrentCard, getFailedCards],
  (heapLength, currentCard, failedCards) => {
    if (!currentCard) {
      return 0;
    }
    const currentCardIsFailedCard = failedCards.indexOf(currentCard) !== -1;
    return heapLength + (currentCardIsFailedCard ? 0 : 1);
  }
);

const getFailedCardsLength = (state: AppState) => state.review.failed.length;
const getCompleted = (state: AppState) => state.review.completed;

export const getReviewProgress = createSelector(
  [getFailedCardsLength, getCompleted, getUnreviewedCards],
  (failedCards, completedCards, unreviewedCards) => ({
    failedCards,
    completedCards,
    unreviewedCards,
  })
);
*/

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
