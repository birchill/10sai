import { takeEvery, call, cancel, put, take, select } from 'redux-saga/effects';
import { routeFromURL, routesEqual } from '../router';
import * as routeActions from '../actions/route';
import * as editActions from '../actions/edit';
import EditState from '../edit-states';

// Selectors

const getRoute = state => (state ? state.route || {} : {});

// XXX Share this with sagas/edit.js
const getHistoryIndex = state => (
  state.route && typeof state.route.index === 'number' ? state.route.index : -1
);
const getCurrentRoute = state => {
  const index = getHistoryIndex(state);
  if (index < 0 ||
      !Array.isArray(state.route.history) ||
      index >= state.route.history.length) {
    return {};
  }
  return state.route.history[index];
};
const getActiveRecord = state => (state ? state.edit.forms.active : {});

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
    yield put(routeActions.navigate({ url: action.url, replace: true }));
  } else {
    const index = typeof routeState.index === 'number'
                  ? routeState.index + 1
                  : 0;
    yield call([ history, 'pushState' ], { index }, '', action.url);
    yield put(routeActions.navigate({ url: action.url }));
  }
}

export function* beforeScreenChange() {
  const currentRoute = yield select(getCurrentRoute);

  if (currentRoute.screen === 'edit-card') {
    // XXX Fork this to something defined in edit.js (and move the tests as
    // well)
    const activeRecord = yield select(getActiveRecord);
    if (activeRecord.editState === EditState.DIRTY) {
      yield put(editActions.saveEditCard(activeRecord.formId));
      // XXX Once we fork this, NAVIGATE should be watched for here
      const action = yield take(
        [ 'FINISH_SAVE_CARD',
          'FAIL_SAVE_CARD',
          'NAVIGATE'
        ]);
      if (action.type !== 'FINISH_SAVE_CARD') {
        // XXX Should we throw for the FAIL case? Probably yes.
        // For the NAVIGATE case, we don't want to cancel prematurely, but
        // actually join the forked process and then cancel()
        // Probably likewise for another BEFORE_SCREEN_CHANGE
        yield cancel();
      }
    }
  }
}

export function* updateUrl(action) {
  const routeState = yield select(getRoute);

  if (typeof routeState.index === 'number' &&
      routeState.index >= 0) {
    yield call([ history, 'replaceState' ],
               { index: routeState.index },
               '',
               action.url);
  }
}

function* routeSagas() {
  /* eslint-disable indent */
  yield* [ takeEvery('FOLLOW_LINK', followLink),
           takeEvery('BEFORE_SCREEN_CHANGE', beforeScreenChange),
           takeEvery('UPDATE_URL', updateUrl) ];
  /* eslint-enable indent */
}

export default routeSagas;
