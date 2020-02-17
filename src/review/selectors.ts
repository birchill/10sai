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
        // We use getReviewSummary both to prepare the object we write to the
        // DataStore but also to then compare it to the object in memory so we
        // know if we need to re-load the review or not.
        //
        // Due to the way the reducer simply and the fact that we've changed the
        // schema for progress records a few times, we can end up with
        // obsolete fields on the progress object (notably the 'created' field)
        // which shouldn't affect the result of the comparison. As a result, we
        // specifically filter out just the fields we expect here.
        result.previousProgress = {
          level: item.previousProgress.level,
          due: item.previousProgress.due,
        };
      }
      return result;
    });
};

export const getReviewSummary = (state: AppState): ReviewSummary => ({
  maxCards: state.review.maxCards,
  maxNewCards: state.review.maxNewCards,
  history: getHistorySummary(state.review.queue),
});
