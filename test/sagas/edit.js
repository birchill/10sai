/* global describe, it */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga } from 'redux-saga-test-plan';
import { navigate as navigateSaga,
         saveCard as saveCardSaga } from '../../src/sagas/edit';
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

const dirtyEditState = id => ({
  edit: {
    forms: {
      active: {
        formId: id,
        editState: EditState.DIRTY_EDIT,
        card: {
          _id: id,
          prompt: 'Updated',
          answer: 'Answer',
        },
        dirtyFields: [ 'prompt' ],
      }
    },
  }
});

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

    // newCard generates a globally unique sequence number and since we call
    // this before the implementation will, we should increment the number by
    // one to match what the implementation will get.
    const newCardAction = editActions.newCard();
    newCardAction.id++;

    return expectSaga(navigateSaga, cardStore,
                      routeActions.navigate('/cards/new'))
      .not.put(editActions.loadCard('123'))
      .put(newCardAction)
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

  it('triggers a save action if the current form is dirty', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore,
                      routeActions.navigate('/cards/456'))
      .withState(dirtyEditState('123'))
      .put(editActions.saveCard('123',
                                dirtyEditState('123').edit.forms.active.card))
      .run();
  });
});

const dirtyNewState = id => ({
  edit: {
    forms: {
      active: {
        formId: id,
        editState: EditState.DIRTY_NEW,
        card: {
          prompt: 'Prompt',
          answer: 'Answer',
        },
        dirtyFields: [ 'prompt', 'answer' ],
      }
    },
  }
});

describe('sagas:edit saveCard', () => {
  it('saves the card', () => {
    const cardStore = {
      putCard: card => card,
    };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(saveCardSaga, cardStore,
                      editActions.saveCard(formId, card))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId, card))
      .run();
  });

  it('reports the ID of the saved card', () => {
    const cardStore = {
      putCard: card => ({ ...card, _id: 'generated-id' }),
    };
    const card = { question: 'yer' };
    const formId = 'abc';

    return expectSaga(saveCardSaga, cardStore,
                      editActions.saveCard(formId, card))
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

    return expectSaga(saveCardSaga, cardStore,
                      editActions.saveCard(formId, card))
      .withState(dirtyNewState(formId))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId,
           { ...card, _id: '1234' }))
      .put({ type: 'UPDATE_URL', url: '/cards/1234' })
      .run();
  });

  it('updates the history so the previous URL reflects the saved card', () => {
    const cardStore = {
      putCard: card => ({ ...card, _id: '1234' }),
    };
    const card = { question: 'yer' };
    const formId = 12;

    return expectSaga(saveCardSaga, cardStore,
                      editActions.saveCard(formId, card))
      .withState(dirtyNewState(formId + 1))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.finishSaveCard(formId,
           { ...card, _id: '1234' }))
      .put({ type: 'INSERT_HISTORY', url: '/cards/1234' })
      .run();
  });

  it('does NOT update history if the card is not new', () => {
    const cardStore = { putCard: card => card };
    const card = { question: 'yer', _id: '1234' };
    const formId = '1234';

    return expectSaga(saveCardSaga, cardStore,
                      editActions.saveCard(formId, card))
      .withState(dirtyEditState(formId))
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

    return expectSaga(saveCardSaga, cardStore,
                      editActions.saveCard(formId, card))
      .call([ cardStore, 'putCard' ], card)
      .put(editActions.failSaveCard(formId, error))
      .run();
  });
});
