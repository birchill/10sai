import subject from './sync';
import { queryAvailableCards, updateReviewCard } from './actions';
import { ReviewState } from './reducer';
import reducer from '../reducer';
import { ReviewAction } from './actions';
import { getReviewSummary } from './selectors';
import { ReviewPhase } from './ReviewPhase';
import { Card } from '../model';
import DataStore from '../store/DataStore';
import { Store } from 'redux';

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

  __triggerChange(type: string, change: any) {
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

const initialState = reducer(undefined, { type: 'NONE' } as any);

class MockStore {
  cb?: () => void;
  state: State;
  actions: Array<ReviewAction>;

  constructor() {
    this.state = {
      screen: initialState.route.screen,
      review: initialState.review,
    };
    this.actions = [];
  }

  subscribe(cb: () => void) {
    this.cb = cb;
  }

  dispatch(action: ReviewAction) {
    this.actions.push(action);
  }

  getState() {
    return this.state;
  }

  __update(newState: State) {
    this.state = newState;

    if (this.cb) {
      this.cb();
    }
  }
}

// Mock selectors from other modules we depend on
jest.mock('../route/selectors', () => ({
  getScreen: (state: State) => state.screen,
}));

describe('review:sync', () => {
  let dataStore: MockDataStore;
  let store: MockStore;

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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);
      store.__update({
        screen: 'review',
        review: initialState.review,
      });

      expect(store.actions).toEqual([queryAvailableCards()]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('triggers an update immediately when cards are newly-needed due to a state change, even if there are some', () => {
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          availableCards: { newCards: 2, overdueCards: 3 },
        },
      });

      expect(store.actions).toEqual([queryAvailableCards()]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('triggers a delayed update when a card is added', () => {
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);
      store.__update({
        screen: 'review',
        review: initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
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
          ...initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
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
        review: initialState.review,
      });
      expect(clearTimeout).toHaveBeenCalledTimes(1);
      expect(store.actions).toEqual([queryAvailableCards()]);
    });

    it('does NOT trigger an update when cards are already being loaded', () => {
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          loadingAvailableCards: true,
        },
      });

      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('does NOT trigger an update when the progress is being saved', () => {
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          savingProgress: true,
        },
      });

      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('does NOT trigger an update when a card is added when not in an appropriate state', () => {
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);
      store.__update({
        screen: 'home',
        review: initialState.review,
      });
      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);

      dataStore.__triggerChange('card', {});

      expect(store.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it('batches updates from multiple card changes', () => {
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);
      store.__update({
        screen: 'review',
        review: initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);

      const card: Card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);

      const card = {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      } as Card;
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);

      store.__update({
        screen: 'review',
        review: initialState.review,
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
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);

      store.__update({
        screen: 'review',
        review: initialState.review,
      });
      const reviewSummary = getReviewSummary(initialState);

      dataStore.__triggerChange('review', reviewSummary);
      expect(store.actions).not.toContainEqual(
        expect.objectContaining({ type: 'LOAD_REVIEW', review: reviewSummary })
      );
    });

    it('cancels the review when the review is deleted', () => {
      subject((dataStore as unknown) as DataStore, (store as unknown) as Store);
      store.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          phase: ReviewPhase.Question,
        },
      });

      dataStore.__triggerChange('review', null);

      expect(store.actions).toContainEqual(
        expect.objectContaining({ type: 'CANCEL_REVIEW' })
      );
    });
  });
});
