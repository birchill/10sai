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
      if (recordedChanges > num) {
        throw `Got ${recordedChanges} calls, but only expected ${num}`;
      }
    };

    if (num === 0) {
      resolver([]);
    }

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

  it('does NOT report a newly-added card that does NOT match', async () => {
    const note1 = await dataStore.putNote({
      content: 'Note 1',
      keywords: ['ABC', 'DEF'],
    });

    const result: Array<Note> = [];

    const [callback] = waitForCalls(1);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);
    await subject.getNotes();

    const note2 = await dataStore.putNote({
      content: 'Note 2',
      keywords: ['def'],
    });

    expect(await subject.getNotes()).toEqual([note1]);
  });

  it('reports a deleted card that matches', async () => {
    const note = await dataStore.putNote({
      content: 'Note',
      keywords: ['abc', 'def'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(2);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);
    await subject.getNotes();

    await dataStore.deleteNote(note.id);

    const calls = await finished;

    expect(calls[0]).toEqual([note]);
    expect(calls[1]).toEqual([]);
    expect(await subject.getNotes()).toEqual([]);
  });

  it('does NOT report a deleted card that does NOT match', async () => {
    const note1 = await dataStore.putNote({
      content: 'Note 1',
      keywords: ['abc'],
    });
    const note2 = await dataStore.putNote({
      content: 'Note 2',
      keywords: ['def'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(1);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);
    await subject.getNotes();

    await dataStore.deleteNote(note2.id);

    const calls = await finished;

    expect(calls[0]).toEqual([note1]);
    expect(await subject.getNotes()).toEqual([note1]);
  });

  it('reports a content change to a card that matches', async () => {
    const note = await dataStore.putNote({
      content: 'Content',
      keywords: ['ABC', 'DEF'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(2);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);
    await subject.getNotes();

    const updatedNote = await dataStore.putNote({
      ...note,
      content: 'Updated content',
    });

    const calls = await finished;

    expect(calls[0]).toEqual([note]);
    expect(calls[1]).toEqual([updatedNote]);
    expect(await subject.getNotes()).toEqual([updatedNote]);
  });

  it('does NOT report a content change to a card that does NOT match', async () => {
    const note1 = await dataStore.putNote({
      content: 'Note 1',
      keywords: ['ABC'],
    });
    const note2 = await dataStore.putNote({
      content: 'Note 2',
      keywords: ['DEF'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(1);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);
    await subject.getNotes();

    const updatedNote2 = await dataStore.putNote({
      ...note2,
      content: 'Updated content',
    });

    const calls = await finished;

    expect(calls[0]).toEqual([note1]);
    expect(await subject.getNotes()).toEqual([note1]);
  });

  it('reports an updated card that begins to match', async () => {
    const note1 = await dataStore.putNote({
      content: 'Note 1',
      keywords: ['ABC'],
    });
    const note2 = await dataStore.putNote({
      content: 'Note 2',
      keywords: ['DEF'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(2);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);
    await subject.getNotes();

    const updatedNote2 = await dataStore.putNote({
      ...note2,
      keywords: ['Abc', 'DEF'],
    });

    const calls = await finished;

    expect(calls[0]).toEqual([note1]);
    expect(calls[1]).toEqual([note1, updatedNote2]);
    expect(await subject.getNotes()).toEqual([note1, updatedNote2]);
  });

  it('reports an updated card that stops matching', async () => {
    const note1 = await dataStore.putNote({
      content: 'Note 1',
      keywords: ['ABC'],
    });
    const note2 = await dataStore.putNote({
      content: 'Note 2',
      keywords: ['ABC', 'DEF'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(2);
    const subject = new NoteListWatcher(dataStore, callback, ['abc']);
    await subject.getNotes();

    await dataStore.putNote({
      ...note2,
      keywords: ['DEF'],
    });

    const calls = await finished;

    expect(calls[0]).toEqual([note1, note2]);
    expect(calls[1]).toEqual([note1]);
    expect(await subject.getNotes()).toEqual([note1]);
  });

  it('reports a keyword change to a card that matches (and continues to match)', async () => {
    const note = await dataStore.putNote({
      content: 'Content',
      keywords: ['ABC'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(2);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);
    await subject.getNotes();

    const updatedNote = await dataStore.putNote({
      ...note,
      keywords: ['abc', 'def'],
    });

    const calls = await finished;

    expect(calls[0]).toEqual([note]);
    expect(calls[1]).toEqual([updatedNote]);
    expect(await subject.getNotes()).toEqual([updatedNote]);
  });

  it('does NOT report a keyword change to a card that does NOT match (and continues to NOT match)', async () => {
    const note1 = await dataStore.putNote({
      content: 'Note 1',
      keywords: ['ABC'],
    });
    const note2 = await dataStore.putNote({
      content: 'Note 2',
      keywords: ['DEF'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(1);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);
    await subject.getNotes();

    const updatedNote2 = await dataStore.putNote({
      ...note2,
      keywords: ['def', 'AB'],
    });

    const calls = await finished;

    expect(calls[0]).toEqual([note1]);
    expect(await subject.getNotes()).toEqual([note1]);
  });

  it('does NOT report a redundant change to a card that matches', async () => {
    const note = await dataStore.putNote({
      content: 'Note',
      keywords: ['ABC'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(1);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);
    await subject.getNotes();

    await dataStore.putNote({ ...note });

    const calls = await finished;

    expect(calls[0]).toEqual([note]);
    expect(await subject.getNotes()).toEqual([note]);
  });

  it('does NOT report a redundant change to a card that matches', async () => {
    const note = await dataStore.putNote({
      content: 'Note',
      keywords: ['ABC'],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(1);
    const subject = new NoteListWatcher(dataStore, callback, ['ABC']);
    await subject.getNotes();

    await dataStore.putNote({ ...note });

    const calls = await finished;

    expect(calls[0]).toEqual([note]);
    expect(await subject.getNotes()).toEqual([note]);
  });

  it('does not return any results when given an empty string as the only keyword', async () => {
    const note1 = await dataStore.putNote({
      content: 'Note 1',
      keywords: ['ABC'],
    });
    // Make sure to include a note that actually has an empty string has one of
    // its keywords.
    //
    // (Hopefully the UI would prevent users from actually entering this but
    // it's always possible for it to find its way into the database by other
    // means.)
    const note2 = await dataStore.putNote({
      content: 'Note 2',
      keywords: [''],
    });

    const result: Array<Note> = [];

    const [callback, finished] = waitForCalls(0);
    const subject = new NoteListWatcher(dataStore, callback, ['']);
    expect(await subject.getNotes()).toEqual([]);

    // Make the first note have an empty string keyword.
    await dataStore.putNote({
      ...note1,
      keywords: [''],
    });
    // Make a change to the second note (which already has an empty string
    // keyword).
    await dataStore.putNote({
      ...note2,
      content: 'Updated content',
    });

    const calls = await finished;

    expect(await subject.getNotes()).toEqual([]);
  });

  // Test: An empty array of keywords to match
});
