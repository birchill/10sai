/* global beforeEach, describe, expect, it, jest */

import subject from './sync';
import { queryAvailableCards } from './actions';

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

jest.mock('./selectors', () => ({
  getNeedAvailableCards: state => state.screen === 'review',
  getAvailableCards: state => state.review.availableCards,
  getLoadingAvailableCards: state => state.review.loadingAvailableCards,
}));

describe('review:sync', () => {
  let cardStore;
  let store;

  beforeEach(() => {
    cardStore = new MockCardStore();
    store = new MockStore();

    setTimeout.mockClear();
    clearTimeout.mockClear();
  });

  it('triggers an update immediately when cards are needed and there are none', () => {
    subject(cardStore, store);
    store.__update({
      screen: 'review',
      review: { availableCards: undefined, loadingAvailableCards: false },
    });

    expect(store.actions).toEqual([queryAvailableCards()]);
    expect(setTimeout).toHaveBeenCalledTimes(0);
  });

  it('triggers a delayed update when cards are needed but there are some', () => {
    subject(cardStore, store);
    store.__update({
      screen: 'review',
      review: {
        availableCards: { newCards: 2, overdueCards: 3 },
        loadingAvailableCards: false,
      },
    });

    expect(store.actions).toEqual([]);
    expect(setTimeout).toHaveBeenCalledTimes(1);

    jest.runAllTimers();
    expect(store.actions).toEqual([queryAvailableCards()]);
  });

  it('cancels a delayed update when cards are needed immediately', () => {
    subject(cardStore, store);
    // Trigger a delayed update
    store.__update({
      screen: 'review',
      review: {
        availableCards: { newCards: 2, overdueCards: 3 },
        loadingAvailableCards: false,
      },
    });
    expect(setTimeout).toHaveBeenCalledTimes(1);

    // Then trigger an immediate update
    store.__update({
      screen: 'review',
      review: {
        availableCards: undefined,
        loadingAvailableCards: false,
      },
    });
    expect(clearTimeout).toHaveBeenCalledTimes(1);
    expect(store.actions).toEqual([queryAvailableCards()]);
  });

  it('cancels a delayed update when cards are no longer needed', () => {
    subject(cardStore, store);
    // Trigger a delayed update
    store.__update({
      screen: 'review',
      review: {
        availableCards: { newCards: 2, overdueCards: 3 },
        loadingAvailableCards: false,
      },
    });
    expect(setTimeout).toHaveBeenCalledTimes(1);

    // Then change screen
    store.__update({
      screen: 'home',
      review: {
        availableCards: undefined,
        loadingAvailableCards: false,
      },
    });
    expect(clearTimeout).toHaveBeenCalledTimes(1);
    expect(store.actions).toEqual([]);
  });

  it('does not trigger an update when cards are already being loaded', () => {
    subject(cardStore, store);
    store.__update({
      screen: 'review',
      review: { availableCards: undefined, loadingAvailableCards: true },
    });

    expect(store.actions).toEqual([]);
    expect(setTimeout).toHaveBeenCalledTimes(0);
  });

  it('triggers a delayed update when a card is added', () => {
    subject(cardStore, store);
    store.__update({
      screen: 'review',
      review: {
        availableCards: undefined,
        loadingAvailableCards: false,
      },
    });
    expect(store.actions).toEqual([queryAvailableCards()]);
    expect(setTimeout).toHaveBeenCalledTimes(0);

    cardStore.__triggerChange('change', {});

    expect(setTimeout).toHaveBeenCalledTimes(1);

    jest.runAllTimers();
    expect(store.actions).toEqual([
      queryAvailableCards(),
      queryAvailableCards(),
    ]);
  });

  it('does NOT trigger an update when a card is added when not in an appropriate state', () => {});

  it('triggers a delayed update when a card is deleted', () => {});

  it("triggers a delayed update when a card's progress is updated", () => {});

  // TODO
  it("does not trigger an update when a card's content is updated", () => {});

  it('batches updates from multiple card changes', () => {});
});
