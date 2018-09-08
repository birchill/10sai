/**
 * @jest-environment node
 *
 * Why this? See my complaint about jest in ../route/sagas.test.js
 */

import { expectSaga } from 'redux-saga-test-plan';

import { watchNoteEdits, beforeNotesScreenChange } from './sagas';
import reducer from '../reducer';
import { Note } from '../model';
import * as noteActions from './actions';
import { EditNoteContext, EditScreenContext } from './actions';
import { FormState } from '../edit/FormState';
import { SaveState, NoteState } from '../notes/reducer';
import { StoreError } from '../store/DataStore';

const noteState = (
  cardFormId: number,
  noteFormId: number,
  note: Partial<Note>,
  dirtyFields?: Set<keyof Note>
) => {
  return {
    route: { index: 0 },
    edit: {
      forms: {
        active: {
          formId: cardFormId,
          formState: FormState.Ok,
          card: {},
          notes: [
            {
              formId: noteFormId,
              note,
              dirtyFields,
            },
          ],
        },
      },
    },
  };
};

describe('sagas:notes watchNoteEdits', () => {
  it('saves the note', () => {
    const dataStore = { putNote: note => note };
    const note = {
      content: 'Noterifictastical!',
      keywords: ['abc', 'def'],
    };
    const dirtyFields = new Set<keyof Note>(['content', 'keywords']);
    const cardFormId = 5;
    const noteFormId = 7;
    const context: EditNoteContext = {
      screen: 'edit-card',
      cardFormId,
      noteFormId,
    };

    return expectSaga(watchNoteEdits, dataStore)
      .withState(noteState(cardFormId, noteFormId, note, dirtyFields))
      .dispatch(noteActions.saveNote(context))
      .call([dataStore, 'putNote'], note)
      .put(noteActions.finishSaveNote(context, note))
      .silentRun(100);
  });

  it('deletes note from the store even if the initial save is in progress', () => {
    const dataStore = {
      putNote: async note => {
        // This needs to take a tick or two so that the delete runs before we
        // finish saving.
        return new Promise(resolve => {
          setImmediate(() => {
            resolve({ ...note, id: 'abc' });
          });
        });
      },
      deleteNote: () => {},
    };
    const note = {
      content: 'Noterifictastical!',
      keywords: ['abc', 'def'],
    };
    const dirtyFields = new Set<keyof Note>(['content', 'keywords']);
    const cardFormId = 5;
    const noteFormId = 7;
    const context: EditNoteContext = {
      screen: 'edit-card',
      cardFormId,
      noteFormId,
    };
    const initialState = noteState(cardFormId, noteFormId, note, dirtyFields);

    return expectSaga(watchNoteEdits, dataStore)
      .withReducer(reducer, initialState)
      .dispatch(noteActions.saveNote(context))
      .dispatch(noteActions.deleteNote(context))
      .call([dataStore, 'putNote'], note)
      .call([dataStore, 'deleteNote'], 'abc')
      .silentRun(100);
  });
});

const multiNoteState = (cardFormId: number, notes: Array<NoteState>) => {
  return {
    route: { index: 0 },
    edit: {
      forms: {
        active: {
          formId: cardFormId,
          formState: FormState.Ok,
          card: {},
          notes,
        },
      },
    },
  };
};

const typicalNote = (id: string): Note => ({
  id,
  keywords: ['def', 'ghi'],
  content: 'Noterifictastical!',
  created: Date.now(),
  modified: Date.now(),
});

describe('sagas:notes beforeNotesScreenChange', () => {
  it('dispatches SAVE_NOTE for any of the notes that are dirty', () => {
    const cardFormId = 5;
    const firstNote: NoteState = {
      formId: 1,
      note: typicalNote('abc'),
      saveState: SaveState.Ok,
      originalKeywords: new Set(['def', 'ghi']),
      dirtyFields: new Set<keyof Note>(['keywords']),
    };
    const secondNote: NoteState = {
      formId: 2,
      note: typicalNote('def'),
      saveState: SaveState.Ok,
      originalKeywords: new Set(['def', 'ghi']),
    };
    const thirdNote: NoteState = {
      formId: 3,
      note: typicalNote('ghi'),
      saveState: SaveState.Ok,
      originalKeywords: new Set(['def', 'ghi']),
      dirtyFields: new Set<keyof Note>(['content']),
    };
    const state = multiNoteState(cardFormId, [
      firstNote,
      secondNote,
      thirdNote,
    ]);

    const screenContext: EditScreenContext = {
      screen: 'edit-card',
      cardFormId,
    };
    const firstNoteContext: EditNoteContext = {
      ...screenContext,
      noteFormId: 1,
    };
    const thirdNoteContext: EditNoteContext = {
      ...screenContext,
      noteFormId: 3,
    };

    return expectSaga(beforeNotesScreenChange, screenContext)
      .withState(state)
      .put(noteActions.saveNote(firstNoteContext))
      .put(noteActions.saveNote(thirdNoteContext))
      .dispatch(noteActions.finishSaveNote(firstNoteContext, firstNote.note))
      .dispatch(noteActions.finishSaveNote(thirdNoteContext, thirdNote.note))
      .returns(true)
      .run();
  });

  it('does nothing if note of the notes are dirty', () => {
    const cardFormId = 5;
    const state = multiNoteState(cardFormId, [
      {
        formId: 1,
        note: typicalNote('abc'),
        saveState: SaveState.Ok,
        originalKeywords: new Set(['def', 'ghi']),
      },
      {
        formId: 2,
        note: typicalNote('def'),
        saveState: SaveState.Ok,
        originalKeywords: new Set(['def', 'ghi']),
      },
    ]);

    const screenContext: EditScreenContext = {
      screen: 'edit-card',
      cardFormId,
    };
    const firstNoteContext: EditNoteContext = {
      ...screenContext,
      noteFormId: 1,
    };
    const secondNoteContext: EditNoteContext = {
      ...screenContext,
      noteFormId: 2,
    };

    return expectSaga(beforeNotesScreenChange, screenContext)
      .withState(state)
      .not.put(noteActions.saveNote(firstNoteContext))
      .not.put(noteActions.saveNote(secondNoteContext))
      .returns(true)
      .run();
  });

  it('returns false if any of the notes fails to save', () => {
    const cardFormId = 5;
    const firstNote: NoteState = {
      formId: 1,
      note: typicalNote('abc'),
      saveState: SaveState.Ok,
      originalKeywords: new Set(['def', 'ghi']),
      dirtyFields: new Set<keyof Note>(['keywords']),
    };
    const secondNote: NoteState = {
      formId: 2,
      note: typicalNote('def'),
      saveState: SaveState.Ok,
      originalKeywords: new Set(['def', 'ghi']),
      dirtyFields: new Set<keyof Note>(['content']),
    };
    const state = multiNoteState(cardFormId, [firstNote, secondNote]);

    const screenContext: EditScreenContext = {
      screen: 'edit-card',
      cardFormId,
    };
    const firstNoteContext: EditNoteContext = {
      ...screenContext,
      noteFormId: 1,
    };
    const secondNoteContext: EditNoteContext = {
      ...screenContext,
      noteFormId: 2,
    };

    return expectSaga(beforeNotesScreenChange, screenContext)
      .withState(state)
      .put(noteActions.saveNote(firstNoteContext))
      .put(noteActions.saveNote(secondNoteContext))
      .dispatch(noteActions.finishSaveNote(firstNoteContext, firstNote.note))
      .dispatch(
        noteActions.failSaveNote(
          secondNoteContext,
          new StoreError(400, 'bad', 'This is bad')
        )
      )
      .returns(false)
      .run();
  });
});