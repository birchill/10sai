import {
  all,
  call,
  put,
  select,
  take,
  takeEvery,
  CallEffect,
  Effect,
} from 'redux-saga/effects';
import { Store } from 'redux';

import { watchEdits, ResourceState } from '../utils/autosave-saga';
import { KeysOfType } from '../utils/type-helpers';
import { beforeNotesScreenChange } from '../notes/sagas';
import {
  routeFromURL,
  routeFromPath,
  URLFromRoute,
  routesEqual,
} from '../route/router';
import { AppState } from '../reducer';
import { getActiveRecord, isDirty, hasDataToSave } from './selectors';
import * as Actions from '../actions';
import { CardChange } from '../store/CardStore';
import { DataStore, StoreError } from '../store/DataStore';
import { Card } from '../model';

const SAVE_DELAY = 5000;

export function* navigate(
  dataStore: DataStore,
  action: Actions.NavigateAction
): Generator<Effect, void, any> {
  // Look for navigation actions that should load a card
  const route = action.url
    ? routeFromURL(action.url)
    : routeFromPath(action.path, action.search, action.fragment);
  if (route.screen !== 'edit-card') {
    return;
  }

  if (!route.card) {
    let card: Actions.PrefilledCard | undefined;
    if (route.search) {
      card = {};
      const { search } = route;

      const assignStringField = (
        key: KeysOfType<Actions.PrefilledCard, string | undefined>
      ) => {
        if (!search[key]) {
          return;
        }

        if (Array.isArray(search[key]) && (search[key] as Array<any>).length) {
          const array = search[key] as Array<any>;
          const lastElement = array[array.length - 1];
          if (typeof lastElement === 'string') {
            card![key] = lastElement;
          }
        } else if (typeof search[key] === 'string') {
          card![key] = search[key] as string;
        }
      };

      assignStringField('front');
      assignStringField('back');

      const assignStringArray = (
        key: KeysOfType<Actions.PrefilledCard, string[] | undefined>
      ) => {
        if (!search[key]) {
          return;
        }

        if (Array.isArray(search[key]) && (search[key] as Array<any>).length) {
          card![key] = [];
          for (const value of search[key] as Array<any>) {
            if (typeof value === 'string') {
              (card![key] as Array<string>).push(value);
            }
          }
        } else if (typeof search[key] === 'string') {
          card![key] = [search[key] as string];
        }
      };

      assignStringArray('keywords');
      assignStringArray('tags');
    }

    yield put(Actions.newCard(card));

    return;
  }

  yield put(Actions.loadCard(route.card));

  const activeRecord = yield select(getActiveRecord);
  const { formId } = activeRecord;

  try {
    const card = yield call([dataStore, 'getCard'], route.card);
    yield put(Actions.finishLoadCard(formId, card));
  } catch (error) {
    const storeError: StoreError = error;
    if (storeError.reason !== 'deleted') {
      console.error(`Failed to load card: ${JSON.stringify(storeError)}`);
    }
    yield put(Actions.failLoadCard(formId, storeError));
  }
}

type EditSaveContext = number;

export function* save(
  dataStore: DataStore,
  formId: number,
  card: Partial<Card>
): Generator<any, Partial<Card>, any> {
  try {
    const savedCard = yield call([dataStore, 'putCard'], card);

    // Get the active record since we may have navigated while the card was
    // being saved.
    const activeRecord = yield select(getActiveRecord);

    // If it is a new card, we haven't navigated to another card already,
    // and we're still on the new card screen, update the URL.
    if (
      !card.id &&
      formId === activeRecord.formId &&
      routesEqual(
        routeFromPath(location.pathname, location.search, location.hash),
        { screen: 'edit-card' }
      )
    ) {
      const newUrl = URLFromRoute({
        screen: 'edit-card',
        card: savedCard.id,
      });
      yield put(Actions.updateUrl(newUrl));
    }

    // This needs to happen after we inspect the location above since it may
    // trigger a NAVIGATE action.
    yield put(Actions.finishSaveCard(formId, savedCard));

    return savedCard;
  } catch (error) {
    console.error(`Failed to save: ${JSON.stringify(error)}`);
    yield put(Actions.failSaveCard(formId, error));

    return card;
  }
}

export function* watchCardEdits(
  dataStore: DataStore
): Generator<any, void, any> {
  const params = {
    editActionType: 'EDIT_CARD',
    saveActionType: 'SAVE_CARD',
    deleteActionType: 'DELETE_CARD',
    resourceStateSelector: (
      action:
        | Actions.EditCardAction
        | Actions.SaveCardAction
        | Actions.DeleteCardAction
    ) => {
      return (
        state: AppState
      ): ResourceState<Card, EditSaveContext> | undefined => {
        const card = state.edit.forms.active.card;
        return {
          context: action.formId,
          needsSaving: isDirty(state) && hasDataToSave(card),
          resource: card,
        };
      };
    },
    delete: (
      dataStore: DataStore,
      action: Actions.DeleteCardAction,
      card: Partial<Card>
    ): CallEffect | undefined => {
      if (typeof card.id === 'string' || typeof action.cardId === 'string') {
        return call([dataStore, 'deleteCard'], (card.id || action.cardId)!);
      }
      return undefined;
    },
    save,
    saveActionCreator: (saveContext: EditSaveContext) =>
      Actions.saveCard(saveContext),
    finishSaveActionCreator: (
      saveContext: EditSaveContext,
      resource: Partial<Card>
    ) => Actions.finishSaveCard(saveContext, resource),
  };

  yield* watchEdits(dataStore, SAVE_DELAY, params);
}

export function* editSagas(dataStore: DataStore) {
  yield* [
    takeEvery(['NAVIGATE'], navigate, dataStore),
    watchCardEdits(dataStore),
  ];
}

export function* beforeEditScreenChange(): Generator<any, boolean, any> {
  const activeRecord = yield select(getActiveRecord);

  const [saveCardResult, saveNotesResult] = yield all([
    saveBeforeScreenChange(activeRecord.formId),
    beforeNotesScreenChange({
      screen: 'edit-card',
      cardFormId: activeRecord.formId,
    }),
  ]);

  return !!saveCardResult && !!saveNotesResult;
}

function* saveBeforeScreenChange(
  formId: number
): Generator<Effect, boolean, any> {
  if (!(yield select(isDirty))) {
    return true;
  }

  yield put(Actions.saveCard(formId));

  const action = yield take(['FINISH_SAVE_CARD', 'FAIL_SAVE_CARD']);

  return action.type !== 'FAIL_SAVE_CARD';
}

export function syncEditChanges(dataStore: DataStore, store: Store<AppState>) {
  dataStore.changes.on('card', (change: CardChange) => {
    const cardBeingEdited = getActiveRecord(store.getState()).card;
    if (cardBeingEdited && cardBeingEdited.id === change.card.id) {
      store.dispatch({ type: 'SYNC_EDIT_CARD', change });
    }
  });
}
