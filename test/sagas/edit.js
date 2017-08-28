/* global describe, it */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga } from 'redux-saga-test-plan';
import { navigate as navigateSaga,
         watchCardEdits as watchCardEditsSaga,
         save as saveSaga } from '../../src/sagas/edit';
import EditState from '../../src/edit-states';
import * as editActions from '../../src/actions/edit';
import * as routeActions from '../../src/actions/route';

const loadingState = formId => ({
  edit: {
    forms: {
      active: {
        formId,
        editState: EditState.LOADING,
        card: {}
      }
    },
  }
});

const dirtyState = (formId, cardToUse) => {
  const card = cardToUse || { prompt: 'Updated', answer: 'Answer' };
  return {
    route: { index: 0 },
    edit: {
      forms: {
        active: {
          formId,
          editState: EditState.DIRTY,
          card,
          dirtyFields: [ 'prompt' ],
        }
      },
    }
  };
};

describe('sagas:edit navigate', () => {
  it('triggers a load action if the route is for editing a card (URL)', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore,
                      routeActions.navigate({ url: '/cards/123' }))
      .put(editActions.loadCard('123'))
      .call([ cardStore, 'getCard' ], '123')
      .run();
  });

  it('triggers a load action if the route is for editing a card (path)', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore,
                      routeActions.navigate({ path: '/cards/123' }))
      .put(editActions.loadCard('123'))
      .call([ cardStore, 'getCard' ], '123')
      .run();
  });

  it('triggers a new action if the route is for adding a card', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore,
                      routeActions.navigate({ url: '/cards/new' }))
      .not.put(editActions.loadCard('123'))
      .put(editActions.newCard(1))
      .not.call([ cardStore, 'getCard' ], '123')
      .run();
  });

  it('does not triggers a load action if the route is something else', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore,
                      routeActions.navigate({ url: '/' }))
      .not.put(editActions.loadCard('123'))
      .not.call([ cardStore, 'getCard' ], '123')
      .run();
  });

  it('dispatches a finished action if the load successfully complete', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore,
                      routeActions.navigate({ url: '/cards/123' }))
      .put(editActions.loadCard('123'))
      .call([ cardStore, 'getCard' ], '123')
      .withState(loadingState('123'))
      .put(editActions.finishLoadCard('123', { _id: '123' }))
      .run();
  });

  it('dispatches a failed action if the load successfully complete', () => {
    const error = { status: 404, name: 'not_found' };
    const cardStore = {
      getCard: () => new Promise((resolve, reject) => { reject(error); })
    };

    return expectSaga(navigateSaga, cardStore,
                      routeActions.navigate({ url: '/cards/123' }))
      .put(editActions.loadCard('123'))
      .call([ cardStore, 'getCard' ], '123')
      .withState(loadingState('123'))
      .put(editActions.failLoadCard('123'))
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
          editState: EditState.OK,
          card,
        }
      },
    }
  };
};

const emptyState = formId => ({
  edit: {
    forms: {
      active: {
        formId,
        editState: EditState.EMPTY,
        card: {},
      }
    }
  }
});

describe('sagas:edit watchCardEdits', () => {
  it('saves the card', () => {
    const cardStore = { putCard: card => card };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, cardStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveEditCard(formId))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId, card))
      .silentRun(100);
  });

  it('does NOT save the card if it is not dirty', () => {
    const cardStore = { putCard: card => card };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, cardStore)
      .withState(okState(formId, card))
      .dispatch(editActions.saveEditCard(formId))
      .not.call([ cardStore, 'putCard' ], card)
      .not.put(editActions.finishSaveCard(formId, card))
      .silentRun(100);
  });

  it('fails if there is no card to save', () => {
    const cardStore = { putCard: card => card };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, cardStore)
      .withState(emptyState(formId))
      .dispatch(editActions.saveEditCard(formId))
      .not.call([ cardStore, 'putCard' ], {})
      .not.put(editActions.failSaveCard(formId, 'No card to save'))
      .silentRun(100);
  });

  it('reports the ID of the saved card', () => {
    const cardStore = {
      putCard: card => ({ ...card, _id: 'generated-id' }),
    };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(watchCardEditsSaga, cardStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveEditCard(formId))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId,
           { ...card, _id: 'generated-id' }))
      .silentRun(100);
  });

  it('updates the history so the current URL reflects the saved card', () => {
    const cardStore = {
      putCard: card => ({ ...card, _id: '1234' }),
    };
    const card = { question: 'yer' };
    const formId = 12;

    return expectSaga(watchCardEditsSaga, cardStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveEditCard(formId))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId,
           { ...card, _id: '1234' }))
      .put(routeActions.updateUrl('/cards/1234'))
      .silentRun(100);
  });

  it('does NOT update history if the card is not new', () => {
    const cardStore = { putCard: card => card };
    const card = { question: 'yer', _id: '1234' };
    const formId = '1234';

    return expectSaga(watchCardEditsSaga, cardStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveEditCard(formId))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId, card))
      .not.put(routeActions.updateUrl('/cards/1234'))
      .silentRun(100);
  });

  it('dispatches a failed action when the card cannot be saved', () => {
    const error = { status: 404, name: 'not_found' };
    const cardStore = {
      putCard: () => new Promise((resolve, reject) => { reject(error); })
    };
    const card = { question: 'yer' };
    const formId = 13;

    return expectSaga(watchCardEditsSaga, cardStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveEditCard(formId))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.failSaveCard(formId, error))
      .silentRun(100);
  });

  it('dispatches the onSuccess action when provided', () => {
    const cardStore = { putCard: card => card };
    const card = { question: 'yer', _id: '1234' };
    const formId = '1234';
    const onSuccess = () => {};

    return expectSaga(watchCardEditsSaga, cardStore)
      .withState(dirtyState(formId, card))
      .dispatch(editActions.saveEditCard(formId, onSuccess))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId, card))
      .call(onSuccess)
      .silentRun(100);
  });

  it('dispatches the onSuccess action even when the card is not saved', () => {
    const cardStore = { putCard: card => card };
    const card = { question: 'yer', _id: 'abc' };
    const formId = 'abc';
    const onSuccess = () => {};

    return expectSaga(watchCardEditsSaga, cardStore)
      .withState(okState(formId, card))
      .dispatch(editActions.saveEditCard(formId, onSuccess))
      .call(onSuccess)
      .silentRun(100);
  });
});

// This is largely covered by the watchCardEditsSaga tests above but there are
// a few things we can't test there with redux-test-plan (like changing state
// mid-course).
describe('sagas:edit save', () => {
  it('does NOT update history if the app is navigated while saving', () => {
    const cardStore = {
      putCard: card => ({ ...card, _id: '4567' }),
    };
    const card = { question: 'yer' };
    const oldFormId = 17;
    const newFormId = 18;

    return expectSaga(saveSaga, cardStore, oldFormId, card)
      .withState(emptyState(newFormId))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(oldFormId, { ...card, _id: '4567' }))
      .not.put(routeActions.updateUrl('/cards/4567'))
      .silentRun(100);
  });
});
