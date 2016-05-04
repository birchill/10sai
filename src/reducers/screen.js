export default function screen(state = null, action) {
  switch (action.type) {
    case 'CHANGE_SCREEN':
      return action.screen || null;
    default:
      return state;
  }
}
