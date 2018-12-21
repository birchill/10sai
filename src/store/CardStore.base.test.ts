/* global afterEach, beforeEach, describe, expect, it */

import PouchDB from 'pouchdb';

import { DataStore } from './DataStore';
import { CardStore, CardContent, CardChange } from './CardStore';
import { Card } from '../model';
import { generateUniqueTimestampId } from './utils';
import { syncWithWaitableRemote, waitForChangeEvents } from './test-utils';
import '../../jest/customMatchers';

PouchDB.plugin(require('pouchdb-adapter-memory'));

describe('CardStore', () => {
  let dataStore: DataStore;
  let subject: CardStore;

  beforeEach(() => {
    dataStore = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });
    subject = dataStore.cardStore;
  });

  afterEach(() => dataStore.destroy());

  it('is initially empty', async () => {
    const cards = await subject.getCards();
    expect(cards).toHaveLength(0);
  });

  it('returns added cards', async () => {
    await subject.putCard({ question: 'Question', answer: 'Answer' });
    const cards = await subject.getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Question');
    expect(cards[0].answer).toBe('Answer');
  });

  it('returns individual cards', async () => {
    let card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    card = await subject.getCard(card.id);
    expect(card.question).toBe('Question');
    expect(card.answer).toBe('Answer');
  });

  it('returns cards by id', async () => {
    const card1 = await subject.putCard({
      question: 'Question 1',
      answer: 'Answer 1',
    });
    const card2 = await subject.putCard({
      question: 'Question 2',
      answer: 'Answer 2',
    });
    const card3 = await subject.putCard({
      question: 'Question 3',
      answer: 'Answer 3',
    });
    const cards = await subject.getCardsById([card1.id, card3.id, card2.id]);
    expect(cards.map(card => card.id)).toEqual([card1.id, card3.id, card2.id]);
    // Spot check card contents
    expect(cards[1].answer).toBe('Answer 3');
  });

  it('does not return non-existent cards', async () => {
    await expect(subject.getCard('abc')).rejects.toMatchObject({
      status: 404,
      name: 'not_found',
      message: 'missing',
      reason: 'missing',
    });
  });

  it('does not return non-existent cards when fetching by id', async () => {
    const existingCard = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    const cards = await subject.getCardsById([
      'batman',
      existingCard.id,
      'doily',
    ]);
    expect(cards).toHaveLength(1);
    expect(cards.map(card => card.id)).toEqual([existingCard.id]);
  });

  it('generates unique ascending IDs', () => {
    let prevId = '';
    for (let i = 0; i < 100; i++) {
      const id = generateUniqueTimestampId();
      expect(id > prevId).toBeTruthy();
      prevId = id;
    }
  });

  it('does not return the prefix when putting a card', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    expect(card.id.substr(0, 5)).not.toBe('card-');
  });

  it('does not return the prefix when getting a single card', async () => {
    let card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    card = await subject.getCard(card.id);
    expect(card.id.substr(0, 5)).not.toBe('card-');
  });

  it('does not return the prefix when getting multiple cards', async () => {
    await subject.putCard({ question: 'Q1', answer: 'A1' });
    await subject.putCard({ question: 'Q2', answer: 'A2' });

    const cards = await subject.getCards();
    for (const card of cards) {
      expect(card.id.substr(0, 5)).not.toBe('card-');
    }
  });

  it('does not return the prefix when cards by id', async () => {
    const card1 = await subject.putCard({ question: 'Q1', answer: 'A1' });
    const card2 = await subject.putCard({ question: 'Q2', answer: 'A2' });

    const cards = await subject.getCardsById([card1.id, card2.id]);
    for (const card of cards) {
      expect(card.id.substr(0, 5)).not.toBe('card-');
    }
  });

  it('returns added cards in order', async () => {
    const card1 = await subject.putCard({ question: 'Q1', answer: 'A1' });
    const card2 = await subject.putCard({ question: 'Q2', answer: 'A2' });

    const cards = await subject.getCards();
    // Sanity check: card IDs are unique
    expect(card1.id).not.toBe(card2.id);

    expect(cards).toHaveLength(2);
    expect(cards[0].id).toBe(card2.id);
    expect(cards[1].id).toBe(card1.id);
  });

  it('reports added cards', async () => {
    const changesPromise = waitForChangeEvents<CardChange>(
      dataStore,
      'card',
      1
    );

    const addedCard = await subject.putCard({ question: 'Q1', answer: 'A1' });

    const changes = await changesPromise;
    expect(changes[0].card).toMatchObject(addedCard);
  });

  it('does not return deleted cards', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.deleteCard(card.id);

    const cards = await subject.getCards();

    expect(cards).toHaveLength(0);
  });

  it('does not return individual deleted cards', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    const id = card.id;
    await subject.deleteCard(card.id);

    await expect(subject.getCard(id)).rejects.toMatchObject({
      status: 404,
      name: 'not_found',
      message: 'missing',
      reason: 'deleted',
    });
  });

  it('does not return deleted cards when fetching by id', async () => {
    const deletedCard = await subject.putCard({
      question: 'Question (deleted)',
      answer: 'Answer (deleted)',
    });
    await subject.deleteCard(deletedCard.id);

    const existingCard = await subject.putCard({
      question: 'Question (existing)',
      answer: 'Answer (existing)',
    });

    const cards = await subject.getCardsById([deletedCard.id, existingCard.id]);

    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe(existingCard.id);
  });

  it('deletes the specified card', async () => {
    const firstCard = await subject.putCard({
      question: 'Question 1',
      answer: 'Answer 1',
    });
    await subject.putCard({ question: 'Question 2', answer: 'Answer 2' });

    await subject.deleteCard(firstCard.id);

    const cards = await subject.getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Question 2');
    expect(cards[0].answer).toBe('Answer 2');
  });

  it('fails silently when the card to be deleted cannot be found', async () => {
    await expect(subject.deleteCard('abc')).resolves.toBeUndefined();
  });

  it('deletes the specified card even when the revision is old', async () => {
    const card = await subject.putCard({
      question: 'Question 1',
      answer: 'Answer 1',
    });
    await subject.putCard({ ...card, question: 'Updated question' });

    await subject.deleteCard(card.id);

    const cards = await subject.getCards();
    expect(cards).toHaveLength(0);
  });

  it('reports deleted cards', async () => {
    const changesPromise = waitForChangeEvents<CardChange>(
      dataStore,
      'card',
      2
    );

    const addedCard = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.deleteCard(addedCard.id);

    const changes = await changesPromise;
    expect(changes[1].card.id).toBe(addedCard.id);
    expect(changes[1].deleted).toBeTruthy();
  });

  it('updates the specified field of cards', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });

    card = await subject.putCard({
      id: card.id,
      question: 'Updated question',
    });

    expect(card.question).toBe('Updated question');
    expect(card.answer).toBe('Answer');

    const cards = await subject.getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Updated question');
    expect(cards[0].answer).toBe('Answer');
  });

  it('updates cards even without a revision', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });

    card = await subject.putCard({
      id: card.id,
      question: 'Updated question',
    });

    expect(card.question).toBe('Updated question');
    expect(card.answer).toBe('Answer');

    const cards = await subject.getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Updated question');
    expect(cards[0].answer).toBe('Answer');
  });

  it('returns an error when trying to update a missing card', async () => {
    await expect(
      subject.putCard({ id: 'abc', question: 'Question' })
    ).rejects.toMatchObject({
      status: 404,
      name: 'not_found',
      message: 'missing',
    });
  });

  it('returns an error when trying to update a deleted card', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.deleteCard(card.id);

    await expect(
      subject.putCard({ id: card.id, question: 'Question' })
    ).rejects.toMatchObject({
      status: 404,
      name: 'not_found',
      message: 'missing',
    });
  });

  it('stores the created date when adding a new card', async () => {
    const beginDate = new Date();
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    expect(new Date(card.created)).toBeInDateRange(beginDate, new Date());
  });

  it('stores the last modified date when adding a new card', async () => {
    const beginDate = new Date();
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    expect(new Date(card.modified)).toBeInDateRange(beginDate, new Date());
  });

  it('updates the last modified date when updating a card', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });
    const beginDate = new Date();
    card = await subject.putCard({
      id: card.id,
      question: 'Updated question',
    });
    expect(new Date(card.modified)).toBeInDateRange(beginDate, new Date());
  });

  it('does not write empty optional fields for new cards', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
      keywords: [],
      tags: [],
      starred: false,
    });
    const testRemote = new PouchDB('cards_remote', { adapter: 'memory' });

    try {
      const waitForIdle = await syncWithWaitableRemote(dataStore, testRemote);
      await waitForIdle();

      const doc = await testRemote.get<CardContent>(`card-${card.id}`);
      expect(doc.keywords).not.toBeDefined();
      expect(doc.tags).not.toBeDefined();
      expect(doc.starred).not.toBeDefined();
    } finally {
      testRemote.destroy();
    }
  });

  it('does not write empty optional fields when updating cards', async () => {
    const testRemote = new PouchDB('cards_remote', { adapter: 'memory' });
    const waitForIdle = await syncWithWaitableRemote(dataStore, testRemote);

    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
      keywords: ['abc'],
      tags: ['abc', 'def'],
      starred: true,
    });
    await subject.putCard({
      id: card.id,
      keywords: [],
      tags: [],
      starred: false,
    });

    try {
      await waitForIdle();

      const doc = await testRemote.get<CardContent>(`card-${card.id}`);
      expect(doc.keywords).not.toBeDefined();
      expect(doc.tags).not.toBeDefined();
      expect(doc.starred).not.toBeDefined();
    } finally {
      testRemote.destroy();
    }
  });

  it('reports changes to cards', async () => {
    const changesPromise = waitForChangeEvents<CardChange>(
      dataStore,
      'card',
      2
    );

    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.putCard({ ...card, question: 'Updated question' });

    const changes = await changesPromise;
    expect(changes[1].card.question).toBe('Updated question');
  });
});
