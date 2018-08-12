import { EditState } from '../edit/reducer';
import { ReviewState } from '../review/reducer';
import { NoteState } from '../notes/reducer';
import { NoteContext, NoteListContext } from './actions';

// XXX Move this to root reducer once it gets converted to TS.
interface State {
  edit: EditState;
  review: ReviewState;
}

export const getNoteListSelector = (context: NoteListContext) => {
  return (state: State): Array<NoteState> => {
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
  return (state: State): NoteState | undefined => {
    const notes = getNoteListSelector(context)(state);
    return notes.find(
      (noteState: NoteState) => noteState.formId === context.noteFormId
    );
  };
};

export const isDirty = (noteState: NoteState): boolean =>
  typeof noteState.dirtyFields !== 'undefined' &&
  noteState.dirtyFields.size > 0;
