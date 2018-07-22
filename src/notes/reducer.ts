import deepEqual from 'deep-equal';
import { collate } from 'pouchdb-collate';
import * as actions from './actions';
import { Note } from '../model';
import { StoreError } from '../store/DataStore';

export const enum SaveState {
  New = 'new',
  Ok = 'ok',
  InProgress = 'in-progress',
  Error = 'error',
}

export interface NoteState {
  formId: number;
  note: Partial<Note>;
  dirtyFields?: Set<keyof Note>;
  saveState: SaveState;
  saveError?: StoreError;
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
          saveState: SaveState.New,
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

      return updateState(state, updatedNoteState, noteStateIndex);
    }

    case 'SAVE_NOTE': {
      const noteStateIndex = findNoteIndex(state, action.context.noteFormId);
      if (noteStateIndex === -1) {
        return state;
      }
      const noteState = state[noteStateIndex];

      const updatedNoteState: NoteState = {
        ...noteState,
        saveState: SaveState.InProgress,
      };
      delete updatedNoteState.saveError;

      return updateState(state, updatedNoteState, noteStateIndex);
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
        saveState: SaveState.Ok,
      };
      if (dirtyFields.size) {
        updatedNoteState.dirtyFields = dirtyFields;
      }

      return updateState(state, updatedNoteState, noteStateIndex);
    }

    case 'FAIL_SAVE_NOTE': {
      const noteStateIndex = findNoteIndex(state, action.context.noteFormId);
      if (noteStateIndex === -1) {
        return state;
      }
      const noteState = state[noteStateIndex];

      const updatedNoteState: NoteState = {
        ...noteState,
        saveState: SaveState.Error,
        saveError: action.error,
      };

      return updateState(state, updatedNoteState, noteStateIndex);
    }

    case 'UPDATE_NOTE_LIST': {
      // Check both lists use the same sorting so that we can iterate them in
      // tandem.
      if (process.env.NODE_ENV === 'development') {
        console.assert(
          action.notes.every(
            (value, index, notes) =>
              index === 0 || collate(notes[index - 1].id, value.id) === -1
          ),
          'Notes in action should be sorted by ID'
        );
        console.assert(
          state.every(
            (value, index, notes) =>
              index === 0 ||
              collate(notes[index - 1].note.id, value.note.id) === -1
          ),
          'Notes in state should be sorted by ID'
        );
        console.assert(
          action.noteFormIds.length >= action.notes.length,
          'There should be at least as many note form IDs as notes'
        );
      }

      const updatedState: Array<NoteState> = [];
      let madeChange: boolean = false;

      if (state.length !== action.notes.length) {
        madeChange = true;
      }

      let newListIndex = 0;
      let oldListIndex = 0;

      const findMatchInOldList = (id: string): NoteState | undefined => {
        while (
          oldListIndex < state.length &&
          collate(state[oldListIndex].note.id, id) < 0
        ) {
          oldListIndex++;
        }
        return oldListIndex < state.length &&
          collate(state[oldListIndex].note.id, id) === 0
          ? state[oldListIndex]
          : undefined;
      };

      for (
        let newListIndex = 0;
        newListIndex < action.notes.length;
        newListIndex++
      ) {
        const newNote = action.notes[newListIndex];
        const match = findMatchInOldList(newNote.id);

        if (match) {
          if (deepEqual(match.note, newNote)) {
            updatedState.push(match);
          } else {
            const noteState: NoteState = {
              formId: match.formId,
              note: newNote,
              saveState: match.saveState,
            };
            if (typeof match.dirtyFields !== 'undefined') {
              noteState.dirtyFields = match.dirtyFields;
              // XXX Preserve the value of dirtyFields
            }
            if (typeof match.saveError !== 'undefined') {
              noteState.saveError = match.saveError;
            }
            updatedState.push(noteState);
            madeChange = true;
          }
        } else {
          const noteState: NoteState = {
            formId: action.noteFormIds.shift()!,
            note: newNote,
            saveState: SaveState.Ok,
          };
          updatedState.push(noteState);
          madeChange = true;
        }
      }
      // XXX Preserve created cards somehow

      return madeChange ? updatedState : state;
    }

    default:
      return state;
  }
}

function findNoteIndex(notes: Array<NoteState>, formId: number): number {
  return notes.findIndex((noteState: NoteState) => noteState.formId === formId);
}

function updateState(
  state: NoteState[],
  updatedNoteState: NoteState,
  noteStateIndex: number
): NoteState[] {
  const updatedState = state.slice();
  updatedState.splice(noteStateIndex, 1, updatedNoteState);
  return updatedState;
}

export default notes;
