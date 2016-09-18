/* global afterEach, beforeEach, define, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import { assert } from 'chai';
import CardStore from '../src/CardStore';
import { waitForEvents } from './testcommon';
import PouchDB from 'pouchdb';

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

  it('generates unique ascending IDs', () => {
    let prevId = '';
    for (let i = 0; i < 100; i++) {
      const id = CardStore.generateCardId();
      assert.isAbove(id, prevId);
      prevId = id;
    }
  });

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
      // Wait for a few rounds of events so the update can take place
      .then(() => waitForEvents(3))
      .then(() => {
        assert.isOk(updateInfo, 'Change was recorded');
        assert.strictEqual(updateInfo.id, addedCard._id,
                           'Reported change has correct ID');
      });
  });

  // XXX: Deletion
  // XXX: Changes to cards
});

// XXX Split this off into a separate file
describe('CardStore remote sync', () => {
  let subject;
  let testRemote;

  beforeEach('setup new store', () => {
    subject = new CardStore({ db: memdown });
    testRemote = new PouchDB('cards_remote', { db: memdown });
  });

  afterEach('clean up stores', () => {
    return Promise.all([ subject.destroy(), testRemote.destroy() ]);
  });

  it('allows setting a remote sync server', () => {
    return subject.setSyncServer(testRemote)
      .then(() => {
        assert.isOk(subject.getSyncServer());
      });
  });

  it('rejects for an invalid sync server', () => {
    return subject.setSyncServer('http://not.found/')
      .then(() => {
        assert.fail('Failed to reject invalid server');
      })
      .catch(err => {
        assert.oneOf(err.code, [ 'ENOTFOUND', 'ENOENT', 'ECONNREFUSED' ],
                     'Expected error for inaccessible server');
      });
  });

  it('reports an error for an invalid sync server', done => {
    subject.setSyncServer('http://not.found/',
      { onError: err => {
        assert.oneOf(err.code, [ 'ENOTFOUND', 'ENOENT', 'ECONNREFUSED' ],
                      'Expected error for inaccessible server');
        done();
      },
    });
  });

  it('rejects a non-http/https database', () => {
    return subject.setSyncServer('irc://irc.mozilla.org')
      .catch(err => {
        assert.strictEqual(err.code, 'INVALID_SERVER');
      });
  });

  it('rejects a non-PouchDB object', () => {
    return subject.setSyncServer(new Date())
      .catch(err => {
        assert.strictEqual(err.code, 'INVALID_SERVER');
      });
  });

  it('allows clearing the sync server using null', () => {
    return subject.setSyncServer(testRemote)
      .then(() => subject.setSyncServer(null))
      .then(() => {
        assert.strictEqual(subject.getSyncServer(), undefined);
      });
  });

  it('allows clearing the sync server using undefined', () => {
    return subject.setSyncServer(testRemote)
      .then(() => subject.setSyncServer())
      .then(() => {
        assert.strictEqual(subject.getSyncServer(), undefined);
      });
  });

  it('allows clearing the sync server using an empty name', () => {
    return subject.setSyncServer(testRemote)
      .then(() => subject.setSyncServer(''))
      .then(() => {
        assert.strictEqual(subject.getSyncServer(), undefined);
      });
  });

  it('allows clearing the sync server using an entirely whitespace name',
  () => {
    return subject.setSyncServer(testRemote)
      .then(() => subject.setSyncServer('  \n '))
      .then(() => {
        assert.strictEqual(subject.getSyncServer(), undefined);
      });
  });

  it('downloads existing cards on the remote server', done => {
    const firstCard =  { question: 'Question 1',
                         answer:   'Answer 1',
                         _id: CardStore.generateCardId(),
                       };
    const secondCard = { question: 'Question 2',
                         answer:   'Answer 2',
                         _id: CardStore.generateCardId(),
                       };

    const expectedCards = [ firstCard, secondCard ];

    subject.onUpdate(info => {
      // XXX These errors are getting swallowed by PouchDB -- need to look
      // up Mocha docs to see how to get to get these out
      assert.deepEqual(info.doc, expectedCards.shift());
    });

    testRemote.put(firstCard)
      .then(result => { firstCard._rev = result.rev; })
      .then(() => testRemote.put(secondCard))
      .then(result => { secondCard._rev = result.rev; })
      .then(() => subject.setSyncServer(testRemote))
      .then(() => {
        (function waitForUpdates() {
          if (expectedCards.length) {
            setImmediate(waitForUpdates);
          } else {
            done();
          }
        }());
      });
  });

  it('disassociates from previous remote sync server when a new one is set',
  () => {
    const card =  { question: 'Question',
                    answer:   'Answer',
                    _id: CardStore.generateCardId(),
                  };

    const alternateRemote = new PouchDB('cards_remote_2', { db: memdown });

    // XXX As above, the following assertion will get swallowed by pouchdb
    subject.onUpdate(() => {
      assert.fail('Did not expect update to be called on the previous remote');
    });

    return subject.setSyncServer(testRemote)
      .then(() => subject.setSyncServer(alternateRemote))
      .then(() => testRemote.put(card))
      .then(() => waitForEvents(20))
      .then(() => {
        alternateRemote.destroy();
      });
  });

  it('ignores redundant attempts to set the same remote server', () => {
    // XXX (Actually do we want this? How do we tell it to retry?)
  });

  it('uploads existing local cards', () => {
    // XXX
  });

  it('reports additions to the remote server', () => {
    // XXX
  });

  it('reports when syncing resumes', () => {
    // XXX
    // -- Should get onActive callbacks... with approprite direction
  });

  it('reports when syncing pauses', () => {
    // XXX
  });

  it('reports sync progress', () => {
    // XXX
    // -- Should get onChange callbacks with appropriate change record, e.g.
    // { direction: 'pull',
    //   change:
    //    { ok: true,
    //      start_time: '2016-09-18T07:01:40.305Z',
    //      docs_read: 2,
    //      docs_written: 2,
    //      doc_write_failures: 0,
    //      errors: [],
    //      last_seq: 2,
    //      docs: [ [Object], [Object] ] } }
    //    });
  });

  it('reports an error when the remote server goes offline', () => {
    // XXX
  });

  // XXX Reports an appropriate error when the remote server hasn't enabled CORS
  // support

  // XXX Reports an appropriate error when the remote server doesn't have
  // the specified database

  // XXX: Conflict resolution
});
