import { takeEvery, call, put, select } from 'redux-saga/effects';
import { routeFromURL, routeFromPath, URLFromRoute } from '../router';
import EditState from '../../src/edit-states';
import * as editActions from '../actions/edit';

// Selectors

const getActiveRecord = state => (state ? state.edit.forms.active : {});

// Sagas

export function* navigate(cardStore, action) {
  // Look for navigation actions that should load a card
  const route = action.url
                ? routeFromURL(action.url)
                : routeFromPath(action.path, action.search,
                                action.fragment);
  if (route.screen !== 'edit-card') {
    return;
  }

  const activeRecord = yield select(getActiveRecord);
  if (activeRecord.editState === EditState.DIRTY_NEW ||
      activeRecord.editState === EditState.DIRTY_EDIT) {
    // XXX Presumably this should wait on the following to succeed?
    yield put(editActions.saveCard(activeRecord.formId, activeRecord.card));
  }

  if (!route.card) {
    yield put(editActions.newCard());
    return;
  }

  yield put(editActions.loadCard(route.card));

  const formId = activeRecord.formId;

  try {
    const card = yield call([ cardStore, 'getCard' ], route.card);
    yield put(editActions.finishLoadCard(formId, card));
  } catch (error) {
    console.error(`Failed to load card: ${route.card}`);
    yield put(editActions.failLoadCard(formId));
  }
}

export function* saveCard(cardStore, action) {
  try {
    const savedCard = yield call([ cardStore, 'putCard' ], action.card);
    yield put(editActions.finishSaveCard(action.formId, savedCard));

    // If it is a new card, update the URL.
    if (!action.card._id) {
      const activeRecord = yield select(getActiveRecord);
      const editURL = URLFromRoute({ screen: 'edit-card',
                                     card: savedCard._id });
      // If we are still editing the saved card, just update the current URL.
      if (activeRecord.formId === action.formId) {
        yield put({ type: 'UPDATE_URL', url: editURL });
      // Otherwise, make the previous entry in the history reflect the saved
      // card. Presumably, it is the previous card we saved.
      } else {
        yield put({ type: 'INSERT_HISTORY', url: editURL });
      }
    }
  } catch (error) {
    yield put(editActions.failSaveCard(action.formId, error));
  }
}

function* saveSagas(cardStore) {
  /* eslint-disable indent */
  yield* [ takeEvery('NAVIGATE', navigate, cardStore),
           takeEvery('SAVE_CARD', saveCard, cardStore) ];
  /* eslint-enable indent */
}

export default saveSagas;
