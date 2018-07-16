import { EditState, EditFormState } from './reducer';
import { Card } from '../model';

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
    activeRecord.dirtyFields.size > 0
  );
};

// Returns true if the form has data that might be worth saving.
//
// This is used to:
//
// - Determine if we should trigger a SAVE_CARD when changing screens,
//   auto-saving, etc.
// - Decide if it makes sense to enable the "Delete" button (it doesn't if the
//   card doesn't have any useful data and isn't already saved)
// - Decide if we should automatically focus the question field (we should if
//   it's a new card, but not if it's an existing one since we don't know where
//   the user will want to edit).
export const hasDataToSave = (card: Partial<Card>): boolean => {
  const cardHasNonEmptyField = (field: keyof Card): boolean =>
    typeof card[field] === 'string' && (card[field] as string).length !== 0;
  return (
    typeof card._id !== 'undefined' ||
    cardHasNonEmptyField('question') ||
    cardHasNonEmptyField('answer')
  );
};
