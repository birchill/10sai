import { createSelector } from 'reselect';

import { getScreen } from '../route/selectors';
import { ReviewPhase } from './ReviewPhase';
import { AppState } from '../reducer';
import { Card, Review } from '../model';

const getHeapLength = (state: AppState) => state.review.heap.length;
const getCurrentCard = (state: AppState) => state.review.currentCard;
const getFailedCardsLevel1 = (state: AppState) =>
  state.review.failedCardsLevel1;
const getFailedCardsLevel2 = (state: AppState) =>
  state.review.failedCardsLevel2;

const getUnreviewedCards = createSelector(
  [getHeapLength, getCurrentCard, getFailedCardsLevel1, getFailedCardsLevel2],
  (heapLength, currentCard, failedCardsLevel1, failedCardsLevel2) => {
    if (!currentCard) {
      return 0;
    }
    const currentCardIsFailedCard =
      failedCardsLevel1.indexOf(currentCard) !== -1 ||
      failedCardsLevel2.indexOf(currentCard) !== -1;
    return heapLength + (currentCardIsFailedCard ? 0 : 1);
  }
);

const getFailedCardsLevel1Length = (state: AppState) =>
  state.review.failedCardsLevel1.length;
const getFailedCardsLevel2Length = (state: AppState) =>
  state.review.failedCardsLevel2.length;
const getCompleted = (state: AppState) => state.review.completed;

export const getReviewProgress = createSelector(
  [
    getFailedCardsLevel1Length,
    getFailedCardsLevel2Length,
    getCompleted,
    getUnreviewedCards,
  ],
  (failedCardsLevel1, failedCardsLevel2, completedCards, unreviewedCards) => ({
    failedCardsLevel1,
    failedCardsLevel2,
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
export const getLoadingAvailableCards = (state: AppState) =>
  state.review.loadingAvailableCards;
export const getSavingProgress = (state: AppState) =>
  state.review.savingProgress;

export const getReviewCards = (state: AppState): Card[] => [
  ...new Set([
    ...state.review.heap,
    ...state.review.failedCardsLevel1,
    ...state.review.failedCardsLevel2,
    ...state.review.history,
    state.review.currentCard,
  ].filter(card => card) as Card[]),
];

export const getReviewInfo = (state: AppState) => (state ? state.review : {});

const extractId = (card: Card) => card.id;
const newCardsCompleted = (state: AppState) =>
  state.review.newCardsInPlay -
  (state.review.currentCard && !state.review.currentCard.progress.reviewed
    ? 1
    : 0);

export const getReviewSummary = (state: AppState): Review => ({
  reviewTime: state.review.reviewTime,
  maxCards: state.review.maxCards,
  maxNewCards: state.review.maxNewCards,
  completed: state.review.completed,
  newCardsCompleted: newCardsCompleted(state),
  history: state.review.history.map(extractId),
  failedCardsLevel1: state.review.failedCardsLevel1.map(extractId),
  failedCardsLevel2: state.review.failedCardsLevel2.map(extractId),
});
