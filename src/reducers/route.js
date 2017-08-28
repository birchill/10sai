import { routeFromPath, routeFromURL } from '../router';

export default function route(state = { }, action) {
  switch (action.type) {
    case 'UPDATE_URL':
      action.replace = 'replace';
      // fall through

    case 'NAVIGATE': {
      const route = action.url
                    ? routeFromURL(action.url)
                    : routeFromPath(action.path, action.search,
                                    action.fragment);
      const history = state.history ? state.history.slice() : [];

      // If we are navigating from history but don't have an index, we should
      // ignore the action as otherwise we are only going to get out of sync
      // with the browser's history.
      const fromHistory = action.source && action.source === 'history';
      if (fromHistory && typeof action.index !== 'number') {
        return state;
      }

      let index = [ action, state ].reduce((result, obj) => {
        return result === -1 && typeof obj.index === 'number'
               ? obj.index
               : result;
      }, -1);

      // For the most part, navigating from history replaces.
      if (fromHistory) {
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
