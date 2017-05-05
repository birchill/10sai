import pathToRegexp from 'path-to-regexp';

//
// Routes to different screens
//
let screenKeys;
const screenRe = pathToRegexp('/:screen', screenKeys);

//
// "Screens" that actually represent popups
//
const popups = [ 'settings' ];

export default function route(state = { }, action) {
  switch (action.type) {
    case 'NAVIGATE': {
      const screenMatches = screenRe.exec(action.url);
      if (screenMatches) {
        if (popups.includes(screenMatches[1])) {
          return { ...state, popup: screenMatches[1] };
        }
        return { ...state, screen: screenMatches[1], popup: undefined };
      }
      return { ...state, screen: '', popup: undefined };
    }

    default:
      return state;
  }
}
