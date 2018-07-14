/**
 * @jest-environment node
 *
 * Why this? See my complaint about jest in ../route/sagas.test.js
 */
/* global beforeEach, describe, it */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga } from 'redux-saga-test-plan';

import {
  navigate as navigateSaga,
  watchCardEdits as watchCardEditsSaga,
  save as saveSaga,
  beforeEditScreenChange as beforeEditScreenChangeSaga,
} from './sagas';
import { FormId } from './reducer';
import { Card } from '../model';
import reducer from '../reducer';
import EditorState from './EditorState';
import * as editActions from './actions';
import * as routeActions from '../route/actions';
import { generateCard } from '../utils/testing';

declare global {
  namespace NodeJS {
    interface Global {
      location: {
        pathname?: string;
        search?: string;
        hash?: string;
      };
    }
  }
}

const loadingState = (cardId: string) => ({
  edit: {
    forms: {
      active: {
        formId: cardId,
        editorState: EditorState.Loading,
        card: {},
      },
    },
  },
});

const dirtyState = (formId: FormId, cardToUse: Partial<Card>) => {
  const card = cardToUse || { prompt: 'Updated', answer: 'Answer' };
  return {
    route: { index: 0 },
    edit: {
      forms: {
        active: {
          formId,
          editorState: EditorState.Ok,
          card,
          dirtyFields: new Set(['prompt']),
        },
      },
    },
  };
};

const initialState = reducer(undefined, { type: 'none' });

describe('sagas:edit navigate', () => {
  it('triggers a load action if the route is for editing a card (URL)', () => {
    const dataStore = { getCard: id => ({ _id: id }) };

    return expectSaga(
      navigateSaga,
      dataStore,
      routeActions.navigate({ url: '/cards/123' })
    )
      .withState(initialState)
      .put(editActions.loadCard('123'))
      .call([dataStore, 'getCard'], '123')
      .run();
  });

  it('triggers a load action if the route is for editing a card (path)', () => {
    const dataStore = { getCard: id => ({ _id: id }) };

    return expectSaga(
      navigateSaga,
      dataStore,
      routeActions.navigate({ path: '/cards/123' })
    )
      .withState(initialState)
      .put(editActions.loadCard('123'))
      .call([dataStore, 'getCard'], '123')
      .run();
  });

  it('triggers a new action if the route is for adding a card', () => {
    const dataStore = { getCard: id => ({ _id: id }) };

    // The new action increments a global counter which can be touched by other
    // tests so we simply get the action here knowing that the next caller will
    // be the code under test (so we increment the id to match the value the
    // caller will get).
    const expectedNewAction = editActions.newCard();
    expectedNewAction.newId++;

    return expectSaga(
      navigateSaga,
      dataStore,
      routeActions.navigate({ url: '/cards/new' })
    )
      .not.put(editActions.loadCard('123'))
      .put(expectedNewAction)
      .not.call([dataStore, 'getCard'], '123')
      .run();
  });

  it('does not triggers a load action if the route is something else', () => {
    const dataStore = { getCard: id => ({ _id: id }) };

    return expectSaga(
      navigateSaga,
      dataStore,
      routeActions.navigate({ url: '/' })
    )
      .not.put(editActions.loadCard('123'))
      .not.call([dataStore, 'getCard'], '123')
      .run();
  });

  it('dispatches a finished action if the load successfully complete', () => {
    const card = generateCard('123');
    const dataStore = { getCard: id => ({ ...card, _id: id }) };

    return expectSaga(
      navigateSaga,
      dataStore,
      routeActions.navigate({ url: '/cards/123' })
    )
      .put(editActions.loadCard('123'))
      .call([dataStore, 'getCard'], '123')
      .withState(loadingState('123'))
      .put(editActions.finishLoadCard('123', card))
      .run();
  });

  it('dispatches a failed action if the load failed to complete', () => {
    const error = { status: 404, name: 'not_found', message: 'Not found' };
    const dataStore = {
      getCard: () =>
        new Promise((resolve, reject) => {
          reject(error);
        }),
    };

    return expectSaga(
      navigateSaga,
      dataStore,
      routeActions.navigate({ url: '/cards/123' })
    )
      .put(editActions.loadCard('123'))
      .call([dataStore, 'getCard'], '123')
      .withState(loadingState('123'))
      .put(editActions.failLoadCard('123', error))
      .silentRun(100);
  });
});

