/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import PouchDB from 'pouchdb';

import { NoteListWatcher } from './NoteListWatcher';
import DataStore from '../store/DataStore';
import { Note } from '../model';

PouchDB.plugin(require('pouchdb-adapter-memory'));

describe('NoteListWatcher', () => {
  let dataStore: DataStore;

  beforeEach(() => {
    dataStore = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });
  });

  afterEach(() => dataStore.destroy());

  // Helper to produce:
  //
  // - a callback to pass to the NoteListWatcher constructor
  // - a Promise that will resolve after the callback has been called |num|
  //   times
  //
  const waitForCalls = (
    num: number
  ): [(notes: Note[]) => void, Promise<Note[][]>] => {
    const calls: Note[][] = [];

    let resolver: (calls: Note[][]) => void;
    const promise = new Promise<Note[][]>(resolve => {
      resolver = resolve;
    });

    let recordedChanges = 0;
    const callback = (notes: Note[]) => {
      calls.push(notes);
      if (++recordedChanges === num) {
        resolver(calls);
      }
    };

    return [callback, promise];
  };

  it('returns the initial list of notes', async () => {
    const note1 = await dataStore.putNote({
      content: 'Note 1',
      keywords: ['ABC', 'DEF'],
    });
    const note2 = await dataStore.putNote({
      content: 'Note 2',
      keywords: ['Def', 'GHI'],
    });
    const note3 = await dataStore.putNote({
      content: 'Note 3',
      keywords: ['Abc'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(1);
    const subject = new NoteListWatcher(dataStore, callback, ['def']);

    const calls = await finished;

    expect(calls[0]).toEqual([note1, note2]);
    expect(await subject.getNotes()).toEqual([note1, note2]);
  });

  it('reports a newly-added card that matches', async () => {
    const note1 = await dataStore.putNote({
      content: 'Note 1',
      keywords: ['ABC', 'DEF'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(2);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);

    // Wait for the initial set of notes to be fetched
    await subject.getNotes();

    const note2 = await dataStore.putNote({
      content: 'Note 2',
      keywords: ['Abc'],
    });

    const calls = await finished;

    expect(calls[0]).toEqual([note1]);
    expect(calls[1]).toEqual([note1, note2]);
    expect(await subject.getNotes()).toEqual([note1, note2]);
  });

  // Test: A newly-added card that matches
  // Test: A newly-added card that does not match
  // Test: A deleted card that did match
  // Test: A deleted card that does not match
  // Test: A content change to a card that does match
  // Test: A content change to a card that does not match
  // Test: A keyword change to a card so that it begins to matches
  // Test: A keyword change to a card so that it no longer matches
  // Test: A keyword change to a card so that it continues to match
  // Test: A keyword change to a card so that it continues to not match
  // Test: A redundant change on a card that does match
  // Test: An empty array of keywords to match
  // Test: An empty string
});
