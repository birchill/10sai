import PouchDB from 'pouchdb';
import { ensureMocksReset, timer } from '@shopify/jest-dom-mocks';

import { AvailableCardWatcher } from './available-card-watcher';
import { AvailableCards, Card } from '../model';
import { DataStore } from '../store/DataStore';
import { waitForEvents } from '../utils/testing';

PouchDB.plugin(require('pouchdb-adapter-memory'));

const MS_PER_DAY = 1000 * 60 * 60 * 24;

describe('AvailableCardWatcher', () => {
  let dataStore: DataStore;
  let reviewTime: Date;
  let relativeTime: (diffInDays: number) => Date;

  beforeEach(() => {
    ensureMocksReset();
    // Pre-fetching views seems to be a real bottle-neck when running tests
    dataStore = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });
    reviewTime = new Date();
    relativeTime = diffInDays =>
      new Date(reviewTime.getTime() + diffInDays * MS_PER_DAY);
  });

  afterEach(() => dataStore.destroy());

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

    const subject = new AvailableCardWatcher({ dataStore, reviewTime });

    const newCards = await subject.getNewCards(10);
    expect(newCards).toEqual([card3.id]);

    const overdueCards = await subject.getOverdueCards(10);
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
    const subject = new AvailableCardWatcher({ dataStore, reviewTime });

    const newCards = await subject.getNewCards(10);

    expect(newCards).toEqual(addedCards.map(card => card.id));
  });

  it('returns only the specified number of new cards', async () => {
    const addedCards = await addNewCards(8);
    const subject = new AvailableCardWatcher({ dataStore, reviewTime });

    const newCards = await subject.getNewCards(5);

    expect(newCards).toEqual(addedCards.slice(0, 5).map(card => card.id));
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

    const subject = new AvailableCardWatcher({ dataStore, reviewTime });

    const overdueCards = await subject.getOverdueCards(10);
    expect(overdueCards).toEqual([
      addedCards[6].id,
      addedCards[3].id,
      addedCards[0].id,
      addedCards[5].id,
      addedCards[1].id,
    ]);
  });

  it('returns only the specified number of overdue cards cards', async () => {
    const addedCards = await addNewCards(10);
    const due = new Date(reviewTime.getTime());
    for (const card of addedCards) {
      // Make each card one more day overdue
      due.setTime(due.getTime() - MS_PER_DAY);
      await dataStore.putCard({
        ...card,
        progress: {
          level: 5,
          due,
        },
      });
    }

    const subject = new AvailableCardWatcher({ dataStore, reviewTime });

    const overdueCards = await subject.getOverdueCards(4);
    expect(overdueCards).toEqual([
      addedCards[9].id,
      addedCards[8].id,
      addedCards[7].id,
      addedCards[6].id,
    ]);
  });

  it('automatically triggers a query', async () => {
    timer.mock();

    const subject = new AvailableCardWatcher({ dataStore, reviewTime });
    expect(subject.isLoading()).toStrictEqual(true);

    // You might think we'd want to mock requestIdleCallback here but actually
    // when running under node (which we do when we run these tests) we polyfill
    // requestIdleCallback with setTimeout so we actually want to mock timers
    // here.
    timer.runAllTimers();
    timer.restore();

    // The above will trigger the query to run, but the query is async so we
    // need to wait a few cycles for it to finish.
    await waitForEvents(15);

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
    const promise = new Promise<Array<AvailableCards>>(resolve => {
      resolver = resolve;
    });

    let recordedChanges = 0;
    const callback = (availableCards: AvailableCards) => {
      calls.push(availableCards);
      if (++recordedChanges === num) {
        resolver(calls);
      }
      if (recordedChanges > num) {
        throw `Got ${recordedChanges} calls, but only expected ${num}`;
      }
    };

    if (num === 0) {
      resolver!([]);
    }

    return [callback, promise];
  };

  it('calls all listeners with the initial result', async () => {
    await addNewCards(3);

    timer.mock();
    const subject = new AvailableCardWatcher({ dataStore, reviewTime });

    const [callbackA, finishedA] = waitForCalls(1);
    subject.addListener(callbackA);

    const [callbackB, finishedB] = waitForCalls(1);
    subject.addListener(callbackB);

    // Trigger initial query
    timer.runAllTimers();
    timer.restore();
    await waitForEvents(15);

    const callsA = await finishedA;
    expect(callsA).toEqual([{ newCards: 3, overdueCards: 0 }]);

    const callsB = await finishedB;
    expect(callsB).toEqual([{ newCards: 3, overdueCards: 0 }]);
  });

  // XXX Calls multiple listeners
  // XXX Allows unregistering listeners
  //
  // XXX Notifies listeners when there is a new new card
  // XXX Notifies listeners when a new card is no longer new
  // XXX Notifies listeners when a new card becomes overdue
  // XXX Does NOT notify listeners when the content of a new card changes
  //
  // XXX Notifies listeners when there is a new overdue card
  // XXX Notifies listeners when an overdue card is no longer overdue
  // XXX Notifies listeners when an overdue card becomes new
  // XXX Notifies listeners when an overdue card becomes more or less overdue
  // XXX Does NOT notify listeners when the content of an overdue card changes
  //
  // XXX Allows setting the review time
  //   -- Calls listeners
});