const okState = (formId, cardToUse) => {
  const card = cardToUse || { prompt: 'Prompt', answer: 'Answer' };
  return {
    edit: {
      forms: {
        active: {
          formId,
          editorState: EditorState.Ok,
          card,
        },
      },
    },
  };
};

const emptyState = formId => ({
  edit: {
    forms: {
      active: {
        formId,
        editorState: EditorState.Empty,
        card: {},
      },
    },
  },
});

const notFoundState = (formId, deleted) => ({
  edit: {
    forms: {
      active: {
        formId,
        editorState: EditorState.NotFound,
        card: {},
        deleted,
      },
    },
  },
});

describe('sagas:edit watchCardEdits', () => {
  beforeEach(() => {
    global.location = {
      pathname: '',
      search: '',
      hash: '',
    };
  });

  it('saves the card', () => {
    const dataStore = { putCard: card => card };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(editActions.finishSaveCard(formId, card))
      .silentRun(100);
  });

  it('does NOT save the card if it is not dirty', () => {
    const dataStore = { putCard: card => card };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(okState(formId, card))
      .dispatch(editActions.saveCard(formId))
      .not.call([dataStore, 'putCard'], card)
      .put(editActions.finishSaveCard(formId, card))
      .silentRun(100);
  });

  it('fails if there is no card to save', () => {
    const dataStore = { putCard: card => card };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(emptyState(formId))
      .dispatch(editActions.saveCard(formId))
      .not.call([dataStore, 'putCard'], {})
      .not.put(
        editActions.failSaveCard(formId, {
          name: 'no_card',
          message: 'No card to save',
        })
      )
      .silentRun(100);
  });

  it('reports the ID of the saved card', () => {
    const dataStore = {
      putCard: card => ({ ...card, _id: 'generated-id' }),
    };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(editActions.finishSaveCard(formId, { ...card, _id: 'generated-id' }))
      .silentRun(100);
  });

  it('updates the history so the current URL reflects the saved card', () => {
    const dataStore = {
      putCard: card => ({ ...card, _id: '1234' }),
    };
    const card = { question: 'yer' };
    const formId = 12;
    global.location.pathname = '/cards/new';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(editActions.finishSaveCard(formId, { ...card, _id: '1234' }))
      .put(routeActions.updateUrl('/cards/1234'))
      .silentRun(100);
  });

  it('does NOT update history if the card is not new', () => {
    const dataStore = { putCard: card => card };
    const card = { question: 'yer', _id: '1234' };
    const formId = '1234';
    global.location.pathname = '/cards/new';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(editActions.finishSaveCard(formId, card))
      .not.put(routeActions.updateUrl('/cards/1234'))
      .silentRun(100);
  });

  it('does NOT update history if we are no longer on the new card screen', () => {
    const dataStore = {
      putCard: card => ({ ...card, _id: '2345' }),
    };
    const card = { question: 'yer' };
    const formId = 18;
    global.location.pathname = '/';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(editActions.finishSaveCard(formId, { ...card, _id: '2345' }))
      .not.put(routeActions.updateUrl('/cards/2345'))
      .silentRun(100);
  });

  it('dispatches a failed action when the card cannot be saved', () => {
    const error = { status: 404, name: 'not_found', message: 'Not found' };
    const dataStore = {
      putCard: () =>
        new Promise((resolve, reject) => {
          reject(error);
        }),
    };
    const card = { question: 'yer' };
    const formId = 13;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(editActions.failSaveCard(formId, error))
      .silentRun(100);
  });

  it('deletes the card when requested', () => {
    const dataStore = { deleteCard: () => {} };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(notFoundState(formId, true))
      .dispatch(editActions.deleteCard(formId))
      .call([dataStore, 'deleteCard'], 'abc')
      .silentRun(100);
  });

  it('does NOT delete the card if it has not been saved', () => {
    const dataStore = { deleteCard: () => {} };
    const card = { _id: 'abc', prompt: 'Prompt', answer: 'Answer' };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.deleteCard(formId))
      .not.call([dataStore, 'deleteCard'], 'abc')
      .silentRun(100);
  });

  it('ignores any errors when deleting', () => {
    const error = { status: 404, name: 'not_found', reason: 'deleted' };
    const dataStore = {
      deleteCard: () =>
        new Promise((resolve, reject) => {
          reject(error);
        }),
    };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(notFoundState(formId, true))
      .dispatch(editActions.deleteCard(formId))
      .call([dataStore, 'deleteCard'], 'abc')
      .silentRun(100);
  });

  it('cancels autosaving when the card is deleted', () => {
    const dataStore = { deleteCard: () => {} };
    const card = { _id: 'abc', question: 'Question', answer: 'Answer' };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withReducer(reducer)
      .withState(okState(formId, card))
      .dispatch(
        editActions.editCard(formId, { ...card, answer: 'Updated answer' })
      )
      .dispatch(editActions.deleteCard(formId))
      .not.call.fn(dataStore.putCard)
      .silentRun(500);
  });
});

