import { expectSaga } from 'redux-saga-test-plan';
import { EffectProviders } from 'redux-saga-test-plan/providers';
import { CallEffectDescriptor } from 'redux-saga/effects';

import * as Actions from '../actions';
import { Card, ReviewCardStatus } from '../model';
import { reducer } from '../reducer';
import { DataStore } from '../store/DataStore';
import { MS_PER_DAY } from '../utils/constants';

import { AvailableCardWatcher } from './available-card-watcher';
import {
  loadReview as loadReviewSaga,
  newReview as newReviewSaga,
  updateProgress as updateProgressSaga,
} from './sagas';

describe('sagas:review newReview', () => {
  const dataStore = ({
    getCardsById: () => {},
    putReview: () => {},
  } as unknown) as DataStore;

  const availableCardWatcher = ({
    getNewCards: () => {},
    getOverdueCards: () => {},
  } as unknown) as AvailableCardWatcher;

  const getCardProvider = (
    newCards: Array<string>,
    overdueCards: Array<string>
  ): EffectProviders => {
    const newCardsWithIds: Array<[
      string,
      string
    ]> = newCards.map((front, i) => [`new-${i + 1}`, front]);
    const overdueCardsWithIds: Array<[
      string,
      string
    ]> = overdueCards.map((front, i) => [`overdue-${i + 1}`, front]);
    const idMap = new Map<string, string>([
      ...newCardsWithIds,
      ...overdueCardsWithIds,
    ]);

    return {
      call(effect: CallEffectDescriptor<any>, next: () => Object) {
        if (effect.fn === dataStore.getCardsById) {
          const ids = effect.args[0];
          const result = [];
          for (const id of ids) {
            if (idMap.has(id)) {
              result.push(idMap.get(id));
            }
          }
          return result;
        }

        if (effect.fn === availableCardWatcher.getNewCards) {
          return newCardsWithIds.map(item => item[0]);
        }

        if (effect.fn === availableCardWatcher.getOverdueCards) {
          return overdueCardsWithIds.map(item => item[0]);
        }

        return next();
      },
    };
  };

  it('respects the limits set for a new review', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const allCards = newCards.concat(overdueCards);
    const action = Actions.newReview({ maxNewCards: 2, maxCards: 3 });

    return expectSaga(newReviewSaga, dataStore, availableCardWatcher)
      .provide(getCardProvider(newCards, overdueCards))
      .withState(reducer(undefined, action))
      .call.fn(availableCardWatcher.getNewCards)
      .call([dataStore, 'getCardsById'], ['new-1', 'new-2'])
      .call.fn(availableCardWatcher.getOverdueCards)
      .call([dataStore, 'getCardsById'], ['overdue-1'])
      .put.like({
        action: {
          type: 'REVIEW_CARDS_LOADED',
          history: [],
          unreviewed: allCards.slice(0, 3),
        },
      })
      .run();
  });

  it('does not request more than the maximum number of cards even if the new card limit is greater', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const action = Actions.newReview({ maxNewCards: 3, maxCards: 2 });

    return expectSaga(newReviewSaga, dataStore, availableCardWatcher)
      .provide(getCardProvider(newCards, []))
      .withState(reducer(undefined, action))
      .call([availableCardWatcher, 'getNewCards'])
      .call([dataStore, 'getCardsById'], ['new-1', 'new-2'])
      .not.call([availableCardWatcher, 'getOverdueCards'])
      .put.like({
        action: {
          type: 'REVIEW_CARDS_LOADED',
          history: [],
          unreviewed: newCards,
        },
      })
      .run();
  });

  it('requests more cards if there are not enough new cards', async () => {
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const action = Actions.newReview({ maxNewCards: 2, maxCards: 3 });

    return expectSaga(newReviewSaga, dataStore, availableCardWatcher)
      .provide(getCardProvider([], overdueCards))
      .withState(reducer(undefined, action))
      .call([availableCardWatcher, 'getNewCards'])
      .not.call([dataStore, 'getCardsById'])
      .call([availableCardWatcher, 'getOverdueCards'])
      .call(
        [dataStore, 'getCardsById'],
        ['overdue-1', 'overdue-2', 'overdue-3']
      )
      .put.like({
        action: {
          type: 'REVIEW_CARDS_LOADED',
          history: [],
          unreviewed: overdueCards,
        },
      })
      .run();
  });

  it('saves the review state', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const action = Actions.newReview({ maxNewCards: 2, maxCards: 3 });
    const initialState = reducer(undefined, action);

    return expectSaga(newReviewSaga, dataStore, availableCardWatcher)
      .provide(getCardProvider(newCards, overdueCards))
      .withState(initialState)
      .call.fn(availableCardWatcher.getNewCards)
      .call.fn(availableCardWatcher.getOverdueCards)
      .call([dataStore, 'putReview'], {
        maxCards: 3,
        maxNewCards: 2,
        history: [],
      })
      .run();
  });
});

