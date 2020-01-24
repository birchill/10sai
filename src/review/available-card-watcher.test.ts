import PouchDB from 'pouchdb';

import { AvailableCardWatcher } from './available-card-watcher';
import { Card } from '../model';
import { DataStore } from '../store/DataStore';

PouchDB.plugin(require('pouchdb-adapter-memory'));

const MS_PER_DAY = 1000 * 60 * 60 * 24;

describe('AvailableCardWatcher', () => {
  let dataStore: DataStore;
  let reviewTime: Date;
  let relativeTime: (diffInDays: number) => Date;

  beforeEach(() => {
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

  it('returns new cards in oldest first order', async () => {
    const numCardsToAdd = 3;
    const cardsAdded: Array<Card> = [];
    for (let i = 0; i < numCardsToAdd; i++) {
      cardsAdded.push(
        await dataStore.putCard({
          front: 'Front',
          back: 'Back',
        })
      );
    }

    const subject = new AvailableCardWatcher({ dataStore, reviewTime });

    const newCards = await subject.getNewCards(10);
    expect(newCards).toEqual(cardsAdded.map(card => card.id));
  });

  it('returns only the specified number of new cards', async () => {
    const numCardsToAdd = 8;
    const cardsAdded: Array<Card> = [];
    for (let i = 0; i < numCardsToAdd; i++) {
      cardsAdded.push(
        await dataStore.putCard({
          front: 'Front',
          back: 'Back',
        })
      );
    }

    const subject = new AvailableCardWatcher({ dataStore, reviewTime });

    const newCards = await subject.getNewCards(5);
    expect(newCards).toEqual(cardsAdded.slice(0, 5).map(card => card.id));
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
    const cardsAdded: Array<Card> = [];
    for (let i = 0; i < dueTimes.length; i++) {
      cardsAdded.push(
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
      cardsAdded[6].id,
      cardsAdded[3].id,
      cardsAdded[0].id,
      cardsAdded[5].id,
      cardsAdded[1].id,
    ]);
  });

  it('returns only the specified number of overdue cards cards', async () => {
    const numCards = 10;
    const cardsAdded: Array<Card> = [];
    const due = new Date(reviewTime.getTime());
    for (let i = 0; i < numCards; i++) {
      // Make each card one more day overdue
      due.setTime(due.getTime() - MS_PER_DAY);
      cardsAdded.push(
        await dataStore.putCard({
          front: 'Front',
          back: 'Back',
          progress: {
            level: 5,
            due,
          },
        })
      );
    }

    const subject = new AvailableCardWatcher({ dataStore, reviewTime });

    const overdueCards = await subject.getOverdueCards(4);
    expect(overdueCards).toEqual([
      cardsAdded[9].id,
      cardsAdded[8].id,
      cardsAdded[7].id,
      cardsAdded[6].id,
    ]);
  });

  // XXX Automatically triggers a query
  //  -- This should test the isLoading flag

  // XXX Calls all listeners with initial result
  //  -- Try registering before and after initial query
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
