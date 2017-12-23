/* global describe, it */
/* eslint arrow-body-style: [ 'off' ] */

import { assert } from 'chai';
import { expectSaga } from 'redux-saga-test-plan';
import * as matchers from 'redux-saga-test-plan/matchers';

import {
  updateHeap as updateHeapSaga,
  updateProgress as updateProgressSaga,
} from '../../src/sagas/review';
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
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const getCards = (maxNewCards, maxExistingCards, reviewTime) => {
    const cards = new Array(Math.max(maxNewCards, maxExistingCards));
    for (let i = 0; i < cards.length; i++) {
      const newCard = i < maxNewCards;
      cards[i] = {
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
        progress: {
          level: newCard ? 0 : 1,
          reviewed: newCard ? null : new Date(reviewTime - 3 * MS_PER_DAY),
        },
      };
      if (!newCard) {
        cards[i]._id = i;
      }
    }
    return cards;
  };

  const cardInHistory = (card, state) => {
    const { history } = state.review;
    return history.some(
      elem => elem.question === card.question && elem.answer === card.answer
    );
  };

  it('stores the updated review time of a passed card', async () => {
    const reviewTime = new Date();
    let state = reducer(undefined, reviewActions.newReview(2, 3, reviewTime));

    const cards = getCards(0, 3, reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.passCard();
    state = reducer(state, action);

    const cardStore = { putCard: card => card };
    return expectSaga(updateProgressSaga, cardStore, action)
      .withState(state)
      .call([cardStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: { level: cardToUpdate.progress.level, reviewed: reviewTime },
      })
      .run();
  });

  it('stores the updated progress of a failed card', async () => {
    const reviewTime = new Date();
    let state = reducer(undefined, reviewActions.newReview(1, 3, reviewTime));

    const cards = getCards(0, 3, reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.failCard();
    state = reducer(state, action);

    const cardStore = { putCard: card => card };
    return expectSaga(updateProgressSaga, cardStore, action)
      .withState(state)
      .call([cardStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: { level: 0, reviewed: reviewTime },
      })
      .run();
  });

  it('stores the updated progress of a passed card when it is the last card', async () => {
    const reviewTime = new Date();
    let state = reducer(undefined, reviewActions.newReview(2, 3, reviewTime));

    const cards = getCards(0, 1, reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.passCard();
    state = reducer(state, action);
    assert.strictEqual(state.review.nextCard, null, 'Should have no next card');
    assert.strictEqual(
      state.review.currentCard,
      null,
      'Should have no current card'
    );
    assert.isTrue(
      cardInHistory(cardToUpdate, state),
      'Card to update is in history'
    );

    const cardStore = { putCard: card => card };
    return expectSaga(updateProgressSaga, cardStore, action)
      .withState(state)
      .call([cardStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: { level: cardToUpdate.progress.level, reviewed: reviewTime },
      })
      .run();
  });

  it('stores the updated progress of a failed card when it is the last card', async () => {
    const reviewTime = new Date();
    let state = reducer(undefined, reviewActions.newReview(2, 3, reviewTime));

    const cards = getCards(0, 2, reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    // Pass the first card so it is in history
    state = reducer(state, reviewActions.passCard());

    // Now we should have a single card left that we want to fail.
    // We want to check we update it despite the fact that it won't go into
    // history yet.
    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.failCard();
    state = reducer(state, action);
    assert.strictEqual(state.review.nextCard, null, 'Should have no next card');
    assert.deepEqual(
      state.review.currentCard,
      cardToUpdate,
      'Card to update is the current card'
    );
    assert.isFalse(
      cardInHistory(cardToUpdate, state),
      'Card to update is not in history'
    );

    const cardStore = { putCard: card => card };
    return expectSaga(updateProgressSaga, cardStore, action)
      .withState(state)
      .call([cardStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: { level: 0, reviewed: reviewTime },
      })
      .run();
  });
});
