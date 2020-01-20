import PouchDB from 'pouchdb';

import { DataStore } from './DataStore';
import { CardDoc, CardChange } from './CardStore';
import { generateUniqueTimestampId } from './utils';
import { waitForChangeEvents } from './test-utils';
import { Card } from '../model';
import { waitForEvents } from '../utils/testing';
import { Omit, MakeOptional } from '../utils/type-helpers';

PouchDB.plugin(require('pouchdb-adapter-memory'));

const cardForDirectPut = (card: Omit<Card, 'progress'>): CardDoc => ({
  ...card,
  _id: 'card-' + card.id,
});

// Sometimes we want to wait for the sync to settle down which we do by waiting
// for its onIdle callback to be called. However, due to instability on startup
// (particularly when setting up design docs) it can temporarily go idle then go
// active again so we add a little timeout after getting an initial onIdle
// callback to make sure it really is idle.

function idleSync(): [({}) => any, Promise<void>] {
  const idleTimeout = 50; // ms

  let resolver: () => void;
  const idlePromise = new Promise<void>(resolve => {
    resolver = resolve;
  });

  let timeout = setTimeout(resolver!, idleTimeout);
  const idleCallback = () => {
    clearTimeout(timeout);
    timeout = setTimeout(resolver, idleTimeout);
  };

  return [idleCallback, idlePromise];
}

describe('DataStore remote sync', () => {
  let subject: DataStore;
  let testRemote: PouchDB.Database;
  let failedAssertion: Error | undefined;

  // PouchDB swallows exceptions thrown from certain callbacks like the on
  // 'changes' callback which, unfortunately, includes exceptions which are
  // failed assertions. The |throwError| method for directly passing the failed
  // assertion to mocha also only appears to be in the browser-based version
  // (not the CLI version) so we can't use that. Instead, we just wrap such
  // callbacks to set a global variable if an assertion fails and then re-throw
  // when the test shuts down.
  function wrapAssertingFunction(fn: Function) {
    return (...args: any) => {
      try {
        fn.apply(this, args);
      } catch (e) {
        failedAssertion = e;
      }
    };
  }

  beforeEach(() => {
    subject = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });

    failedAssertion = undefined;

    testRemote = new PouchDB('cards_remote', { adapter: 'memory' });
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
      expect(err.status).toEqual(500);
    }
  });

  it('reports an error for an invalid sync server', done => {
    subject
      .setSyncServer('http://not.found/', {
        onError: err => {
          expect(err.status).toEqual(500);
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

  it('downloads existing cards on the remote server', async () => {
    const now = JSON.parse(JSON.stringify(new Date()));
    const firstCard: MakeOptional<Card, 'progress'> = {
      id: generateUniqueTimestampId(),
      front: 'Question 1',
      back: 'Answer 1',
      created: now,
      modified: now,
      keywords: [],
      tags: [],
      starred: false,
    };
    const secondCard: MakeOptional<Card, 'progress'> = {
      id: generateUniqueTimestampId(),
      front: 'Question 2',
      back: 'Answer 2',
      created: now,
      modified: now,
      keywords: [],
      tags: [],
      starred: false,
    };
    const initialProgress = {
      level: 0,
      due: null,
    };

    const expectedCards = [firstCard, secondCard];

    const changesPromise = waitForChangeEvents<CardChange>(subject, 'card', 2);

    await testRemote.put(cardForDirectPut(firstCard));
    await testRemote.put({
      _id: 'progress-' + firstCard.id,
      ...initialProgress,
    });
    expectedCards[0].progress = initialProgress;

    await testRemote.put(cardForDirectPut(secondCard));
    await testRemote.put({
      _id: 'progress-' + secondCard.id,
      ...initialProgress,
    });
    expectedCards[1].progress = initialProgress;

    await subject.setSyncServer(testRemote);

    const changes = await changesPromise;
    expect(changes[0].card).toEqual(expectedCards[0]);
    expect(changes[1].card).toEqual(expectedCards[1]);
  });

  it('disassociates from previous remote sync server when a new one is set', async () => {
    const card: MakeOptional<Card, 'progress'> = {
      id: generateUniqueTimestampId(),
      front: 'Question',
      back: 'Answer',
      keywords: [],
      tags: [],
      starred: false,
      created: JSON.parse(JSON.stringify(new Date())),
      modified: JSON.parse(JSON.stringify(new Date())),
    };

    const alternateRemote = new PouchDB('cards_remote_2', {
      adapter: 'memory',
    });

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
    const alternateRemote = new PouchDB('cards_remote_2', {
      adapter: 'memory',
    });
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

    await subject.putCard({ front: 'Question 1', back: 'Answer 1' });
    await subject.putCard({ front: 'Question 2', back: 'Answer 2' });
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
      onActive: wrapAssertingFunction(
        (info: PouchDB.Replication.SyncResult<{}>) => {
          expect(info.direction).toBe('pull');
          done();
        }
      ),
    });

    testRemote.put({
      _id: 'card-' + generateUniqueTimestampId(),
      front: 'Question',
      back: 'Answer',
    });
  });

  it('reports when uploads starts and stops', done => {
    subject.setSyncServer(testRemote, {
      onActive: wrapAssertingFunction(
        (info: PouchDB.Replication.SyncResult<{}>) => {
          expect(info.direction).toBe('push');
          done();
        }
      ),
    });

    subject.putCard({ front: 'Question', back: 'Answer' });
  });

  it('reports sync progress on initial download', async () => {
    const numCards = 9;
    const docs = [];
    for (let i = 0; i < numCards; i++) {
      docs.push({
        _id: generateUniqueTimestampId(),
        front: `Question ${i + 1}`,
        back: `Answer ${i + 1}`,
      });
    }

    let resolveAllDone: () => void;
    const allDone = new Promise(resolve => {
      resolveAllDone = resolve;
    });

    const progressValues: Array<number | null> = [];
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
          front: `Question ${i + 1}`,
          back: `Answer ${i + 1}`,
        })
      );
    }

    let resolveAllDone: () => void;
    const allDone = new Promise(resolve => {
      resolveAllDone = resolve;
    });

    const progressValues: Array<number | null> = [];
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
    expect(progressValues[0]).toBeLessThan(progressValues[1] as number);
    expect(progressValues[1]).toBeLessThan(progressValues[2] as number);
    expect(progressValues[2]).toBeLessThan(progressValues[3] as number);
    // We should check that progressValues[3] is 1, but it can actually go to
    // 1.1 due to the design doc. Not sure why actually. Oh well.
  });

  it('reports indeterminate progress on balanced bi-directional sync', async () => {
    const localCards = 4;
    const putPromises = [];
    for (let i = 0; i < localCards; i++) {
      putPromises.push(
        subject.putCard({
          front: `Local question ${i + 1}`,
          back: `Local answer ${i + 1}`,
        })
      );
    }

    const remoteCards = 4;
    const remoteDocs = [];
    for (let i = 0; i < remoteCards; i++) {
      remoteDocs.push({
        _id: generateUniqueTimestampId(),
        front: `Remote question ${i + 1}`,
        back: `Remote answer ${i + 1}`,
      });
    }

    let resolveAllDone: () => void;
    const allDone = new Promise(resolve => {
      resolveAllDone = resolve;
    });

    const progressValues: Array<number | null> = [];
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
        _id: generateUniqueTimestampId(),
        front: `Question ${i + 1}`,
        back: `Answer ${i + 1}`,
      });
    }

    let resolveIdle: () => void;
    const waitForIdle = new Promise(resolve => {
      resolveIdle = resolve;
    });

    const progressValues: Array<number | null> = [];
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
});