describe('sagas:review loadReview', () => {
  const dataStore = ({
    getCardsById: () => {},
    putReview: () => {},
  } as unknown) as DataStore;

  const availableCardWatcher = ({
    getNewCards: () => {},
    getOverdueCards: () => {},
  } as unknown) as AvailableCardWatcher;

  const getCardProvider = (cards: Array<Partial<Card>>): EffectProviders => {
    return {
      call(effect, next) {
        if (effect.fn === dataStore.getCardsById) {
          const ids = effect.args[0];
          const result = [];
          for (const id of ids) {
            const card = cards.find(card => card.id === id);
            if (card) {
              result.push(card);
            } else if (id.startsWith('new-')) {
              const newId = parseInt(id.substr('new-'.length), 10);
              result.push({
                id: `new-${newId}`,
                front: `New question ${newId + 1}`,
                back: `New answer ${newId + 1}`,
              });
            } else if (!isNaN(id)) {
              const thisId = parseInt(id, 10);
              result.push({
                id,
                front: `Question ${thisId + 1}`,
                back: `Answer ${thisId + 1}`,
              });
            }
          }
          return result;
        }

        if (
          effect.fn === availableCardWatcher.getNewCards ||
          effect.fn === availableCardWatcher.getOverdueCards
        ) {
          const result = [];

          if (effect.fn === availableCardWatcher.getNewCards) {
            for (let i = 0; i < 5; i++) {
              result.push(`new-${i}`);
            }
          } else {
            for (let i = 0; i < 5; i++) {
              result.push(String(i));
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

    const later = new Date(Date.now() + 2 * MS_PER_DAY);
    const action = Actions.loadReview({
      review: {
        maxCards: 6,
        maxNewCards: 2,
        history: [
          { id: 'a', status: ReviewCardStatus.Passed },
          {
            id: 'b',
            status: ReviewCardStatus.Failed,
            previousProgress: { level: 2, due: later },
          },
          {
            id: 'c',
            status: ReviewCardStatus.Passed,
            previousProgress: { level: 2, due: later },
          },
          {
            id: 'd',
            status: ReviewCardStatus.Failed,
            previousProgress: { level: 2, due: later },
          },
        ],
      },
    });
    state = reducer(state, action);

    return expectSaga(loadReviewSaga, dataStore, availableCardWatcher, action)
      .provide(getCardProvider(cards))
      .withState(state)
      .put.like({
        action: {
          type: 'REVIEW_CARDS_LOADED',
          history: [
            {
              card: { id: 'a', front: 'Question A', back: 'Answer A' },
              status: 'passed',
            },
            {
              card: { id: 'b', front: 'Question B', back: 'Answer B' },
              status: 'failed',
              previousProgress: { level: 2, due: later },
            },
            {
              card: { id: 'c', front: 'Question C', back: 'Answer C' },
              status: 'passed',
              previousProgress: { level: 2, due: later },
            },
            {
              card: { id: 'd', front: 'Question D', back: 'Answer D' },
              status: 'failed',
              previousProgress: { level: 2, due: later },
            },
          ],
          unreviewed: [
            {
              id: 'new-0',
              front: 'New question 1',
              back: 'New answer 1',
            },
            {
              id: '0',
              front: 'Question 1',
              back: 'Answer 1',
            },
          ],
        },
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

  it('stores the updated due time of a passed card', async () => {
    let state = reducer(
      undefined,
      Actions.newReview({ maxNewCards: 2, maxCards: 3 })
    );

    const cards = getCards(0, 3, new Date());
    state = reducer(
      state,
      Actions.reviewCardsLoaded({ history: [], unreviewed: cards })
    );

    const updatePosition = state.review.position!;
    const action = Actions.passCard();
    state = reducer(state, action);

    const updatedCard = state.review.queue[updatePosition].card as Card;

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        id: updatedCard.id,
        progress: {
          level: updatedCard.progress.level,
          due: updatedCard.progress.due,
        },
      })
      .run();
  });

  it('stores the updated progress of a failed card', async () => {
    let state = reducer(
      undefined,
      Actions.newReview({ maxNewCards: 1, maxCards: 3 })
    );

    const cards = getCards(0, 3, new Date());
    state = reducer(
      state,
      Actions.reviewCardsLoaded({ history: [], unreviewed: cards })
    );

    const updatePosition = state.review.position!;
    const action = Actions.failCard();
    state = reducer(state, action);

    const updatedCard = state.review.queue[updatePosition].card as Card;

    const due = new Date(action.reviewTime);
    due.setMinutes(0, 0, 0);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        id: updatedCard.id,
        progress: { level: 0, due },
      })
      .run();
  });

  it('stores the updated progress of a passed card when it is the last card', async () => {
    let state = reducer(
      undefined,
      Actions.newReview({ maxNewCards: 2, maxCards: 3 })
    );

    const cards = getCards(0, 1, new Date());
    state = reducer(
      state,
      Actions.reviewCardsLoaded({ history: [], unreviewed: cards })
    );

    const updatePosition = state.review.position!;
    const action = Actions.passCard();
    state = reducer(state, action);

    const updatedCard = state.review.queue[updatePosition].card as Card;

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        id: updatedCard.id,
        progress: {
          level: updatedCard.progress.level,
          due: updatedCard.progress.due,
        },
      })
      .run();
  });

  it('stores the updated progress of a failed card when it is the last card', async () => {
    let state = reducer(
      undefined,
      Actions.newReview({ maxNewCards: 2, maxCards: 3 })
    );

    const cards = getCards(0, 2, new Date());
    state = reducer(
      state,
      Actions.reviewCardsLoaded({ history: [], unreviewed: cards })
    );

    // Pass the first card so it is in history
    state = reducer(state, Actions.passCard());

    // Now we should have a single card left that we want to fail.
    const updatePosition = state.review.position!;
    const action = Actions.failCard();
    state = reducer(state, action);

    const updatedCard = state.review.queue[updatePosition].card as Card;

    const due = new Date(action.reviewTime);
    due.setMinutes(0, 0, 0);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putCard'], {
        id: updatedCard.id,
        progress: { level: 0, due },
      })
      .run();
  });

  it('stores the updated review when the progress changes', async () => {
    let state = reducer(
      undefined,
      Actions.newReview({ maxNewCards: 2, maxCards: 3 })
    );

    const cards = getCards(1, 3, new Date());
    state = reducer(
      state,
      Actions.reviewCardsLoaded({ history: [], unreviewed: cards })
    );

    state = reducer(state, Actions.passCard());
    state = reducer(state, Actions.passCard());

    const action = Actions.failCard();
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'putReview'], {
        maxCards: 3,
        maxNewCards: 2,
        history: [
          { id: cards[0].id, status: ReviewCardStatus.Passed },
          {
            id: cards[1].id,
            status: ReviewCardStatus.Passed,
            previousProgress: cards[1].progress,
          },
          {
            id: cards[2].id,
            status: ReviewCardStatus.Failed,
            previousProgress: cards[2].progress,
          },
        ],
      })
      .run();
  });

  it('deletes the review when the review is finished', async () => {
    let state = reducer(
      undefined,
      Actions.newReview({ maxNewCards: 1, maxCards: 1 })
    );

    const cards = getCards(1, 1, new Date());
    state = reducer(
      state,
      Actions.reviewCardsLoaded({ history: [], unreviewed: cards })
    );

    const action = Actions.passCard();
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, dataStore, action)
      .withState(state)
      .call([dataStore, 'finishReview'])
      .run();
  });
});
