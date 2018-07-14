import deepEqual from 'deep-equal';
import * as actions from './actions';
import { Note } from '../model';

export const enum NoteEditState {
  Ok = 'ok',
  Deleted = 'deleted',
}

export interface NoteState {
  // Until a new note gets saved, we need to identify it so we assign it
  // a number.
  //
  // This number only needs to be unique within the set of notes associated with
  // the same EditForm.
  newId?: number;
  note: Partial<Note>;
  editState: NoteEditState;
  dirtyFields?: Set<keyof Note>;
}

export function notes(
  state: Array<NoteState> = [],
  action: actions.NoteAction
): NoteState[] {
  switch (action.type) {
    case 'ADD_NOTE': {
      const newNote: Partial<Note> = {};
      if (action.initialKeywords) {
        newNote.keywords = action.initialKeywords.slice();
      }

      return [
        ...state,
        {
          newId: action.newId,
          note: newNote,
          editState: NoteEditState.Ok,
        },
      ];
    }

    case 'EDIT_NOTE': {
      // Find the note to update
      const noteStateIndex = findNoteIndex(state, action.newId, action.noteId);
      if (noteStateIndex === -1) {
        return state;
      }
      const noteState = state[noteStateIndex];

      // Update the note
      const updatedNote: Partial<Note> = {
        ...noteState.note,
        ...action.change,
      };

      // Update the dirty fields
      const dirtyFields: Set<keyof Note> = noteState.dirtyFields
        ? new Set(noteState.dirtyFields.values())
        : new Set();
      for (const [field, value] of Object.entries(action.change) as Array<
        [keyof Note, any]
      >) {
        if (field !== 'id' && !deepEqual(value, noteState.note[field])) {
          dirtyFields.add(field);
        }
      }

      // Prepare the updated note staet
      const updatedNoteState: NoteState = {
        ...noteState,
        note: updatedNote,
        dirtyFields,
      };

      // Put the updated thing in the right place in the array
      const updatedState = state.slice();
      updatedState.splice(noteStateIndex, 1, updatedNoteState);
      return updatedState;
    }

    default:
      return state;
  }
}

function findNoteIndex(
  notes: Array<NoteState>,
  newId?: number,
  noteId?: string
): number {
  return notes.findIndex(
    (note: NoteState) =>
      (typeof note.newId !== 'undefined' && note.newId === newId) ||
      (typeof noteId !== 'undefined' && note.note.id === noteId)
  );
}

export default notes;
