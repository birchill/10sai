/**
 * @jest-environment node
 *
 * Why this? See my complaint about jest in ../route/sagas.test.js
 */

import { expectSaga } from 'redux-saga-test-plan';

import { watchNoteEdits as watchNoteEditsSaga } from './sagas';
import reducer from '../reducer';
import { Note } from '../model';
import * as noteActions from './actions';
import { EditNoteContext } from './actions';
import { FormState } from '../edit/FormState';
import { SaveState } from '../notes/reducer';

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
          dirtyFields: new Set(['prompt']),
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

describe('sagas:edit watchNoteEdits', () => {
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

    return expectSaga(watchNoteEditsSaga, dataStore)
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

    return expectSaga(watchNoteEditsSaga, dataStore)
      .withReducer(reducer, initialState)
      .dispatch(noteActions.saveNote(context))
      .dispatch(noteActions.deleteNote(context))
      .call([dataStore, 'putNote'], note)
      .call([dataStore, 'deleteNote'], 'abc')
      .silentRun(100);
  });
});
