/* global afterEach, beforeEach, describe, it */
/* eslint arrow-body-style: [ "off" ] */
// @format

import PouchDB from 'pouchdb';
import memdown from 'memdown';
import { assert, AssertionError } from 'chai';
import CardStore from '../src/CardStore';
import { waitForEvents } from './testcommon';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

describe('CardStore progress reporting', () => {
  let subject;
  let relativeTime;

  beforeEach('setup new store', () => {
    // Pre-fetching views seems to be a real bottle-neck when running tests
    subject = new CardStore({ pouch: { db: memdown }, prefetchViews: false });
    relativeTime = diffInDays =>
      new Date(subject.reviewTime.getTime() + diffInDays * MS_PER_DAY);
  });

  afterEach('clean up store', () => subject.destroy());

  it('returns the progress when getting cards', async () => {
    await subject.putCard({ question: 'Question', answer: 'Answer' });
    const cards = await subject.getCards();
    assert.strictEqual(cards.length, 1, 'Length of getCards() result');
    assert.strictEqual(cards[0].level, 0);
    assert.strictEqual(cards[0].reviewed, null);
  });

  it('returns the progress when getting a single card', async () => {
    const newCard = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    const card = await subject.getCard(newCard._id);
    assert.strictEqual(card.level, 0);
    assert.strictEqual(card.reviewed, null);
  });

  it('returns the progress when reporting added cards', async () => {
    let updateInfo;
    subject.changes.on('change', info => {
      updateInfo = info;
    });

    await subject.putCard({ question: 'Q1', answer: 'A1' });
    // Wait for a few rounds of events so the update can take place
    await waitForEvents(3);

    assert.isOk(updateInfo, 'Change was recorded');
    assert.strictEqual(updateInfo.doc.level, 0);
    assert.strictEqual(updateInfo.doc.reviewed, null);
  });

  // TODO: Test that the card returned when putting a card includes the progress
  // TODO: Test that changes to the progress are reported

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

  it('deletes the corresponding progress record when deleting a card', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.deleteCard(card);

    assert.isFalse(await subject.hasProgressRecord(card._id));
  });

  async function addCards(num) {
    const cards = new Array(num);
    for (let i = 0; i < cards.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      cards[i] = await subject.putCard({
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
      });
    }
    return cards;
  }

  it('returns cards based on their overdueness', async () => {
    // First add a bunch of cards
    const cards = await addCards(5);

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
    const result = await subject.getCards({ type: 'overdue' });
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0].question, 'Question 2');
    assert.strictEqual(result[1].question, 'Question 5');
    assert.strictEqual(result[2].question, 'Question 3');
    assert.strictEqual(result[3].question, 'Question 4');
  });

  it('respects the limit set when returning overdue cards', async () => {
    // Add cards
    const cards = await addCards(4);

    // Make the cards progressively overdue.
    const reviewed = new Date(subject.reviewTime.getTime() - 3 * MS_PER_DAY);
    for (const card of cards) {
      reviewed.setTime(reviewed.getTime() - MS_PER_DAY);
      // eslint-disable-next-line no-await-in-loop
      await subject.updateProgress(card._id, {
        reviewed,
        level: 3,
      });
    }

    const result = await subject.getCards({ type: 'overdue', limit: 2 });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].question, 'Question 4');
    assert.strictEqual(result[1].question, 'Question 3');
  });

  it('sorts failed cards first', async () => {
    const cards = await addCards(3);

    // Card 1: Just overdue
    await subject.updateProgress(cards[0]._id, {
      reviewed: relativeTime(-2.1),
      level: 2,
    });
    // Card 2: Failed (and overdue)
    await subject.updateProgress(cards[1]._id, {
      reviewed: relativeTime(-2.1),
      level: 0,
    });
    // Card 3: Just overdue
    await subject.updateProgress(cards[2]._id, {
      reviewed: relativeTime(-2.1),
      level: 2,
    });

    const result = await subject.getCards({ type: 'overdue' });
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].question, 'Question 2');
    assert.strictEqual(result[1].question, 'Question 3');
    assert.strictEqual(result[2].question, 'Question 1');
  });

  it('allows skipping failed cards', async () => {
    const cards = await addCards(3);

    // Card 1: Just overdue
    await subject.updateProgress(cards[0]._id, {
      reviewed: relativeTime(-2.1),
      level: 2,
    });
    // Card 2: Failed (and overdue)
    await subject.updateProgress(cards[1]._id, {
      reviewed: relativeTime(-2.1),
      level: 0,
    });
    // Card 3: Just overdue
    await subject.updateProgress(cards[2]._id, {
      reviewed: relativeTime(-2.1),
      level: 2,
    });

    const result = await subject.getCards({
      type: 'overdue',
      skipFailedCards: true,
    });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].question, 'Question 3');
    assert.strictEqual(result[1].question, 'Question 1');
  });

  it('allows the review time to be updated', async () => {
    const cards = await addCards(3);

    // Card 1: Level now: -1, in 10 days' time: 9
    await subject.updateProgress(cards[0]._id, {
      reviewed: subject.reviewTime,
      level: 1,
    });
    // Card 2: Level now: 0.2, in 10 days' time: 10.2
    await subject.updateProgress(cards[1]._id, {
      reviewed: relativeTime(-1.2),
      level: 1,
    });
    // Card 3: Level now: 0.333, in 10 days' time: 0.666
    await subject.updateProgress(cards[2]._id, {
      reviewed: relativeTime(-40),
      level: 30,
    });

    // Initially only cards 3 and 2 are due, and in that order ...
    let result = await subject.getCards({ type: 'overdue' });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].question, 'Question 3');
    assert.strictEqual(result[1].question, 'Question 2');

    // ... but in 10 days' time ...
    await subject.setReviewTime(relativeTime(10));

    // ... we should get card 2, card 1, card 3
    result = await subject.getCards({ type: 'overdue' });
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].question, 'Question 2');
    assert.strictEqual(result[1].question, 'Question 1');
    assert.strictEqual(result[2].question, 'Question 3');
  });

  it('returns new cards, oldest first', async () => {
    // Create some cards with creation time spaced out
    const waitASec = () =>
      new Promise(resolve => {
        setTimeout(resolve, 1);
      });
    const cards = new Array(3);
    for (let i = 0; i < cards.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      cards[i] = await subject.putCard({
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
      });
      // eslint-disable-next-line no-await-in-loop
      await waitASec();
    }

    const result = await subject.getCards({ type: 'new' });
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].question, 'Question 3');
    assert.strictEqual(result[1].question, 'Question 2');
    assert.strictEqual(result[2].question, 'Question 1');
  });

  it('returns the review level along with overdue cards', async () => {
    const cards = await addCards(2);

    await subject.updateProgress(cards[0]._id, {
      reviewed: relativeTime(-1),
      level: 1,
    });
    await subject.updateProgress(cards[1]._id, {
      reviewed: relativeTime(-4),
      level: 2,
    });

    const result = await subject.getCards({ type: 'overdue' });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].question, 'Question 2');
    assert.strictEqual(result[0].level, 2, 'Level of first card');
    assert.strictEqual(result[1].question, 'Question 1');
    assert.strictEqual(result[1].level, 1, 'Level of second card');
  });

  it('returns the review level along with new cards', async () => {
    await addCards(2);

    const result = await subject.getCards({ type: 'new' });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].question, 'Question 2');
    assert.strictEqual(result[0].level, 0, 'Level of first card');
    assert.strictEqual(result[1].question, 'Question 1');
    assert.strictEqual(result[1].level, 0, 'Level of second card');
  });
});
