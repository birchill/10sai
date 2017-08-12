import { takeEvery, call, put, select } from 'redux-saga/effects';
import { routeFromURL, routeFromPath, URLFromRoute } from '../router';
import * as editActions from '../actions/edit';
import EditState from '../edit-states';

// Local state

let saveEditCardPromise;
let saveEditCardPromiseFns = { resolve: () => {}, reject: () => {} };

// Public utility functions

// Dispatches a SAVE_EDIT_CARD action only if needed and returns a Promise that
// resolves when the save has completed.
export function saveEditCardIfNeeded(formId, dispatch) {
  if (!saveEditCardPromise) {
    saveEditCardPromise = new Promise((resolve, reject) => {
      saveEditCardPromiseFns = { resolve, reject };
    });
    dispatch(editActions.saveEditCard(formId));
  }

  return saveEditCardPromise;
}

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

  if (!route.card) {
    yield put(editActions.newCard());
    return;
  }

  yield put(editActions.loadCard(route.card));
  saveEditCardPromise = undefined;

  const activeRecord = yield select(getActiveRecord);
  const formId = activeRecord.formId;

  try {
    const card = yield call([ cardStore, 'getCard' ], route.card);
    yield put(editActions.finishLoadCard(formId, card));
  } catch (error) {
    console.error(`Failed to load card: ${route.card}`);
    yield put(editActions.failLoadCard(formId));
  }
}

export function* editCard() {
  const activeRecord = yield select(getActiveRecord);
  if (activeRecord.editState === EditState.DIRTY) {
    saveEditCardPromise = undefined;
  }
}

export function* saveEditCard(cardStore, action) {
  try {
    const activeRecord = yield select(getActiveRecord);
    // In future we'll probably need to look through the different forms
    // to find the correct one, but for now this should hold.
    console.assert(activeRecord.formId === action.formId,
                   'Active record mismatch');

    // Don't save if there's nothing to save.
    if (activeRecord.editState === EditState.EMPTY ||
        activeRecord.editState === EditState.NOT_FOUND) {
      yield put(editActions.failSaveCard(action.formId, 'No card to save'));
      saveEditCardPromiseFns.reject('No card to save');
      return;
    }

    // Don't save if the card is not dirty (but do dispatch a finished action or
    // else the dispatcher might be waiting forever).
    if (activeRecord.editState === EditState.OK) {
      yield put(editActions.finishSaveCard(action.formId, activeRecord.card));
      saveEditCardPromiseFns.resolve(activeRecord.card);
      return;
    }

    const savedCard = yield call([ cardStore, 'putCard' ], activeRecord.card);
    yield put(editActions.finishSaveCard(action.formId, savedCard));
    saveEditCardPromiseFns.resolve(savedCard);

    // If it is a new card, update the URL.
    if (!activeRecord.card._id) {
      const editURL = URLFromRoute({ screen: 'edit-card',
                                     card: savedCard._id });
      yield put({ type: 'UPDATE_URL', url: editURL });
    }
  } catch (error) {
    yield put(editActions.failSaveCard(action.formId, error));
    saveEditCardPromiseFns.reject(error);
  }
}

function* editSagas(cardStore) {
  /* eslint-disable indent */
  yield* [ takeEvery('NAVIGATE', navigate, cardStore),
           takeEvery('EDIT_CARD', editCard),
           takeEvery('SAVE_EDIT_CARD', saveEditCard, cardStore) ];
  /* eslint-enable indent */
}

export default editSagas;
