import deepEqual from 'deep-equal';
import { Action } from 'redux';

import { FormState } from './FormState';
import { Card } from '../model';
import { notes as notesReducer, NoteState } from '../notes/reducer';
import * as actions from './actions';
import { StoreError } from '../store/DataStore';
import { isNoteAction, NoteAction, EditNoteContext } from '../notes/actions';
import { copyField } from '../utils/type-helpers';

export const enum SaveState {
  New = 'new',
  Ok = 'ok',
  InProgress = 'in-progress',
  Error = 'error',
}

export interface EditFormState {
  formId: number;
  formState: FormState;
  card: Partial<Card>;
  dirtyFields?: Set<keyof Card>;
  notes: Array<NoteState>;
  saveState: SaveState;
  saveError?: StoreError;
}

export interface EditState {
  forms: {
    active: EditFormState;
  };
  newCardTags: string[];
}

const initialState: EditState = {
  forms: {
    active: {
      formId: 0,
      formState: FormState.Ok,
      card: {},
      notes: [],
      saveState: SaveState.New,
    },
  },
  newCardTags: [],
};

export function edit(state = initialState, action: Action): EditState {
  const editAction = action as actions.EditAction;

  switch (editAction.type) {
    case 'NEW_CARD': {
      let card: Partial<Card> = {};
      if (state.newCardTags.length) {
        card.tags = state.newCardTags;
      }

      let dirtyFields: undefined | Set<keyof Card>;

      if (editAction.card) {
        card = { ...card, ...editAction.card };

        // This isn't great. A malicious site could potentially just start
        // opening windows with the appropriate URL and query string and thereby
        // add junk to the user's set of cards. NOT setting this to dirty,
        // however, will mean that if the user clicks "Done" nothing will be
        // saved.
        //
        // Perhaps in future we could add a referer check of some sort for this?
        dirtyFields = new Set<keyof Card>(Object.keys(editAction.card) as Array<
          keyof Card
        >);
      }

      return {
        ...state,
        forms: {
          active: {
            formId: editAction.newFormId,
            formState: FormState.Ok,
            card,
            dirtyFields,
            notes: [],
            saveState: SaveState.New,
          },
        },
      };
    }

    case 'LOAD_CARD': {
      return {
        ...state,
        forms: {
          active: {
            formId: editAction.newFormId,
            formState: FormState.Loading,
            card: {},
            notes: [],
            saveState: SaveState.Ok,
          },
        },
      };
    }

    case 'FINISH_LOAD_CARD': {
      if (editAction.formId !== state.forms.active.formId) {
        return state;
      }

      return {
        ...state,
        forms: {
          active: {
            formId: editAction.formId,
            formState: FormState.Ok,
            card: editAction.card,
            notes: [],
            saveState: SaveState.Ok,
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
        ...state,
        forms: {
          active: {
            formId: editAction.formId,
            formState: deleted ? FormState.Deleted : FormState.NotFound,
            card: {},
            notes: [],
            saveState: SaveState.Ok,
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

      let newCardTags = state.newCardTags;
      if (
        dirtyFields.has('tags') &&
        typeof editAction.card.tags !== 'undefined'
      ) {
        newCardTags = editAction.card.tags || [];
      }

      return {
        ...state,
        forms: {
          active: {
            formId: editAction.formId,
            formState: FormState.Ok,
            card: { ...state.forms.active.card, ...editAction.card },
            dirtyFields,
            notes: state.forms.active.notes,
            saveState: editState.saveState,
          },
        },
        newCardTags,
      };
    }

    case 'SAVE_CARD': {
      if (
        editAction.formId !== state.forms.active.formId ||
        state.forms.active.formState === FormState.Deleted
      ) {
        return state;
      }

      const updatedState = {
        ...state,
        forms: {
          ...state.forms,
          active: {
            ...state.forms.active,
            saveState: SaveState.InProgress,
          },
        },
      };
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
        ...state,
        forms: {
          active: {
            formId: editAction.formId,
            formState: FormState.Ok,
            card: { ...editAction.card, ...state.forms.active.card },
            notes: state.forms.active.notes,
            saveState: SaveState.Ok,
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
        ...state,
        forms: {
          active: {
            ...state.forms.active,
            saveState: SaveState.Error,
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
          ...state,
          forms: {
            active: {
              formId: state.forms.active.formId,
              formState: FormState.Deleted,
              card: {},
              notes: [],
              saveState: state.forms.active.saveState,
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
        if (
          state.forms.active.dirtyFields &&
          state.forms.active.dirtyFields.has(field)
        ) {
          copyField(card, state.forms.active.card, field);
        } else {
          copyField(card, editAction.change.card, field);
        }
      }

      return {
        ...state,
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
          ...state,
          forms: {
            active: {
              formId: editAction.formId,
              formState: FormState.Ok,
              card: {},
              notes: [],
              saveState: SaveState.New,
            },
          },
        };
      }

      return {
        ...state,
        forms: {
          active: {
            formId: editAction.formId,
            formState: FormState.Deleted,
            card: {},
            notes: [],
            saveState: state.forms.active.saveState,
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
      ...state,
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
