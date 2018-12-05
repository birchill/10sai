/* global describe, it, expect */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga, ExpectApiEffects } from 'redux-saga-test-plan';
import * as matchers from 'redux-saga-test-plan/matchers';

import {
  loadReview as loadReviewSaga,
  updateHeap as updateHeapSaga,
  updateProgress as updateProgressSaga,
} from './sagas';
import * as reviewActions from './actions';
import reducer from '../reducer';
import { Card } from '../model';
import { ReviewState } from './reducer';
import { EffectProviders } from 'redux-saga-test-plan/providers';
import { CallEffectDescriptor } from 'redux-saga/effects';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface State {
  review: ReviewState;
}

describe('sagas:review updateHeap', () => {
  const dataStore = {
    getCards: () => {},
    putReview: () => {},
  };

  const getDataStoreProvider = (
    newCards: Array<string>,
    overdueCards: Array<string>
  ): EffectProviders => {
    return {
      call(effect: CallEffectDescriptor, next: () => Object) {
        if (effect.fn === dataStore.getCards) {
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

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider(newCards, overdueCards))
      .withState(reducer(undefined, action))
      .call([dataStore, 'getCards'], { limit: 2, type: 'new' })
      .call([dataStore, 'getCards'], { limit: 1, type: 'overdue' })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: allCards } })
      .run();
  });

  it('does not request more than the maximum number of cards even if the new card limit is greater', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const action = reviewActions.newReview(3, 2);

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide([[matchers.call.fn(dataStore.getCards), newCards]])
      .withState(reducer(undefined, action))
      .call([dataStore, 'getCards'], { limit: 2, type: 'new' })
      .not.call.fn(dataStore.getCards)
      .put.like({ action: { type: 'REVIEW_LOADED', cards: newCards } })
      .run();
  });

  it('requests more cards if the are not enough new cards', async () => {
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const action = reviewActions.newReview(2, 3);

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider([], overdueCards))
      .withState(reducer(undefined, action))
      .call([dataStore, 'getCards'], { limit: 2, type: 'new' })
      .call([dataStore, 'getCards'], { limit: 3, type: 'overdue' })
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

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider(newCards, overdueCards))
      .withState(state)
      .call([dataStore, 'getCards'], { limit: 1, type: 'new' })
      .call([dataStore, 'getCards'], {
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

    return expectSaga(updateHeapSaga, dataStore, action)
      .withState(state)
      .not.call.fn(dataStore.getCards)
      .not.call.fn(dataStore.getCards)
      .put.like({ action: { type: 'REVIEW_LOADED', cards: [] } })
      .run();
  });

  it('respects the limits set for an updated review even when there are no slots left', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));
    const action = reviewActions.setReviewLimit(1, 2);
    state = reducer(state, action);
    state.review.newCardsInPlay = 2;
    state.review.completed = 2;

    return expectSaga(updateHeapSaga, dataStore, action)
      .withState(state)
      .not.call.fn(dataStore.getCards)
      .not.call.fn(dataStore.getCards)
      .put.like({ action: { type: 'REVIEW_LOADED', cards: [] } })
      .run();
  });

  it('skips failed cards when updating due to a change in review time', async () => {
    let state = reducer(undefined, reviewActions.newReview(0, 3));
    const action = reviewActions.setReviewTime(new Date());
    state = reducer(state, action);
    state.review.completed = 2;

    const overdueCards = ['Overdue card 3', 'Overdue card 4'];

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider([], overdueCards))
      .withState(state)
      .call([dataStore, 'getCards'], {
        limit: 1,
        type: 'overdue',
        skipFailedCards: true,
      })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: overdueCards } })
      .run();
  });

  it('does not put review loaded due to a change in review time if we are not reviewing', async () => {
    const state = reducer(undefined, { type: 'NOTHING' });
    const action = reviewActions.setReviewTime(new Date());

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider([], []))
      .withState(state)
      .not.put.like({ action: { type: 'REVIEW_LOADED' } })
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

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide([[matchers.call.fn(dataStore.getCards), newCards]])
      .withState(state)
      .call([dataStore, 'getCards'], { limit: 1, type: 'new' })
      .not.call.fn(dataStore.getCards)
      .put.like({ action: { type: 'REVIEW_LOADED', cards: newCards } })
      .run();
  });

  it('saves the review state', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const action = reviewActions.newReview(2, 3);
    const initialState = reducer(undefined, action);

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider(newCards, overdueCards))
      .withState(initialState)
      .call.fn(dataStore.getCards)
      .call.fn(dataStore.getCards)
      .call([dataStore, 'putReview'], {
        reviewTime: initialState.review.reviewTime,
        maxCards: 3,
        maxNewCards: 2,
        completed: 0,
        newCardsCompleted: 0,
        history: [],
        failedCardsLevel1: [],
        failedCardsLevel2: [],
      })
      .run();
  });
});

