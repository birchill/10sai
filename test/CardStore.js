/* global afterEach, beforeEach, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import chai, { assert } from 'chai';
import chaiDateTime from 'chai-datetime';
import CardStore from '../src/CardStore';
import { waitForEvents } from './testcommon';

chai.use(chaiDateTime);

describe('CardStore', () => {
  let subject;

  beforeEach('setup new store', () => {
    subject = new CardStore({ pouch: { db: memdown }, prefetchViews: false });
  });

  afterEach('clean up store', () => subject.destroy());

  it('is initially empty', async () => {
    const cards = await subject.getCards();
    assert.strictEqual(cards.length, 0, 'Length of getCards() result');
  });

  it('returns added cards', async () => {
    await subject.putCard({ question: 'Question', answer: 'Answer' });
    const cards = await subject.getCards();
    assert.strictEqual(cards.length, 1, 'Length of getCards() result');
    assert.strictEqual(cards[0].question, 'Question');
    assert.strictEqual(cards[0].answer, 'Answer');
  });

  it('returns individual cards', async () => {
    let card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    card = await subject.getCard(card._id);
    assert.strictEqual(card.question, 'Question');
    assert.strictEqual(card.answer, 'Answer');
  });

  it('does not return non-existent cards', async () => {
    try {
      await subject.getCard('abc');
      assert.fail('Should have reported an error for non-existent card');
    } catch (err) {
      assert.strictEqual(err.status, 404);
      assert.strictEqual(err.name, 'not_found');
      assert.strictEqual(err.message, 'missing');
      assert.strictEqual(err.reason, 'missing');
    }
  });

  it('generates unique ascending IDs', () => {
    let prevId = '';
    for (let i = 0; i < 100; i++) {
      const id = CardStore.generateCardId();
      assert.isAbove(id, prevId);
      prevId = id;
    }
  });

  it('does not return the prefix when putting a card', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    assert.notEqual(card._id.substr(0, 5), 'card-');
  });

  it('does not return the prefix when getting a single card', async () => {
    let card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    card = await subject.getCard(card._id);
    assert.notEqual(card._id.substr(0, 5), 'card-');
  });

  it('does not return the prefix when getting multiple cards', async () => {
    await subject.putCard({ question: 'Q1', answer: 'A1' });
    await subject.putCard({ question: 'Q2', answer: 'A2' });

    const cards = await subject.getCards();
    for (const card of cards) {
      assert.notEqual(card._id.substr(0, 5), 'card-');
    }
  });

  it('returns added cards in order', async () => {
    const card1 = await subject.putCard({ question: 'Q1', answer: 'A1' });
    const card2 = await subject.putCard({ question: 'Q2', answer: 'A2' });

    const cards = await subject.getCards();
    // Sanity check
    assert.notStrictEqual(card1._id, card2._id, 'Card IDs are unique');

    assert.strictEqual(cards.length, 2, 'Expected no. of cards');
    assert.strictEqual(
      cards[0]._id,
      card2._id,
      'Card added last is returned first'
    );
    assert.strictEqual(
      cards[1]._id,
      card1._id,
      'Card added first is returned last'
    );
  });

  it('reports added cards', async () => {
    let updateInfo;
    subject.changes.on('change', info => {
      updateInfo = info;
    });

    const addedCard = await subject.putCard({ question: 'Q1', answer: 'A1' });
    // Wait for a few rounds of events so the update can take place
    await waitForEvents(3);

    assert.isOk(updateInfo, 'Change was recorded');
    assert.strictEqual(
      updateInfo.id,
      addedCard._id,
      'Reported change has correct ID'
    );
  });

  it('does not return deleted cards', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.deleteCard(card);

    const cards = await subject.getCards();

    assert.strictEqual(cards.length, 0, 'Length of getCards() result');
  });

  it('does not return individual deleted cards', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    const id = card._id;
    await subject.deleteCard(card);

    try {
      await subject.getCard(id);
      assert.fail('Should have reported an error for non-existent card');
    } catch (err) {
      assert.strictEqual(err.status, 404);
      assert.strictEqual(err.name, 'not_found');
      assert.strictEqual(err.message, 'missing');
      assert.strictEqual(err.reason, 'deleted');
    }
  });

  it('deletes the specified card', async () => {
    const firstCard = await subject.putCard({
      question: 'Question 1',
      answer: 'Answer 1',
    });
    await subject.putCard({ question: 'Question 2', answer: 'Answer 2' });

    await subject.deleteCard(firstCard);

    const cards = await subject.getCards();
    assert.strictEqual(cards.length, 1, 'Length of getCards() result');
    assert.strictEqual(cards[0].question, 'Question 2');
    assert.strictEqual(cards[0].answer, 'Answer 2');
  });

  it('reports an error when the card to be deleted cannot be found', async () => {
    try {
      await subject.deleteCard({ _id: 'abc' });
      assert.fail('Should have reported an error for missing card');
    } catch (err) {
      assert.strictEqual(err.status, 404);
      assert.strictEqual(err.name, 'not_found');
      assert.strictEqual(err.message, 'missing');
      assert.strictEqual(err.reason, 'deleted');
    }
  });

  it('deletes the specified card even when the revision is old', async () => {
    const card = await subject.putCard({
      question: 'Question 1',
      answer: 'Answer 1',
    });
    await subject.putCard({ ...card, question: 'Updated question' });

    await subject.deleteCard(card);

    const cards = await subject.getCards();
    assert.strictEqual(cards.length, 0, 'Length of getCards() result');
  });

  it('reports deleted cards', async () => {
    let updateInfo;
    subject.changes.on('change', info => {
      updateInfo = info;
    });
    const addedCard = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });

    await subject.deleteCard(addedCard);

    await waitForEvents(5);
    assert.strictEqual(
      updateInfo.id,
      addedCard._id,
      'Reported change has correct ID'
    );
    assert.isOk(updateInfo.deleted, 'Reported change is a delete record');
  });

  it('updates the specified field of cards', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });

    card = await subject.putCard({
      _id: card._id,
      _rev: card._rev,
      question: 'Updated question',
    });

    assert.strictEqual(card.question, 'Updated question');
    assert.strictEqual(card.answer, 'Answer');

    const cards = await subject.getCards();
    assert.strictEqual(cards.length, 1, 'Length of getCards() result');
    assert.strictEqual(cards[0].question, 'Updated question');
    assert.strictEqual(cards[0].answer, 'Answer');
  });

  it('updates cards even without a revision', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });

    card = await subject.putCard({
      _id: card._id,
      question: 'Updated question',
    });

    assert.strictEqual(card.question, 'Updated question');
    assert.strictEqual(card.answer, 'Answer');

    const cards = await subject.getCards();
    assert.strictEqual(cards.length, 1, 'Length of getCards() result');
    assert.strictEqual(cards[0].question, 'Updated question');
    assert.strictEqual(cards[0].answer, 'Answer');
  });

  it('updates cards even when the revision is old', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });
    const oldRevision = card._rev;
    card = await subject.putCard({
      _id: card._id,
      question: 'Updated question',
    });

    await subject.putCard({
      _id: card._id,
      _rev: oldRevision,
      answer: 'Updated answer',
    });

    const cards = await subject.getCards();
    assert.strictEqual(cards.length, 1, 'Length of getCards() result');
    assert.strictEqual(cards[0].question, 'Updated question');
    assert.strictEqual(cards[0].answer, 'Updated answer');
  });

  it('returns an error when trying to update a missing card', async () => {
    try {
      await subject.putCard({ _id: 'abc', question: 'Question' });
      assert.fail('Should have reported an error for missing card');
    } catch (err) {
      assert.strictEqual(err.status, 404);
      assert.strictEqual(err.name, 'not_found');
      assert.strictEqual(err.message, 'missing');
    }
  });

  it('returns an error when trying to update a deleted card', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.deleteCard(card);

    try {
      await subject.putCard({ _id: card._id, question: 'Updated question' });

      assert.fail('Should have reported an error for deleted card');
    } catch (err) {
      assert.strictEqual(err.status, 404);
      assert.strictEqual(err.name, 'not_found');
      assert.strictEqual(err.message, 'missing');
    }
  });

  it('stores the created date when adding a new card', async () => {
    const beginDate = new Date();
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    assert.withinTime(new Date(card.created), beginDate, new Date());
  });

  it('stores the last modified date when adding a new card', async () => {
    const beginDate = new Date();
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    assert.withinTime(new Date(card.modified), beginDate, new Date());
  });

  it('updates the last modified date when updating a card', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });
    const beginDate = new Date();
    card = await subject.putCard({
      _id: card._id,
      question: 'Updated question',
    });
    assert.withinTime(new Date(card.modified), beginDate, new Date());
  });

  it('reports changes to cards', async () => {
    const updates = [];
    subject.changes.on('change', info => {
      updates.push(info);
    });

    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.putCard({ ...card, question: 'Updated question' });

    // Wait for a few rounds of events so the update records can happen
    await waitForEvents(3);

    assert.strictEqual(
      updates.length,
      2,
      'Should get two change records: add, update'
    );
    assert.strictEqual(updates[1].doc.question, 'Updated question');
  });
});
