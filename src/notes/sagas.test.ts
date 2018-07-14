/**
 * @jest-environment node
 *
 * Why this? See my complaint about jest in ../route/sagas.test.js
 */

import { expectSaga } from 'redux-saga-test-plan';

import { watchNoteEdits as watchCardEditsSaga } from './sagas';
import { NoteEditState } from './reducer';
import { Note } from '../model';
import * as noteActions from './actions';
import { NoteIdentifiers, EditNoteContext } from './actions';
import { FormId } from '../edit/reducer';
import EditorState from '../edit/EditorState';

const noteState = (
  formId: FormId,
  note: Partial<Note>,
  dirtyFields?: Set<keyof Note>
) => {
  return {
    route: { index: 0 },
    edit: {
      forms: {
        active: {
          formId,
          editorState: EditorState.Ok,
          card: {},
          dirtyFields: new Set(['prompt']),
          notes: [
            {
              note: {
                created: Date.now(),
                modified: Date.now(),
                ...note,
              },
              editState: NoteEditState.Ok,
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
    const formId = 'abc';
    const context: EditNoteContext = {
      screen: 'edit-card',
      formId,
    };
    const noteId: NoteIdentifiers = { newId: 1 };

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(noteState(formId, note))
      .dispatch(noteActions.saveNote(context, noteId))
      .call([dataStore, 'putNote'], note)
      .put(noteActions.finishSaveNote(context, noteId, note))
      .silentRun(100);
  });
});
