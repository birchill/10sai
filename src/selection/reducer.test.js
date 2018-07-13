/* global describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import subject from '../reducer';
import * as editActions from '../edit/actions';
import * as reviewActions from '../review/actions';
import * as routeActions from '../route/actions';
import { generateCards } from '../utils/testing';

describe('reducer:selection', () => {
  it('should initially populate the active card field with undefined', () => {
    const initialState = subject(undefined, { type: 'yer' });

    expect(initialState.selection.activeCardId).toBe(undefined);
  });

  it('should update the active card when a card finishes loading', () => {
    let state = subject(undefined, editActions.loadCard('abc'));
    const card = {
      _id: 'abc',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    state = subject(state, editActions.finishLoadCard(card._id, card));

    expect(state.selection.activeCardId).toBe('abc');
  });

  it('should update the active card when a card finishes saving', () => {
    let state = subject(undefined, editActions.newCard());
    const unsavedId = state.edit.forms.active.formId;

    state = subject(
      state,
      editActions.editCard(unsavedId, { prompt: 'Prompt', answer: 'Answer' })
    );
    state = subject(state, editActions.saveCard(unsavedId));
    state = subject(
      state,
      editActions.finishSaveCard(unsavedId, {
        _id: 'def',
        prompt: 'Prompt',
        answer: 'Answer',
      })
    );

    expect(state.selection.activeCardId).toBe('def');
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

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear the active card when it is deleted', () => {
    let state = subject(undefined, editActions.loadCard('ghi'));
    const card = {
      _id: 'ghi',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    state = subject(state, editActions.finishLoadCard(card._id, card));
    state = subject(state, editActions.deleteCard('ghi', 'ghi'));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear a newly-created active card when it is deleted', () => {
    // The important distinction in this test is that the formId of the active
    // card ends up being the so-called "newId".
    let state = subject(undefined, editActions.newCard(7));

    const card = {
      prompt: 'Prompt',
      answer: 'Answer',
    };
    state = subject(state, editActions.editCard(7, card));
    state = subject(state, editActions.saveCard(7));
    state = subject(
      state,
      editActions.finishSaveCard(7, { ...card, _id: 'ghi' })
    );

    state = subject(state, editActions.deleteCard(7, 'ghi'));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear the active card when it is deleted', () => {
    let state = subject(undefined, editActions.loadCard('ghi'));
    const card = {
      _id: 'ghi',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    state = subject(state, editActions.finishLoadCard(card._id, card));
    state = subject(state, editActions.deleteCard('ghi', 'ghi'));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear the active card when it is deleted through sync', () => {
    let state = subject(undefined, editActions.loadCard('xyz'));
    const card = {
      _id: 'xyz',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    state = subject(state, editActions.finishLoadCard(card._id, card));
    state = subject(
      state,
      editActions.syncEditCard({ ...card, _deleted: true })
    );

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should update the active card when navigating to the review screen', () => {
    let state = subject(undefined, reviewActions.newReview(2, 3, new Date()));
    const cards = generateCards(2, 3);
    state = subject(state, reviewActions.reviewLoaded(cards));
    state = subject(state, routeActions.navigate({ url: '/review' }));

    expect(state.selection.activeCardId).toBe(state.review.currentCard._id);
  });

  it('should clear the active card when navigating to the home screen', () => {
    let state = subject(undefined, reviewActions.newReview(2, 3, new Date()));
    const cards = generateCards(2, 3);
    state = subject(state, reviewActions.reviewLoaded(cards));
    state = subject(state, routeActions.navigate({ url: '/review' }));
    state = subject(state, routeActions.navigate({ url: '/' }));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should update the active card when a review is loaded', () => {
    let state = subject(undefined, routeActions.navigate({ url: '/review' }));
    state = subject(state, reviewActions.newReview(2, 3, new Date()));
    const cards = generateCards(2, 3);
    state = subject(state, reviewActions.reviewLoaded(cards));

    expect(state.selection.activeCardId).toBe(state.review.currentCard._id);
  });

  it('should update the active card when the current review card changes', () => {
    let state = subject(undefined, routeActions.navigate({ url: '/review' }));
    state = subject(state, reviewActions.newReview(2, 3, new Date()));
    const cards = generateCards(2, 3);
    state = subject(state, reviewActions.reviewLoaded(cards));
    state = subject(state, reviewActions.passCard());

    expect(state.selection.activeCardId).toBe(state.review.currentCard._id);
  });

  it('should clear the active card when the current review card is deleted', () => {
    let state = subject(undefined, routeActions.navigate({ url: '/review' }));
    state = subject(state, reviewActions.newReview(2, 3, new Date()));
    const cards = generateCards(2, 3);
    state = subject(state, reviewActions.reviewLoaded(cards));
    state = subject(
      state,
      reviewActions.deleteReviewCard(state.review.currentCard._id)
    );

    expect(state.selection.activeCardId).toBe(undefined);
  });
});
