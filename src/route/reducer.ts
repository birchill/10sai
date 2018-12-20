import { Route, routeFromPath, routeFromURL } from './router';
import { Action } from '../actions';

import * as routeActions from './actions';

export interface RouteState {
  history: Array<Route>;
  index: number;
}

const initialState: RouteState = {
  history: [],
  index: -1,
};

export function route(state = initialState, action: Action): RouteState {
  switch (action.type) {
    case 'UPDATE_URL':
      const navigateAction: routeActions.NavigateAction = {
        ...action,
        type: 'NAVIGATE',
        replace: true,
      };
      return route(state, navigateAction);

    case 'NAVIGATE': {
      const route = action.url
        ? routeFromURL(action.url)
        : routeFromPath(action.path, action.search, action.fragment);
      const history = state.history.slice();

      let index = state.index;
      if (action.source) {
        index = action.source.index;
      }

      // For the most part, navigating from history replaces.
      if (action.source && action.source.type === 'history') {
        action.replace = true;
      }

      if (action.replace && index >= 0 && index < history.length) {
        history[index] = route;
      } else {
        if (index < history.length - 1) {
          history.splice(index + 1);
        }
        history.push(route);
        index = history.length - 1;
      }

      return { index, history };
    }

    default:
      return state;
  }
}
