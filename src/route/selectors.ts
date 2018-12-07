import { RouteState } from './reducer';

// XXX Move this to root reducer once it gets converted to TS.
interface State {
  route: RouteState;
}

// XXX Derive the values here from Route's screen type
export const getScreen = (
  state: State
): '' | 'lookup' | 'review' | 'edit-card' | undefined => {
  return state.route.history.length
    ? state.route.history[state.route.index].screen
    : undefined;
};
