import {
  call,
  fork,
  put,
  race,
  select,
  take,
  takeEvery,
} from 'redux-saga/effects';
import { delay } from 'redux-saga';
import {
  routeFromURL,
  routeFromPath,
  URLFromRoute,
  routesEqual,
} from '../router';
import * as editActions from '../actions/edit';
import * as routeActions from '../actions/route';
import EditState from '../edit-states';

const SAVE_DELAY = 2000;

// Selectors

const getActiveRecord = state => (state ? state.edit.forms.active : {});

// Sagas

export function* navigate(cardStore, action) {
  // Look for navigation actions that should load a card
  const route = action.url
    ? routeFromURL(action.url)
    : routeFromPath(action.path, action.search, action.fragment);
  if (route.screen !== 'edit-card') {
    return;
  }

  if (!route.card) {
    yield put(editActions.newCard());
    return;
  }

  yield put(editActions.loadCard(route.card));

  const activeRecord = yield select(getActiveRecord);
  const formId = activeRecord.formId;

  try {
    const card = yield call([cardStore, 'getCard'], route.card);
    yield put(editActions.finishLoadCard(formId, card));
  } catch (error) {
    if (error && error.reason !== 'deleted') {
      console.error(`Failed to load card: ${error}`);
    }
    yield put(editActions.failLoadCard(formId, error));
  }
}

export function* save(cardStore, formId, card) {
  try {
    const savedCard = yield call([cardStore, 'putCard'], card);

    // Get the active record since we may have navigated while the card was
    // being saved.
    const activeRecord = yield select(getActiveRecord);

    // If it is a new card, we haven't navigated to another card already,
    // and we're still on the new card screen, update the URL.
    if (
      !card._id &&
      formId === activeRecord.formId &&
      routesEqual(
        routeFromPath(location.pathname, location.search, location.hash),
        { screen: 'edit-card' }
      )
    ) {
      const newUrl = URLFromRoute({
        screen: 'edit-card',
        card: savedCard._id,
      });
      yield put(routeActions.updateUrl(newUrl));
    }

    // This needs to happen after we inspect the location above since it may
    // trigger a NAVIGATE action.
    yield put(editActions.finishSaveCard(formId, savedCard));

    return savedCard._id;
  } catch (error) {
    console.error(`Failed to save: ${error}`);
    yield put(editActions.failSaveCard(formId, error));
    // Re-throw error since when saving synchronously we want to know about it
    throw error;
  }
}

function* autoSave(cardStore, formId, card) {
  // Debounce -- we allow this part of the task to be cancelled
  // eslint-disable-next-line no-unused-vars
  const { wait, cancel } = yield race({
    wait: call(delay, SAVE_DELAY),
    cancel: take('CANCEL_AUTO_SAVE'),
  });

  if (cancel) {
    return formId;
  }

  // The remaining steps should not be cancelled since otherwise we risk
  // writing the card twice with different IDs.
  try {
    return yield save(cardStore, formId, card);
  } catch (error) {
    // Nothing special to do here. We'll have already dispatched the appropriate
    // action and that's enough for auto-saving.
    return formId;
  }
}

export function* watchCardEdits(cardStore) {
  let autoSaveTask;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const action = yield take([
      'EDIT_CARD',
      'SAVE_EDIT_CARD',
      'DELETE_EDIT_CARD',
    ]);

    const activeRecord = yield select(getActiveRecord);
    // In future we'll probably need to look through the different forms
    // to find the correct one, but for now this should hold.
    console.assert(
      !action.formId || activeRecord.formId === action.formId,
      `Active record mismatch ${activeRecord.formId} vs ${action.formId}`
    );

    // Check if anything needs saving
    if (
      activeRecord.editState !== EditState.DIRTY &&
      action.type !== 'DELETE_EDIT_CARD'
    ) {
      // If we are responding to a save action, put the finish action anyway
      // in case someone is waiting on either a finished or fail to indicate
      // completion of the save.
      if (action.type === 'SAVE_EDIT_CARD') {
        yield put(
          editActions.finishSaveCard(activeRecord.formId, activeRecord.card)
        );
      }
      continue;
    }

    let id = action.formId || activeRecord.formId;
    // If there is an auto save in progress, cancel it.
    if (autoSaveTask) {
      if (autoSaveTask.isRunning()) {
        yield put({ type: 'CANCEL_AUTO_SAVE' });
      }
      // Get the possibly updated card ID.
      try {
        id = yield autoSaveTask.done;
      } catch (error) {
        // If the previous auto-save failed, just ignore it. It will have
        // dispatched a suitable error action.
      }
    }
    autoSaveTask = undefined;

    switch (action.type) {
      case 'EDIT_CARD':
        autoSaveTask = yield fork(autoSave, cardStore, id, activeRecord.card);
        break;

      case 'SAVE_EDIT_CARD':
        try {
          yield save(cardStore, id, activeRecord.card);
        } catch (error) {
          // Don't do anything
        }
        break;

      case 'DELETE_EDIT_CARD':
        if (activeRecord.deleted) {
          try {
            yield call([cardStore, 'deleteCard'], { _id: id });
          } catch (error) {
            console.error(`Failed to delete card: ${error}`);
          }
        }
        break;

      default:
        console.log(`Unexpected action ${action.type}`);
        break;
    }
  }
}

function* editSagas(cardStore) {
  yield* [
    takeEvery(['NAVIGATE'], navigate, cardStore),
    watchCardEdits(cardStore),
  ];
}

export function* beforeEditScreenChange() {
  const activeRecord = yield select(getActiveRecord);
  if (activeRecord.editState !== EditState.DIRTY) {
    return true;
  }

  yield put(editActions.saveEditCard(activeRecord.formId));

  const action = yield take(['FINISH_SAVE_CARD', 'FAIL_SAVE_CARD']);

  return action.type !== 'FAIL_SAVE_CARD';
}

export default editSagas;
