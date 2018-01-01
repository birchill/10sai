/* global afterEach, beforeEach, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import { assert } from 'chai';
import CardStore from '../src/CardStore';
import ReviewSyncListener from '../src/ReviewSyncListener';
import { waitForEvents } from './testcommon';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

describe('CardStore', () => {
  let cardStore;
  let subject;
  let relativeTime;

  beforeEach('setup new store', () => {
    cardStore = new CardStore({ pouch: { db: memdown }, prefetchViews: false });
    subject = new ReviewSyncListener(cardStore);
    relativeTime = diffInDays =>
      new Date(cardStore.reviewTime.getTime() + diffInDays * MS_PER_DAY);
  });

  afterEach('clean up store', () => cardStore.destroy());

  it('returns the initial state', async () => {
    let resolveAvailable;
    const availablePromise = new Promise(resolve => {
      resolveAvailable = resolve;
    });
    subject.subscribe('availableCards', availableCards => {
      resolveAvailable(availableCards);
    });

    const result = await availablePromise;

    assert.deepEqual(
      result,
      { newCards: 0, overdueCards: 0 },
      'Initially an empty result is returned'
    );
  });

  it('returns the updated state', async () => {
    const results = [];
    const waitForResults = numResults =>
      new Promise(function checkForResults(resolve) {
        if (results.length >= numResults) {
          resolve(results);
        } else {
          setTimeout(() => {
            checkForResults(resolve);
          }, 0);
        }
      });
    subject.subscribe('availableCards', availableCards => {
      results.push(availableCards);
    });
    // Wait for initial empty record
    await waitForResults(1);

    // Add two new cards as a single batch
    await cardStore.putCard({ question: 'Question #1', answer: 'Answer #1' });
    await cardStore.putCard({ question: 'Question #2', answer: 'Answer #2' });
    await waitForResults(2);

    // Then wait and add an overdue card
    await cardStore.putCard({
      question: 'Question #3',
      answer: 'Answer #3',
      progress: { reviewed: relativeTime(-10), level: 2 },
    });

    await waitForResults(3);

    assert.deepEqual(
      results,
      [
        { newCards: 0, overdueCards: 0 },
        { newCards: 2, overdueCards: 0 },
        { newCards: 2, overdueCards: 1 },
      ],
      'Returns each of the updates'
    );
  });

  it('allows unsubscribing', async () => {
    const results = [];
    const waitForResults = numResults =>
      new Promise(function checkForResults(resolve) {
        if (results.length >= numResults) {
          resolve(results);
        } else {
          setTimeout(() => {
            checkForResults(resolve);
          }, 0);
        }
      });

    // Add a card and wait for its change to be processed
    let resolveInitialCard;
    const initialCardAdded = new Promise(resolve => {
      resolveInitialCard = resolve;
    });
    cardStore.changes.on('change', changes => {
      if (changes.doc.question === 'Question #1') {
        resolveInitialCard();
      }
    });
    await cardStore.putCard({ question: 'Question #1', answer: 'Answer #1' });
    await initialCardAdded;

    // Now we can subscribe
    const listener = availableCards => {
      results.push(availableCards);
    };
    subject.subscribe('availableCards', listener);

    await waitForResults(1);

    // Unsubscribe
    subject.unsubscribe('availableCards', listener);

    // Add another card
    await cardStore.putCard({ question: 'Question #2', answer: 'Answer #2' });

    // Wait a while so that the change has a chance to be processed
    await waitForEvents(50);

    assert.deepEqual(
      results,
      [{ newCards: 1, overdueCards: 0 }],
      'Returns only the first update'
    );
  });

  it('allows multiple subscribers', async () => {
    // TODO
  });
});
