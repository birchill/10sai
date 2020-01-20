import { expectSaga } from 'redux-saga-test-plan';
import * as matchers from 'redux-saga-test-plan/matchers';

import {
  loadReview as loadReviewSaga,
  updateHeap as updateHeapSaga,
  updateProgress as updateProgressSaga,
} from './sagas';
import * as Actions from '../actions';
import { reducer } from '../reducer';
import { Card } from '../model';
import { AppState } from '../reducer';
import { DataStore } from '../store/DataStore';
import { EffectProviders } from 'redux-saga-test-plan/providers';
import { CallEffectDescriptor } from 'redux-saga/effects';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

describe('sagas:review updateHeap', () => {
  const dataStore = ({
    getOverdueCards: () => {},
    getNewCards: () => {},
    putReview: () => {},
  } as unknown) as DataStore;

  const getDataStoreProvider = (
    newCards: Array<string>,
    overdueCards: Array<string>
  ): EffectProviders => {
    return {
      call(effect: CallEffectDescriptor<any>, next: () => Object) {
        if (effect.fn === dataStore.getNewCards) {
          return newCards;
        }

        if (effect.fn === dataStore.getOverdueCards) {
          return overdueCards;
        }

        return next();
      },
    };
  };

  it('respects the limits set for a new review', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const allCards = newCards.concat(overdueCards);
    const action = Actions.newReview(2, 3);

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider(newCards, overdueCards))
      .withState(reducer(undefined, action))
      .call([dataStore, 'getNewCards'], { limit: 2 })
      .call([dataStore, 'getOverdueCards'], {
        limit: 1,
        skipFailedCards: false,
      })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: allCards } })
      .run();
  });

  it('does not request more than the maximum number of cards even if the new card limit is greater', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const action = Actions.newReview(3, 2);

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide([[matchers.call.fn(dataStore.getNewCards), newCards]])
      .withState(reducer(undefined, action))
      .call([dataStore, 'getNewCards'], { limit: 2 })
      .not.call.fn(dataStore.getCards)
      .put.like({ action: { type: 'REVIEW_LOADED', cards: newCards } })
      .run();
  });

  it('requests more cards if there are not enough new cards', async () => {
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const action = Actions.newReview(2, 3);

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider([], overdueCards))
      .withState(reducer(undefined, action))
      .call([dataStore, 'getNewCards'], { limit: 2 })
      .call([dataStore, 'getOverdueCards'], {
        limit: 3,
        skipFailedCards: false,
      })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: overdueCards } })
      .run();
  });

  it('respects the limits set for an updated review', async () => {
    let state = reducer(undefined, Actions.newReview(2, 3));
    const action = Actions.setReviewLimit(3, 5);
    state = reducer(state, action);
    state.review.newCardsInPlay = 2;
    state.review.completed = 2;

    const newCards = ['New card 3'];
    const overdueCards = ['Overdue card 3', 'Overdue card 4'];
    const allCards = newCards.concat(overdueCards);

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider(newCards, overdueCards))
      .withState(state)
      .call([dataStore, 'getNewCards'], { limit: 1 })
      .call([dataStore, 'getOverdueCards'], {
        limit: 2,
        skipFailedCards: true,
      })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: allCards } })
      .run();
  });

  it('respects the overall limit for an updated review', async () => {
    let state = reducer(undefined, Actions.newReview(2, 3));
    const action = Actions.setReviewLimit(2, 3);
    state = reducer(state, action);
    state.review.newCardsInPlay = 1;
    state.review.completed = 2;
    state.review.failed = [{} as Card];

    return expectSaga(updateHeapSaga, dataStore, action)
      .withState(state)
      .not.call.fn(dataStore.getNewCards)
      .not.call.fn(dataStore.getOverdueCards)
      .put.like({ action: { type: 'REVIEW_LOADED', cards: [] } })
      .run();
  });

  it('respects the limits set for an updated review even when there are no slots left', async () => {
    let state = reducer(undefined, Actions.newReview(2, 3));
    const action = Actions.setReviewLimit(1, 2);
    state = reducer(state, action);
    state.review.newCardsInPlay = 2;
    state.review.completed = 2;

    return expectSaga(updateHeapSaga, dataStore, action)
      .withState(state)
      .not.call.fn(dataStore.getNewCards)
      .not.call.fn(dataStore.getOverdueCards)
      .put.like({ action: { type: 'REVIEW_LOADED', cards: [] } })
      .run();
  });

  it('skips failed cards when updating due to a change in review time', async () => {
    let state = reducer(undefined, Actions.newReview(0, 3));
    const action = Actions.setReviewTime(new Date());
    state = reducer(state, action);
    state.review.completed = 2;

    const overdueCards = ['Overdue card 3', 'Overdue card 4'];

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider([], overdueCards))
      .withState(state)
      .call([dataStore, 'getOverdueCards'], {
        limit: 1,
        skipFailedCards: true,
      })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: overdueCards } })
      .run();
  });

  it('does not put review loaded due to a change in review time if we are not reviewing', async () => {
    const state = reducer(undefined, { type: 'NOTHING' } as any);
    const action = Actions.setReviewTime(new Date());

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider([], []))
      .withState(state)
      .not.put.like({ action: { type: 'REVIEW_LOADED' } })
      .run();
  });

  it('counts the current card as an occupied slot', async () => {
    let state = reducer(undefined, Actions.newReview(2, 3));
    const action = Actions.setReviewLimit(3, 4);
    state = reducer(state, action);
    state.review.newCardsInPlay = 2;
    state.review.completed = 2;
    state.review.currentCard = {} as Card;

    const newCards = ['New card 3'];

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide([[matchers.call.fn(dataStore.getNewCards), newCards]])
      .withState(state)
      .call([dataStore, 'getNewCards'], { limit: 1 })
      .not.call.fn(dataStore.getCards)
      .put.like({ action: { type: 'REVIEW_LOADED', cards: newCards } })
      .run();
  });

  it('saves the review state', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const action = Actions.newReview(2, 3);
    const initialState = reducer(undefined, action);

    return expectSaga(updateHeapSaga, dataStore, action)
      .provide(getDataStoreProvider(newCards, overdueCards))
      .withState(initialState)
      .call.fn(dataStore.getNewCards)
      .call.fn(dataStore.getOverdueCards)
      .call([dataStore, 'putReview'], {
        reviewTime: initialState.review.reviewTime,
        maxCards: 3,
        maxNewCards: 2,
        completed: 0,
        newCardsCompleted: 0,
        history: [],
        failed: [],
      })
      .run();
  });
});

