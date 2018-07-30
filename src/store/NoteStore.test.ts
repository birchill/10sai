/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import PouchDB from 'pouchdb';

import DataStore from './DataStore';
import { NoteStore, NoteContent, NoteChange, NOTE_PREFIX } from './NoteStore';
import { Note } from '../model';
import { syncWithWaitableRemote, waitForChangeEvents } from './test-utils';
import { waitForEvents } from '../utils/testing';
import { stripFields } from '../utils/type-helpers';

PouchDB.plugin(require('pouchdb-adapter-memory'));

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

    // A separate remote we use for reading back documents directly, injecting
    // conflicting documents etc.
    testRemote = new PouchDB('cards_remote', { adapter: 'memory' });
  });

  afterEach(() => Promise.all([dataStore.destroy(), testRemote.destroy()]));

  it('returns a newly-added note', async () => {
    const putNote = await subject.putNote(typicalNewNote);

    const gotNote = await subject.getNote(putNote.id);

    expect(gotNote).toEqual(putNote);
  });

  it('does not return a non-existent note', async () => {
    await expect(subject.getNote('abc')).rejects.toMatchObject({
      status: 404,
      name: 'not_found',
      message: 'missing',
      reason: 'missing',
    });
  });

  it('updates a note', async () => {
    const putNote = await subject.putNote(typicalNewNote);

    const updatedNote = await subject.putNote({
      id: putNote.id,
      content: 'Updated content',
    });

    const gotNote = await subject.getNote(putNote.id);
    expect(gotNote).toEqual({
      ...putNote,
      content: 'Updated content',
      modified: updatedNote.modified,
    });
  });

  it('ignores a redundant update to a note', async () => {
    const putNote = await subject.putNote(typicalNewNote);

    const updatedNote = await subject.putNote({
      id: putNote.id,
      content: putNote.content,
    });

    // Check the result returned
    expect(updatedNote.modified).toEqual(putNote.modified);

    // Check the result returned from the DB
    const gotNote = await subject.getNote(putNote.id);
    expect(gotNote.modified).toEqual(putNote.modified);
  });

  it('does not return a deleted note', async () => {
    const putNote = await subject.putNote(typicalNewNote);
    await subject.deleteNote(putNote.id);

    await expect(subject.getNote(putNote.id)).rejects.toMatchObject({
      status: 404,
      name: 'not_found',
      message: 'missing',
      reason: 'deleted',
    });
  });

  it('fails silently when the note to be deleted cannot be found', async () => {
    await expect(subject.deleteNote('abc')).resolves.toBeUndefined();
  });

  it('resolves conflicts by choosing the most recently modified note', async () => {
    // Create a new note and get the ID
    const localNote = await subject.putNote({
      ...typicalNewNote,
      content: 'Local',
    });

    // Create a new note with the same ID on the remote but with an older
    // created/modified value.
    await testRemote.put<NoteContent>({
      ...stripFields(typicalNewNote, ['id']),
      _id: NOTE_PREFIX + localNote.id,
      content: 'Remote',
      created: localNote.created - 1,
      modified: localNote.modified - 1,
    });

    // Now connect the two and let chaos ensue
    const waitForIdle = await syncWithWaitableRemote(dataStore, testRemote);
    await waitForIdle();

    // Check that the conflict is gone...
    const result = await testRemote.get<NoteContent>(
      NOTE_PREFIX + localNote.id,
      {
        conflicts: true,
      }
    );
    expect(result._conflicts).toBeUndefined();
    // ... and that we chose the right note
    expect(result.content).toBe('Local');
    expect(result.modified).toBe(localNote.modified);
  });

  it('reports added notes', async () => {
    const changesPromise = waitForChangeEvents<NoteChange>(
      dataStore,
      'note',
      1
    );

    const putNote = await subject.putNote(typicalNewNote);

    const changes = await changesPromise;
    expect(changes[0].note).toMatchObject(putNote);
  });

  it('reports deleted notes', async () => {
    const changesPromise = waitForChangeEvents<NoteChange>(
      dataStore,
      'note',
      2
    );
    const putNote = await subject.putNote(typicalNewNote);

    await subject.deleteNote(putNote.id);

    const changes = await changesPromise;
    expect(changes[1].note.id).toBe(putNote.id);
    expect(changes[1].deleted).toBeTruthy();
  });

  it('reports changes to notes', async () => {
    const changesPromise = waitForChangeEvents<NoteChange>(
      dataStore,
      'note',
      2
    );
    const putNote = await subject.putNote(typicalNewNote);

    await subject.putNote({ ...putNote, content: 'Updated' });

    const changes = await changesPromise;
    expect(changes[1].note.content).toBe('Updated');
  });

  it('does not report redundant changes', async () => {
    const changesPromise = waitForChangeEvents<NoteChange>(
      dataStore,
      'note',
      1
    );
    const putNote = await subject.putNote(typicalNewNote);
    await changesPromise;

    let gotChange = false;
    dataStore.changes.on('note', () => {
      gotChange = true;
    });

    await subject.putNote({ ...putNote, content: typicalNewNote.content });
    await waitForEvents(5);

    expect(gotChange).toBeFalsy();
  });

  it('keyword search: initially returns an empty array', async () => {
    const result = await dataStore.getKeywords('ABC', 10);
    expect(result).toEqual([]);
  });

  it('keyword search: returns matching keywords', async () => {
    await dataStore.putNote({ ...typicalNewNote, keywords: ['abcdef'] });
    await dataStore.putNote({ ...typicalNewNote, keywords: ['BCD', 'Abc'] });
    await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['ABCDEFGHI', 'abcdef'],
    });
    await dataStore.putNote({ ...typicalNewNote, keywords: ['ABCD'] });

    const result = await dataStore.getKeywords('ABC', 10);

    expect(result).toEqual(['Abc', 'abcdef', 'ABCD', 'ABCDEFGHI']);
  });

  it('keyword search: respects the limit for matched keywords', async () => {
    await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['ABCDEF'],
    });
    await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['BCD', 'ABC'],
    });
    await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['ABCDEFGHI'],
    });
    await subject.putNote({
      ...typicalNewNote,
      keywords: ['ABCD'],
    });

    const result = await dataStore.getKeywords('ABC', 2);

    expect(result).toEqual(['ABC', 'ABCD']);
  });

  it('keyword search: prioritizes notes over cards', async () => {
    await dataStore.putCard({
      question: 'Question',
      answer: 'Answer',
      keywords: ['A1'],
      tags: [],
      starred: false,
    });
    await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['A2'],
    });
    await dataStore.putCard({
      question: 'Question',
      answer: 'Answer',
      keywords: ['A3'],
      tags: [],
      starred: false,
    });

    const result = await dataStore.getKeywords('A', 5);

    expect(result).toEqual(['A2', 'A1', 'A3']);
  });

  it('keyword lookup: returns an empty array when there are no matches', async () => {
    const result = await dataStore.getNotesForKeywords(['ABC']);

    expect(result).toEqual([]);
  });

  it('keyword lookup: returns matching keywords', async () => {
    const note1 = await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['ABC'],
    });
    const note2 = await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['ABCDEF'],
    });
    const note3 = await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['BCD', 'ABC'],
    });
    const note4 = await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['ABC'],
    });

    const result = await dataStore.getNotesForKeywords(['ABC']);

    expect(result).toEqual([note1, note3, note4]);
  });

  it('keyword lookup: returns matches on any of the keywords', async () => {
    const note1 = await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['ABC'],
    });
    const note2 = await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['DEF'],
    });
    const note3 = await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['Bcd', 'Abc'],
    });
    const note4 = await dataStore.putNote({
      ...typicalNewNote,
      keywords: ['BCD', 'unrelated'],
    });

    const result = await dataStore.getNotesForKeywords(['ABC', 'bcd']);

    expect(result).toEqual([note1, note3, note4]);
  });

  it('keyword lookup: returns nothing for an empty array', async () => {
    await dataStore.putNote({ ...typicalNewNote, keywords: ['ABC'] });

    const result = await dataStore.getNotesForKeywords([]);

    expect(result).toEqual([]);
  });

  it('keyword lookup: returns nothing for an empty string', async () => {
    await dataStore.putNote({ ...typicalNewNote, keywords: ['ABC'] });

    const result = await dataStore.getNotesForKeywords(['']);

    expect(result).toEqual([]);
  });
});
