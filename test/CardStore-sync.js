/* global afterEach, beforeEach, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import PouchDB from 'pouchdb';
import memdown from 'memdown';
import { assert, AssertionError } from 'chai';

import CardStore from '../src/CardStore';
import { waitForEvents } from './testcommon';

const cardForDirectPut = card => ({
  ...card,
  _id: 'card-' + card._id,
});

// Sometimes we want to wait for the sync to settle down which we do by waiting
// for its onIdle callback to be called. However, due to instability on startup
// (particularly when setting up design docs) it can temporarily go idle then go
// active again so we add a little timeout after getting an initial onIdle
// callback to make sure it really is idle.

function idleSync() {
  const idleTimeout = 50; // ms

  let resolver;
  const idlePromise = new Promise(resolve => {
    resolver = resolve;
  });

  let timeout = setTimeout(resolver, idleTimeout);
  const idleCallback = () => {
    clearTimeout(timeout);
    timeout = setTimeout(resolver, idleTimeout);
  };

  return [ idleCallback, idlePromise ];
}

describe('CardStore remote sync', () => {
  let subject;
  let testRemote;
  let failedAssertion;

  // PouchDB swallows exceptions thrown from certain callbacks like the on
  // 'changes' callback which, unfortunately, includes exceptions which are
  // failed assertions. The |throwError| method for directly passing the failed
  // assertion to mocha also only appears to be in the browser-based version
  // (not the CLI version) so we can't use that. Instead, we just wrap such
  // callbacks to set a global variable if an assertion fails and then re-throw
  // when the test shuts down.
  function wrapAssertingFunction(fn) {
    return (...args) => {
      try {
        fn.apply(this, args);
      } catch (e) {
        if (e instanceof AssertionError) {
          failedAssertion = e;
        } else {
          throw e;
        }
      }
    };
  }

  beforeEach('setup new store', () => {
    subject = new CardStore({ pouch: { db: memdown }, prefetchViews: false });

    failedAssertion = undefined;

    testRemote = new PouchDB('cards_remote', { db: memdown });
  });

  afterEach('clean up stores', () => {
    if (failedAssertion) {
      throw failedAssertion;
    }

    return Promise.all([subject.destroy(), testRemote.destroy()]);
  });

  it('allows setting a remote sync server', async () => {
    await subject.setSyncServer(testRemote);
    assert.isOk(subject.getSyncServer());
  });

  it('rejects for an invalid sync server', async () => {
    try {
      await subject.setSyncServer('http://not.found/');
      assert.fail('Failed to reject invalid server');
    } catch (err) {
      assert.oneOf(
        err.code,
        ['ENOTFOUND', 'ENOENT', 'ECONNREFUSED'],
        'Expected error for inaccessible server'
      );
    }
  });

  it('reports an error for an invalid sync server', done => {
    subject
      .setSyncServer('http://not.found/', {
        onError: err => {
          assert.oneOf(
            err.code,
            ['ENOTFOUND', 'ENOENT', 'ECONNREFUSED'],
            'Expected error for inaccessible server'
          );
          done();
        },
      })
      .catch(() => {
        /* Ok */
      });
  });

  it('rejects a non-http/https database', async () => {
    try {
      await subject.setSyncServer('irc://irc.mozilla.org');
      assert.fail('Failed to reject invalid server');
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_SERVER');
    }
  });

  it('rejects a non-PouchDB object', async () => {
    try {
      await subject.setSyncServer(new Date());
      assert.fail('Failed to reject invalid server');
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_SERVER');
    }
  });

  it('allows clearing the sync server using null', async () => {
    await subject.setSyncServer(testRemote);
    await subject.setSyncServer(null);
    assert.strictEqual(subject.getSyncServer(), undefined);
  });

  it('allows clearing the sync server using undefined', async () => {
    await subject.setSyncServer(testRemote);
    await subject.setSyncServer();
    assert.strictEqual(subject.getSyncServer(), undefined);
  });

  it('allows clearing the sync server using an empty name', async () => {
    await subject.setSyncServer(testRemote);
    await subject.setSyncServer('');
    assert.strictEqual(subject.getSyncServer(), undefined);
  });

  it('allows clearing the sync server using an entirely whitespace name', async () => {
    await subject.setSyncServer(testRemote);
    await subject.setSyncServer('  \n ');
    assert.strictEqual(subject.getSyncServer(), undefined);
  });

  it('downloads existing cards on the remote server', done => {
    const now = JSON.parse(JSON.stringify(new Date()));
    const firstCard = {
      question: 'Question 1',
      answer: 'Answer 1',
      _id: CardStore.generateCardId(),
      created: now,
      modified: now,
    };
    const secondCard = {
      question: 'Question 2',
      answer: 'Answer 2',
      _id: CardStore.generateCardId(),
      created: now,
      modified: now,
    };
    const initialProgress = {
      level: 0,
      reviewed: null,
    };

    const expectedCards = [firstCard, secondCard];

    subject.changes.on(
      'change',
      wrapAssertingFunction(info => {
        assert.deepEqual(info.doc, expectedCards.shift());
      })
    );

    testRemote
      .put(cardForDirectPut(firstCard))
      .then(result => {
        firstCard._rev = result.rev;
      })
      .then(() => testRemote.put(
        { _id: 'progress-' + firstCard._id, ...initialProgress }
      ))
      .then(() => {
        expectedCards[0] = { ...firstCard, ...initialProgress };
      })
      .then(() => testRemote.put(cardForDirectPut(secondCard)))
      .then(result => {
        secondCard._rev = result.rev;
      })
      .then(() => testRemote.put(
        { _id: 'progress-' + secondCard._id, ...initialProgress }
      ))
      .then(() => {
        expectedCards[1] = { ...secondCard, ...initialProgress };
      })
      .then(() => subject.setSyncServer(testRemote))
      .then(() => {
        (function waitForUpdates() {
          if (expectedCards.length) {
            setImmediate(waitForUpdates);
          } else {
            done();
          }
        })();
      });
  });

  it('disassociates from previous remote sync server when a new one is set', async () => {
    const card = {
      question: 'Question',
      answer: 'Answer',
      _id: CardStore.generateCardId(),
      created: JSON.parse(JSON.stringify(new Date())),
    };

    const alternateRemote = new PouchDB('cards_remote_2', { db: memdown });

    subject.changes.on(
      'change',
      wrapAssertingFunction(() => {
        assert.fail(
          'Did not expect update to be called on the previous remote'
        );
      })
    );

    await subject.setSyncServer(testRemote);
    await subject.setSyncServer(alternateRemote);
    await testRemote.put(cardForDirectPut(card));

    await waitForEvents(20);
    await alternateRemote.destroy();
  });

  it('does not report events from the old remote', async () => {
    const alternateRemote = new PouchDB('cards_remote_2', { db: memdown });
    const callbacks = {
      onIdle: wrapAssertingFunction(() => {
        assert.fail('Did not expect pause to be called on the previous remote');
      }),
    };

    await subject.setSyncServer(testRemote, callbacks);
    await subject.setSyncServer(alternateRemote);

    await waitForEvents(20);
    await alternateRemote.destroy();
  });

  it('uploads existing local cards', async () => {
    const [ idleCallback, idlePromise ] = idleSync();

    await subject.putCard({ question: 'Question 1', answer: 'Answer 1' });
    await subject.putCard({ question: 'Question 2', answer: 'Answer 2' });
    await subject.setSyncServer(testRemote, { onIdle: idleCallback });
    await idlePromise;

    const remoteCards = await testRemote.allDocs({
      include_docs: true,
      descending: true,
      startkey: 'card-\ufff0',
      endkey: 'card-',
    });
    assert.strictEqual(remoteCards.rows.length, 2);
  });

  it('reports when download starts and stops', done => {
    subject.setSyncServer(testRemote, {
      onActive: wrapAssertingFunction(info => {
        assert.strictEqual(info.direction, 'pull');
        done();
      }),
    });

    testRemote.put({
      question: 'Question',
      answer: 'Answer',
      _id: 'card-' + CardStore.generateCardId(),
    });
  });

  it('reports when uploads starts and stops', done => {
    subject.setSyncServer(testRemote, {
      onActive: wrapAssertingFunction(info => {
        assert.strictEqual(info.direction, 'push');
        done();
      }),
    });

    subject.putCard({ question: 'Question', answer: 'Answer' });
  });

  it('reports sync progress on initial download', async () => {
    const numCards = 9;
    const docs = [];
    for (let i = 0; i < numCards; i++) {
      docs.push({
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
        _id: CardStore.generateCardId(),
      });
    }

    let resolveAllDone;
    const allDone = new Promise(resolve => {
      resolveAllDone = resolve;
    });

    const allChanges = [];
    await testRemote.bulkDocs(docs);
    await subject.setSyncServer(testRemote, {
      onChange: changes => allChanges.push(changes),
      onIdle: () => resolveAllDone(),
      batchSize: 2,
    });
    await allDone;

    assert.strictEqual(
      allChanges.length,
      5,
      'Should be five batches of changes'
    );
    // (Some of these numbers are bit different to what we'd normally expect but
    // that's because the design docs which we *don't* sync are included in the
    // total.)
    //
    // This feature has been disabled for now. We should just wait until PouchDB
    // reports the pending flag:
    // https://github.com/pouchdb/pouchdb/issues/5710
    /*
    assert.deepEqual(
      allChanges.map(change => change.progress),
      [0, 2 / 3, 1.0],
      'Each batch has expected progress'
    );
    */
  });

  it('reports sync progress on initial upload', async () => {
    const numCards = 5;
    const putPromises = [];
    for (let i = 0; i < numCards; i++) {
      putPromises.push(
        subject.putCard({
          question: `Question ${i + 1}`,
          answer: `Answer ${i + 1}`,
        })
      );
    }

    let resolveAllDone;
    const allDone = new Promise(resolve => {
      resolveAllDone = resolve;
    });

    const allChanges = [];
    await Promise.all(putPromises);
    await subject.setSyncServer(testRemote, {
      onChange: changes => allChanges.push(changes),
      onIdle: () => resolveAllDone(),
      batchSize: 3,
    });
    await allDone;

    // Note that although there are 5 cards, there are 10 documents since there
    // is a corresponding 'progress' document for each card. So we should have
    // batch sizes: 3, 3, 3, 1.
    assert.strictEqual(
      allChanges.length,
      4,
      'Should be four batches of changes'
    );
    const progressValues = allChanges.map(change => change.progress);
    assert.isBelow(progressValues[0], 1);
    assert.isBelow(progressValues[0], progressValues[1]);
    assert.isBelow(progressValues[1], progressValues[2]);
    assert.isBelow(progressValues[2], progressValues[3]);
    // We should check that progressValues[3] is 1, but it can actually go to
    // 1.1 due to the design doc. Not sure why actually. Oh well.
  });

  it('reports indeterminate progress on balanced bi-directional sync', async () => {
    const localCards = 4;
    const putPromises = [];
    for (let i = 0; i < localCards; i++) {
      putPromises.push(
        subject.putCard({
          question: `Local question ${i + 1}`,
          answer: `Local answer ${i + 1}`,
        })
      );
    }

    const remoteCards = 4;
    const remoteDocs = [];
    for (let i = 0; i < remoteCards; i++) {
      remoteDocs.push({
        question: `Remote question ${i + 1}`,
        answer: `Remote answer ${i + 1}`,
        _id: CardStore.generateCardId(),
      });
    }

    let resolveAllDone;
    const allDone = new Promise(resolve => {
      resolveAllDone = resolve;
    });

    const allChanges = [];
    await Promise.all(putPromises);
    await testRemote.bulkDocs(remoteDocs);
    await subject.setSyncServer(testRemote, {
      onChange: changes => allChanges.push(changes),
      onIdle: () => resolveAllDone(),
      batchSize: 3,
    });
    await allDone;

    // As with the previous test, bear in mind that 5 cards produce 10 documents
    // since we have a corresponding 'progress' document for each card.
    // That said, I don't really understand why 4 cards in 2 directions (i.e. 16
    // documents total), with a batch size of 3 should happen in five batches.
    // It's some PouchDB magic, but it seems to be deterministic at least.
    assert.strictEqual(
      allChanges.length,
      5,
      'Should be eight batches of changes'
    );
    assert.deepEqual(
      allChanges.map(change => change.progress),
      Array(allChanges.length).fill(null),
      'Each batch should have an indeterminate progress'
    );
  });

  it('reports indeterminate sync progress on subsequent download', async () => {
    const numCards = 3;
    const docs = [];
    for (let i = 0; i < numCards; i++) {
      docs.push({
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
        _id: CardStore.generateCardId(),
      });
    }

    let resolveIdle;
    const waitForIdle = new Promise(resolve => {
      resolveIdle = resolve;
    });

    const allChanges = [];
    await subject.setSyncServer(testRemote, {
      onChange: changes => allChanges.push(changes),
      onIdle: () => resolveIdle(),
      batchSize: 2,
    });
    await waitForIdle;
    await testRemote.bulkDocs(docs);
    await new Promise(resolve => {
      resolveIdle = resolve;
    });

    assert.deepEqual(
      allChanges.map(change => change.progress),
      Array(allChanges.length).fill(null),
      'Each batch should have an indeterminate progress'
    );
  });

  it('reports an error when the remote server goes offline', () => {
    // XXX
  });

  // XXX Reports an appropriate error when the remote server doesn't have
  // the specified database

  // XXX: Conflict resolution
});