describe('sagas:review updateProgress', () => {
  const dataStore = {
    putCard: (card: Partial<Card>) => card,
    putReview: () => {},
    deleteReview: () => {},
  };

  const getCards = (
    maxNewCards: number,
    maxExistingCards: number,
    reviewTime: Date
  ) => {
    const cards = new Array(Math.max(maxNewCards, maxExistingCards));
    for (let i = 0; i < cards.length; i++) {
      const newCard = i < maxNewCards;
      cards[i] = {
        _id: i,
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
        progress: {
          level: newCard ? 0 : 1,
          reviewed: newCard
            ? null
            : new Date(reviewTime.getTime() - 3 * MS_PER_DAY),
        },
      };
    }
    return cards;
  };

  const reviewLoaded = (
    cards: Array<Card>,
    currentCardSeed: number,
    nextCardSeed: number
  ) => {
    const action = reviewActions.reviewLoaded(cards);
    action.currentCardSeed = currentCardSeed;
    action.nextCardSeed = nextCardSeed;
    return action;
  };

  const passCard = (seed: number) => {
    const action = reviewActions.passCard();
    action.nextCardSeed = seed;
    return action;
  };

  const failCard = (seed: number) => {
    const action = reviewActions.failCard();
    action.nextCardSeed = seed;
    return action;
  };

  const cardInHistory = (card: Card, state: State) => {
    const { history } = state.review;
    return history.some(
      elem => elem.question === card.question && elem.answer === card.answer
    );
  };

  it('stores the updated review time of a passed card', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));

    const cards = getCards(0, 3, state.review.reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.passCard();
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: {
          level: cardToUpdate.progress.level,
          reviewed: state.review.reviewTime,
        },
      })
      .run();
  });

  it('stores the updated progress of a failed card', async () => {
    let state = reducer(undefined, reviewActions.newReview(1, 3));

    const cards = getCards(0, 3, state.review.reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.failCard();
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: { level: 0, reviewed: state.review.reviewTime },
      })
      .run();
  });

  it('stores the updated progress of a passed card when it is the last card', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));

    const cards = getCards(0, 1, state.review.reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.passCard();
    state = reducer(state, action);
    expect(state.review.nextCard).toBe(null);
    expect(state.review.currentCard).toBe(null);
    expect(cardInHistory(cardToUpdate, state)).toBe(true);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: {
          level: cardToUpdate.progress.level,
          reviewed: state.review.reviewTime,
        },
      })
      .run();
  });

  it('stores the updated progress of a failed card when it is the last card', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));

    const cards = getCards(0, 2, state.review.reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    // Pass the first card so it is in history
    state = reducer(state, reviewActions.passCard());

    // Now we should have a single card left that we want to fail.
    // We want to check we update it despite the fact that it won't go into
    // history yet.
    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.failCard();
    state = reducer(state, action);
    expect(state.review.nextCard).toBe(null);
    expect(state.review.currentCard).toEqual(cardToUpdate);
    expect(cardInHistory(cardToUpdate, state)).toBe(false);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: { level: 0, reviewed: state.review.reviewTime },
      })
      .run();
  });

  it('stores the updated review when the progress changes', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));

    const cards = getCards(1, 3, state.review.reviewTime);
    state = reducer(state, reviewLoaded(cards, 0, 0));

    state = reducer(state, passCard(0));
    state = reducer(state, passCard(0));

    const action = failCard(0);
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putReview'], {
        reviewTime: state.review.reviewTime,
        maxCards: 3,
        maxNewCards: 2,
        completed: 2,
        newCardsCompleted: 1,
        history: [0, 1],
        failedCardsLevel1: [],
        failedCardsLevel2: [2],
      })
      .run();
  });

  it('deletes the review when the review is finished', async () => {
    let state = reducer(undefined, reviewActions.newReview(1, 1));

    const cards = getCards(1, 1, state.review.reviewTime);
    state = reducer(state, reviewLoaded(cards, 0, 0));

    const action = passCard(0);
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'deleteReview'])
      .run();
  });
});

