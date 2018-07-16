import { call, put, select, CallEffect } from 'redux-saga/effects';
import { watchEdits, ResourceState } from '../utils/autosave-saga';
import * as noteActions from './actions';
import { getNoteStateSelector, isDirty } from './selectors';
import { DataStore } from '../store/DataStore';
import { Note } from '../model';
import { NoteContext } from './actions';
import { EditState } from '../edit/reducer';

const SAVE_DELAY = 2000;

// XXX This doesn't belong here
interface State {
  edit: EditState;
}

export function* save(
  dataStore: DataStore,
  context: NoteContext,
  note: Partial<Note>
) {
  try {
    const savedNote = yield call([dataStore, 'putNote'], note);

    yield put(noteActions.finishSaveNote(context, savedNote));

    return savedNote;
  } catch (error) {
    console.error(`Failed to save: ${JSON.stringify(error)}`);
    yield put(noteActions.failSaveNote(context, error));

    return note;
  }
}

export function* watchNoteEdits(dataStore: DataStore) {
  const params = {
    editActionType: 'EDIT_NOTE',
    saveActionType: 'SAVE_NOTE',
    deleteActionType: 'DELETE_NOTE',

    resourceStateSelector: (
      action:
        | noteActions.EditNoteAction
        | noteActions.SaveNoteAction
        | noteActions.DeleteNoteAction
    ) => {
      const noteStateSelector = getNoteStateSelector(action.context);

      return (state: State): ResourceState<Note, NoteContext> | undefined => {
        const noteState = noteStateSelector(state);
        if (!noteState) {
          return undefined;
        }

        const hasDataToSave = (note: Partial<Note>): boolean =>
          typeof note.id !== 'undefined' ||
          (typeof note.content === 'string' && note.content.length !== 0);

        return {
          context: action.context,
          deleted: false,
          needsSaving: isDirty(noteState) && hasDataToSave(noteState.note),
          resource: noteState.note,
        };
      };
    },
    delete: (
      dataStore: DataStore,
      action: noteActions.DeleteNoteAction
    ): CallEffect | undefined => {
      if (typeof action.noteId === 'string') {
        return call([dataStore, 'deleteNote'], action.noteId);
      }
    },
    save,
    saveActionCreator: (context: NoteContext) => noteActions.saveNote(context),
    finishSaveActionCreator: (context: NoteContext, note: Partial<Note>) =>
      noteActions.finishSaveNote(context, note),
  };

  yield* watchEdits(dataStore, SAVE_DELAY, params);
}

export function* noteSagas(dataStore: DataStore) {
  yield* [watchNoteEdits(dataStore)];
}

export default noteSagas;
