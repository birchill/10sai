// @format
/* global afterEach, beforeEach, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import { assert } from 'chai';
import CardStore from '../src/CardStore';
import ReviewMaster from '../src/ReviewMaster';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

describe('ReviewMaster', () => {
  let store;
  let subject;

  beforeEach('setup master', () => {
    store = new CardStore({ pouch: { db: memdown } });
    subject = new ReviewMaster(store);
  });

  afterEach('clean up master', () => store.destroy());

  async function addCards(num) {
    const promises = [];
    for (let i = 0; i < num; i++) {
      promises.push(store.putCard({
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
      }));
    }
    return Promise.all(promises);
  }

  /*
   * Initial selection
   */

  it('respects the total limit', async () => {
    // Add 20 new cards
    const cards = await addCards(20);

    // Make 15 overdue
    // TODO: Factor this out
    const progressPromises = [];
    for (let i = 0; i < 15; i++) {
      progressPromises.push(store.updateProgress(cards[i]._id,
        // Make it reviewed two days ago
        { reviewed: new Date(store.reviewTime.getTime() - 2 * MS_PER_DAY),
          level: 1 }));
    }
    await Promise.all(progressPromises);

    await subject.setReviewLimits({ total: 10, unreviewed: 2 });
    assert.strictEqual(subject.questionsRemaining, 10, 'questions remaining');
    assert.strictEqual(subject.completeCount, 0, 'complete count');
    assert.strictEqual(subject.newCount, 2, 'new count');
    assert.strictEqual(subject.repeatQuestionsRemaining, 0,
      'repeat questions remaining');
  });

  it('respects the new limit', async () => {
  });

  it('chooses cards that are relatively less overdue but overall more overdue', async () => {
  });

  /*
   * Current, next, and previous cards
   *
   * -- test we choose them randomly
   */

  /*
   * Updating progress
   */

  /*
   * Incorporating sync changes
   */

  /*
   * Revising results
   */

  /*
   * Syncing review status (separate file?)
   */
});
