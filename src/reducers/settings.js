const initialState = { syncServer: '' };

export default function sync(state = initialState, action) {
  switch (action.type) {
    case 'UPDATE_SETTINGS':
      return { ...state, ...action.settings };

    case 'UPDATE_SETTING':
      return { ...state, [action.key]: action.value };

    default:
      return state;
  }
}
