import PouchDB from 'pouchdb';

import { AvailableCardWatcher } from './available-card-watcher';
import { AvailableCards, Card } from '../model';
import { DataStore } from '../store/DataStore';
import { waitForEvents } from '../utils/testing';

PouchDB.plugin(require('pouchdb-adapter-memory'));

describe('AvailableCardWatcher', () => {
  let dataStore: DataStore;
  let subject: AvailableCardWatcher | undefined;
  let initialReviewTime = new Date();
  initialReviewTime.setMinutes(0, 0, 0);

  beforeEach(() => {
    // Pre-fetching views seems to be a real bottle-neck when running tests
    dataStore = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });
  });

  afterEach(async () => {
    subject?.disconnect();
    subject = undefined;
    await dataStore.destroy();
  });

  function relativeTime(diffInDays: number): Date {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    return new Date(initialReviewTime.getTime() + diffInDays * MS_PER_DAY);
  }

  it('returns the initial set of available cards', async () => {
    // Overdue
    const card1 = await dataStore.putCard({
      front: 'Front',
      back: 'Back',
      progress: {
        level: 10,
        due: relativeTime(-1),
      },
    });

    // Not overdue
    await dataStore.putCard({
      front: 'Front',
      back: 'Back',
      progress: {
        level: 10,
        due: relativeTime(1),
      },
    });

    // New
    const card3 = await dataStore.putCard({
      front: 'Front',
      back: 'Back',
    });

    // Most overdue
    const card4 = await dataStore.putCard({
      front: 'Front',
      back: 'Back',
      progress: {
        level: 10,
        due: relativeTime(-5),
      },
    });

    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });

    const newCards = await subject.getNewCards();
    expect(newCards).toEqual([card3.id]);

    const overdueCards = await subject.getOverdueCards();
    expect(overdueCards).toEqual([card4.id, card1.id]);

    const availableCards = await subject.getNumAvailableCards();
    expect(availableCards).toEqual({ newCards: 1, overdueCards: 2 });
  });

  async function addNewCards(num: number): Promise<Array<Card>> {
    const cards = new Array(num);
    for (let i = 0; i < cards.length; i++) {
      cards[i] = await dataStore.putCard({
        front: `Question ${i + 1}`,
        back: `Answer ${i + 1}`,
      });
    }
    return cards;
  }

  it('returns new cards in oldest first order', async () => {
    const addedCards = await addNewCards(3);
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });

    const newCards = await subject.getNewCards();

    expect(newCards).toEqual(addedCards.map((card) => card.id));
  });

  it('returns overdue cards in order of most to least overdue', async () => {
    const dueTimes = [
      relativeTime(-1), // #3
      relativeTime(0), // #5
      relativeTime(3),
      relativeTime(-3), // #2
      relativeTime(5),
      relativeTime(-0.1), // #4
      relativeTime(-100), // #1
      relativeTime(0.1),
    ];
    const addedCards: Array<Card> = [];
    for (let i = 0; i < dueTimes.length; i++) {
      addedCards.push(
        await dataStore.putCard({
          front: 'Front',
          back: 'Back',
          progress: {
            level: 5,
            due: dueTimes[i],
          },
        })
      );
    }

    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });

    const overdueCards = await subject.getOverdueCards();
    expect(overdueCards).toEqual([
      addedCards[6].id,
      addedCards[3].id,
      addedCards[0].id,
      addedCards[5].id,
      addedCards[1].id,
    ]);
  });

  it('automatically triggers a query', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });

    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    expect(subject.isLoading()).toStrictEqual(true);

    // You might think we'd want to mock requestIdleCallback here but actually
    // when running under node (which we do when we run these tests) we polyfill
    // requestIdleCallback with setTimeout so we actually want to mock timers
    // here.
    //
    // We don't want to run _all_ timers though or else we'll end up running
    // and re-running the periodic task to update the review time, ad
    // infinitum. Furthermore, we don't want to run all _pending_ timers,
    // either, since that will end up running the timer to update the review
    // time and our query callback will abort since it will detect the updated
    // review time.
    //
    // Instead, we just want to advance timers enough to let the polyfill-ed
    // requestIdleCallback run.
    jest.advanceTimersByTime(10 * 1000);
    jest.useRealTimers();

    // The above will trigger the query to run, but the query is async so we
    // need to wait a few cycles for it to finish.
    await waitForEvents(40);

    expect(subject.isLoading()).toStrictEqual(false);
  });

  // Helper to produce:
  //
  // - a callback to pass to the AvailableCardWatcher addListener method
  // - a Promise that will resolve after the callback has been called |num|
  //   times
  //
  const waitForCalls = (
    num: number
  ): [
    (availableCards: AvailableCards) => void,
    Promise<Array<AvailableCards>>
  ] => {
    const calls: Array<AvailableCards> = [];

    let resolver: (calls: Array<AvailableCards>) => void;
    let rejecter: (err: any) => void;
    const promise = new Promise<Array<AvailableCards>>((resolve, reject) => {
      resolver = resolve;
      rejecter = reject;
    });

    let recordedChanges = 0;
    const callback = (availableCards: AvailableCards) => {
      calls.push(availableCards);
      if (++recordedChanges === num) {
        resolver(calls);
      }
      if (recordedChanges > num) {
        const err = new Error(
          `Got ${recordedChanges} calls, but only expected ${num}`
        );
        // Reject the promise and throw so that one way or another the test
        // framework hears about it.
        rejecter(err);
        throw err;
      }
    };

    if (num === 0) {
      resolver!([]);
    }

    return [callback, promise];
  };

  it('calls all listeners with the initial result', async () => {
    await addNewCards(3);

    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });

    const [callbackA, finishedA] = waitForCalls(1);
    subject.addListener(callbackA);

    const [callbackB, finishedB] = waitForCalls(1);
    subject.addListener(callbackB);

    // Trigger initial query
    jest.advanceTimersByTime(10 * 1000);
    jest.useRealTimers();
    await waitForEvents(20);

    const callsA = await finishedA;
    expect(callsA).toEqual([{ newCards: 3, overdueCards: 0 }]);

    const callsB = await finishedB;
    expect(callsB).toEqual([{ newCards: 3, overdueCards: 0 }]);
  });

  it('notifies listeners when there is a new card', async () => {
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    await subject.getNewCards();

    const [callback, finished] = waitForCalls(1);
    subject.addListener(callback);

    const card = await dataStore.putCard({
      front: 'Front',
      back: 'Back',
    });

    const calls = await finished;
    expect(calls).toEqual([{ newCards: 1, overdueCards: 0 }]);
    expect(subject.isLoading()).toStrictEqual(false);
    expect(await subject.getNewCards()).toEqual([card.id]);
  });

  it('notifies listeners of all the new cards', async () => {
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    await subject.getNewCards();

    const [callback, finished] = waitForCalls(5);
    subject.addListener(callback);

    const addedCards = await addNewCards(5);

    const calls = await finished;
    expect(calls).toHaveLength(5);
    expect(calls[4]).toEqual({ newCards: 5, overdueCards: 0 });
    expect(await subject.getNewCards()).toEqual(
      addedCards.map((card) => card.id)
    );
  });

  it('notifies listeners when a card is no longer new', async () => {
    const addedCards = await addNewCards(3);
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });

    await subject.getNewCards();

    const [callback, finished] = waitForCalls(1);
    subject.addListener(callback);

    // Make the second card no longer new (nor overdue)
    await dataStore.putCard({
      ...addedCards[1],
      progress: { level: 10, due: relativeTime(5) },
    });

    const calls = await finished;
    expect(calls).toEqual([{ newCards: 2, overdueCards: 0 }]);
    expect(await subject.getNewCards()).toEqual([
      addedCards[0].id,
      addedCards[2].id,
    ]);
  });

  it('notifies listeners when a new card is deleted', async () => {
    const addedCards = await addNewCards(3);
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });

    await subject.getNewCards();

    const [callback, finished] = waitForCalls(1);
    subject.addListener(callback);

    await dataStore.deleteCard(addedCards[1].id);

    const calls = await finished;
    expect(calls).toEqual([{ newCards: 2, overdueCards: 0 }]);
    expect(await subject.getNewCards()).toEqual([
      addedCards[0].id,
      addedCards[2].id,
    ]);
  });

  it('notifies listeners when a new card is now overdue', async () => {
    const addedCards = await addNewCards(3);
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });

    await subject.getNewCards();

    const [callback, finished] = waitForCalls(2);
    subject.addListener(callback);

    // Make the first and third cards overdue
    await dataStore.putCard({
      ...addedCards[0],
      progress: { level: 10, due: relativeTime(-5) },
    });
    await dataStore.putCard({
      ...addedCards[2],
      progress: { level: 3, due: relativeTime(-5) },
    });

    const calls = await finished;
    expect(calls).toEqual([
      { newCards: 2, overdueCards: 1 },
      { newCards: 1, overdueCards: 2 },
    ]);
    expect(await subject.getNewCards()).toEqual([addedCards[1].id]);
    expect(await subject.getOverdueCards()).toEqual([
      addedCards[2].id,
      addedCards[0].id,
    ]);
  });

  it('does NOT notify listeners when the content of a new card changes', async () => {
    const addedCards = await addNewCards(3);
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    await subject.getNewCards();

    const [callback, finished] = waitForCalls(0);
    subject.addListener(callback);

    await dataStore.putCard({
      ...addedCards[1],
      front: 'Updated front',
    });

    // Wait a moment so that if we _do_ get a callback, when we wait on
    // `finished` below it will reject.
    await waitForEvents(10);

    const calls = await finished;
    expect(calls).toHaveLength(0);
  });

  it('notifies listeners when there is a new overdue card', async () => {
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    await subject.getNewCards();

    const [callback, finished] = waitForCalls(1);
    subject.addListener(callback);

    const card = await dataStore.putCard({
      front: 'Front',
      back: 'Back',
      progress: {
        level: 10,
        due: relativeTime(-1),
      },
    });

    const calls = await finished;
    expect(calls).toEqual([{ newCards: 0, overdueCards: 1 }]);
    expect(await subject.getOverdueCards()).toEqual([card.id]);
  });

  it('notifies listeners when there is a card is no longer overdue', async () => {
    const card = await dataStore.putCard({
      front: 'Front',
      back: 'Back',
      progress: {
        level: 10,
        due: relativeTime(-1),
      },
    });

    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    await subject.getNewCards();

    const [callback, finished] = waitForCalls(1);
    subject.addListener(callback);

    await dataStore.putCard({
      ...card,
      progress: {
        level: 10,
        due: relativeTime(10),
      },
    });

    const calls = await finished;
    expect(calls).toEqual([{ newCards: 0, overdueCards: 0 }]);
    expect(await subject.getOverdueCards()).toEqual([]);
  });

  it('notifies listeners when an overdue card is deleted', async () => {
    const addedCards = await addNewCards(3);
    for (const card of addedCards) {
      await dataStore.putCard({
        ...card,
        progress: {
          level: 10,
          due: relativeTime(-1),
        },
      });
    }

    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    await subject.getNewCards();

    const [callback, finished] = waitForCalls(1);
    subject.addListener(callback);

    await dataStore.deleteCard(addedCards[1].id);

    const calls = await finished;
    expect(calls).toEqual([{ newCards: 0, overdueCards: 2 }]);
    expect(await subject.getOverdueCards()).toEqual([
      addedCards[0].id,
      addedCards[2].id,
    ]);
  });

  it('notifies listeners when an overdue card becomes new', async () => {
    const card = await dataStore.putCard({
      front: 'Front',
      back: 'Back',
      progress: {
        level: 10,
        due: relativeTime(-1),
      },
    });

    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    await subject.getNewCards();

    const [callback, finished] = waitForCalls(1);
    subject.addListener(callback);

    await dataStore.putCard({
      ...card,
      progress: {
        level: 0,
        due: null,
      },
    });

    const calls = await finished;
    expect(calls).toEqual([{ newCards: 1, overdueCards: 0 }]);
    expect(await subject.getOverdueCards()).toEqual([]);
    expect(await subject.getNewCards()).toEqual([card.id]);
  });

  it('notifies listeners when an overdue card changes its overdueness', async () => {
    const cardA = await dataStore.putCard({
      front: 'Question #1',
      back: 'Question #2',
      progress: {
        level: 10,
        due: relativeTime(-5),
      },
    });
    const cardB = await dataStore.putCard({
      front: 'Question #1',
      back: 'Question #2',
      progress: {
        level: 10,
        due: relativeTime(-3),
      },
    });

    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    expect(await subject.getOverdueCards()).toEqual([cardA.id, cardB.id]);

    const [callback, finished] = waitForCalls(1);
    subject.addListener(callback);

    await dataStore.putCard({
      ...cardA,
      progress: {
        ...cardA.progress,
        due: relativeTime(-1),
      },
    });

    const calls = await finished;
    expect(calls).toEqual([{ newCards: 0, overdueCards: 2 }]);
    expect(await subject.getOverdueCards()).toEqual([cardB.id, cardA.id]);
  });

  it('does NOT notify listeners when the overdueness changes in an insignificant way', async () => {
    const cardA = await dataStore.putCard({
      front: 'Question #1',
      back: 'Question #2',
      progress: {
        level: 10,
        due: relativeTime(-5),
      },
    });
    const cardB = await dataStore.putCard({
      front: 'Question #1',
      back: 'Question #2',
      progress: {
        level: 10,
        due: relativeTime(-3),
      },
    });

    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    expect(await subject.getOverdueCards()).toEqual([cardA.id, cardB.id]);

    const [callback, finished] = waitForCalls(0);
    subject.addListener(callback);

    await dataStore.putCard({
      ...cardA,
      progress: {
        ...cardA.progress,
        due: relativeTime(-4),
      },
    });

    // Wait a moment so that if we _do_ get a callback, when we wait on
    // `finished` below it will reject.
    await waitForEvents(10);

    const calls = await finished;
    expect(calls).toHaveLength(0);
  });

  it('does NOT notify listeners when the content of an overdue card changes', async () => {
    const card = await dataStore.putCard({
      front: 'Front',
      back: 'Back',
      progress: {
        level: 10,
        due: relativeTime(-5),
      },
    });

    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    await subject.getNewCards();

    const [callback, finished] = waitForCalls(0);
    subject.addListener(callback);

    await dataStore.putCard({
      ...card,
      front: 'Updated front',
    });

    // Wait a moment so that if we _do_ get a callback, when we wait on
    // `finished` below it will reject.
    await waitForEvents(10);

    const calls = await finished;
    expect(calls).toHaveLength(0);
  });

  it('does NOT notify listeners when a card is added that is neither new nor overdue', async () => {
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    await subject.getNewCards();

    const [callback, finished] = waitForCalls(0);
    subject.addListener(callback);

    await dataStore.putCard({
      front: 'Front',
      back: 'Back',
      progress: {
        level: 10,
        due: relativeTime(10),
      },
    });

    // Wait a moment so that if we _do_ get a callback, when we wait on
    // `finished` below it will reject.
    await waitForEvents(10);

    const calls = await finished;
    expect(calls).toHaveLength(0);
  });

  it('allows unregistering listeners', async () => {
    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    await subject.getNewCards();

    const [callback, finished] = waitForCalls(3);
    subject.addListener(callback);

    await addNewCards(3);

    // Wait for the initial set of callbacks to be called
    await waitForEvents(10);

    subject.removeListener(callback);

    await addNewCards(2);

    const calls = await finished;
    expect(calls).toHaveLength(3);
  });

  it('updates the review time each hour', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });

    const dueTimes = [
      relativeTime(-3),
      relativeTime(-2),
      relativeTime(-1),
      relativeTime(0),
      relativeTime(0.01),
      relativeTime(2),
    ];
    const addedCards: Array<Card> = [];
    for (let i = 0; i < dueTimes.length; i++) {
      addedCards.push(
        await dataStore.putCard({
          front: 'Front',
          back: 'Back',
          progress: {
            level: 5,
            due: dueTimes[i],
          },
        })
      );
    }

    subject = new AvailableCardWatcher({ dataStore, initialReviewTime });
    let overdueCards = await subject.getOverdueCards();
    expect(overdueCards).toEqual(addedCards.slice(0, 4).map((card) => card.id));

    const [callback, finished] = waitForCalls(1);
    subject.addListener(callback);

    // Let the timer task run that should update the review time so that one
    // more card becomes overdue.
    const originalReviewTime = subject.getReviewTime();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    // The review time should be updated by one hour.
    const updatedReviewTime = subject.getReviewTime();
    expect(updatedReviewTime.getTime() - originalReviewTime.getTime()).toEqual(
      60 * 60 * 1000
    );

    overdueCards = await subject.getOverdueCards();
    expect(overdueCards).toEqual(addedCards.slice(0, 5).map((card) => card.id));

    const calls = await finished;
    expect(calls).toEqual([{ newCards: 0, overdueCards: 5 }]);
  });
});
