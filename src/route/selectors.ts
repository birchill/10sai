import { AppState } from '../reducer';
import { RouteState } from './reducer';

// XXX Derive the values here from Route's screen type
export const getScreen = (
  state: AppState
): '' | 'lookup' | 'review' | 'edit-card' | undefined => {
  return state.route.history.length
    ? state.route.history[state.route.index].screen
    : undefined;
};
