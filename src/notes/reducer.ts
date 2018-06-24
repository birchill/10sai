import * as actions from './actions';
import { Note } from '../model';

export type FormId = string | number;

export const enum NoteEditState {
  Ok = 'ok',
  Dirty = 'dirty',
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
      // XXX
    }

    default:
      return state;
  }
}

export default notes;
