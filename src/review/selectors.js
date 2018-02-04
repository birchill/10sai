import { createSelector } from 'reselect';
import { getScreen } from '../route/selectors';
import ReviewState from './states';

const getHeapLength = state => state.review.heap.length;
const getCurrentCard = state => state.review.currentCard;
const getFailedCardsLevel1 = state => state.review.failedCardsLevel1;
const getFailedCardsLevel2 = state => state.review.failedCardsLevel2;

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

const getFailedCardsLevel1Length = state =>
  state.review.failedCardsLevel1.length;
const getFailedCardsLevel2Length = state =>
  state.review.failedCardsLevel2.length;
const getCompleted = state => state.review.completed;

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

const getReviewState = state => state.review.reviewState;

// We only care about available cards if we are looking at the review screen
// and we are in the idle or complete state.
export const getNeedAvailableCards = state =>
  getScreen(state) === 'review' &&
  [ReviewState.IDLE, ReviewState.COMPLETE].includes(getReviewState(state));

export const getAvailableCards = state => state.review.availableCards;
export const getLoadingAvailableCards = state =>
  state.review.loadingAvailableCards;
export const getSavingProgress = state => state.review.savingProgress;

export const getReviewCards = state => [
  ...new Set(
    [
      ...state.review.heap,
      ...state.review.failedCardsLevel1,
      ...state.review.failedCardsLevel2,
      ...state.review.history,
      state.review.currentCard,
    ].filter(card => card)
  ),
];

export const getReviewInfo = state => (state ? state.review : {});

const extractId = card => card._id;
const newCardsCompleted = state =>
  state.review.newCardsInPlay -
  (state.review.currentCard && !state.review.currentCard.reviewed ? 1 : 0);

export const getReviewSummary = state => ({
  maxCards: state.review.maxCards,
  maxNewCards: state.review.maxNewCards,
  completed: state.review.completed,
  newCardsCompleted: newCardsCompleted(state),
  history: state.review.history.map(extractId),
  failedCardsLevel1: state.review.failedCardsLevel1.map(extractId),
  failedCardsLevel2: state.review.failedCardsLevel2.map(extractId),
});

export default getReviewProgress;
