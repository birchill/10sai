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
import { Store } from 'redux';
import {
  ResourceParams,
  watchEdits,
  ResourceState,
  SaveContextBase,
} from '../utils/autosave-saga';
import {
  routeFromURL,
  routeFromPath,
  URLFromRoute,
  routesEqual,
} from '../route/router';
import { EditState, EditFormState, FormId } from './reducer';
import { getActiveRecord, isDirty } from './selectors';
import * as editActions from './actions';
import * as routeActions from '../route/actions';
import EditorState from './EditorState';
import { DataStore, StoreError } from '../store/DataStore';
import { Card } from '../model';

const SAVE_DELAY = 2000;

// XXX Move this to root reducer once it gets converted to TS.
interface State {
  edit: EditState;
}

// Sagas

// XXX This should move to route/actions.ts once converted to TS
interface NavigateAction {
  url?: string;
  path?: string;
  search?: string;
  fragment?: string;
  source?: 'history';
  replace?: boolean;
}

export function* navigate(dataStore: DataStore, action: NavigateAction) {
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
  const { formId } = activeRecord;

  try {
    const card = yield call([dataStore, 'getCard'], route.card);
    yield put(editActions.finishLoadCard(formId, card));
  } catch (error) {
    const storeError: StoreError = error;
    if (storeError.reason !== 'deleted') {
      console.error(`Failed to load card: ${JSON.stringify(storeError)}`);
    }
    yield put(editActions.failLoadCard(formId, storeError));
  }
}

export function* save(
  dataStore: DataStore,
  resourceState: ResourceState<Card, EditSaveContext>
) {
  const formId = formIdFromSaveContext(resourceState.context);
  const card = resourceState.resource;

  try {
    const savedCard = yield call([dataStore, 'putCard'], card);

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
    console.error(`Failed to save: ${JSON.stringify(error)}`);
    yield put(editActions.failSaveCard(formId, error));
    // Re-throw error since when saving synchronously we want to know about it
    throw error;
  }
}

type EditSaveContext = SaveContextBase;

const formIdFromSaveContext = (saveContext: EditSaveContext): FormId => {
  console.assert(
    typeof saveContext.resourceId !== 'undefined' ||
      typeof saveContext.newId !== 'undefined',
    'Either the resource ID or new ID must be filled in'
  );
  return typeof saveContext.newId === 'number'
    ? saveContext.newId
    : saveContext.resourceId!;
};

export function* watchCardEdits(dataStore: DataStore) {
  const params = {
    editActionType: 'EDIT_CARD',
    saveActionType: 'SAVE_CARD',
    deleteActionType: 'DELETE_CARD',
    cancelAutoSaveActionType: 'CANCEL_AUTO_SAVE',
    resourceStateSelector: (
      action:
        | editActions.EditCardAction
        | editActions.SaveCardAction
        | editActions.DeleteCardAction
    ) => {
      return (state: State): ResourceState<Card, EditSaveContext> => ({
        context: {
          newId: typeof action.formId === 'number' ? action.formId : undefined,
          resourceId:
            typeof action.formId === 'string'
              ? action.formId
              : state.edit.forms.active.card._id,
        },
        deleted: !!state.edit.forms.active.deleted,
        dirty: isDirty(state),
        resource: state.edit.forms.active.card,
      });
    },
    hasDataToSave: (resource: Partial<Card>): boolean => {
      const cardHasNonEmptyField = (field: keyof Card): boolean =>
        typeof resource[field] === 'string' &&
        (resource[field] as string).length !== 0;
      return (
        typeof resource._id !== 'undefined' ||
        cardHasNonEmptyField('question') ||
        cardHasNonEmptyField('answer')
      );
    },
    delete: (dataStore: DataStore, resourceId: string) =>
      call([dataStore, 'deleteCard'], resourceId),
    save,
    finishSaveActionCreator: (
      saveContext: EditSaveContext,
      resource: Partial<Card>
    ) =>
      editActions.finishSaveCard(formIdFromSaveContext(saveContext), resource),
    cancelSaveActionCreator: (saveContext: EditSaveContext) => ({
      type: 'CANCEL_AUTO_SAVE',
    }),
  };

  yield* watchEdits(dataStore, SAVE_DELAY, params);
}

export function* editSagas(dataStore: DataStore) {
  yield* [
    takeEvery(['NAVIGATE'], navigate, dataStore),
    watchCardEdits(dataStore),
  ];
}

export function* beforeEditScreenChange() {
  if (!(yield select(isDirty))) {
    return true;
  }

  const activeRecord = yield select(getActiveRecord);

  yield put(editActions.saveCard(activeRecord.formId));

  const action = yield take(['FINISH_SAVE_CARD', 'FAIL_SAVE_CARD']);

  return action.type !== 'FAIL_SAVE_CARD';
}

export function syncEditChanges(dataStore: DataStore, store: Store<State>) {
  dataStore.changes.on('card', change => {
    const cardBeingEdited = getActiveRecord(store.getState()).card;
    if (cardBeingEdited && cardBeingEdited._id === change._id) {
      store.dispatch({ type: 'SYNC_EDIT_CARD', change });
    }
  });
}

export default editSagas;
