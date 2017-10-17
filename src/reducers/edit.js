import deepEqual from 'deep-equal';
import EditState from '../edit-states';

// Editing state shape:
//
// {
//   forms: {
//     active: {
//       formId: card ID or a sequence number (for yet-to-be-saved cards),
//       editState: EditState,
//       card: { _id: ..., question: ..., ... },
//       dirtyFields: [ 'question', 'question' etc. ]
//     }
//     [ next: { " " } ]
//     [ prev: { " " } ]
//   }
//   [ saveError ]
// }

const initialState = {
  forms: {
    active: {
      formId: 0,
      editState: EditState.EMPTY,
      card: {},
    },
  },
};

export default function edit(state = initialState, action) {
  switch (action.type) {
    case 'NEW_CARD': {
      return {
        forms: {
          active: { formId: action.id, editState: EditState.EMPTY, card: {} }
        }
      };
    }

    case 'LOAD_CARD': {
      return {
        forms: {
          active: { formId: action.id, editState: EditState.LOADING, card: {} }
        }
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
            editState: EditState.OK,
            card: action.card,
          }
        }
      };
    }

    case 'FAIL_LOAD_CARD': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      const deleted = Boolean(action.error &&
                              action.error.reason &&
                              action.error.reason === 'deleted');
      return {
        forms: {
          active: {
            formId: action.formId,
            editState: EditState.NOT_FOUND,
            card: {},
            deleted,
          }
        }
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
      dirtyFields.push(...Object.keys(action.card).filter(field =>
        field !== '_id' &&
        !deepEqual(action.card[field], state.forms.active.card[field]) &&
        // This use of indexOf is not awesome but generally dirtyFields will be
        // 0 ~ 1 items so it's probably ok.
        dirtyFields.indexOf(field) === -1
      ));

      return {
        forms: {
          active: {
            formId: action.formId,
            editState: EditState.DIRTY,
            card: { ...state.forms.active.card, ...action.card },
            dirtyFields
          }
        }
      };
    }

    case 'FINISH_SAVE_CARD': {
      if (action.formId !== state.forms.active.formId ||
          state.forms.active.deleted) {
        return state;
      }

      const dirtyFields = Object.keys(action.card).filter(field =>
        field !== '_id' &&
        !deepEqual(action.card[field], state.forms.active.card[field])
      );
      const editState = dirtyFields.length
                        ? EditState.DIRTY
                        : EditState.OK;

      const result = {
        forms: {
          active: {
            formId: action.card._id,
            editState,
            card: { ...action.card, ...state.forms.active.card },
          }
        }
      };
      if (dirtyFields.length) {
        result.forms.active.dirtyFields = dirtyFields;
      }

      return result;
    }

    case 'FAIL_SAVE_CARD': {
      if (action.formId !== state.forms.active.formId ||
          state.forms.active.deleted) {
        return state;
      }

      return { forms: state.forms, saveError: action.error };
    }

    case 'SYNC_CARD': {
      if (action.card._id !== state.forms.active.card._id) {
        return state;
      }

      if (action.card._deleted) {
        return {
          forms: {
            active: {
              formId: state.forms.active.formId,
              editState: EditState.NOT_FOUND,
              card: {},
              deleted: true,
            }
          }
        };
      }

      const card = {};
      for (const field in action.card) {
        if (action.card.hasOwnProperty(field)) {
          card[field] = state.forms.active.dirtyFields &&
                        state.forms.active.dirtyFields.includes(field)
                        ? state.forms.active.card[field]
                        : action.card[field];
        }
      }

      return {
        forms: {
          active: { ...state.forms.active, card }
        }
      };
    }

    case 'DELETE_EDIT_CARD': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      if (!state.forms.active.card._id) {
        return {
          forms: {
            active: { formId: action.formId,
                      editState: EditState.EMPTY,
                      card: {} }
          }
        };
      }

      return {
        forms: {
          active: {
            formId: action.formId,
            editState: EditState.NOT_FOUND,
            card: {},
            deleted: true,
          }
        }
      };
    }

    default:
      return state;
  }
}