describe('sagas:review updateProgress', () => {
  const dataStore = ({
    putCard: (card: Partial<Card>) => card,
    putReview: () => {},
    finishReview: () => {},
  } as unknown) as DataStore;

  const getCards = (
    maxNewCards: number,
    maxExistingCards: number,
    reviewTime: Date
  ) => {
    const cards = new Array(Math.max(maxNewCards, maxExistingCards));
    for (let i = 0; i < cards.length; i++) {
      const newCard = i < maxNewCards;
      cards[i] = {
        id: i,
        front: `Question ${i + 1}`,
        back: `Answer ${i + 1}`,
        progress: {
          level: newCard ? 0 : 1,
          due: newCard ? null : new Date(reviewTime.getTime() - 2 * MS_PER_DAY),
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
    const action = Actions.reviewLoaded(cards);
    action.currentCardSeed = currentCardSeed;
    action.nextCardSeed = nextCardSeed;
    return action;
  };

  const passCard = (seed: number) => {
    const action = Actions.passCard();
    action.nextCardSeed = seed;
    return action;
  };

  const failCard = (seed: number) => {
    const action = Actions.failCard();
    action.nextCardSeed = seed;
    return action;
  };

  const cardInHistory = (card: Card, state: AppState) => {
    const { history } = state.review;
    return history.some(
      elem => elem.front === card.front && elem.back === card.back
    );
  };

  it('stores the updated review time of a passed card', async () => {
    let state = reducer(undefined, Actions.newReview(2, 3));

    const cards = getCards(0, 3, state.review.reviewTime);
    state = reducer(state, Actions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = Actions.passCard();
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        id: cardToUpdate!.id,
        progress: {
          level: cardToUpdate!.progress.level,
          due: new Date(
            state.review.reviewTime.getTime() +
              cardToUpdate!.progress.level * MS_PER_DAY
          ),
        },
      })
      .run();
  });

  it('stores the updated progress of a failed card', async () => {
    let state = reducer(undefined, Actions.newReview(1, 3));

    const cards = getCards(0, 3, state.review.reviewTime);
    state = reducer(state, Actions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = Actions.failCard();
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        id: cardToUpdate!.id,
        progress: { level: 0, due: state.review.reviewTime },
      })
      .run();
  });

  it('stores the updated progress of a passed card when it is the last card', async () => {
    let state = reducer(undefined, Actions.newReview(2, 3));

    const cards = getCards(0, 1, state.review.reviewTime);
    state = reducer(state, Actions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = Actions.passCard();
    state = reducer(state, action);
    expect(state.review.nextCard).toBe(null);
    expect(state.review.currentCard).toBe(null);
    expect(cardInHistory(cardToUpdate!, state)).toBe(true);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        id: cardToUpdate!.id,
        progress: {
          level: cardToUpdate!.progress.level,
          due: new Date(
            state.review.reviewTime.getTime() +
              cardToUpdate!.progress.level * MS_PER_DAY
          ),
        },
      })
      .run();
  });

  it('stores the updated progress of a failed card when it is the last card', async () => {
    let state = reducer(undefined, Actions.newReview(2, 3));

    const cards = getCards(0, 2, state.review.reviewTime);
    state = reducer(state, Actions.reviewLoaded(cards));

    // Pass the first card so it is in history
    state = reducer(state, Actions.passCard());

    // Now we should have a single card left that we want to fail.
    // We want to check we update it despite the fact that it won't go into
    // history yet.
    const cardToUpdate = state.review.currentCard;
    const action = Actions.failCard();
    state = reducer(state, action);
    expect(state.review.nextCard).toBe(null);
    expect(state.review.currentCard).toEqual(cardToUpdate);
    expect(cardInHistory(cardToUpdate!, state)).toBe(false);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        id: cardToUpdate!.id,
        progress: { level: 0, due: state.review.reviewTime },
      })
      .run();
  });

  it('stores the updated review when the progress changes', async () => {
    let state = reducer(undefined, Actions.newReview(2, 3));

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
        failed: [2],
      })
      .run();
  });

  it('deletes the review when the review is finished', async () => {
    let state = reducer(undefined, Actions.newReview(1, 1));

    const cards = getCards(1, 1, state.review.reviewTime);
    state = reducer(state, reviewLoaded(cards, 0, 0));

    const action = passCard(0);
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'finishReview'])
      .run();
  });
});

