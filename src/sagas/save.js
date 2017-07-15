import { takeEvery, call, put } from 'redux-saga/effects';
import { URLFromRoute } from '../router';

// Sagas

export function* saveCard(action, cardStore) {
  try {
    const savedCard = yield call([ cardStore, 'putCard' ], action.card);
    yield put({ type: 'COMPLETE_SAVE_CARD', card: savedCard });
    // If it is a new card, update history so the edit card for the screen
    // appears to be the previous item in the history.
    if (!action.card._id) {
      yield put({ type: 'INSERT_HISTORY',
                  url: URLFromRoute({ screen: 'edit-card',
                                      card: savedCard._id }) });
    }
  } catch (err) {
    yield put({ type: 'FAIL_SAVE_CARD', err });
  }
}

function* saveSagas(cardStore) {
  yield* [ takeEvery('SAVE_CARD', saveCard, cardStore) ];
}

export default saveSagas;
