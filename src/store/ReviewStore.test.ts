/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import PouchDB from 'pouchdb';

import DataStore from './DataStore';
import { ReviewContent, ReviewStore } from './ReviewStore';
import { Review } from '../model';
import { waitForEvents } from '../utils/testing';
import {
  syncWithWaitableRemote,
  waitForHackilyTypedChangeEvents,
} from './test-utils';

PouchDB.plugin(require('pouchdb-adapter-memory'));

const waitForMs = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

// Note: Using numbers other than 1 for 'num' might be unsafe since, if the
// changes are to the same document they might get batched together.
const waitForNumReviewChanges = (db, num) => {
  let resolver;
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
    failedCardsLevel1: ['def'],
    failedCardsLevel2: [],
    reviewTime: new Date(),
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
    await subject.putReview(typicalReview);
    const gotReview = await subject.getReview();
    expect(gotReview).toEqual(typicalReview);
  });

  it('updates the latest review', async () => {
    // Setup a remote so we can read back the review document
    await dataStore.setSyncServer(testRemote);

    // Put documents twice
    await subject.putReview(typicalReview);
    await waitForNumReviewChanges(testRemote, 1);

    // But wait a few milliseconds between to ensure they have different IDs
    await waitForMs(2);
    await subject.putReview({ ...typicalReview, completed: 2 });
    await waitForNumReviewChanges(testRemote, 1);

    const reviews = await testRemote.allDocs<ReviewContent>({
      startkey: 'review-',
      endkey: 'review-\ufff0',
      include_docs: true,
    });

    // We should have updated the one document
    expect(reviews.rows).toHaveLength(1);
    expect(reviews.rows[0].value.rev).toEqual(expect.stringMatching(/^2-/));
    expect(reviews.rows[0].doc.completed).toBe(2);
  });

  it('returns the latest review', async () => {
    const waitForIdle = await syncWithWaitableRemote(dataStore, testRemote);

    // Push two new docs to the remote
    await testRemote.put({
      ...typicalReview,
      completed: 1,
      _id: 'review-1',
    });
    await testRemote.put({
      ...typicalReview,
      completed: 2,
      _id: 'review-2',
    });

    // Wait for sync to finish
    await waitForIdle();

    // Check the result of getReview
    const review = await subject.getReview();
    expect(review.completed).toBe(2);
  });

  it('allows deleting reviews', async () => {
    await subject.putReview(typicalReview);
    await subject.deleteReview();
    const gotReview = await subject.getReview();
    expect(gotReview).toBe(null);
  });

  it('deletes all reviews', async () => {
    const waitForIdle = await syncWithWaitableRemote(dataStore, testRemote);

    // Push two new docs to the remote
    await testRemote.put({
      ...typicalReview,
      completed: 1,
      _id: 'review-1',
    });
    await testRemote.put({
      ...typicalReview,
      completed: 2,
      _id: 'review-2',
    });

    // Wait for sync to finish then delete
    await waitForIdle();
    await subject.deleteReview();

    // Wait for sync to finish
    await waitForIdle();

    // Check there are no review docs in the remote
    const result = await testRemote.allDocs({
      startkey: 'review',
      endkey: 'review-\ufff0',
    });
    expect(result.rows).toHaveLength(0);
  });

  it('resolves conflicts by choosing the furthest review progress', async () => {
    // Create a new review and get the ID
    await subject.putReview(typicalReview);
    const localReview = await subject._getReview();

    // Create a new review with the same ID on the remote but with a greater
    // completed value.
    await testRemote.put({
      ...typicalReview,
      completed: 2,
      _id: localReview._id,
    });

    // Now connect the two and let chaos ensue
    const waitForIdle = await syncWithWaitableRemote(dataStore, testRemote);
    await waitForIdle();

    // Check that the conflict is gone...
    const result = await testRemote.get<ReviewContent>(localReview._id, {
      conflicts: true,
    });
    expect(result._conflicts).toBeUndefined();
    // ... and that we chose the right review
    expect(result.completed).toBe(2);
  });

  it('reports new review docs', async () => {
    const changesPromise = waitForHackilyTypedChangeEvents(
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

  it('reports deleted review docs', async () => {
    await subject.putReview(typicalReview);
    const changesPromise = waitForHackilyTypedChangeEvents(
      dataStore,
      'review',
      1
    );
    await subject.deleteReview();
    const changes = await changesPromise;
    expect(changes[0]).toBeNull();
  });

  it('does not report new review docs older than current', async () => {
    // Create regular review and wait for it to be reported
    const changesPromise = waitForHackilyTypedChangeEvents(
      dataStore,
      'review',
      1
    );
    await subject.putReview(typicalReview);
    await changesPromise;

    // Start monitoring for further changes
    const changes = [];
    dataStore.changes.on('review', change => {
      changes.push(change);
    });

    // Create remote with a review with earlier ID and wait for them to sync
    const waitForIdle = await syncWithWaitableRemote(dataStore, testRemote);
    await testRemote.put({
      ...typicalReview,
      completed: 2,
      _id: 'review-0',
    });
    await waitForIdle();

    // Wait for a few cycles and test that no changes are reported
    await waitForEvents(5);
    expect(changes).toHaveLength(0);
  });
});
