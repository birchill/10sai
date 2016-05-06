export default function nav(state = { }, action) {
  switch (action.type) {
    case 'CHANGE_LOCATION':
      if (action.screen === 'settings') {
        return { ...state, popup: 'settings' };
      }
      return { ...state, screen: action.screen, popup: undefined };

    default:
      return state;
  }
}
