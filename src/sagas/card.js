import { takeEvery, call, put } from 'redux-saga/effects';
import { routeFromURL, routeFromPath, URLFromRoute } from '../router';

// Sagas

export function* navigate(cardStore, action) {
  // Look for navigation actions that should load a card
  const route = action.url
                ? routeFromURL(action.url)
                : routeFromPath(action.path, action.search,
                                action.fragment);
  if (route.screen !== 'edit-card' || !route.card) {
    return;
  }

  yield put({ type: 'LOAD_CARD', card: route.card });

  try {
    const card = yield call([ cardStore, 'getCard' ], route.card);
    yield put({ type: 'FINISH_LOAD_CARD', card });
  } catch (error) {
    yield put({ type: 'FAIL_LOAD_CARD', error });
  }
}

export function* saveCard(cardStore, action) {
  try {
    const savedCard = yield call([ cardStore, 'putCard' ], action.card);
    yield put({ type: 'FINISH_SAVE_CARD', card: savedCard });
    // If it is a new card, update history so the edit card for the screen
    // appears to be the previous item in the history.
    if (!action.card._id) {
      yield put({ type: 'INSERT_HISTORY',
                  url: URLFromRoute({ screen: 'edit-card',
                                      card: savedCard._id }) });
    }
  } catch (error) {
    yield put({ type: 'FAIL_SAVE_CARD', error });
  }
}

function* saveSagas(cardStore) {
  /* eslint-disable indent */
  yield* [ takeEvery('NAVIGATE', navigate, cardStore),
           takeEvery('SAVE_CARD', saveCard, cardStore) ];
  /* eslint-enable indent */
}

export default saveSagas;
