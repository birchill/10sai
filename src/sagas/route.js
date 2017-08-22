import { takeEvery, call, put, select } from 'redux-saga/effects';
import { URLFromRoute, routeFromURL, routesEqual } from '../router';
import * as routeActions from '../actions/route';

// Selectors

const getRoute = state => (state ? state.route || {} : {});

// Sagas

export function* followLink(action) {
  const routeState = yield select(getRoute);
  let navigateRoute;

  // First, regardless of direction, if the route matches the current route
  // ignore the navigation altogether.
  if (typeof routeState.index === 'number' &&
      Array.isArray(routeState.history) &&
      routeState.index >= 0 &&
      routeState.index < routeState.history.length) {
    const currentRoute = routeState.history[routeState.index];
    navigateRoute = routeFromURL(action.url || '/');
    if (routesEqual(currentRoute, navigateRoute)) {
      return;
    }
  }

  // If the direction is backwards, check if the previous item in the history
  // matches the item we're trying to navigate. If it does, just call
  // history.back() and let the popstatechange handler take care of updating
  // state.
  if (action.direction === 'backwards' &&
      typeof routeState.index === 'number' &&
      Array.isArray(routeState.history) &&
      routeState.index >= 1 &&
      routeState.index < routeState.history.length) {
    const previousRoute = routeState.history[routeState.index - 1];
    navigateRoute = navigateRoute || routeFromURL(action.url || '/');
    if (routesEqual(previousRoute, navigateRoute)) {
      yield call([ history, 'back' ]);
      return;
    }
  }

  // Otherwise use pushState / replaceState() and dispatch the relevant action.
  if (action.direction === 'replace' &&
      typeof routeState.index === 'number' &&
      routeState.index >= 0) {
    yield call([ history, 'replaceState' ], { index: routeState.index }, '',
               action.url);
    yield put(routeActions.navigate(action.url, 'replace'));
  } else {
    const index = typeof routeState.index === 'number'
                  ? routeState.index + 1
                  : 0;
    yield call([ history, 'pushState' ], { index }, '', action.url);
    yield put(routeActions.navigate(action.url));
  }
}

// A special-case action to take the current URL, replace it with some other
// URL, then push the previous current URL on. Used when adding cards so that we
// can go from, e.g.:
//
//   0: /
//   1: /cards/new
//
// to:
//
//   0: /
//   1: /cards/123
//   2: /cards/new
//
// That way if the user enters a new card and then presses back, they navigate
// back to the edit screen of the card they just created.
export function* insertHistory(action) {
  const routeState = yield select(getRoute);

  if (typeof routeState.index === 'number' &&
      routeState.index >= 0) {
    const previousRoute = routeState.history[routeState.index];
    yield call([ history, 'replaceState' ],
               { index: routeState.index },
               '',
               action.url);
    yield call([ history, 'pushState' ],
               { index: routeState.index + 1 },
               '',
               URLFromRoute(previousRoute));
  }
}

export function* silentlyUpdateUrl(action) {
  // Get current route so we can compare it
  const routeState = yield select(getRoute);
  if (typeof routeState.index !== 'number' ||
      routeState.index >= routeState.history.length) {
    return;
  }
  const currentRoute = routeState.history[routeState.index];

  // Only update the URL if the reducer already did so
  if (URLFromRoute(currentRoute) === action.url) {
    yield call([ history, 'replaceState' ],
               { index: routeState.index },
               '',
               action.url);
  }
}

function* routeSagas() {
  /* eslint-disable indent */
  yield* [ takeEvery('FOLLOW_LINK', followLink),
           takeEvery('INSERT_HISTORY', insertHistory),
           takeEvery('SILENTLY_UPDATE_URL', silentlyUpdateUrl) ];
  /* eslint-enable indent */
}

export default routeSagas;
