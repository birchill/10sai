import EditState from '../edit-states';

// Editing state shape:
//
// {
//   forms: {
//     active: {
//       editState: EditState
//       card
//     }
//     [ next: { " " } ]
//     [ prev: { " " } ]
//   }
//   [ saveError ]
// }

const initialState = {
  forms: {
    active: {
      editState: EditState.EMPTY,
      card: {}
    },
  },
};

export default function edit(state = initialState, action) {
  switch (action.type) {
    case 'LOAD_CARD': {
      return {
        forms: {
          active: { editState: EditState.LOADING, card: {} }
        }
      };
    }

    case 'FINISH_LOAD_CARD': {
      return {
        forms: {
          active: { editState: EditState.OK, card: action.card }
        }
      };
    }

    case 'FAIL_LOAD_CARD': {
      return {
        forms: {
          active: { editState: EditState.NOT_FOUND, card: {} }
        }
      };
    }

    case 'UPDATE_EDIT_CARD': {
      return {
        forms: {
          active: { ...state.forms.active, card: action.card }
        }
      };
    }

    /*
    case 'SAVE_CARD': {
      return { state: EditState.SAVING };
    }
    case 'FINISH_SAVE_CARD': {
      return { state: EditState.OK };
    }
    case 'FAIL_SAVE_CARD': {
      return { state: EditState.OK, error: action.error };
    }
    */

    default:
      return state;
  }
}
