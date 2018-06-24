import deepEqual from 'deep-equal';
import EditorState from './EditorState';
import { Card } from '../model';
import { NoteState } from '../notes/reducer';
import * as actions from './actions';
import { StoreError } from '../store/DataStore';
import { isNoteAction, NoteAction, EditNoteContext } from '../notes/actions';
import { notes as notesReducer } from '../notes/reducer';
import { Action } from 'redux';

// (Eventual) Editing state shape:
//
// {
//   forms: {
//     active: {
//       formId: card ID or a sequence number (for yet-to-be-saved cards),
//       editorState: EditorState,
//       card: { _id: ..., question: ..., ... },
//       dirtyFields: [ 'question', 'question' etc. ]
//       notes: [ ...  ]
//     }
//     [ next: { " " } ]
//     [ prev: { " " } ]
//   }
//   [ saveError ]
// }

export type FormId = string | number;

export interface EditFormState {
  formId: string | number;
  editorState: EditorState;
  card: Partial<Card>;
  dirtyFields?: Array<keyof Card>;
  deleted?: boolean;
  notes: Array<NoteState>;
}

export interface EditState {
  forms: {
    active: EditFormState;
  };
  saveError?: StoreError;
}

const initialState: EditState = {
  forms: {
    active: {
      formId: 0,
      editorState: EditorState.Empty,
      card: {},
      notes: [],
    },
  },
};

export function edit(state = initialState, action: Action): EditState {
  const editAction = action as actions.EditAction;

  switch (editAction.type) {
    case 'NEW_CARD': {
      return {
        forms: {
          active: {
            formId: editAction.id,
            editorState: EditorState.Empty,
            card: {},
            notes: [],
          },
        },
      };
    }

    case 'LOAD_CARD': {
      return {
        forms: {
          active: {
            formId: editAction.id,
            editorState: EditorState.Loading,
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
            formId: editAction.card._id,
            editorState: EditorState.Ok,
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
            editorState: EditorState.NotFound,
            card: {},
            deleted,
            notes: [],
          },
        },
      };
    }

    case 'EDIT_CARD': {
      if (editAction.formId !== state.forms.active.formId) {
        return state;
      }

      if (process.env.NODE_ENV === 'development') {
        console.assert(
          !Object.keys(editAction.card).includes('progress') &&
            !Object.keys(editAction.card).includes('reviewed'),
          'Should not be passing review fields as part of editing a card'
        );
      }

      const dirtyFields = state.forms.active.dirtyFields || [];
      dirtyFields.push(
        ...(Object.keys(editAction.card) as Array<keyof Card>).filter(
          field =>
            field !== '_id' &&
            field !== 'modified' &&
            !deepEqual(
              editAction.card[field],
              state.forms.active.card[field]
            ) &&
            // This use of indexOf is not awesome but generally dirtyFields will
            // be 0 ~ 1 items so it's probably ok.
            dirtyFields.indexOf(field) === -1
        )
      );

      return {
        forms: {
          active: {
            formId: editAction.formId,
            editorState: EditorState.Dirty,
            card: { ...state.forms.active.card, ...editAction.card },
            dirtyFields,
            notes: state.forms.active.notes,
          },
        },
      };
    }

    case 'FINISH_SAVE_CARD': {
      if (
        editAction.formId !== state.forms.active.formId ||
        state.forms.active.deleted
      ) {
        return state;
      }

      const dirtyFields = (Object.keys(editAction.card) as Array<
        keyof Card
      >).filter(
        field =>
          field !== '_id' &&
          field !== 'modified' &&
          !deepEqual(editAction.card[field], state.forms.active.card[field])
      );
      const editorState = dirtyFields.length
        ? EditorState.Dirty
        : EditorState.Ok;

      const result: EditState = {
        forms: {
          active: {
            formId: editAction.card._id!,
            editorState,
            card: { ...editAction.card, ...state.forms.active.card },
            notes: state.forms.active.notes,
          },
        },
      };
      if (dirtyFields.length) {
        result.forms.active.dirtyFields = dirtyFields;
      }

      return result;
    }

    case 'FAIL_SAVE_CARD': {
      if (
        editAction.formId !== state.forms.active.formId ||
        state.forms.active.deleted
      ) {
        return state;
      }

      return { forms: state.forms, saveError: editAction.error };
    }

    case 'SYNC_EDIT_CARD': {
      if (editAction.change._id !== state.forms.active.card._id) {
        return state;
      }

      if (editAction.change._deleted) {
        return {
          forms: {
            active: {
              formId: state.forms.active.formId,
              editorState: EditorState.NotFound,
              card: {},
              deleted: true,
              notes: [],
            },
          },
        };
      }

      // Rebuild the card choosing the fields from the action except for fields
      // that are currently marked as dirty--for those we choose the value in
      // the state.
      const card: Partial<Card> = {};
      // The type of editAction.change includes the properties of Card as well
      // as ChangesMeta (e.g. _deleted, _attachments, _conflicts). We don't
      // expect those other things to be present here, but just to make TS
      // happy...
      const isCardField = (field: string): field is keyof Card =>
        !field.startsWith('_') || field === '_id';
      for (const field of Object.keys(editAction.change)) {
        if (isCardField(field)) {
          card[field] =
            state.forms.active.dirtyFields &&
            state.forms.active.dirtyFields.includes(field)
              ? state.forms.active.card[field]
              : editAction.change[field];
        }
      }

      return {
        forms: {
          active: { ...state.forms.active, card },
        },
      };
    }

    case 'DELETE_EDIT_CARD': {
      if (editAction.formId !== state.forms.active.formId) {
        return state;
      }

      if (!state.forms.active.card._id) {
        return {
          forms: {
            active: {
              formId: editAction.formId,
              editorState: EditorState.Empty,
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
            editorState: EditorState.NotFound,
            card: {},
            deleted: true,
            notes: [],
          },
        },
      };
    }
  }

  const noteActionIsForEditContext = (action: NoteAction): boolean =>
    action.context.screen === 'edit' &&
    (action.context as EditNoteContext).formId === state.forms.active.formId;

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

export default edit;
