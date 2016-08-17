/* global define, describe, it, beforeEach */

import memdown from 'memdown';
import { assert } from 'chai';
import CardStore from '../src/CardStore';

describe('CardStore', () => {
  let subject;

  beforeEach('setup new store', () => {
    // Create a new store with an in-memory adaptor so we don't need to
    // clean up each time.
    subject = new CardStore({ db: memdown });
  });

  it('is initially empty', () =>
    subject.getCards()
      .then(cards => {
        assert.strictEqual(cards.length, 0, 'Length of getCards() result');
      })
  );

  it('returns added cards', () =>
    subject.putCard({ question: 'Question', answer: 'Answer' })
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards.length, 1, 'Length of getCards() result');
        assert.strictEqual(cards[0].question, 'Question');
        assert.strictEqual(cards[0].answer, 'Answer');
      })
  );

  it('returns added cards in order', () => {
    // XXX
  });

  it('reports added cards', () => {
    // XXX
  });

  it('allows setting a remote sync server', () => {
    // XXX
  });

  it('reports an error for an invalid sync server', () => {
    // XXX
  });

  it('allows clearing the sync server using null', () => {
    // XXX
  });

  it('allows clearing the sync server using an empty string', () => {
    // XXX
  });

  it('disassociates from previous remote sync server when a new one is set',
  () => {
    // XXX
  });

  it('ignore redundant attempts to set the same remote server', () => {
    // XXX
  });

  it('downloads existing cards on the remote server', () => {
    // XXX
  });

  it('uploads existing local cards', () => {
    // XXX
  });

  it('reports additions to the remote server', () => {
    // XXX
  });

  it('reports when syncing resumes', () => {
    // XXX
  });

  it('reports when syncing pauses', () => {
    // XXX
  });

  it('reports sync progress', () => {
    // XXX
  });

  it('reports an error when the remote server goes offline', () => {
    // XXX
  });

  // XXX: Deletion
  // XXX: Changes to cards
  // XXX: Conflict resolution
});
