/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import PouchDB from 'pouchdb';

import DataStore from './DataStore';
import NoteStore from './NoteStore';
import { NOTE_PREFIX, NoteContent } from './content';
import { Note } from '../model';
import { syncWithWaitableRemote, waitForChangeEvents } from './test-utils';
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
    const changesPromise = waitForChangeEvents<Note>(dataStore, 'note', 1);

    const putNote = await subject.putNote(typicalNewNote);

    const changes = await changesPromise;
    expect(changes[0]).toMatchObject(putNote);
  });

  it('reports deleted notes', async () => {
    const changesPromise = waitForChangeEvents<Note>(dataStore, 'note', 2);
    const putNote = await subject.putNote(typicalNewNote);

    await subject.deleteNote(putNote.id);

    const changes = await changesPromise;
    expect(changes[1].id).toBe(putNote.id);
    expect(changes[1].deleted).toBeTruthy();
  });

  it('reports changes to notes', async () => {
    const changesPromise = waitForChangeEvents<Note>(dataStore, 'note', 2);
    const putNote = await subject.putNote(typicalNewNote);

    await subject.putNote({ ...putNote, content: 'Updated' });

    const changes = await changesPromise;
    expect(changes[1].content).toBe('Updated');
  });
});
