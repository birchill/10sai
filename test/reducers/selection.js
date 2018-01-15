/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import subject from '../../src/reducers/index';
import * as editActions from '../../src/actions/edit';
import * as reviewActions from '../../src/review/actions';
import * as routeActions from '../../src/actions/route';
import { generateCards } from '../testcommon';

describe('reducer:selection', () => {
  it('should initially populate the active card field with undefined', () => {
    const initialState = subject(undefined, { type: 'yer' });

    assert.strictEqual(initialState.selection.activeCardId, undefined);
  });

  it('should update the active card when a card finishes loading', () => {
    let state = subject(undefined, editActions.loadCard('abc'));
    const card = {
      _id: 'abc',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    state = subject(state, editActions.finishLoadCard(card._id, card));

    assert.strictEqual(state.selection.activeCardId, 'abc');
  });

  it('should update the active card when a card finishes saving', () => {
    let state = subject(undefined, editActions.newCard());
    const unsavedId = state.edit.forms.active.formId;

    state = subject(
      state,
      editActions.editCard(unsavedId, { prompt: 'Prompt', answer: 'Answer' })
    );
    state = subject(state, editActions.saveEditCard(unsavedId));
    state = subject(
      state,
      editActions.finishSaveCard(unsavedId, {
        _id: 'def',
        prompt: 'Prompt',
        answer: 'Answer',
      })
    );

    assert.strictEqual(state.selection.activeCardId, 'def');
  });

  it('should clear the active card when a new card is started', () => {
    let state = subject(undefined, editActions.loadCard('tuv'));
    const card = {
      _id: 'tuv',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    state = subject(state, editActions.finishLoadCard(card._id, card));
    state = subject(state, editActions.newCard());

    assert.strictEqual(state.selection.activeCardId, undefined);
  });

  it('should clear the active card when it is deleted', () => {
    let state = subject(undefined, editActions.loadCard('ghi'));
    const card = {
      _id: 'ghi',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    state = subject(state, editActions.finishLoadCard(card._id, card));
    state = subject(state, editActions.deleteEditCard('ghi'));

    assert.strictEqual(state.selection.activeCardId, undefined);
  });

  it('should clear the active card when it is deleted through sync', () => {
    let state = subject(undefined, editActions.loadCard('xyz'));
    const card = {
      _id: 'xyz',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    state = subject(state, editActions.finishLoadCard(card._id, card));
    state = subject(state, editActions.syncEditCard({ ...card, _deleted: true }));

    assert.strictEqual(state.selection.activeCardId, undefined);
  });

  it('should update the active card when navigating to the review screen', () => {
    let state = subject(undefined, reviewActions.newReview(2, 3, new Date()));
    const cards = generateCards(2, 3);
    state = subject(state, reviewActions.reviewLoaded(cards));
    state = subject(state, routeActions.navigate({ url: '/review' }));

    assert.strictEqual(
      state.selection.activeCardId,
      state.review.currentCard._id
    );
  });

  it('should clear the active card when navigating to the home screen', () => {
    let state = subject(undefined, reviewActions.newReview(2, 3, new Date()));
    const cards = generateCards(2, 3);
    state = subject(state, reviewActions.reviewLoaded(cards));
    state = subject(state, routeActions.navigate({ url: '/review' }));
    state = subject(state, routeActions.navigate({ url: '/' }));

    assert.strictEqual(state.selection.activeCardId, undefined);
  });

  it('should update the active card when a review is loaded', () => {
    let state = subject(undefined, routeActions.navigate({ url: '/review' }));
    state = subject(state, reviewActions.newReview(2, 3, new Date()));
    const cards = generateCards(2, 3);
    state = subject(state, reviewActions.reviewLoaded(cards));

    assert.strictEqual(
      state.selection.activeCardId,
      state.review.currentCard._id
    );
  });

  it('should update the active card when the current review card changes', () => {
    let state = subject(undefined, routeActions.navigate({ url: '/review' }));
    state = subject(state, reviewActions.newReview(2, 3, new Date()));
    const cards = generateCards(2, 3);
    state = subject(state, reviewActions.reviewLoaded(cards));
    state = subject(state, reviewActions.passCard());

    assert.strictEqual(
      state.selection.activeCardId,
      state.review.currentCard._id
    );
  });
});
