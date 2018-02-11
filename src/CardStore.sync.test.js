/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import PouchDB from 'pouchdb';
import memdown from 'memdown';

import CardStore from './CardStore.ts';
import { waitForEvents } from '../test/testcommon';

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

  return [idleCallback, idlePromise];
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
        failedAssertion = e;
      }
    };
  }

  beforeEach(() => {
    subject = new CardStore({ pouch: { db: memdown }, prefetchViews: false });

    failedAssertion = undefined;

    testRemote = new PouchDB('cards_remote', { db: memdown });
  });

  afterEach(() => {
    if (failedAssertion) {
      throw failedAssertion;
    }

    return Promise.all([subject.destroy(), testRemote.destroy()]);
  });

  it('allows setting a remote sync server', async () => {
    await subject.setSyncServer(testRemote);
    expect(subject.getSyncServer()).toBeTruthy();
  });

  it('rejects for an invalid sync server', async () => {
    try {
      await subject.setSyncServer('http://not.found/');
      expect(false).toBe(true);
    } catch (err) {
      expect(['ENOTFOUND', 'ENOENT', 'ECONNREFUSED']).toContain(err.code);
    }
  });

  it('reports an error for an invalid sync server', done => {
    subject
      .setSyncServer('http://not.found/', {
        onError: err => {
          expect(['ENOTFOUND', 'ENOENT', 'ECONNREFUSED']).toContain(err.code);
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
      expect(false).toBe(true);
    } catch (err) {
      expect(err.name).toBe('bad_request');
    }
  });

  it('rejects a non-PouchDB object', async () => {
    try {
      await subject.setSyncServer(new Date());
      expect(false).toBe(true);
    } catch (err) {
      expect(err.name).toBe('bad_request');
    }
  });

  it('allows clearing the sync server using null', async () => {
    await subject.setSyncServer(testRemote);
    await subject.setSyncServer(null);
    expect(subject.getSyncServer()).toBe(undefined);
  });

  it('allows clearing the sync server using undefined', async () => {
    await subject.setSyncServer(testRemote);
    await subject.setSyncServer();
    expect(subject.getSyncServer()).toBe(undefined);
  });

  it('allows clearing the sync server using an empty name', async () => {
    await subject.setSyncServer(testRemote);
    await subject.setSyncServer('');
    expect(subject.getSyncServer()).toBe(undefined);
  });

  it('allows clearing the sync server using an entirely whitespace name', async () => {
    await subject.setSyncServer(testRemote);
    await subject.setSyncServer('  \n ');
    expect(subject.getSyncServer()).toBe(undefined);
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
      'card',
      wrapAssertingFunction(info => {
        expect(info.doc).toEqual(expectedCards.shift());
      })
    );

    testRemote
      .put(cardForDirectPut(firstCard))
      .then(() =>
        testRemote.put({ _id: 'progress-' + firstCard._id, ...initialProgress })
      )
      .then(() => {
        expectedCards[0].progress = initialProgress;
      })
      .then(() => testRemote.put(cardForDirectPut(secondCard)))
      .then(() =>
        testRemote.put({
          _id: 'progress-' + secondCard._id,
          ...initialProgress,
        })
      )
      .then(() => {
        expectedCards[1].progress = initialProgress;
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
      'card',
      wrapAssertingFunction(() => {
        expect(false).toBe(true);
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
        expect(false).toBe(true);
      }),
    };

    await subject.setSyncServer(testRemote, callbacks);
    await subject.setSyncServer(alternateRemote);

    await waitForEvents(20);
    await alternateRemote.destroy();
  });

  it('uploads existing local cards', async () => {
    const [idleCallback, idlePromise] = idleSync();

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
    expect(remoteCards.rows.length).toBe(2);
  });

  it('reports when download starts and stops', done => {
    subject.setSyncServer(testRemote, {
      onActive: wrapAssertingFunction(info => {
        expect(info.direction).toBe('pull');
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
        expect(info.direction).toBe('push');
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

    const progressValues = [];
    await testRemote.bulkDocs(docs);
    await subject.setSyncServer(testRemote, {
      onProgress: progress => progressValues.push(progress),
      onIdle: () => resolveAllDone(),
      batchSize: 2,
    });
    await allDone;

    expect(progressValues).toHaveLength(5);
    // (Some of these numbers are bit different to what we'd normally expect but
    // that's because the design docs which we *don't* sync are included in the
    // total.)
    //
    // This feature has been disabled for now. We should just wait until PouchDB
    // reports the pending flag:
    // https://github.com/pouchdb/pouchdb/issues/5710
    /*
    expect(progressValues.toEqual([0, 2 / 3, 1.0]);
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

    const progressValues = [];
    await Promise.all(putPromises);
    await subject.setSyncServer(testRemote, {
      onProgress: progress => progressValues.push(progress),
      onIdle: () => resolveAllDone(),
      batchSize: 3,
    });
    await allDone;

    // Note that although there are 5 cards, there are 10 documents since there
    // is a corresponding 'progress' document for each card. So we should have
    // batch sizes: 3, 3, 3, 1.
    expect(progressValues).toHaveLength(4);
    expect(progressValues[0]).toBeLessThan(1);
    expect(progressValues[0]).toBeLessThan(progressValues[1]);
    expect(progressValues[1]).toBeLessThan(progressValues[2]);
    expect(progressValues[2]).toBeLessThan(progressValues[3]);
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

    const progressValues = [];
    await Promise.all(putPromises);
    await testRemote.bulkDocs(remoteDocs);
    await subject.setSyncServer(testRemote, {
      onProgress: progress => progressValues.push(progress),
      onIdle: () => resolveAllDone(),
      batchSize: 3,
    });
    await allDone;

    // As with the previous test, bear in mind that 5 cards produce 10 documents
    // since we have a corresponding 'progress' document for each card.
    // That said, I don't really understand why 4 cards in 2 directions (i.e. 16
    // documents total), with a batch size of 3 should happen in five batches.
    // It's some PouchDB magic, but it seems to be deterministic at least.
    expect(progressValues).toHaveLength(5);
    expect(progressValues).toEqual(Array(progressValues.length).fill(null));
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

    const progressValues = [];
    await subject.setSyncServer(testRemote, {
      onProgress: progress => progressValues.push(progress),
      onIdle: () => resolveIdle(),
      batchSize: 2,
    });
    await waitForIdle;
    await testRemote.bulkDocs(docs);
    await new Promise(resolve => {
      resolveIdle = resolve;
    });

    expect(progressValues).toEqual(Array(progressValues.length).fill(null));
  });

  it('reports an error when the remote server goes offline', () => {
    // XXX
  });

  // XXX Reports an appropriate error when the remote server doesn't have
  // the specified database

  // XXX: Conflict resolution
});