describe('sagas:review loadReview', () => {
  const dataStore = {
    reviewTime: new Date(),
    getCards: () => {},
    getCardsById: () => {},
  };

  const getDataStoreProvider = (
    cards: Array<Partial<Card>>
  ): EffectProviders => {
    return {
      call(effect, next) {
        if (effect.fn === dataStore.getCardsById) {
          const ids = effect.args[0];
          const result = [];
          for (const id of ids) {
            const card = cards.find(card => card._id === id);
            if (card) {
              result.push(card);
            }
          }
          return result;
        }

        if (effect.fn === dataStore.getCards) {
          expect(effect.args.length).toBeGreaterThanOrEqual(1);
          expect(effect.args[0].limit).toBeDefined();
          expect(typeof effect.args[0].limit).toBe('number');

          const { limit, type } = effect.args[0];

          const result = [];
          for (let i = 0; i < limit; i++) {
            if (type === 'new') {
              result.push({
                _id: `new-${i}`,
                question: `New question ${i + 1}`,
                answer: `New answer ${i + 1}`,
              });
            } else {
              result.push({
                _id: i,
                question: `Question ${i + 1}`,
                answer: `Answer ${i + 1}`,
              });
            }
          }
          return result;
        }

        return next();
      },
    };
  };

  it('fills in the cards when the review is synced', async () => {
    let state = reducer(undefined, { type: 'none' });

    const cards: Array<Partial<Card>> = [
      { _id: 'a', question: 'Question A', answer: 'Answer A' },
      { _id: 'b', question: 'Question B', answer: 'Answer B' },
      { _id: 'c', question: 'Question C', answer: 'Answer C' },
      { _id: 'd', question: 'Question D', answer: 'Answer D' },
    ];

    const action = reviewActions.loadReview({
      maxCards: 6,
      maxNewCards: 2,
      completed: 2,
      newCardsCompleted: 1,
      history: ['a', 'c'],
      failedCardsLevel1: ['b'],
      failedCardsLevel2: ['d'],
      reviewTime: dataStore.reviewTime,
    });
    state = reducer(state, action);

    return expectSaga(loadReviewSaga, dataStore, action)
      .provide(getDataStoreProvider(cards))
      .withState(state)
      .put.like({
        action: {
          type: 'REVIEW_LOADED',
          cards: [
            {
              _id: 'new-0',
              question: 'New question 1',
              answer: 'New answer 1',
            },
            {
              _id: 0,
              question: 'Question 1',
              answer: 'Answer 1',
            },
          ],
          history: [
            { _id: 'a', question: 'Question A', answer: 'Answer A' },
            { _id: 'c', question: 'Question C', answer: 'Answer C' },
          ],
          failedCardsLevel1: [
            { _id: 'b', question: 'Question B', answer: 'Answer B' },
          ],
          failedCardsLevel2: [
            { _id: 'd', question: 'Question D', answer: 'Answer D' },
          ],
        },
      })
      .run();
  });
});
