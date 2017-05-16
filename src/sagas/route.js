import { takeEvery, call, put, select } from 'redux-saga/effects';
import { routeFromURL, routesEqual } from '../router';

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
      history.back();
      return;
    }
  }

  // Otherwise use pushState / replaceState() and dispatch the relevant action.
  if (action.direction === 'replace' &&
      typeof routeState.index === 'number' &&
      routeState.index >= 0) {
    yield call([ history, 'replaceState' ], { index: routeState.index }, '',
               action.url);
    yield put({ type: 'NAVIGATE', replace: true, url: action.url });
  } else {
    const index = typeof routeState.index === 'number'
                  ? routeState.index + 1
                  : 0;
    yield call([ history, 'pushState' ], { index }, '', action.url);
    yield put({ type: 'NAVIGATE', url: action.url });
  }
}

function* routeSagas() {
  yield* [ takeEvery('FOLLOW_LINK', followLink) ];
}

export default routeSagas;
