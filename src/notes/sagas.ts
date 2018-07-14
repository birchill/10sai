import { call, put, select } from 'redux-saga/effects';
import { Store } from 'redux';
import {
  watchEdits,
  ResourceState,
  SaveContextBase,
} from '../utils/autosave-saga';
import * as noteActions from './actions';
import { DataStore } from '../store/DataStore';
import { Note } from '../model';

const SAVE_DELAY = 2000;

type NoteSaveContext = NoteContext & SaveContextBase;

const noteContextFromSaveContext = (
  saveContext: NoteSaveContext
): NoteContext => stripFields(saveContext, ['newId', 'resourceId']);

export function* save(
  dataStore: DataStore,
  resourceState: ResourceState<Note, NoteSaveContext>
) {
  const context: NoteContext = noteContextFromSaveContext(
    resourceState.context
  );
  const noteId: NoteIdentifiers = {
    newId: resourceState.context.newId,
    noteId: resourceState.context.resourceId,
  };
  const note = resourceState.resource;

  try {
    const savedNote = yield call([dataStore, 'putNote'], note);

    yield put(noteActions.finishSaveNote(context, noteId, savedNote));

    return savedNote._id;
  } catch (error) {
    console.error(`Failed to save: ${JSON.stringify(error)}`);
    yield put(noteActions.failSaveNote(context, noteId, error));
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
      return (state: State): ResourceState<Note, NoteSaveContext> => ({
        context: {
          newId: action.newId,
          resourceId: action.noteId,
          // XXX Probably need to switch based on the screen type
          screen: action.context.screen,
        },
        // XXX Fix this
        deleted: false,
        // XXX And this
        dirty: isDirty(state),
        // XXX This probably depends on the context...
        resource: state.edit.forms.active.card,
      });
    },
    hasDataToSave: (resource: Partial<Note>): boolean =>
      typeof resource._id !== 'undefined' ||
      (typeof resource.content === 'string' && resource.content.length !== 0),
    delete: (dataStore: DataStore, resourceId: string) =>
      call([dataStore, 'deleteNote'], resourceId),
    save,
    saveActionCreator: (saveContext: NoteSaveContext) => {
      const context: NoteContext = noteContextFromSaveContext(saveContext);
      const noteId: NoteIdentifiers = {
        newId: saveContext.newId,
        noteId: saveContext.resourceId,
      };
      return noteActions.saveNote(context, noteId);
    },
    finishSaveActionCreator: (
      saveContext: NoteSaveContext,
      resource: Partial<Note>
    ) => {
      // XXX Remove this boilerplate somehow
      // (Perhaps even by changing the actions themselves)
      const context: NoteContext = noteContextFromSaveContext(saveContext);
      const noteId: NoteIdentifiers = {
        newId: saveContext.newId,
        noteId: saveContext.resourceId,
      };
      return noteActions.finishSaveNote(context, noteId, resource);
    },
  };

  yield* watchEdits(dataStore, SAVE_DELAY, params);
}

export function* noteSagas(dataStore: DataStore) {
  yield* [watchNoteEdits(dataStore)];
}

export default noteSagas;
