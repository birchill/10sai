/* global beforeEach, describe, expect, it, jest */

import subject from './sync';
import { queryAvailableCards, updateReviewCard } from './actions';
import reducer, { ReviewState } from './reducer';
import { getReviewSummary } from './selectors';
import EventEmitter from 'event-emitter';
import ReviewPhase from './ReviewPhase';
import { Card } from '../model';

jest.useFakeTimers();

type ChangeCallback = (change: any) => void;

class MockDataStore {
  cbs: {
    [type: string]: ChangeCallback[];
  };
  changes: EventEmitter;

  constructor() {
    this.cbs = {};
    this.changes = {
      on: (type: string, cb: ChangeCallback) => {
        if (this.cbs[type]) {
          this.cbs[type].push(cb);
        } else {
          this.cbs[type] = [cb];
        }
      },
    } as EventEmitter;
  }

  __triggerChange(type, change) {
    if (!this.cbs[type]) {
      return;
    }

    for (const cb of this.cbs[type]) {
      cb(change);
    }
  }

  async getReview() {
    return null;
  }
}

// This is the simplified view of the State we use here.
interface State {
  screen: string;
  review: ReviewState;
}

const initialReviewState = reducer(undefined, { type: 'NONE' } as any);

class MockStore {
  cb?: () => void;
  state: State;
  actions: any[];

  constructor() {
    this.state = {
      screen: '',
      review: initialReviewState,
    };
    this.actions = [];
  }

  subscribe(cb) {
    this.cb = cb;
  }

  dispatch(action) {
    this.actions.push(action);
  }

  getState() {
    return this.state;
  }

  __update(newState) {
    this.state = newState;

    if (this.cb) {
      this.cb();
    }
  }
}

// Mock selectors from other modules we depend on
jest.mock('../route/selectors', () => ({
  getScreen: state => state.screen,
}));

