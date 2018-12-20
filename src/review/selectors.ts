import { createSelector } from 'reselect';

import { getScreen } from '../route/selectors';
import { ReviewPhase } from './ReviewPhase';
import { ReviewState } from './reducer';
import { RouteState } from '../route/reducer';
import { Card, Review } from '../model';

// XXX Move this to root reducer once it gets converted to TS.
interface State {
  review: ReviewState;
  route: RouteState;
}

const getHeapLength = (state: State) => state.review.heap.length;
const getCurrentCard = (state: State) => state.review.currentCard;
const getFailedCardsLevel1 = (state: State) => state.review.failedCardsLevel1;
const getFailedCardsLevel2 = (state: State) => state.review.failedCardsLevel2;

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

const getFailedCardsLevel1Length = (state: State) =>
  state.review.failedCardsLevel1.length;
const getFailedCardsLevel2Length = (state: State) =>
  state.review.failedCardsLevel2.length;
const getCompleted = (state: State) => state.review.completed;

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

export const getReviewPhase = (state: State) => state.review.phase;

// We only care about available cards if we are looking at the review screen
// and we are in the idle or complete state.
export const getNeedAvailableCards = (state: State) =>
  getScreen(state) === 'review' &&
  [ReviewPhase.Idle, ReviewPhase.Complete].includes(getReviewPhase(state));

export const getAvailableCards = (state: State) => state.review.availableCards;
export const getLoadingAvailableCards = (state: State) =>
  state.review.loadingAvailableCards;
export const getSavingProgress = (state: State) => state.review.savingProgress;

export const getReviewCards = (state: State): Card[] => [
  ...new Set([
    ...state.review.heap,
    ...state.review.failedCardsLevel1,
    ...state.review.failedCardsLevel2,
    ...state.review.history,
    state.review.currentCard,
  ].filter(card => card) as Card[]),
];

export const getReviewInfo = (state: State) => (state ? state.review : {});

const extractId = (card: Card) => card._id;
const newCardsCompleted = (state: State) =>
  state.review.newCardsInPlay -
  (state.review.currentCard && !state.review.currentCard.progress.reviewed
    ? 1
    : 0);

export const getReviewSummary = (state: State): Review => ({
  reviewTime: state.review.reviewTime,
  maxCards: state.review.maxCards,
  maxNewCards: state.review.maxNewCards,
  completed: state.review.completed,
  newCardsCompleted: newCardsCompleted(state),
  history: state.review.history.map(extractId),
  failedCardsLevel1: state.review.failedCardsLevel1.map(extractId),
  failedCardsLevel2: state.review.failedCardsLevel2.map(extractId),
});
