/* global afterEach, beforeEach, define, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import { assert } from 'chai';
import CardStore from '../src/CardStore';
import { waitForEvents } from './testcommon';

describe('CardStore', () => {
  let subject;

  beforeEach('setup new store', () => {
    subject = new CardStore({ db: memdown });
  });

  afterEach('clean up store', () => subject.destroy());

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
    let id1;
    let id2;

    return subject.putCard({ question: 'Q1', answer: 'A1' })
      .then(card => { id1 = card._id; })
      .then(() => subject.putCard({ question: 'Q2', answer: 'A2' }))
      .then(card => { id2 = card._id; })
      .then(() => subject.getCards())
      .then(cards => {
        // Sanity check
        assert.notStrictEqual(id1, id2, 'Card IDs are unique');

        assert.strictEqual(cards.length, 2, 'Expected no. of cards');
        assert.strictEqual(cards[0]._id, id2,
                           'Card added last is returned first');
        assert.strictEqual(cards[1]._id, id1,
                           'Card added first is returned last');
      });
  });

  it('reports added cards', () => {
    let addedCard;
    let updateInfo;

    subject.onUpdate(info => { updateInfo = info; });

    return subject.putCard({ question: 'Q1', answer: 'A1' })
      .then(card => { addedCard = card; })
      // Two rounds of waiting should be enough for the update to happen
      .then(waitForEvents)
      .then(waitForEvents)
      .then(() => {
        assert.isOk(updateInfo, 'Change was recorded');
        assert.strictEqual(updateInfo.id, addedCard._id,
                           'Reported change has correct ID');
      });
  });

  // XXX: Deletion
  // XXX: Changes to cards
});

describe('CardStore remote sync', () => {
  let subject;

  beforeEach('setup new store', () => {
    subject = new CardStore({ db: memdown });
  });

  afterEach('clean up stores', () => {
    const destroyRemote = subject.getSyncServer()
                          ? subject.getSyncServer().destroy()
                          : Promise.resolve();
    const destroyLocal = subject.destroy();
    return Promise.all([ destroyRemote, destroyLocal ]);
  });

  it('allows setting a remote sync server', () => {
    return subject.setSyncServer('cards_remote', {})
      .then(() => {
        assert.isOk(subject.getSyncServer());
      });
  });

  it('reports an error for an invalid sync server', () => {
    return subject.setSyncServer('http://not.found/',
      { onError: error => { console.log(error); } }
    ).catch(() => {
      // XXX Actually test for an error
      // We should actually get an error here or somewhere--maybe calling sync()
      // doesn't actually trigger a connection???
    }).then(() => {
      return subject.getSyncServer().destroy();
    }).catch(err => {
      // XXX This is not the error we're looking for... we should get one
      // before now
      assert.strictEqual(err.code, 'ENOTFOUND',
                         'Got expected error when calling destroy()');
    }).then(() => {
      subject.setSyncServer(null);
    });
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

  // XXX: Conflict resolution
});
