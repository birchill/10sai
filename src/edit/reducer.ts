import deepEqual from 'deep-equal';
import EditorState from './EditorState';
import { Card, Note } from '../model';
import * as actions from './actions';
import { StoreError } from '../store/DataStore';

// (Eventual) Editing state shape:
//
// {
//   forms: {
//     active: {
//       formId: card ID or a sequence number (for yet-to-be-saved cards),
//       editorState: EditorState,
//       card: { _id: ..., question: ..., ... },
//       dirtyFields: [ 'question', 'question' etc. ]
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
  notes: Array<EditNote>;
}

export const enum EditNoteState {
  Ok = 'ok',
  Dirty = 'dirty',
  Deleted = 'deleted',
}

export interface EditNote {
  note: Partial<Note>;
  noteState: EditNoteState;
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

export function edit(
  state = initialState,
  action: actions.EditAction
): EditState {
  switch (action.type) {
    case 'NEW_CARD': {
      return {
        forms: {
          active: {
            formId: action.id,
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
            formId: action.id,
            editorState: EditorState.Loading,
            card: {},
            notes: [],
          },
        },
      };
    }

    case 'FINISH_LOAD_CARD': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      return {
        forms: {
          active: {
            formId: action.card._id,
            editorState: EditorState.Ok,
            card: action.card,
            notes: [],
          },
        },
      };
    }

    case 'FAIL_LOAD_CARD': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      const deleted = Boolean(
        action.error &&
          typeof action.error === 'object' &&
          action.error.reason === 'deleted'
      );
      return {
        forms: {
          active: {
            formId: action.formId,
            editorState: EditorState.NotFound,
            card: {},
            deleted,
            notes: [],
          },
        },
      };
    }

    case 'EDIT_CARD': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      if (process.env.NODE_ENV === 'development') {
        console.assert(
          !Object.keys(action.card).includes('progress') &&
            !Object.keys(action.card).includes('reviewed'),
          'Should not be passing review fields as part of editing a card'
        );
      }

      const dirtyFields = state.forms.active.dirtyFields || [];
      dirtyFields.push(
        ...(Object.keys(action.card) as Array<keyof Card>).filter(
          field =>
            field !== '_id' &&
            field !== 'modified' &&
            !deepEqual(action.card[field], state.forms.active.card[field]) &&
            // This use of indexOf is not awesome but generally dirtyFields will
            // be 0 ~ 1 items so it's probably ok.
            dirtyFields.indexOf(field) === -1
        )
      );

      return {
        forms: {
          active: {
            formId: action.formId,
            editorState: EditorState.Dirty,
            card: { ...state.forms.active.card, ...action.card },
            dirtyFields,
            notes: state.forms.active.notes,
          },
        },
      };
    }

    case 'FINISH_SAVE_CARD': {
      if (
        action.formId !== state.forms.active.formId ||
        state.forms.active.deleted
      ) {
        return state;
      }

      const dirtyFields = (Object.keys(action.card) as Array<
        keyof Card
      >).filter(
        field =>
          field !== '_id' &&
          field !== 'modified' &&
          !deepEqual(action.card[field], state.forms.active.card[field])
      );
      const editorState = dirtyFields.length
        ? EditorState.Dirty
        : EditorState.Ok;

      const result: EditState = {
        forms: {
          active: {
            formId: action.card._id!,
            editorState,
            card: { ...action.card, ...state.forms.active.card },
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
        action.formId !== state.forms.active.formId ||
        state.forms.active.deleted
      ) {
        return state;
      }

      return { forms: state.forms, saveError: action.error };
    }

    case 'SYNC_EDIT_CARD': {
      if (action.change._id !== state.forms.active.card._id) {
        return state;
      }

      if (action.change._deleted) {
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
      // The type of action.change includes the properties of Card as well as
      // ChangesMeta (e.g. _deleted, _attachments, _conflicts). We don't expect
      // those other things to be present here, but just to make TS happy...
      const isCardField = (field: string): field is keyof Card =>
        !field.startsWith('_') || field === '_id';
      for (const field of Object.keys(action.change)) {
        if (isCardField(field)) {
          card[field] =
            state.forms.active.dirtyFields &&
            state.forms.active.dirtyFields.includes(field)
              ? state.forms.active.card[field]
              : action.change[field];
        }
      }

      return {
        forms: {
          active: { ...state.forms.active, card },
        },
      };
    }

    case 'DELETE_EDIT_CARD': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      if (!state.forms.active.card._id) {
        return {
          forms: {
            active: {
              formId: action.formId,
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
            formId: action.formId,
            editorState: EditorState.NotFound,
            card: {},
            deleted: true,
            notes: [],
          },
        },
      };
    }

    case 'ADD_EDIT_NOTE': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      const newNote: Partial<Note> = {};
      if (action.initialKeywords) {
        newNote.keywords = action.initialKeywords.slice();
      }

      return {
        forms: {
          active: {
            ...state.forms.active,
            notes: [
              ...state.forms.active.notes,
              {
                note: newNote,
                noteState: EditNoteState.Ok,
              },
            ],
          },
        },
      };
    }

    default:
      return state;
  }
}

export default edit;
