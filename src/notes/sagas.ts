import { call, put, select, CallEffect, take } from 'redux-saga/effects';
import { watchEdits, ResourceState } from '../utils/autosave-saga';
import * as noteActions from './actions';
import {
  getNoteListSelector,
  getNoteStateSelector,
  isDirty,
} from './selectors';
import { DataStore } from '../store/DataStore';
import { Note } from '../model';
import { NoteContext, NoteListContext } from './actions';
import { SaveState } from './reducer';
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
        // If we are deleting a note, we won't have any resource left
        if (action.type === 'DELETE_NOTE') {
          return {
            context: action.context,
            needsSaving: false,
            resource: {},
          };
        }

        const noteState = noteStateSelector(state);
        if (!noteState) {
          return undefined;
        }

        const hasDataToSave = (note: Partial<Note>): boolean =>
          typeof note.id !== 'undefined' ||
          (typeof note.content === 'string' && note.content.length !== 0);

        return {
          context: action.context,
          needsSaving: isDirty(noteState) && hasDataToSave(noteState.note),
          resource: noteState.note,
        };
      };
    },
    delete: (
      dataStore: DataStore,
      action: noteActions.DeleteNoteAction,
      note: Partial<Note>
    ): CallEffect | undefined => {
      if (typeof note.id === 'string' || typeof action.noteId === 'string') {
        return call([dataStore, 'deleteNote'], note.id || action.noteId);
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

export function* beforeNotesScreenChange(context: NoteListContext) {
  const noteList = yield select(getNoteListSelector(context));

  const keyFromContext = (context: NoteContext): string =>
    Object.values(context).join('-');
  const notesBeingSaved = new Set<string>();
  for (const note of noteList) {
    if (!isDirty(note)) {
      continue;
    }

    const noteContext: NoteContext = { ...context, noteFormId: note.formId };
    yield put(noteActions.saveNote(noteContext));

    notesBeingSaved.add(keyFromContext(noteContext));
  }

  while (notesBeingSaved.size) {
    const action:
      | noteActions.FinishSaveNoteAction
      | noteActions.FailSaveNoteAction = yield take([
      'FINISH_SAVE_NOTE',
      'FAIL_SAVE_NOTE',
    ]);

    const key = keyFromContext(action.context);
    if (notesBeingSaved.has(key)) {
      if (action.type === 'FAIL_SAVE_NOTE') {
        return false;
      }
      notesBeingSaved.delete(key);
    }
  }

  return true;
}

export default noteSagas;
