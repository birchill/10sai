import PouchDB from 'pouchdb';

import { DataStore } from './DataStore';
import { ReviewContent, ReviewStore } from './ReviewStore';
import { Review } from '../model';
import { syncWithWaitableRemote, waitForChangeEvents } from './test-utils';

PouchDB.plugin(require('pouchdb-adapter-memory'));

// Note: Using numbers other than 1 for 'num' might be unsafe since, if the
// changes are to the same document they might get batched together.
const waitForNumReviewChanges = (db: PouchDB.Database, num: number) => {
  let resolver: () => void;
  const promise = new Promise(resolve => {
    resolver = resolve;
  });

  let recordedChanges = 0;
  db.changes({ since: 'now', live: true }).on('change', change => {
    if (!change.id.startsWith('review-')) {
      return;
    }
    if (++recordedChanges === num) {
      resolver();
    }
  });

  return promise;
};

describe('ReviewStore', () => {
  let dataStore: DataStore;
  let subject: ReviewStore;
  let testRemote: PouchDB.Database;

  const typicalReview: Review = {
    maxCards: 3,
    maxNewCards: 2,
    completed: 1,
    newCardsCompleted: 0,
    history: ['abc', 'def'],
    failed: ['def'],
  };

  beforeEach(() => {
    // Pre-fetching views seems to be a real bottle-neck when running tests
    dataStore = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });
    subject = dataStore.reviewStore;

    // A separate remote we use for reading back documents directly, injecting
    // conflicting documents etc.
    testRemote = new PouchDB('cards_remote', { adapter: 'memory' });
  });

  afterEach(() => Promise.all([dataStore.destroy(), testRemote.destroy()]));

  it('returns a newly-added review', async () => {
    // Initially there should be no review
    expect(await subject.getReview()).toBeNull();

    await subject.putReview(typicalReview);
    const gotReview = await subject.getReview();
    expect(gotReview).toEqual(typicalReview);
  });

  it('updates a review', async () => {
    // Setup a remote so we can read back the review document
    await dataStore.setSyncServer(testRemote);

    // Put document with changes
    await subject.putReview(typicalReview);
    await waitForNumReviewChanges(testRemote, 1);

    await subject.putReview({ ...typicalReview, completed: 2 });
    await waitForNumReviewChanges(testRemote, 1);

    const review = await testRemote.get<ReviewContent>('review-default');

    // We should have updated the one document
    expect(review._rev).toEqual(expect.stringMatching(/^2-/));
    expect(review.completed).toBe(2);
    expect(review.finished).toBe(false);
  });

  it('allows finishing reviews', async () => {
    await subject.putReview(typicalReview);
    await subject.finishReview();
    const gotReview = await subject.getReview();
    expect(gotReview).toBeNull();
  });

  it('resolves conflicts by choosing the furthest review progress', async () => {
    // Create a new review locally.
    await subject.putReview(typicalReview);

    // Create a new review on the remote with a greater completed value.
    await testRemote.put({
      ...typicalReview,
      _id: 'review-default',
      completed: 2,
      finished: false,
    });

    // Wait a moment for the different stores to update their sequence stores.
    //
    // (There seems to be a bug in pouchdb-adapter-leveldb-core where if we
    // don't do this, we'll sometimes end up with random errors from picking up
    // undefined documents from the sequence store. It appears to be doing some
    // work async so I suspect we just need to let it settle down.)
    await new Promise(resolve => setTimeout(resolve, 50));

    // Now connect the two and let chaos ensue
    const waitForIdle = await syncWithWaitableRemote(dataStore, testRemote);
    await waitForIdle();

    // Check that the conflict is gone...
    const result = await testRemote.get<ReviewContent>('review-default', {
      conflicts: true,
    });
    expect(result._conflicts).toBeUndefined();
    // ... and that we chose the right review
    expect(result.completed).toBe(2);
  });

  it('reports new review docs', async () => {
    const changesPromise = waitForChangeEvents<Review | null>(
      dataStore,
      'review',
      1
    );
    await subject.putReview({ ...typicalReview, completed: 7 });
    const changes = await changesPromise;
    expect(changes[0]).toMatchObject({
      completed: 7,
    });
  });

  it('reports finished review docs', async () => {
    await subject.putReview(typicalReview);
    const changesPromise = waitForChangeEvents<Review | null>(
      dataStore,
      'review',
      1
    );
    await subject.finishReview();
    const changes = await changesPromise;
    expect(changes[0]).toBeNull();
  });
});
