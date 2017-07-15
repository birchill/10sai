// edit {
//   state: 'saving' | 'ok' ('loading' in future)
//   [error]
//   (card too in future)
// }
export default function edit(state = { state: 'OK' }, action) {
  switch (action.type) {
    case 'SAVE_CARD': {
      return { state: 'SAVING' };
    }
    case 'FINISH_SAVE_CARD': {
      return { state: 'OK' };
    }
    case 'FAIL_SAVE_CARD': {
      return { state: 'OK', error: action.error };
    }

    default:
      return state;
  }
}
