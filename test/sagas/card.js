/* global describe, it */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga } from 'redux-saga-test-plan';
import { saveCard as saveCardSaga,
         navigate as navigateSaga } from '../../src/sagas/card';

const saveCard = card => ({
  type: 'SAVE_CARD',
  card,
});

describe('sagas:card saveCard', () => {
  it('saves the card', () => {
    const cardStore = {
      putCard: card => card,
    };
    const card = { question: 'yer' };

    return expectSaga(saveCardSaga, cardStore, saveCard(card))
      .call([ cardStore, 'putCard' ], card)
      .put({ type: 'FINISH_SAVE_CARD', card })
      .run();
  });

  it('reports the ID of the saved card', () => {
    const cardStore = {
      putCard: card => ({ ...card, _id: 'generated-id' }),
    };
    const card = { question: 'yer' };

    return expectSaga(saveCardSaga, cardStore, saveCard(card))
      .call([ cardStore, 'putCard' ], card)
      .put({ type: 'FINISH_SAVE_CARD',
             card: { ...card, _id: 'generated-id' } })
      .run();
  });

  it('updates the history so a new card is previous in history', () => {
    const cardStore = {
      putCard: card => ({ ...card, _id: '1234' }),
    };
    const card = { question: 'yer' };

    return expectSaga(saveCardSaga, cardStore, saveCard(card))
      .call([ cardStore, 'putCard' ], card)
      .put({ type: 'FINISH_SAVE_CARD',
             card: { ...card, _id: '1234' } })
      .put({ type: 'INSERT_HISTORY', url: '/cards/1234' })
      .run();
  });

  it('does not update history if the card is not new', () => {
    const cardStore = { putCard: card => card };
    const card = { question: 'yer', _id: '1234' };

    return expectSaga(saveCardSaga, cardStore, saveCard(card))
      .call([ cardStore, 'putCard' ], card)
      .put({ type: 'FINISH_SAVE_CARD', card })
      .not.put({ type: 'INSERT_HISTORY', url: '/cards/1234' })
      .run();
  });

  it('dispatches a failed action when the card cannot be saved', () => {
    const error = { status: 404, name: 'not_found' };
    const cardStore = {
      putCard: () => new Promise((resolve, reject) => { reject(error); })
    };
    const card = { question: 'yer' };

    return expectSaga(saveCardSaga, cardStore, saveCard(card))
      .call([ cardStore, 'putCard' ], card)
      .put({ type: 'FAIL_SAVE_CARD', error })
      .run();
  });
});

const navigateWithURL = url => ({
  type: 'NAVIGATE',
  url,
});

const navigateWithPath = (path, search, fragment) => ({
  type: 'NAVIGATE',
  path,
  search,
  fragment,
});

describe('sagas:card navigate', () => {
  it('triggers a load action if the route is for editing a card (URL)', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore, navigateWithURL('/cards/123'))
      .put({ type: 'LOAD_CARD', card: '123' })
      .call([ cardStore, 'getCard' ], '123')
      .run();
  });

  it('triggers a load action if the route is for editing a card (path)', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore, navigateWithPath('/cards/123'))
      .put({ type: 'LOAD_CARD', card: '123' })
      .call([ cardStore, 'getCard' ], '123')
      .run();
  });

  it('does not triggers a load action if the route is for adding a card', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore, navigateWithURL('/cards/new'))
      .not.put({ type: 'LOAD_CARD', card: '123' })
      .not.call([ cardStore, 'getCard' ], '123')
      .run();
  });

  it('does not triggers a load action if the route is something else', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore, navigateWithURL('/'))
      .not.put({ type: 'LOAD_CARD', card: '123' })
      .not.call([ cardStore, 'getCard' ], '123')
      .run();
  });

  it('dispatches a finished action if the load successfully complete', () => {
    const cardStore = { getCard: id => ({ _id: id }) };

    return expectSaga(navigateSaga, cardStore, navigateWithURL('/cards/123'))
      .put({ type: 'LOAD_CARD', card: '123' })
      .call([ cardStore, 'getCard' ], '123')
      .put({ type: 'FINISH_LOAD_CARD', card: { _id: '123' } })
      .run();
  });

  it('dispatches a failed action if the load successfully complete', () => {
    const error = { status: 404, name: 'not_found' };
    const cardStore = {
      getCard: () => new Promise((resolve, reject) => { reject(error); })
    };

    return expectSaga(navigateSaga, cardStore, navigateWithURL('/cards/123'))
      .put({ type: 'LOAD_CARD', card: '123' })
      .call([ cardStore, 'getCard' ], '123')
      .put({ type: 'FAIL_LOAD_CARD', error })
      .run();
  });
});
