/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import PouchDB from 'pouchdb';

import DataStore from '../DataStore';
import NoteStore from './NoteStore';
import { NoteRecord } from './records';
import { Note } from '../../model';
// import { waitForEvents } from '../../../test/testcommon';
// import { syncWithWaitableRemote } from '../test-utils';

PouchDB.plugin(require('pouchdb-adapter-memory'));

/*
const waitForMs = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

// Note: Using numbers other than 1 for 'num' might be unsafe since, if the
// changes are to the same document they might get batched together.
const waitForNumReviewChanges = (db, num) => {
  let resolver;
  const promise = new Promise(resolve => {
    resolver = resolve;
  });

  let recordedChanges = 0;
  db.changes({ since: 'now', live: true }).on('change', change => {
    if (!change.id.startsWith('review-')) {
      return;
    }
    if (++recordedChanges === num) {
      resolver();
    }
  });

  return promise;
};

const waitForNumReviewEvents = (dataStore, num) => {
  const events = [];

  let resolver;
  const promise = new Promise(resolve => {
    resolver = resolve;
  });

  let recordedChanges = 0;
  dataStore.changes.on('review', change => {
    events.push(change);
    if (++recordedChanges === num) {
      resolver(events);
    }
  });

  return promise;
};
 */

describe('NoteStore', () => {
  let dataStore: DataStore;
  let subject: NoteStore;
  let testRemote: PouchDB.Database;

  const typicalNewNote: Partial<Note> = {
    keywords: ['keyword 1', 'keyword 2'],
    content: 'Note',
  };

  beforeEach(() => {
    // Pre-fetching views seems to be a real bottle-neck when running tests
    dataStore = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });
    subject = dataStore.noteStore;

    // A separate remote we use for reading back records directly, injecting
    // conflicting records etc.
    testRemote = new PouchDB('cards_remote', { adapter: 'memory' });
  });

  afterEach(() => Promise.all([dataStore.destroy(), testRemote.destroy()]));

  it('returns a newly-added note', async () => {
    const putNote = await subject.putNote(typicalNewNote);
    const gotNote = await subject.getNote(putNote.id);
    expect(gotNote).toEqual(putNote);
  });
});
