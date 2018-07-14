import { EditState } from '../edit/reducer';
import { NoteState } from '../notes/reducer';
import { NoteContext } from './actions';

// XXX Move this to root reducer once it gets converted to TS.
interface State {
  edit: EditState;
}

export const getNoteStateSelector = (context: NoteContext) => {
  return (state: State): NoteState | undefined => {
    // TODO: Once we have notes in the review screen this needs to be
    // something like:
    //
    //   const notes = action.screen === 'edit-card'
    //     ? state.edit.forms.active.notes
    //     : ....
    //
    const notes = state.edit.forms.active.notes;
    console.log(JSON.stringify(notes));
    console.log(`Searching for ${context.noteFormId}`);
    return notes.find(
      (noteState: NoteState) => noteState.formId === context.noteFormId
    );
  };
};

export const isDirty = (noteState: NoteState): boolean =>
  typeof noteState.dirtyFields !== 'undefined' &&
  noteState.dirtyFields.size > 0;
