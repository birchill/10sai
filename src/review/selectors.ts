import { createSelector } from 'reselect';

import { getScreen } from '../route/selectors';
import { ReviewPhase } from './review-phase';
import { AppState } from '../reducer';
import { Card, Review } from '../model';

const getHeapLength = (state: AppState) => state.review.heap.length;
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

export const getReviewCards = (state: AppState): Card[] => [
  ...new Set(
    [
      ...state.review.heap,
      ...state.review.failed,
      ...state.review.history,
      state.review.currentCard,
    ].filter(card => !!card) as Card[]
  ),
];

export const getReviewInfo = (state: AppState) => (state ? state.review : {});

const extractId = (card: Card) => card.id;
const newCardsCompleted = (state: AppState) =>
  state.review.newCardsInPlay -
  (state.review.currentCard && !state.review.currentCard.progress.due ? 1 : 0);

export const getReviewSummary = (state: AppState): Review => ({
  reviewTime: state.review.reviewTime,
  maxCards: state.review.maxCards,
  maxNewCards: state.review.maxNewCards,
  completed: state.review.completed,
  newCardsCompleted: newCardsCompleted(state),
  history: state.review.history.map(extractId),
  failed: state.review.failed.map(extractId),
});
