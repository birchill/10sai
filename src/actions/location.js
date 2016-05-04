export default function routeLocationDidUpdate(state) {
  return {
    type: 'CHANGE_SCREEN',
    screen: state.params.screen,
  };
}
