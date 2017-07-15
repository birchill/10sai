/* global describe, it */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga } from 'redux-saga-test-plan';
import { saveCard as subject } from '../../src/sagas/save';

const saveCard = card => ({
  type: 'SAVE_CARD',
  card,
});

describe('sagas:save saveCard', () => {
  it('saves the card', () => {
    const api = {
      putCard: card => card,
    };
    const card = { question: 'yer' };

    return expectSaga(subject, saveCard(card), api)
      .call([ api, 'putCard' ], card)
      .put({ type: 'COMPLETE_SAVE_CARD', card })
      .run();
  });

  it('reports the ID of the saved card', () => {
    const api = {
      putCard: card => ({ ...card, _id: 'generated-id' }),
    };
    const card = { question: 'yer' };

    return expectSaga(subject, saveCard(card), api)
      .call([ api, 'putCard' ], card)
      .put({ type: 'COMPLETE_SAVE_CARD',
             card: { ...card, _id: 'generated-id' } })
      .run();
  });

  it('updates the history so a new card is previous in history', () => {
    const api = {
      putCard: card => ({ ...card, _id: '1234' }),
    };
    const card = { question: 'yer' };

    return expectSaga(subject, saveCard(card), api)
      .call([ api, 'putCard' ], card)
      .put({ type: 'COMPLETE_SAVE_CARD',
             card: { ...card, _id: '1234' } })
      .put({ type: 'INSERT_HISTORY', url: '/cards/1234' })
      .run();
  });

  it('does not update history if the card is not new', () => {
    const api = { putCard: card => card };
    const card = { question: 'yer', _id: '1234' };

    return expectSaga(subject, saveCard(card), api)
      .call([ api, 'putCard' ], card)
      .put({ type: 'COMPLETE_SAVE_CARD', card })
      .not.put({ type: 'INSERT_HISTORY', url: '/cards/1234' })
      .run();
  });

  it('dispatches a failed action when the card cannot be saved', () => {
    const err = { status: 404, name: 'not_found' };
    const api = {
      putCard: () => new Promise((resolve, reject) => { reject(err); })
    };
    const card = { question: 'yer' };

    return expectSaga(subject, saveCard(card), api)
      .call([ api, 'putCard' ], card)
      .put({ type: 'FAIL_SAVE_CARD', err })
      .run();
  });
});
