/* global describe, it */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga } from 'redux-saga-test-plan';
import * as matchers from 'redux-saga-test-plan/matchers';

import { updateHeap as updateHeapSaga } from '../../src/sagas/review';
import * as reviewActions from '../../src/actions/review';
import reducer from '../../src/reducers/index';

describe('sagas:review updateHeap', () => {
  const cardStore = {
    getCards: () => {},
  };

  const getCardStoreProvider = (newCards, overdueCards) => {
    return {
      call(effect, next) {
        if (effect.fn === cardStore.getCards) {
          const type = effect.args[0] ? effect.args[0].type : '';
          if (type === 'new') {
            return newCards;
          } else if (type === 'overdue') {
            return overdueCards;
          }
        }

        return next();
      },
    };
  };

  it('respects the limits set for a new review', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const allCards = newCards.concat(overdueCards);
    const action = reviewActions.newReview(2, 3);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide(getCardStoreProvider(newCards, overdueCards))
      .withState(reducer(undefined, action))
      .call([cardStore, 'getCards'], { limit: 2, type: 'new' })
      .call([cardStore, 'getCards'], { limit: 1, type: 'overdue' })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: allCards } })
      .run();
  });

  it('does not request more than the maximum number of cards even if the new card limit is greater', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const action = reviewActions.newReview(3, 2);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide([[matchers.call.fn(cardStore.getCards), newCards]])
      .withState(reducer(undefined, action))
      .call([cardStore, 'getCards'], { limit: 2, type: 'new' })
      .not.call.fn([cardStore, 'getCards'])
      .put.like({ action: { type: 'REVIEW_LOADED', cards: newCards } })
      .run();
  });

  it('requests more cards if the are not enough new cards', async () => {
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const action = reviewActions.newReview(2, 3);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide(getCardStoreProvider([], overdueCards))
      .withState(reducer(undefined, action))
      .call([cardStore, 'getCards'], { limit: 2, type: 'new' })
      .call([cardStore, 'getCards'], { limit: 3, type: 'overdue' })
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
      .provide(getCardStoreProvider(newCards, overdueCards))
      .withState(state)
      .call([cardStore, 'getCards'], { limit: 1, type: 'new' })
      .call([cardStore, 'getCards'], {
        limit: 2,
        type: 'overdue',
        skipFailedCards: true,
      })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: allCards } })
      .run();
  });

  it('respects the overall limit for an updated review', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));
    const action = reviewActions.setReviewLimit(2, 3);
    state = reducer(state, action);
    state.review.newCardsInPlay = 1;
    state.review.completed = 2;
    state.review.failedCardsLevel1 = [{}];

    return expectSaga(updateHeapSaga, cardStore, action)
      .withState(state)
      .not.call.fn([cardStore, 'getCards'])
      .not.call.fn([cardStore, 'getCards'])
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
      .not.call.fn([cardStore, 'getCards'])
      .not.call.fn([cardStore, 'getCards'])
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
      .provide([[matchers.call.fn(cardStore.getCards), newCards]])
      .withState(state)
      .call([cardStore, 'getCards'], { limit: 1, type: 'new' })
      .not.call.fn([cardStore, 'getCards'])
      .put.like({ action: { type: 'REVIEW_LOADED', cards: newCards } })
      .run();
  });
});

describe('sagas:review updateProgress', () => {
  /*
  const cardStore = {
    updateProgress: () => {},
  };
  */

  it('updates the progress of a failed card', async () => {
    // TODO
  });
});
