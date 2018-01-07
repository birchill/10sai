import { createSelector } from 'reselect';

const getHeapLength = state => state.review.heap.length;
const getCurrentCard = state => state.review.currentCard;
const getFailedCardsLevel1 = state => state.review.failedCardsLevel1;
const getFailedCardsLevel2 = state => state.review.failedCardsLevel2;

const getUnseenCards = createSelector(
  [getHeapLength, getCurrentCard, getFailedCardsLevel1, getFailedCardsLevel2],
  (heapLength, currentCard, failedCardsLevel1, failedCardsLevel2) => {
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
    getUnseenCards,
  ],
  (failedCardsLevel1, failedCardsLevel2, completedCards, unseenCards) => ({
    failedCardsLevel1,
    failedCardsLevel2,
    completedCards,
    unseenCards,
  })
);

export default getReviewProgress;
