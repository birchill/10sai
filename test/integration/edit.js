/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { expectSaga } from 'redux-saga-test-plan';
import reducer from '../../src/reducers/index';
import editSagas from '../../src/sagas/edit';
import * as editActions from '../../src/actions/edit';
import EditState from '../../src/edit-states';

describe('integration:edit', () => {
  it('should allow creating and saving a new card', () => {
    const cardStore = { putCard: card => ({ ...card, _id: 'abc' }) };
    const formId = 12;

    let state = reducer(undefined, editActions.newCard(formId));
    state = reducer(state, editActions.editCard(formId, { prompt: 'Prompt' }));
    state = reducer(state, editActions.editCard(formId, { answer: 'Answer' }));

    return expectSaga(editSagas, cardStore)
      // Danger -- withReducer must come before withState!
      .withReducer(reducer)
      .withState(state)
      .dispatch(editActions.saveEditCard(formId))
      .hasFinalState({
        ...state,
        edit: {
          forms: {
            active: {
              formId: 'abc',
              editState: EditState.OK,
              card: {
                _id: 'abc',
                prompt: 'Prompt',
                answer: 'Answer',
              }
            }
          }
        }
      })
      .run();
  });

  it('should allow loading, editing, and saving a new card', () => {
  });

  it('should allow editing while still saving', () => {
  });

  it('should save a dirty card before creating a new one', () => {
  });

  it('should save a dirty card before loading a different one', () => {
  });
});
