import { EditState } from '../edit/reducer';
import { NoteState } from '../notes/reducer';
import { NoteContext, NoteListContext } from './actions';

// XXX Move this to root reducer once it gets converted to TS.
interface State {
  edit: EditState;
}

export const getNoteListSelector = (context: NoteListContext) => {
  return (state: State): Array<NoteState> => {
    console.assert(
      context.screen === 'edit-card',
      "We don't support notes in the review screen yet"
    );
    return state.edit.forms.active.notes;
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
