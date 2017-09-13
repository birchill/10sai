/* global afterEach, beforeEach, describe, it */
/* eslint arrow-body-style: [ "off" ] */
// @format

import PouchDB from 'pouchdb';
import memdown from 'memdown';
import { assert, AssertionError } from 'chai';
import CardStore from '../src/CardStore';

describe('CardStore progress reporting', () => {
  let subject;

  beforeEach('setup new store', () => {
    subject = new CardStore({ pouch: { db: memdown } });
  });

  afterEach('clean up store', () => subject.destroy());

  it('creates a progress record when adding a new card', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    assert.isTrue(await subject.hasProgressRecord(card._id));
  });

  it('deletes the card when the corresponding progress record cannot be created', async () => {
    // Override ID generation so we can ensure there will be a conflicting
    // progress record.
    const originalGenerateCardId = CardStore.generateCardId;
    CardStore.generateCardId = () => 'abc';

    let testRemote;
    try {
      // Create a remote with a progress record that will conflict
      const testRemote = new PouchDB('cards_remote', { db: memdown });
      await testRemote.put({ _id: 'progress-abc' });

      // Sync it to our subject
      let resolveIdle;
      const idlePromise = new Promise(resolve => {
        resolveIdle = resolve;
      });
      await subject.setSyncServer(testRemote, { onIdle: () => resolveIdle() });
      await idlePromise;
      assert.isTrue(await subject.hasProgressRecord('abc'));

      // Then try to create a card with an ID that will conflict
      await subject.putCard({ question: 'Question', answer: 'Answer' });
      assert.fail('Should have failed to create the card');
    } catch (err) {
      // Should be a conflict error
      assert.strictEqual(err.status, 409);
      try {
        await subject.getCard('abc');
        assert.fail('Should have failed to fetch card');
      } catch (err) {
        if (err instanceof AssertionError) {
          throw err;
        }
        assert.strictEqual(err.status, 404);
      }
    } finally {
      if (testRemote) {
        testRemote.destroy();
      }
      CardStore.generateCardId = originalGenerateCardId;
    }
  });

  it('returns cards based on their overdueness', async () => {
    // First add a bunch of cards
    const cards = new Array(5);
    for (let i = 0; i < cards.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      cards[i] = await subject.putCard({
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
      });
    }

    const MS_PER_DAY = 1000 * 60 * 60;
    const relativeTime = diffInDays =>
      new Date(subject.reviewTime.getTime() + diffInDays * MS_PER_DAY);

    // Set their progress somewhat randomly so we can test the sorting of the
    // result.
    //
    // Card 1: Not *quite* overdue yet
    await subject.updateProgress(cards[0]._id, {
      reviewed: relativeTime(-1.9),
      level: 2,
    });
    // Card 2: Very overdue
    await subject.updateProgress(cards[1]._id, {
      reviewed: relativeTime(-200),
      level: 20,
    });
    // Card 3: Just overdue
    await subject.updateProgress(cards[2]._id, {
      reviewed: relativeTime(-2.1),
      level: 2,
    });
    // Card 4: Precisely overdue to the second
    await subject.updateProgress(cards[3]._id, {
      reviewed: relativeTime(-1),
      level: 1,
    });
    // Card 5: Somewhat overdue
    await subject.updateProgress(cards[4]._id, {
      reviewed: relativeTime(-12),
      level: 8,
    });

    // Given, the above we'd expect the result to be:
    //
    //     [ Card 2, Card 5, Card 3, Card 4 ]
    const result = await subject.getOverdueCards();
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0].question, 'Question 2');
    assert.strictEqual(result[1].question, 'Question 5');
    assert.strictEqual(result[2].question, 'Question 3');
    assert.strictEqual(result[3].question, 'Question 4');
  });

  it('respects the limit set when returning overdue cards', async () => {
    // Add cards
    const cards = new Array(4);
    for (let i = 0; i < cards.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      cards[i] = await subject.putCard({
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
      });
    }

    // Make the cards progressively overdue.
    const MS_PER_DAY = 1000 * 60 * 60;
    const reviewed = new Date(subject.reviewTime.getTime() - 3 * MS_PER_DAY);
    for (const card of cards) {
      reviewed.setTime(reviewed.getTime() - MS_PER_DAY);
      // eslint-disable-next-line no-await-in-loop
      await subject.updateProgress(card._id, {
        reviewed,
        level: 3,
      });
    }

    const result = await subject.getOverdueCards({ limit: 2 });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].question, 'Question 4');
    assert.strictEqual(result[1].question, 'Question 3');
  });

  // TODO: Test updating review time
});
