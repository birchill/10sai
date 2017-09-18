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
      promises.push(
        store.putCard({
          question: `Question ${i + 1}`,
          answer: `Answer ${i + 1}`,
        })
      );
    }
    return Promise.all(promises);
  }

  async function makeOverdue(card, daysOverdue, level) {
    const progress = {
      reviewed: new Date(store.reviewTime.getTime() - daysOverdue * MS_PER_DAY),
    };
    if (typeof level !== 'undefined') {
      progress.level = level;
    }
    return store.updateProgress(card._id, progress);
  }

  /*
   * Initial selection
   */

  it('respects the limits set', async function test() {
    // This test takes a while
    this.timeout(3000);

    // Add 20 new cards
    const cards = await addCards(20);

    // Make 15 overdue
    const progressPromises = [];
    for (let i = 0; i < 15; i++) {
      progressPromises.push(makeOverdue(cards[i], 2, 1));
    }
    await Promise.all(progressPromises);

    await subject.setReviewLimits({ total: 10, unreviewed: 2 });
    assert.strictEqual(subject.completeCount, 0, 'complete count');
    assert.strictEqual(subject.failCount, 0, 'fail count');
    assert.strictEqual(subject.newCount, 2, 'new count');
    assert.strictEqual(subject.unseenCount, 10, 'unseen count');
    assert.strictEqual(subject.questionsRemaining, 10, 'questions remaining');
  });

  /*
   * Current, next, and previous cards
   *
   * (Should we have two next cards? Next if correct, next if incorrect?)
   *
   * -- test we choose them randomly
   * -- test that when the queues are updated (by calling setReviewLimits) that
   *    the current card is not changed
   */

  it('chooses the current card randomly', async () => {
  });

  it('weights the choice towards the more overdue cards', async () => {
    // Basically make every second card more overdue than the others then repeat
    // the above over and over many times and check that the even cards get
    // chosen more.
  });

  it('does not change the current or previous cards when the review queues are regenerated', async () => {
    // (Might be hard to test the previous card at this point)
  });

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
