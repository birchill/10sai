import { AppState } from '../reducer';
import { NoteState } from '../notes/reducer';
import { NoteContext, NoteListContext } from './actions';

export const getNoteListSelector = (context: NoteListContext) => {
  return (state: AppState): Array<NoteState> => {
    if (context.screen === 'edit-card') {
      return state.edit.forms.active.notes;
    }
    if (context.screen === 'review') {
      return state.review.notes;
    }
    console.error(`Unrecognized note list context ${JSON.stringify(context)}`);
    return [];
  };
};

export const getNoteStateSelector = (context: NoteContext) => {
  return (state: AppState): NoteState | undefined => {
    const notes = getNoteListSelector(context)(state);
    return notes.find(
      (noteState: NoteState) => noteState.formId === context.noteFormId
    );
  };
};

export const isDirty = (noteState: NoteState): boolean =>
  typeof noteState.dirtyFields !== 'undefined' &&
  noteState.dirtyFields.size > 0;
