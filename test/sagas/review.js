/* global describe, it */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga } from 'redux-saga-test-plan';
import * as matchers from 'redux-saga-test-plan/matchers';

import { updateHeap as updateHeapSaga } from '../../src/sagas/review';
import * as reviewActions from '../../src/actions/review';
import reducer from '../../src/reducers/index';

describe('sagas:review updateHeap', () => {
  const cardStore = {
    getNewCards: () => {},
    getOverdueCards: () => {},
  };

  it('respects the limits set for a new review', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const allCards = newCards.concat(overdueCards);
    const action = reviewActions.newReview(2, 3);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide([
        [matchers.call.fn(cardStore.getNewCards), newCards],
        [matchers.call.fn(cardStore.getOverdueCards), overdueCards],
      ])
      .withState(reducer(undefined, action))
      .call([cardStore, 'getNewCards'], { limit: 2 })
      .call([cardStore, 'getOverdueCards'], { limit: 1 })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: allCards } })
      .run();
  });

  it('does not request more than the maximum number of cards even if the new card limit is greater', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const action = reviewActions.newReview(3, 2);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide([[matchers.call.fn(cardStore.getNewCards), newCards]])
      .withState(reducer(undefined, action))
      .call([cardStore, 'getNewCards'], { limit: 2 })
      .not.call.fn([cardStore, 'getOverdueCards'])
      .put.like({ action: { type: 'REVIEW_LOADED', cards: newCards } })
      .run();
  });

  it('requests more cards if the are not enough new cards', async () => {
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const action = reviewActions.newReview(2, 3);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide([
        [matchers.call.fn(cardStore.getNewCards), []],
        [matchers.call.fn(cardStore.getOverdueCards), overdueCards],
      ])
      .withState(reducer(undefined, action))
      .call([cardStore, 'getNewCards'], { limit: 2 })
      .call([cardStore, 'getOverdueCards'], { limit: 3 })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: overdueCards } })
      .run();
  });

  it('respects the limits set for an updated review', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));
    const action = reviewActions.setReviewLimit(3, 5);
    state = reducer(state, action);
    state.review.newCardsInPlay = 2;
    state.review.completed = 2;

    const newCards = ['New card 3'];
    const overdueCards = ['Overdue card 3', 'Overdue card 4'];
    const allCards = newCards.concat(overdueCards);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide([
        [matchers.call.fn(cardStore.getNewCards), newCards],
        [matchers.call.fn(cardStore.getOverdueCards), overdueCards],
      ])
      .withState(state)
      .call([cardStore, 'getNewCards'], { limit: 1 })
      .call([cardStore, 'getOverdueCards'], { limit: 2, skipFailedCards: true })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: allCards } })
      .run();
  });

  it('respects the overall limit for an updated review', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));
    const action = reviewActions.setReviewLimit(2, 3);
    state = reducer(state, action);
    state.review.newCardsInPlay = 1;
    state.review.completed = 2;
    state.review.failedCardsLevel1 = [ {} ];

    return expectSaga(updateHeapSaga, cardStore, action)
      .withState(state)
      .not.call.fn([cardStore, 'getNewCards'])
      .not.call.fn([cardStore, 'getOverdueCards'])
      .put.like({ action: { type: 'REVIEW_LOADED', cards: [] } })
      .run();
  });

  it('respects the limits set for an updated review even when there are no slots left', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));
    const action = reviewActions.setReviewLimit(1, 2);
    state = reducer(state, action);
    state.review.newCardsInPlay = 2;
    state.review.completed = 2;

    return expectSaga(updateHeapSaga, cardStore, action)
      .withState(state)
      .not.call.fn([cardStore, 'getNewCards'])
      .not.call.fn([cardStore, 'getOverdueCards'])
      .put.like({ action: { type: 'REVIEW_LOADED', cards: [] } })
      .run();
  });

  it('counts the current card as an occupied slot', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));
    const action = reviewActions.setReviewLimit(3, 4);
    state = reducer(state, action);
    state.review.newCardsInPlay = 2;
    state.review.completed = 2;
    state.review.currentCard = {};

    const newCards = ['New card 3'];

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide([
        [matchers.call.fn(cardStore.getNewCards), newCards],
      ])
      .withState(state)
      .call([cardStore, 'getNewCards'], { limit: 1 })
      .not.call.fn([cardStore, 'getOverdueCards'])
      .put.like({ action: { type: 'REVIEW_LOADED', cards: newCards } })
      .run();
  });
});
