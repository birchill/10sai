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
    assert.strictEqual(cards[0].progress.level, 0);
    assert.strictEqual(cards[0].progress.reviewed, null);
  });

  it('returns the progress when getting a single card', async () => {
    const newCard = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    const card = await subject.getCard(newCard._id);
    assert.strictEqual(card.progress.level, 0);
    assert.strictEqual(card.progress.reviewed, null);
  });

  it('returns the progress when reporting added cards', async () => {
    let updateInfo;
    subject.changes.on('change', info => {
      updateInfo = info;
    });

    await subject.putCard({ question: 'Q1', answer: 'A1' });
    // Wait for a few rounds of events so the update can take place
    await waitForEvents(5);

    assert.isOk(updateInfo, 'Change was recorded');
    assert.strictEqual(updateInfo.doc.progress.level, 0);
    assert.strictEqual(updateInfo.doc.progress.reviewed, null);
  });

  it('returns the progress when adding cards', async () => {
    const newCard = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    assert.strictEqual(newCard.progress.level, 0);
    assert.strictEqual(newCard.progress.reviewed, null);
  });

  it('returns the progress when updating cards', async () => {
    const newCard = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    const updatedCard = await subject.putCard({
      _id: newCard._id,
      question: 'Updated question',
    });
    assert.strictEqual(updatedCard.progress.level, 0);
    assert.strictEqual(updatedCard.progress.reviewed, null);
  });

  it('does not update the card modified time when only updating the progress', async () => {
    const newCard = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    const updatedCard = await subject.putCard({
      _id: newCard._id,
      progress: { level: 1 },
    });
    assert.strictEqual(
      updatedCard.modified,
      newCard.modified,
      'Modified time on card returned from putCard'
    );

    const fetchedCard = await subject.getCard(newCard._id);
    assert.strictEqual(
      fetchedCard.modified,
      newCard.modified,
      'Modified time on card returned from getCard'
    );
  });

  it('allows updating the card contents and progress simultaneously', async () => {
    const newCard = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });

    const updatedCard = await subject.putCard({
      _id: newCard._id,
      question: 'Updated question',
      progress: { level: 1 },
    });
    assert.strictEqual(updatedCard.question, 'Updated question');
    assert.strictEqual(updatedCard.progress.level, 1);
    assert.notEqual(
      updatedCard.modified,
      newCard.modified,
      'Modified time is updated'
    );

    const fetchedCard = await subject.getCard(newCard._id);
    assert.strictEqual(fetchedCard.question, 'Updated question');
    assert.strictEqual(fetchedCard.progress.level, 1);
    assert.notEqual(
      fetchedCard.modified,
      newCard.modified,
      'Modified time is updated'
    );
  });

  it('reports changes to the progress', async () => {
    const updates = [];
    subject.changes.on('change', info => {
      updates.push(info);
    });

    const card = await subject.putCard({ question: 'Q1', answer: 'A1' });
    await subject.putCard({ _id: card._id, progress: { level: 1 } });

    // Wait for a few rounds of events so the update records can happen
    await waitForEvents(8);

    assert.strictEqual(
      updates.length,
      2,
      'Should get two change records: add, update'
    );
    assert.strictEqual(updates[1].doc.progress.level, 1);
    assert.strictEqual(updates[1].doc.question, 'Q1');
  });

  it('only reports once when a card and its progress are deleted', async () => {
    const updates = [];
    subject.changes.on('change', info => {
      updates.push(info);
    });

    const card = await subject.putCard({ question: 'Q1', answer: 'A1' });
    await subject.deleteCard(card);

    // Wait for a few rounds of events so the update records can happen
    await waitForEvents(8);

    assert.strictEqual(
      updates.length,
      2,
      'Should get two change records: add, delete'
    );
    assert.strictEqual(updates[1].deleted, true);

    // Progress information won't be included because it's too difficult to look
    // up the latest revision and return it.
    assert.strictEqual(updates[1].doc.progress, undefined);
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
    await subject.putCard({
      _id: cards[0]._id,
      progress: { reviewed: relativeTime(-1.9), level: 2 },
    });
    // Card 2: Very overdue
    await subject.putCard({
      _id: cards[1]._id,
      progress: { reviewed: relativeTime(-200), level: 20 },
    });
    // Card 3: Just overdue
    await subject.putCard({
      _id: cards[2]._id,
      progress: { reviewed: relativeTime(-2.1), level: 2 },
    });
    // Card 4: Precisely overdue to the second
    await subject.putCard({
      _id: cards[3]._id,
      progress: { reviewed: relativeTime(-1), level: 1 },
    });
    // Card 5: Somewhat overdue
    await subject.putCard({
      _id: cards[4]._id,
      progress: { reviewed: relativeTime(-12), level: 8 },
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
      await subject.putCard({
        _id: card._id,
        progress: { reviewed, level: 3 },
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
    await subject.putCard({
      _id: cards[0]._id,
      progress: { reviewed: relativeTime(-2.1), level: 2 },
    });
    // Card 2: Failed (and overdue)
    await subject.putCard({
      _id: cards[1]._id,
      progress: { reviewed: relativeTime(-2.1), level: 0 },
    });
    // Card 3: Just overdue
    await subject.putCard({
      _id: cards[2]._id,
      progress: { reviewed: relativeTime(-2.1), level: 2 },
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
    await subject.putCard({
      _id: cards[0]._id,
      progress: { reviewed: relativeTime(-2.1), level: 2 },
    });
    // Card 2: Failed (and overdue)
    await subject.putCard({
      _id: cards[1]._id,
      progress: { reviewed: relativeTime(-2.1), level: 0 },
    });
    // Card 3: Just overdue
    await subject.putCard({
      _id: cards[2]._id,
      progress: { reviewed: relativeTime(-2.1), level: 2 },
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
    await subject.putCard({
      _id: cards[0]._id,
      progress: { reviewed: subject.reviewTime, level: 1 },
    });
    // Card 2: Level now: 0.2, in 10 days' time: 10.2
    await subject.putCard({
      _id: cards[1]._id,
      progress: { reviewed: relativeTime(-1.2), level: 1 },
    });
    // Card 3: Level now: 0.333, in 10 days' time: 0.666
    await subject.putCard({
      _id: cards[2]._id,
      progress: { reviewed: relativeTime(-40), level: 30 },
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

    await subject.putCard({
      _id: cards[0]._id,
      progress: { reviewed: relativeTime(-1), level: 1 },
    });
    await subject.putCard({
      _id: cards[1]._id,
      progress: { reviewed: relativeTime(-4), level: 2 },
    });

    const result = await subject.getCards({ type: 'overdue' });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].question, 'Question 2');
    assert.strictEqual(result[0].progress.level, 2, 'Level of first card');
    assert.strictEqual(result[1].question, 'Question 1');
    assert.strictEqual(result[1].progress.level, 1, 'Level of second card');
  });

  it('returns the review level along with new cards', async () => {
    await addCards(2);

    const result = await subject.getCards({ type: 'new' });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].question, 'Question 2');
    assert.strictEqual(result[0].progress.level, 0, 'Level of first card');
    assert.strictEqual(result[1].question, 'Question 1');
    assert.strictEqual(result[1].progress.level, 0, 'Level of second card');
  });
});