describe('review:sync', () => {
  let dataStore;
  let store;

  beforeEach(() => {
    dataStore = new MockDataStore();
    store = new MockStore();

    // I couldn't work out how to get jest.MockImplementation to work for
    // this and ultimately I figured it's not worth the time.
    (setTimeout as any).mockClear();
    (clearTimeout as any).mockClear();
  });

  describe('available cards', () => {
    it('triggers an update immediately when cards are needed and there are none', () => {
      subject(dataStore, store);
      store.__update({
        screen: 'review',
        review: initialReviewState,
      });

      expect(store.actions).toEqual([queryAvailableCards()]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('triggers an update immediately when cards are newly-needed due to a state change, even if there are some', () => {
      subject(dataStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          availableCards: { newCards: 2, overdueCards: 3 },
        },
      });

      expect(store.actions).toEqual([queryAvailableCards()]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('triggers a delayed update when a card is added', () => {
      subject(dataStore, store);
      store.__update({
        screen: 'review',
        review: initialReviewState,
      });
      expect(store.actions).toEqual([queryAvailableCards()]);
      expect(setTimeout).toHaveBeenCalledTimes(0);

      dataStore.__triggerChange('card', {});

      expect(setTimeout).toHaveBeenCalledTimes(1);

      jest.runAllTimers();
      expect(store.actions).toEqual([
        queryAvailableCards(),
        queryAvailableCards(),
      ]);
    });

    it('cancels a delayed update when cards are needed immediately', () => {
      subject(dataStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          availableCards: { newCards: 2, overdueCards: 3 },
        },
      });
      expect(store.actions).toEqual([queryAvailableCards()]);

      // Trigger a delayed update
      dataStore.__triggerChange('card', {});
      expect(setTimeout).toHaveBeenCalledTimes(1);

      // Then trigger an immediate update
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          availableCards: undefined,
        },
      });
      expect(clearTimeout).toHaveBeenCalledTimes(1);
      expect(store.actions).toEqual([
        queryAvailableCards(),
        queryAvailableCards(),
      ]);
    });

    it('cancels a delayed update when cards are no longer needed', () => {
      subject(dataStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          availableCards: { newCards: 2, overdueCards: 3 },
        },
      });
      expect(store.actions).toEqual([queryAvailableCards()]);

      // Trigger a delayed update
      dataStore.__triggerChange('card', {});
      expect(setTimeout).toHaveBeenCalledTimes(1);

      // Then change screen
      store.__update({
        screen: 'home',
        review: initialReviewState,
      });
      expect(clearTimeout).toHaveBeenCalledTimes(1);
      expect(store.actions).toEqual([queryAvailableCards()]);
    });

    it('does NOT trigger an update when cards are already being loaded', () => {
      subject(dataStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          loadingAvailableCards: true,
        },
      });

      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('does NOT trigger an update when the progress is being saved', () => {
      subject(dataStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          savingProgress: true,
        },
      });

      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('does NOT trigger an update when a card is added when not in an appropriate state', () => {
      subject(dataStore, store);
      store.__update({
        screen: 'home',
        review: initialReviewState,
      });
      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);

      dataStore.__triggerChange('card', {});

      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('batches updates from multiple card changes', () => {
      subject(dataStore, store);
      store.__update({
        screen: 'review',
        review: initialReviewState,
      });
      expect(store.actions).toEqual([queryAvailableCards()]);

      dataStore.__triggerChange('card', {});
      dataStore.__triggerChange('card', {});
      dataStore.__triggerChange('card', {});

      jest.runAllTimers();
      expect(store.actions).toEqual([
        queryAvailableCards(),
        queryAvailableCards(),
      ]);
    });
  });

  describe('review cards', () => {
    it('triggers an update when the current card is updated', () => {
      subject(dataStore, store);

      const card: Card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          currentCard: card,
        },
      });

      const updatedCard: Card = {
        ...card,
        question: 'Updated question',
      };
      dataStore.__triggerChange('card', {
        id: 'abc',
        doc: updatedCard,
      });

      expect(store.actions).toContainEqual(updateReviewCard(updatedCard));
    });

    it('triggers an update when an unreviewed card is updated', () => {
      subject(dataStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          heap: [card],
        },
      });

      const updatedCard = {
        ...card,
        question: 'Updated question',
      };
      dataStore.__triggerChange('card', {
        id: 'abc',
        doc: updatedCard,
      });

      expect(store.actions).toContainEqual(updateReviewCard(updatedCard));
    });

    it('triggers an update when a failed card is updated', () => {
      subject(dataStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          failedCardsLevel2: [card],
        },
      });

      const updatedCard = {
        ...card,
        question: 'Updated question',
      };
      dataStore.__triggerChange('card', {
        id: 'abc',
        doc: updatedCard,
      });

      expect(store.actions).toContainEqual(updateReviewCard(updatedCard));
    });

    it('triggers an update when the current card is deleted', () => {
      subject(dataStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      };
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          currentCard: card,
        },
      });

      const updatedCard = {
        ...card,
        question: 'Updated question',
      };
      dataStore.__triggerChange('card', {
        id: 'abc',
        deleted: true,
        doc: {
          ...updatedCard,
          deleted: true,
        },
      });

      expect(store.actions).toContainEqual(
        expect.objectContaining({ type: 'DELETE_REVIEW_CARD', id: 'abc' })
      );
    });

    it('does NOT trigger an update when there is no change to the card', () => {
      subject(dataStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          currentCard: card,
        },
      });

      dataStore.__triggerChange('card', {
        id: 'abc',
        doc: { ...card },
      });

      expect(store.actions).not.toContainEqual(updateReviewCard(card));
    });

    it('does NOT trigger an update when an unrelated card is updated', () => {
      subject(dataStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          currentCard: card,
        },
      });

      dataStore.__triggerChange('card', {
        id: 'xyz',
        doc: {
          ...card,
          _id: 'xyz',
        },
      });

      expect(store.actions).not.toContainEqual(updateReviewCard(card));
    });

    it('does NOT trigger an update when an unrelated card is deleted', () => {
      subject(dataStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      };
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          currentCard: card,
        },
      });

      dataStore.__triggerChange('card', {
        id: 'xyz',
        deleted: true,
        doc: {
          ...card,
          _id: 'xyz',
          deleted: true,
        },
      });

      expect(store.actions).not.toContainEqual(
        expect.objectContaining({ type: 'DELETE_REVIEW_CARD', id: 'xyz' })
      );
    });
  });

  describe('review state', () => {
    it('triggers a sync when the review has changed', () => {
      subject(dataStore, store);

      store.__update({
        screen: 'review',
        review: initialReviewState,
      });

      const review = {
        maxCards: 3,
        maxNewCards: 2,
        completed: 1,
        newCardsCompleted: 0,
        history: ['abc', 'def'],
        failedCardsLevel1: ['def'],
        failedCardsLevel2: [],
      };

      dataStore.__triggerChange('review', review);
      expect(store.actions).toContainEqual(
        expect.objectContaining({ type: 'LOAD_REVIEW', review })
      );
    });

    it('does NOT trigger a sync when nothing has changed', () => {
      subject(dataStore, store);

      store.__update({
        screen: 'review',
        review: initialReviewState,
      });
      const reviewSummary = getReviewSummary({
        review: initialReviewState,
      });

      dataStore.__triggerChange('review', reviewSummary);
      expect(store.actions).not.toContainEqual(
        expect.objectContaining({ type: 'LOAD_REVIEW', review: reviewSummary })
      );
    });

    it('cancels the review when the review is deleted', () => {
      subject(dataStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialReviewState,
          phase: ReviewPhase.QUESTION,
        },
      });

      dataStore.__triggerChange('review', null);

      expect(store.actions).toContainEqual(
        expect.objectContaining({ type: 'CANCEL_REVIEW' })
      );
    });
  });
});
