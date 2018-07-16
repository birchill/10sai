/**
 * @jest-environment node
 *
 * Why this? See my complaint about jest in ../route/sagas.test.js
 */

import { expectSaga } from 'redux-saga-test-plan';

import { watchNoteEdits as watchNoteEditsSaga } from './sagas';
import { Note } from '../model';
import * as noteActions from './actions';
import { EditNoteContext } from './actions';
import { FormState } from '../edit/FormState';

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
});
