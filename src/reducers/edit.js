import EditState from '../edit-states';

// shape:
// {
//   state: EditState
//   [error]
//   (card too in future)
// }

export default function edit(state = { state: EditState.OK }, action) {
  switch (action.type) {
    case 'SAVE_CARD': {
      return { state: EditState.SAVING };
    }
    case 'COMPLETE_SAVE_CARD': {
      return { state: EditState.OK };
    }
    case 'FAIL_SAVE_CARD': {
      return { state: EditState.OK, error: action.error };
    }

    default:
      return state;
  }
}
