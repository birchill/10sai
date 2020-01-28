import PouchDB from 'pouchdb';

import { DataStore } from './DataStore';
import { CardStore, CardChange } from './CardStore';
import { waitForChangeEvents } from './test-utils';

PouchDB.plugin(require('pouchdb-adapter-memory'));

// Let tests override generateUniqueTimestampId;
let mockGenerateUniqueTimestampId: (() => string) | undefined;
jest.mock('./utils', () => {
  const utils = require.requireActual('./utils');
  const originalGenerateUniqueTimestampId = utils.generateUniqueTimestampId;
  return {
    ...utils,
    generateUniqueTimestampId: () => {
      return mockGenerateUniqueTimestampId
        ? mockGenerateUniqueTimestampId()
        : originalGenerateUniqueTimestampId();
    },
  };
});

const MS_PER_DAY = 1000 * 60 * 60 * 24;

describe('CardStore progress reporting', () => {
  let dataStore: DataStore;
  let subject: CardStore;
  let relativeTime: (diffInDays: number) => Date;

  beforeEach(() => {
    // Pre-fetching views seems to be a real bottle-neck when running tests
    dataStore = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });
    subject = dataStore.cardStore;
    relativeTime = diffInDays =>
      new Date(dataStore.reviewTime.getTime() + diffInDays * MS_PER_DAY);
  });

  afterEach(() => dataStore.destroy());

  it('returns the progress when getting cards', async () => {
    await subject.putCard({ front: 'Question', back: 'Answer' });
    const cards = await subject.getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].progress.level).toBe(0);
    expect(cards[0].progress.due).toBeNull();
  });

  it('returns the progress when getting a single card', async () => {
    const newCard = await subject.putCard({
      front: 'Question',
      back: 'Answer',
    });
    const card = await subject.getCard(newCard.id);
    expect(card.progress).toMatchObject({ level: 0, due: null });
  });

  it('returns the progress when getting cards by id', async () => {
    const card1 = await subject.putCard({
      front: 'Question 1',
      back: 'Answer 1',
    });
    const card2 = await subject.putCard({
      front: 'Question 2',
      back: 'Answer 2',
    });
    const cards = await subject.getCardsById([card1.id, card2.id]);
    expect(cards[0].progress).toMatchObject({ level: 0, due: null });
    expect(cards[1].progress).toMatchObject({ level: 0, due: null });
  });

  it('returns the progress when reporting added cards', async () => {
    const changesPromise = waitForChangeEvents<CardChange>(
      dataStore,
      'card',
      1
    );

    await subject.putCard({ front: 'Q1', back: 'A1' });

    const changes = await changesPromise;
    expect(changes[0]).toMatchObject({
      card: {
        progress: {
          level: 0,
          due: null,
        },
      },
    });
  });

  it('returns the progress when adding cards', async () => {
    const newCard = await subject.putCard({
      front: 'Question',
      back: 'Answer',
    });
    expect(newCard).toMatchObject({ progress: { level: 0, due: null } });
  });

  it('returns the progress when updating cards', async () => {
    const newCard = await subject.putCard({
      front: 'Question',
      back: 'Answer',
    });
    const updatedCard = await subject.putCard({
      id: newCard.id,
      front: 'Updated question',
    });
    expect(updatedCard.progress).toMatchObject({ level: 0, due: null });
  });

  it('does not update the card modified time when only updating the progress', async () => {
    const newCard = await subject.putCard({
      front: 'Question',
      back: 'Answer',
    });
    const updatedCard = await subject.putCard({
      id: newCard.id,
      progress: { level: 1, due: null },
    });
    expect(updatedCard.modified).toBe(newCard.modified);

    const fetchedCard = await subject.getCard(newCard.id);
    expect(fetchedCard.modified).toBe(newCard.modified);
  });

  it('allows resetting the progress', async () => {
    const newCard = await subject.putCard({
      front: 'Question',
      back: 'Answer',
      progress: { due: relativeTime(0), level: 1 },
    });
    let fetchedCard = await subject.getCard(newCard.id);
    expect(fetchedCard.progress.level).toBe(1);

    await subject.putCard({
      id: newCard.id,
      progress: { level: 0, due: null },
    });

    fetchedCard = await subject.getCard(newCard.id);
    expect(fetchedCard.progress.level).toBe(0);
  });

  it('allows updating the card contents and progress simultaneously', async () => {
    const newCard = await subject.putCard({
      front: 'Question',
      back: 'Answer',
    });

    const updatedCard = await subject.putCard({
      id: newCard.id,
      front: 'Updated question',
      progress: { level: 1, due: relativeTime(0) },
    });
    expect(updatedCard.front).toBe('Updated question');
    expect(updatedCard.progress.level).toBe(1);
    expect(updatedCard.progress.due).toEqual(relativeTime(0));
    expect(updatedCard.modified).not.toEqual(newCard.modified);

    const fetchedCard = await subject.getCard(newCard.id);
    expect(fetchedCard.front).toBe('Updated question');
    expect(fetchedCard.progress.level).toBe(1);
    expect(fetchedCard.progress.due).toEqual(relativeTime(0));
    expect(fetchedCard.modified).not.toEqual(newCard.modified);
  });

  it('allows setting the card contents and progress simultaneously', async () => {
    const newCard = await subject.putCard({
      front: 'Question',
      back: 'Answer',
      progress: { level: 1, due: relativeTime(-2) },
    });
    expect(newCard.progress.level).toBe(1);

    const fetchedCard = await subject.getCard(newCard.id);
    expect(fetchedCard.progress.level).toBe(1);
    expect(fetchedCard.progress.due).toEqual(relativeTime(-2));
  });

  it('reports changes to the progress', async () => {
    const changesPromise = waitForChangeEvents<CardChange>(
      dataStore,
      'card',
      2
    );

    const card = await subject.putCard({ front: 'Q1', back: 'A1' });
    await subject.putCard({
      id: card.id,
      progress: { level: 1, due: relativeTime(-3) },
    });

    const changes = await changesPromise;

    expect(changes[1].card.progress!.level).toBe(1);
    expect(changes[1].card.progress!.due).toEqual(relativeTime(-3));
    expect(changes[1].card.front).toBe('Q1');
  });

  it('only reports once when a card and its progress are deleted', async () => {
    const changesPromise = waitForChangeEvents<CardChange>(
      dataStore,
      'card',
      2
    );

    const card = await subject.putCard({ front: 'Q1', back: 'A1' });
    await subject.deleteCard(card.id);

    const changes = await changesPromise;

    expect(changes).toHaveLength(2);
    expect(changes[1].deleted).toBe(true);

    // Progress information won't be included because it's too difficult to look
    // up the latest revision and return it.
    expect(changes[1].card.progress).toBe(undefined);
  });

  it('deletes the card when the corresponding progress document cannot be created', async () => {
    // Override ID generation so we can ensure there will be a conflicting
    // progress document.
    mockGenerateUniqueTimestampId = () => 'abc';

    let testRemote;
    try {
      // Create a remote with a progress document that will conflict
      testRemote = new PouchDB('cards_remote', { adapter: 'memory' });
      await testRemote.put({ _id: 'progress-abc' });

      // Sync it to our subject
      let resolveIdle: () => void;
      const idlePromise = new Promise(resolve => {
        resolveIdle = resolve;
      });
      await dataStore.setSyncServer(testRemote, {
        onIdle: () => resolveIdle(),
      });
      await idlePromise;
      expect(await subject.hasProgressDocument('abc')).toBe(true);

      // Then try to create a card with an ID that will conflict
      await subject.putCard({ front: 'Question', back: 'Answer' });
      expect(false).toBe(true);
    } catch (err) {
      // Should be a conflict error
      expect(err.status).toBe(409);
      try {
        await subject.getCard('abc');
        expect(false).toBe(true);
      } catch (err) {
        expect(err.status).toBe(404);
      }
    } finally {
      if (testRemote) {
        testRemote.destroy();
      }
      mockGenerateUniqueTimestampId = undefined;
    }
  });

  it('deletes the corresponding progress document when deleting a card', async () => {
    const card = await subject.putCard({
      front: 'Question',
      back: 'Answer',
    });
    await subject.deleteCard(card.id);

    expect(await subject.hasProgressDocument(card.id)).toBe(false);
  });

  it('deletes the corresponding progress document when deleting a card by ID', async () => {
    const card = await subject.putCard({
      front: 'Question',
      back: 'Answer',
    });
    await subject.deleteCard(card.id);

    expect(await subject.hasProgressDocument(card.id)).toBe(false);
  });
});
