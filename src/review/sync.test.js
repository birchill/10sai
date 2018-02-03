/* global beforeEach, describe, expect, it, jest */

import subject from './sync';
import { queryAvailableCards, updateReviewCard } from './actions';
import reducer from './reducer';

jest.useFakeTimers();

class MockCardStore {
  constructor() {
    this.cbs = {};
    this.changes = {
      on: (type, cb) => {
        if (this.cbs[type]) {
          this.cbs[type].push(cb);
        } else {
          this.cbs[type] = [cb];
        }
      },
    };
  }

  __triggerChange(type, change) {
    if (!this.cbs[type]) {
      return;
    }

    for (const cb of this.cbs[type]) {
      cb(change);
    }
  }
}

class MockStore {
  constructor() {
    this.state = {};
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

const initialState = reducer(undefined, { type: 'NONE' });

describe('review:sync', () => {
  let cardStore;
  let store;

  beforeEach(() => {
    cardStore = new MockCardStore();
    store = new MockStore();

    setTimeout.mockClear();
    clearTimeout.mockClear();
  });

  describe('available cards', () => {
    it('triggers an update immediately when cards are needed and there are none', () => {
      subject(cardStore, store);
      store.__update({
        screen: 'review',
        review: initialState,
      });

      expect(store.actions).toEqual([queryAvailableCards()]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('triggers an update immediately when cards are newly-needed due to a state change, even if there are some', () => {
      subject(cardStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          availableCards: { newCards: 2, overdueCards: 3 },
        },
      });

      expect(store.actions).toEqual([queryAvailableCards()]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('triggers a delayed update when a card is added', () => {
      subject(cardStore, store);
      store.__update({
        screen: 'review',
        review: initialState,
      });
      expect(store.actions).toEqual([queryAvailableCards()]);
      expect(setTimeout).toHaveBeenCalledTimes(0);

      cardStore.__triggerChange('card', {});

      expect(setTimeout).toHaveBeenCalledTimes(1);

      jest.runAllTimers();
      expect(store.actions).toEqual([
        queryAvailableCards(),
        queryAvailableCards(),
      ]);
    });

    it('cancels a delayed update when cards are needed immediately', () => {
      subject(cardStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          availableCards: { newCards: 2, overdueCards: 3 },
        },
      });
      expect(store.actions).toEqual([queryAvailableCards()]);

      // Trigger a delayed update
      cardStore.__triggerChange('card', {});
      expect(setTimeout).toHaveBeenCalledTimes(1);

      // Then trigger an immediate update
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
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
      subject(cardStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          availableCards: { newCards: 2, overdueCards: 3 },
        },
      });
      expect(store.actions).toEqual([queryAvailableCards()]);

      // Trigger a delayed update
      cardStore.__triggerChange('card', {});
      expect(setTimeout).toHaveBeenCalledTimes(1);

      // Then change screen
      store.__update({
        screen: 'home',
        review: initialState,
      });
      expect(clearTimeout).toHaveBeenCalledTimes(1);
      expect(store.actions).toEqual([queryAvailableCards()]);
    });

    it('does NOT trigger an update when cards are already being loaded', () => {
      subject(cardStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          loadingAvailableCards: true,
        },
      });

      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('does NOT trigger an update when the progress is being saved', () => {
      subject(cardStore, store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          savingProgress: true,
        },
      });

      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('does NOT trigger an update when a card is added when not in an appropriate state', () => {
      subject(cardStore, store);
      store.__update({
        screen: 'home',
        review: initialState,
      });
      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);

      cardStore.__triggerChange('card', {});

      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('batches updates from multiple card changes', () => {
      subject(cardStore, store);
      store.__update({
        screen: 'review',
        review: initialState,
      });
      expect(store.actions).toEqual([queryAvailableCards()]);

      cardStore.__triggerChange('card', {});
      cardStore.__triggerChange('card', {});
      cardStore.__triggerChange('card', {});

      jest.runAllTimers();
      expect(store.actions).toEqual([
        queryAvailableCards(),
        queryAvailableCards(),
      ]);
    });
  });

  describe('review cards', () => {
    it('triggers an update when the current card is updated', () => {
      subject(cardStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      };
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          currentCard: card,
        },
      });

      const updatedCard = {
        ...card,
        question: 'Updated question',
      };
      cardStore.__triggerChange('card', {
        id: 'abc',
        doc: updatedCard,
      });

      expect(store.actions).toContainEqual(updateReviewCard(updatedCard));
    });

    it('triggers an update when an unreviewed card is updated', () => {
      subject(cardStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      };
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          heap: [card],
        },
      });

      const updatedCard = {
        ...card,
        question: 'Updated question',
      };
      cardStore.__triggerChange('card', {
        id: 'abc',
        doc: updatedCard,
      });

      expect(store.actions).toContainEqual(updateReviewCard(updatedCard));
    });

    it('triggers an update when a failed card is updated', () => {
      subject(cardStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      };
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          failedCardsLevel2: [card],
        },
      });

      const updatedCard = {
        ...card,
        question: 'Updated question',
      };
      cardStore.__triggerChange('card', {
        id: 'abc',
        doc: updatedCard,
      });

      expect(store.actions).toContainEqual(updateReviewCard(updatedCard));
    });

    it('triggers an update when the current card is deleted', () => {
      subject(cardStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      };
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          currentCard: card,
        },
      });

      const updatedCard = {
        ...card,
        question: 'Updated question',
      };
      cardStore.__triggerChange('card', {
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
      subject(cardStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      };
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          currentCard: card,
        },
      });

      cardStore.__triggerChange('card', {
        id: 'abc',
        doc: { ...card },
      });

      expect(store.actions).not.toContainEqual(updateReviewCard(card));
    });

    it('does NOT trigger an update when an unrelated card is updated', () => {
      subject(cardStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      };
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          currentCard: card,
        },
      });

      cardStore.__triggerChange('card', {
        id: 'xyz',
        doc: {
          ...card,
          _id: 'xyz',
        },
      });

      expect(store.actions).not.toContainEqual(updateReviewCard(card));
    });

    it('does NOT trigger an update when an unrelated card is deleted', () => {
      subject(cardStore, store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      };
      store.__update({
        screen: 'review',
        review: {
          ...initialState,
          currentCard: card,
        },
      });

      cardStore.__triggerChange('card', {
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
});
