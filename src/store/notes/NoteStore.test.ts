/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import PouchDB from 'pouchdb';

import DataStore from '../DataStore';
import NoteStore from './NoteStore';
import { NoteRecord } from './records';
import { Note } from '../../model';

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
    /*
    const putNote = await subject.putNote(typicalNewNote);
    const updatedNote = await subject.putNote({ content: 'Updated content' });
    const gotNote = await subject.getNote(putNote.id);
    expect(gotNote).toEqual({ ...putNote, content: 'Updated content' });
     */
  });

  it('does not return a deleted note', async () => {});

  it('fails silently when the note to be deleted cannot be found', async () => {});

  it('resolves conflicts by choosing the most recently modified note', async () => {});

  it('reports added notes', async () => {});

  it('reports deleted notes', async () => {});

  it('reports changes to notes', async () => {});
});
