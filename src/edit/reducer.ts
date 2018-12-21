import deepEqual from 'deep-equal';
import { Action } from 'redux';

import { FormState } from './FormState';
import { Card } from '../model';
import { notes as notesReducer, NoteState } from '../notes/reducer';
import * as actions from './actions';
import { StoreError } from '../store/DataStore';
import { isNoteAction, NoteAction, EditNoteContext } from '../notes/actions';

export interface EditFormState {
  formId: number;
  formState: FormState;
  isNew: boolean;
  card: Partial<Card>;
  dirtyFields?: Set<keyof Card>;
  notes: Array<NoteState>;
  saveError?: StoreError;
}

export interface EditState {
  forms: {
    active: EditFormState;
  };
}

const initialState: EditState = {
  forms: {
    active: {
      formId: 0,
      formState: FormState.Ok,
      isNew: true,
      card: {},
      notes: [],
    },
  },
};

export function edit(state = initialState, action: Action): EditState {
  const editAction = action as actions.EditAction;

  switch (editAction.type) {
    case 'NEW_CARD': {
      // If the last card was a new card, then we're adding cards in bulk and we
      // should persist the tags field since generally you add a bunch of cards
      // with similar tags at the same time.
      const card: Partial<Card> = {};
      if (
        state.forms.active.isNew &&
        typeof state.forms.active.card.tags !== 'undefined'
      ) {
        card.tags = state.forms.active.card.tags;
      }

      return {
        forms: {
          active: {
            formId: editAction.newFormId,
            formState: FormState.Ok,
            isNew: true,
            card,
            notes: [],
          },
        },
      };
    }

    case 'LOAD_CARD': {
      return {
        forms: {
          active: {
            formId: editAction.newFormId,
            formState: FormState.Loading,
            isNew: false,
            card: {},
            notes: [],
          },
        },
      };
    }

    case 'FINISH_LOAD_CARD': {
      if (editAction.formId !== state.forms.active.formId) {
        return state;
      }

      return {
        forms: {
          active: {
            formId: editAction.formId,
            formState: FormState.Ok,
            isNew: false,
            card: editAction.card,
            notes: [],
          },
        },
      };
    }

    case 'FAIL_LOAD_CARD': {
      if (editAction.formId !== state.forms.active.formId) {
        return state;
      }

      const deleted = Boolean(
        editAction.error &&
          typeof editAction.error === 'object' &&
          editAction.error.reason === 'deleted'
      );
      return {
        forms: {
          active: {
            formId: editAction.formId,
            formState: deleted ? FormState.Deleted : FormState.NotFound,
            isNew: false,
            card: {},
            notes: [],
          },
        },
      };
    }

    case 'EDIT_CARD': {
      if (
        editAction.formId !== state.forms.active.formId ||
        state.forms.active.formState === FormState.Deleted
      ) {
        return state;
      }

      if (process.env.NODE_ENV === 'development') {
        console.assert(
          !Object.keys(editAction.card).includes('progress') &&
            !Object.keys(editAction.card).includes('reviewed'),
          'Should not be passing review fields as part of editing a card'
        );
      }

      const editState = state.forms.active;

      // Update the dirty fields
      const dirtyFields: Set<keyof Card> = editState.dirtyFields
        ? new Set(editState.dirtyFields.values())
        : new Set();
      for (const [field, value] of Object.entries(editAction.card) as Array<
        [keyof Card, any]
      >) {
        if (
          field !== 'id' &&
          field !== 'modified' &&
          !deepEqual(value, editState.card[field])
        ) {
          dirtyFields.add(field);
        }
      }

      return {
        forms: {
          active: {
            formId: editAction.formId,
            formState: FormState.Ok,
            isNew: editState.isNew,
            card: { ...state.forms.active.card, ...editAction.card },
            dirtyFields,
            notes: state.forms.active.notes,
          },
        },
      };
    }

    case 'SAVE_CARD': {
      if (
        editAction.formId !== state.forms.active.formId ||
        state.forms.active.formState === FormState.Deleted
      ) {
        return state;
      }

      if (typeof state.forms.active.saveError === 'undefined') {
        return state;
      }

      const updatedState = { ...state };
      delete updatedState.forms.active.saveError;
      return updatedState;
    }

    case 'FINISH_SAVE_CARD': {
      if (
        editAction.formId !== state.forms.active.formId ||
        state.forms.active.formState === FormState.Deleted
      ) {
        return state;
      }

      const dirtyFields: Set<keyof Card> = new Set(
        (Object.keys(editAction.card) as Array<keyof Card>).filter(
          field =>
            field !== 'id' &&
            field !== 'modified' &&
            !deepEqual(editAction.card[field], state.forms.active.card[field])
        )
      );

      const result: EditState = {
        forms: {
          active: {
            formId: editAction.formId,
            formState: FormState.Ok,
            isNew: state.forms.active.isNew,
            card: { ...editAction.card, ...state.forms.active.card },
            notes: state.forms.active.notes,
          },
        },
      };
      if (dirtyFields.size) {
        result.forms.active.dirtyFields = dirtyFields;
      }

      return result;
    }

    case 'FAIL_SAVE_CARD': {
      if (
        editAction.formId !== state.forms.active.formId ||
        state.forms.active.formState === FormState.Deleted
      ) {
        return state;
      }

      return {
        forms: {
          active: {
            ...state.forms.active,
            saveError: editAction.error,
          },
        },
      };
    }

    case 'SYNC_EDIT_CARD': {
      if (
        editAction.change.card.id !== state.forms.active.card.id ||
        state.forms.active.formState === FormState.Deleted
      ) {
        return state;
      }

      if (editAction.change.deleted) {
        return {
          forms: {
            active: {
              formId: state.forms.active.formId,
              formState: FormState.Deleted,
              isNew: false,
              card: {},
              notes: [],
            },
          },
        };
      }

      // Rebuild the card choosing the fields from the action except for fields
      // that are currently marked as dirty--for those we choose the value in
      // the state.
      const card: Partial<Card> = {};
      for (const field of Object.keys(editAction.change.card) as Array<
        keyof Card
      >) {
        card[field] =
          state.forms.active.dirtyFields &&
          state.forms.active.dirtyFields.has(field)
            ? state.forms.active.card[field]
            : editAction.change.card[field];
      }

      return {
        forms: {
          active: { ...state.forms.active, card },
        },
      };
    }

    case 'DELETE_CARD': {
      if (editAction.formId !== state.forms.active.formId) {
        return state;
      }

      // If the card was not already saved, just clear the fields
      if (!state.forms.active.card.id) {
        return {
          forms: {
            active: {
              formId: editAction.formId,
              formState: FormState.Ok,
              isNew: true,
              card: {},
              notes: [],
            },
          },
        };
      }

      return {
        forms: {
          active: {
            formId: editAction.formId,
            formState: FormState.Deleted,
            isNew: false,
            card: {},
            notes: [],
          },
        },
      };
    }
  }

  const noteActionIsForEditContext = (action: NoteAction): boolean =>
    action.context.screen === 'edit-card' &&
    (action.context as EditNoteContext).cardFormId ===
      state.forms.active.formId;

  if (isNoteAction(action) && noteActionIsForEditContext(action)) {
    return {
      forms: {
        active: {
          ...state.forms.active,
          notes: notesReducer(state.forms.active.notes, action),
        },
      },
    };
  }

  return state;
}
