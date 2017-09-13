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
    subject = new CardStore({ db: memdown });
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
});
