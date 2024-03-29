import {
  takeEvery,
  call,
  put,
  race,
  select,
  take,
  Effect,
} from 'redux-saga/effects';
import { routeFromURL, routesEqual } from './router';
import { beforeEditScreenChange } from '../edit/sagas';
import { beforeReviewScreenChange } from '../review/sagas';
import * as Actions from '../actions';
import { Route } from './router';
import { AppState } from '../reducer';
import { RouteState } from './reducer';

// Selectors

const getRoute = (state: AppState): RouteState => state.route;
const getHistoryIndex = (state: AppState): number => state.route.index;
const getCurrentRoute = (state: AppState): Route | null => {
  const index = getHistoryIndex(state);
  return index >= state.route.history.length
    ? null
    : state.route.history[index];
};

// Sagas

export function* followLink(
  action: Actions.FollowLinkAction
): Generator<Effect, void, any> {
  const routeState = yield select(getRoute);
  let navigateRoute;

  // First, unless the link is an active link, if the route matches the current
  // route ignore the navigation altogether.
  //
  // The "active link" distinction is used for some links that really behave
  // like buttons but where making them links is convenient because it should be
  // possible to right-click / ctrl+click them and perform the action in another
  // tab.
  //
  // In particular, on the new card screen, if you click the "Add" link in the
  // toolbar, then you expect it to create a new card regardless of the fact
  // that (assuming we haven't saved the in-progress card yet) the old URL
  // '/cards/new' and the new URL '/cards/new' are the same.
  //
  // However, if you click the "Add" link in the tab bar then you *don't* expect
  // that to generate a new card since it acts in a navigational fashion, rather
  // than a button-like fashion.
  if (
    !action.active &&
    routeState.index >= 0 &&
    routeState.index < routeState.history.length
  ) {
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
  if (
    action.direction === 'backwards' &&
    routeState.index >= 1 &&
    routeState.index < routeState.history.length
  ) {
    const previousRoute = routeState.history[routeState.index - 1];
    navigateRoute = navigateRoute || routeFromURL(action.url || '/');
    if (routesEqual(previousRoute, navigateRoute)) {
      const screenChangeResult = yield call(beforeScreenChange);
      if (screenChangeResult) {
        yield call([history, 'back']);
      }
      return;
    }
  }

  // Try to run the before change actions and if they fail, don't go ahead with
  // the navigation.
  const screenChangeResult = yield call(beforeScreenChange);
  if (!screenChangeResult) {
    return;
  }

  // Otherwise use pushState / replaceState() and dispatch the relevant action.
  if (action.direction === 'replace' && routeState.index >= 0) {
    yield call(
      [history, 'replaceState'],
      { index: routeState.index },
      '',
      action.url
    );
    yield put(Actions.navigate({ url: action.url, replace: true }));
  } else {
    const index =
      typeof routeState.index === 'number' ? routeState.index + 1 : 0;
    yield call([history, 'pushState'], { index }, '', action.url);
    yield put(Actions.navigate({ url: action.url }));
  }
}

export function* beforeScreenChange(): Generator<Effect, boolean, any> {
  const currentRoute = yield select(getCurrentRoute);

  if (currentRoute && currentRoute.screen === 'edit-card') {
    // I don't recall what the following setup is about but I think the idea is
    // that if while we're saving we trigger a navigate (e.g. to update the URL)
    // then we should return false so we know _not_ to navigate... for some
    // reason.

    const { beforeChangeResult, navigate } = yield race({
      beforeChangeResult: call(beforeEditScreenChange),
      navigate: take('NAVIGATE'),
    });

    if (navigate) {
      return false;
    }
    return beforeChangeResult;
  } else if (currentRoute && currentRoute.screen === 'review') {
    return yield call(beforeReviewScreenChange);
  }

  return true;
}

export function* updateUrl(
  action: Actions.UpdateUrlAction
): Generator<Effect, void, any> {
  const routeState = yield select(getRoute);

  if (typeof routeState.index === 'number' && routeState.index >= 0) {
    yield call(
      [history, 'replaceState'],
      { index: routeState.index },
      '',
      action.url
    );
  }
}

export function* routeSagas() {
  yield* [
    takeEvery('FOLLOW_LINK', followLink),
    takeEvery('BEFORE_SCREEN_CHANGE', beforeScreenChange),
    takeEvery('UPDATE_URL', updateUrl),
  ];
}