// This is largely covered by the watchCardEditsSaga tests above but there are
// a few things we can't test there with redux-test-plan (like changing state
// mid-course).
describe('sagas:edit save', () => {
  it('does NOT update history if the app is navigated while saving', () => {
    const dataStore = {
      putCard: card => ({ ...card, _id: '4567' }),
    };
    const card = { question: 'yer' };
    const oldFormId = 17;
    const newFormId = 18;
    const resourceState = {
      context: {
        newId: oldFormId,
      },
      resource: card,
    };

    return expectSaga(saveSaga, dataStore, resourceState)
      .withState(emptyState(newFormId))
      .call([dataStore, 'putCard'], card)
      .put(editActions.finishSaveCard(oldFormId, { ...card, _id: '4567' }))
      .not.put(routeActions.updateUrl('/cards/4567'))
      .silentRun(100);
  });
});

describe('sagas:edit beforeEditScreenChange', () => {
  it('dispatches SAVE_CARD if the card is dirty', () => {
    const formId = 'abc';
    const state = {
      edit: {
        forms: {
          active: {
            formId,
            editorState: EditorState.Ok,
            dirtyFields: new Set(['answer']),
          },
        },
      },
    };

    return expectSaga(beforeEditScreenChangeSaga)
      .withState(state)
      .put(editActions.saveCard(formId))
      .dispatch(editActions.finishSaveCard(formId, {}))
      .returns(true)
      .run();
  });

  it('does nothing if the card is not dirty', () => {
    const formId = 'abc';
    const state = {
      edit: { forms: { active: { formId, editorState: EditorState.Ok } } },
    };

    return expectSaga(beforeEditScreenChangeSaga)
      .withState(state)
      .not.put(editActions.saveCard(formId))
      .returns(true)
      .run();
  });

  it('returns false if the card fails to save', () => {
    const formId = 'abc';
    const state = {
      edit: {
        forms: {
          active: {
            formId,
            editorState: EditorState.Ok,
            dirtyFields: new Set(['answer']),
          },
        },
      },
    };
    const error = { name: 'too_bad', message: 'too bad' };

    return expectSaga(beforeEditScreenChangeSaga)
      .withState(state)
      .put(editActions.saveCard(formId))
      .dispatch(editActions.failSaveCard(formId, error))
      .returns(false)
      .run();
  });
});
