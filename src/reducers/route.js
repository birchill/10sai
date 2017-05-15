import { routeFromPath, routeFromURL } from '../router';

export default function route(state = { }, action) {
  switch (action.type) {
    case 'NAVIGATE': {
      const route = action.url
                    ? routeFromURL(action.url)
                    : routeFromPath(action.path, action.search,
                                    action.fragment);
      const history = state.history ? state.history.slice() : [];

      let index = typeof state.index === 'number' ? state.index : -1;
      if (action.replace && index >= 0 && index < history.length) {
        history[index] = route;
      } else {
        if (index < history.length - 1) {
          history.splice(index + 1);
        }
        history.push(route);
        index++;
      }

      return { index, history };
    }

    case 'NAVIGATE_FROM_HISTORY': {
      const route = routeFromPath(action.path, action.search, action.fragment);
      const history = state.history ? state.history.slice() : [];
      const hasRoute = typeof action.path !== 'undefined';

      // Ignore actions without an index
      if (typeof action.index !== 'number') {
        return state;
      }

      let index = Math.max(action.index,  0);

      if (index < history.length && hasRoute) {
        history[index] = route;
      } else if (index >= history.length) {
        if (hasRoute) {
          history.push(route);
        }
        index = history.length - 1;
      }

      return { index, history };
    }

    default:
      return state;
  }
}
