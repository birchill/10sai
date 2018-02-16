/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { expectSaga } from 'redux-saga-test-plan';
import reducer from '../../src/reducer';
import editSagas from '../../src/edit/sagas';
import * as editActions from '../../src/edit/actions';
// XXX Re-enable the following
// import * as routeActions from '../../src/route/actions';
import EditState from '../../src/edit/states';

describe('integration:edit', () => {
  it('should allow creating and saving a new card', () => {
    const store = { cards: { putCard: card => ({ ...card, _id: 'abc' }) } };
    const formId = 12;
    global.location = {
      pathname: '/cards/abc',
      search: '',
      hash: '',
    };

    let state = reducer(undefined, editActions.newCard(formId));
    state = reducer(state, editActions.editCard(formId, { prompt: 'Prompt' }));
    state = reducer(state, editActions.editCard(formId, { answer: 'Answer' }));
    state = reducer(state, { type: 'UPDATE_URL', url: '/cards/abc' });

    return (
      expectSaga(editSagas, store)
        // Danger -- withReducer must come before withState!
        .withReducer(reducer)
        .withState(state)
        .dispatch(editActions.saveEditCard(formId))
        .hasFinalState({
          ...state,
          route: {
            index: 0,
            history: [
              {
                screen: 'edit-card',
                card: 'abc',
              },
            ],
          },
          edit: {
            forms: {
              active: {
                formId: 'abc',
                editState: EditState.OK,
                card: {
                  _id: 'abc',
                  prompt: 'Prompt',
                  answer: 'Answer',
                },
              },
            },
          },
          selection: { activeCardId: 'abc' },
        })
        .silentRun(100)
    );
  });

  it('should allow loading, editing, and saving a new card', () => {
    /*
    const originalCard = { _id: 'abc', prompt: 'Prompt', answer: 'Answer' };
    const cardStore = {
      putCard: card => card,
      getCard: () => originalCard,
    };
    const formId = 18;

    let initialState = reducer(undefined, {});

    return expectSaga(editSagas, cardStore)
      .withReducer(reducer)
      .dispatch(routeActions.navigate('/cards/123'))
      // XXX Need to delay the following until the card has loaded
      .dispatch(editActions.editCard('123', { prompt: 'Updated prompt'}))
      // XXX Need to delay the following until the above has completed
      .dispatch(editActions.saveEditCard('123'))
      .hasFinalState({
        // XXX Need to reflect updated route state here
        ...initialState,
        edit: {
          forms: {
            active: {
              formId: '123',
              editState: EditState.OK,
              card: {
                _id: '123',
                prompt: 'Updated prompt',
                answer: 'Answer',
              }
            }
          }
        }
      })
      .run();
    */
  });

  it('should allow editing while still saving', () => {});

  it('should save a dirty card before creating a new one', () => {});

  it('should save a dirty card before loading a different one', () => {});
});