describe('sagas:review loadReview', () => {
  const dataStore = ({
    reviewTime: new Date(),
    getNewCards: () => {},
    getOverdueCards: () => {},
    getCardsById: () => {},
  } as unknown) as DataStore;

  const getDataStoreProvider = (
    cards: Array<Partial<Card>>
  ): EffectProviders => {
    return {
      call(effect, next) {
        if (effect.fn === dataStore.getCardsById) {
          const ids = effect.args[0];
          const result = [];
          for (const id of ids) {
            const card = cards.find(card => card.id === id);
            if (card) {
              result.push(card);
            }
          }
          return result;
        }

        if (
          effect.fn === dataStore.getNewCards ||
          effect.fn === dataStore.getOverdueCards
        ) {
          expect(effect.args.length).toBeGreaterThanOrEqual(1);
          expect(effect.args[0].limit).toBeDefined();
          expect(typeof effect.args[0].limit).toBe('number');

          const { limit } = effect.args[0];
          const result = [];

          if (effect.fn === dataStore.getNewCards) {
            for (let i = 0; i < limit; i++) {
              result.push({
                id: `new-${i}`,
                front: `New question ${i + 1}`,
                back: `New answer ${i + 1}`,
              });
            }
          } else {
            for (let i = 0; i < limit; i++) {
              result.push({
                id: i,
                front: `Question ${i + 1}`,
                back: `Answer ${i + 1}`,
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
    let state = reducer(undefined, { type: 'none' } as any);

    const cards: Array<Partial<Card>> = [
      { id: 'a', front: 'Question A', back: 'Answer A' },
      { id: 'b', front: 'Question B', back: 'Answer B' },
      { id: 'c', front: 'Question C', back: 'Answer C' },
      { id: 'd', front: 'Question D', back: 'Answer D' },
    ];

    const action = Actions.loadReview({
      maxCards: 6,
      maxNewCards: 2,
      completed: 2,
      newCardsCompleted: 1,
      history: ['a', 'c'],
      failed: ['b', 'd'],
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
              id: 'new-0',
              front: 'New question 1',
              back: 'New answer 1',
            },
            {
              id: 0,
              front: 'Question 1',
              back: 'Answer 1',
            },
          ],
          history: [
            { id: 'a', front: 'Question A', back: 'Answer A' },
            { id: 'c', front: 'Question C', back: 'Answer C' },
          ],
          failed: [
            { id: 'b', front: 'Question B', back: 'Answer B' },
            { id: 'd', front: 'Question D', back: 'Answer D' },
          ],
        },
      })
      .run();
  });
});
