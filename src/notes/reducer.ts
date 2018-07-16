import deepEqual from 'deep-equal';
import * as actions from './actions';
import { Note } from '../model';

export interface NoteState {
  formId: number;
  note: Partial<Note>;
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
          formId: action.context.noteFormId,
          note: newNote,
        },
      ];
    }

    case 'EDIT_NOTE': {
      // Find the note to update
      const noteStateIndex = findNoteIndex(state, action.context.noteFormId);
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

    case 'FINISH_SAVE_NOTE': {
      const noteStateIndex = findNoteIndex(state, action.context.noteFormId);
      if (noteStateIndex === -1) {
        return state;
      }
      const noteState = state[noteStateIndex];

      const dirtyFields: Set<keyof Note> = new Set(
        (Object.keys(action.note) as Array<keyof Note>).filter(
          field =>
            field !== 'id' &&
            field !== 'created' &&
            field !== 'modified' &&
            !deepEqual(action.note[field], noteState.note[field])
        )
      );

      const updatedNoteState: NoteState = {
        formId: action.context.noteFormId,
        note: { ...action.note, ...noteState.note },
      };
      if (dirtyFields.size) {
        updatedNoteState.dirtyFields = dirtyFields;
      }

      const updatedState = state.slice();
      updatedState.splice(noteStateIndex, 1, updatedNoteState);
      return updatedState;
    }

    case 'FAIL_SAVE_NOTE': {
      // XXX
      return state;
    }

    default:
      return state;
  }
}

function findNoteIndex(notes: Array<NoteState>, formId: number): number {
  return notes.findIndex((noteState: NoteState) => noteState.formId === formId);
}

export default notes;
