import { EditState, EditFormState } from './reducer';

// XXX Move this to root reducer once it gets converted to TS.
interface State {
  edit: EditState;
}

export const getActiveRecord = (state: State): EditFormState =>
  state.edit.forms.active;

export const isDirty = (state: State): boolean => {
  const activeRecord = getActiveRecord(state);
  return (
    typeof activeRecord.dirtyFields !== 'undefined' &&
    activeRecord.dirtyFields.length > 0
  );
};
