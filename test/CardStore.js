/* global define, it, describe */

import { assert } from 'chai';
import CardStore from '../src/CardStore';

describe('CardStore', () => {
  it('is initially empty', () => {
    const subject = new CardStore();

    return subject.getCards().then(cards => {
      assert.strictEqual(cards.length, 0, 'Length of getCards() result');
    });
  });

  it('returns added cards', () => {
    // XXX
  });

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
