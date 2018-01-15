export const getScreen = state => {
  return state.route && state.route.history && state.route.history.length
    ? state.route.history[state.route.index].screen
    : undefined;
};

export default getScreen;
