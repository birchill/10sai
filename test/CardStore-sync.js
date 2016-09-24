/* global afterEach, beforeEach, define, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import { assert, AssertionError } from 'chai';
import CardStore from '../src/CardStore';
import { waitForEvents } from './testcommon';
import PouchDB from 'pouchdb';

describe('CardStore remote sync', () => {
  let subject;
  let testRemote;
  let failedAssertion;

  beforeEach('setup new store', () => {
    subject = new CardStore({ db: memdown });

    // PouchDB swallows exceptions thrown from the on 'changes' callback which,
    // unfortunately, includes exceptions which are failed assertions. The
    // |throwError| method for directly passing the failed assertion to mocha
    // also only appears to be in the browser-based version (not the CLI
    // version) so we can't use that. Instead, we just wrap the callback set
    // using |onUpdate| to set a global variable if an assertion fails and then
    // re-throw when the test shuts down.
    failedAssertion = undefined;
    const originalOnUpdate = subject.onUpdate;
    subject.onUpdate = fn => {
      const wrappedFn = info => {
        try {
          fn(info);
        } catch (e) {
          if (e instanceof AssertionError) {
            failedAssertion = e;
          } else {
            throw e;
          }
        }
      };
      originalOnUpdate.call(subject, wrappedFn);
    };

    testRemote = new PouchDB('cards_remote', { db: memdown });
  });

  afterEach('clean up stores', () => {
    if (failedAssertion) {
      throw failedAssertion;
    }

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
      .then(() => {
        assert.fail('Failed to reject invalid server');
      })
      .catch(err => {
        assert.strictEqual(err.code, 'INVALID_SERVER');
      });
  });

  it('rejects a non-PouchDB object', () => {
    return subject.setSyncServer(new Date())
      .then(() => {
        assert.fail('Failed to reject invalid server');
      })
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
    // -- Should get onActive callbacks... with appropriate direction
  });

  it('reports when syncing resumes', () => {
    // XXX
    // -- Should get onActive callbacks... with appropriate direction
  });

  it('reports when syncing pauses', () => {
    // XXX
    // -- Should get onActive callbacks... with appropriate direction
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
