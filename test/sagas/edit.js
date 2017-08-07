/* global describe, it */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga } from 'redux-saga-test-plan';
import { navigate as navigateSaga,
         saveEditCard as saveEditCardSaga } from '../../src/sagas/edit';
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
                      routeActions.navigate('/cards/123'))
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
                      routeActions.navigate('/cards/new'))
      .not.put(editActions.loadCard('123'))
      .put(editActions.newCard(1))
      .not.call([ cardStore, 'getCard' ], '123')
      .run();
  });

  it('does not triggers a load action if the route is something else', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore,
                      routeActions.navigate('/'))
      .not.put(editActions.loadCard('123'))
      .not.call([ cardStore, 'getCard' ], '123')
      .run();
  });

  it('dispatches a finished action if the load successfully complete', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore,
                      routeActions.navigate('/cards/123'))
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
                      routeActions.navigate('/cards/123'))
      .put(editActions.loadCard('123'))
      .call([ cardStore, 'getCard' ], '123')
      .withState(loadingState('123'))
      .put(editActions.failLoadCard('123'))
      .run();
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

const notFoundState = formId => ({
  edit: {
    forms: {
      active: {
        formId,
        editState: EditState.NOT_FOUND,
        card: {},
      }
    }
  }
});

describe('sagas:edit saveEditCard', () => {
  it('saves the card', () => {
    const cardStore = {
      putCard: card => card,
    };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(saveEditCardSaga, cardStore,
                      editActions.saveEditCard(formId))
      .withState(dirtyState(formId, card))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId, card))
      .run();
  });

  it('does NOT save the card if it is not dirty', () => {
    const cardStore = {
      putCard: card => card,
    };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(saveEditCardSaga, cardStore,
                      editActions.saveEditCard(formId))
      .withState(okState(formId, card))
      .not.call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId, card))
      .run();
  });

  it('fails if there is no card to save', () => {
    const cardStore = { putCard: card => card };
    const formId = 'abc';

    return expectSaga(saveEditCardSaga, cardStore,
                      editActions.saveEditCard(formId))
      .withState(emptyState(formId))
      .not.call([ cardStore, 'putCard' ], {})
      .put(editActions.failSaveCard(formId, 'No card to save'))
      .run();
  });

  it('fails if there is no card to save because it was not found', () => {
    const cardStore = { putCard: card => card };
    const formId = 'abc';

    return expectSaga(saveEditCardSaga, cardStore,
                      editActions.saveEditCard(formId))
      .withState(notFoundState(formId))
      .not.call([ cardStore, 'putCard' ], {})
      .put(editActions.failSaveCard(formId, 'No card to save'))
      .run();
  });

  it('reports the ID of the saved card', () => {
    const cardStore = {
      putCard: card => ({ ...card, _id: 'generated-id' }),
    };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(saveEditCardSaga, cardStore,
                      editActions.saveEditCard(formId))
      .withState(dirtyState(formId, card))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId,
           { ...card, _id: 'generated-id' }))
      .run();
  });

  it('updates the history so the current URL reflects the saved card', () => {
    const cardStore = {
      putCard: card => ({ ...card, _id: '1234' }),
    };
    const card = { question: 'yer' };
    const formId = 12;

    return expectSaga(saveEditCardSaga, cardStore,
                      editActions.saveEditCard(formId))
      .withState(dirtyState(formId, card))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId,
           { ...card, _id: '1234' }))
      .put({ type: 'UPDATE_URL', url: '/cards/1234' })
      .run();
  });

  it('does NOT update history if the card is not new', () => {
    const cardStore = { putCard: card => card };
    const card = { question: 'yer', _id: '1234' };
    const formId = '1234';

    return expectSaga(saveEditCardSaga, cardStore,
                      editActions.saveEditCard(formId))
      .withState(dirtyState(formId, card))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId, card))
      .not.put({ type: 'INSERT_HISTORY', url: '/cards/1234' })
      .not.put({ type: 'UPDATE_URL', url: '/cards/1234' })
      .run();
  });

  it('dispatches a failed action when the card cannot be saved', () => {
    const error = { status: 404, name: 'not_found' };
    const cardStore = {
      putCard: () => new Promise((resolve, reject) => { reject(error); })
    };
    const card = { question: 'yer' };
    const formId = 13;

    return expectSaga(saveEditCardSaga, cardStore,
                      editActions.saveEditCard(formId))
      .withState(dirtyState(formId, card))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.failSaveCard(formId, error))
      .run();
  });
});
