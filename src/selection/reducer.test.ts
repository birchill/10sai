/* global describe, expect, it */

import { reducer as subject } from '../reducer';
import * as Actions from '../actions';
import { generateCards } from '../utils/testing';
import { Card } from '../model';

describe('reducer:selection', () => {
  it('should initially populate the active card field with undefined', () => {
    const initialState = subject(undefined, ({
      type: 'yer',
    } as unknown) as Actions.Action);

    expect(initialState.selection.activeCardId).toBe(undefined);
  });

  it('should update the active card when a card finishes loading', () => {
    let state = subject(undefined, Actions.loadCard('abc'));
    const formId = state.edit.forms.active.formId;
    const card = {
      _id: 'abc',
      question: 'Prompt',
      answer: 'Answer',
    } as Card;

    state = subject(state, Actions.finishLoadCard(formId, card));

    expect(state.selection.activeCardId).toBe('abc');
  });

  it('should update the active card when a card finishes saving', () => {
    let state = subject(undefined, Actions.newCard());
    const formId = state.edit.forms.active.formId;

    state = subject(
      state,
      Actions.editCard(formId, { question: 'Prompt', answer: 'Answer' })
    );
    state = subject(state, Actions.saveCard(formId));
    state = subject(
      state,
      Actions.finishSaveCard(formId, {
        _id: 'def',
        question: 'Prompt',
        answer: 'Answer',
      })
    );

    expect(state.selection.activeCardId).toBe('def');
  });

  it('should clear the active card when a new card is started', () => {
    let state = subject(undefined, Actions.loadCard('tuv'));
    const formId = state.edit.forms.active.formId;
    const card = {
      _id: 'tuv',
      question: 'Prompt',
      answer: 'Answer',
    } as Card;

    state = subject(state, Actions.finishLoadCard(formId, card));
    state = subject(state, Actions.newCard());

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear the active card when it is deleted', () => {
    let state = subject(undefined, Actions.loadCard('ghi'));
    const formId = state.edit.forms.active.formId;
    const card = {
      _id: 'ghi',
      question: 'Prompt',
      answer: 'Answer',
    } as Card;

    state = subject(state, Actions.finishLoadCard(formId, card));
    state = subject(state, Actions.deleteCard(formId, 'ghi'));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear a newly-created active card when it is deleted', () => {
    let state = subject(undefined, Actions.newCard(7));

    const card = {
      prompt: 'Prompt',
      answer: 'Answer',
    };
    state = subject(state, Actions.editCard(7, card));
    state = subject(state, Actions.saveCard(7));
    state = subject(state, Actions.finishSaveCard(7, { ...card, _id: 'ghi' }));

    state = subject(state, Actions.deleteCard(7, 'ghi'));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear the active card when it is deleted', () => {
    let state = subject(undefined, Actions.loadCard('ghi'));
    const formId = state.edit.forms.active.formId;
    const card = {
      _id: 'ghi',
      question: 'Prompt',
      answer: 'Answer',
    } as Card;

    state = subject(state, Actions.finishLoadCard(formId, card));
    state = subject(state, Actions.deleteCard(formId, 'ghi'));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear the active card when it is deleted through sync', () => {
    let state = subject(undefined, Actions.loadCard('xyz'));
    const formId = state.edit.forms.active.formId;
    const card = {
      _id: 'xyz',
      question: 'Prompt',
      answer: 'Answer',
    } as Card;

    state = subject(state, Actions.finishLoadCard(formId, card));
    state = subject(state, Actions.syncEditCard({ card, deleted: true }));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should update the active card when navigating to the review screen', () => {
    let state = subject(undefined, Actions.newReview(2, 3));
    const cards = generateCards(2, 3);
    state = subject(state, Actions.reviewLoaded(cards));
    state = subject(state, Actions.navigate({ url: '/review' }));

    expect(state.selection.activeCardId).toBe(state.review.currentCard!._id);
  });

  it('should clear the active card when navigating to the home screen', () => {
    let state = subject(undefined, Actions.newReview(2, 3));
    const cards = generateCards(2, 3);
    state = subject(state, Actions.reviewLoaded(cards));
    state = subject(state, Actions.navigate({ url: '/review' }));
    state = subject(state, Actions.navigate({ url: '/' }));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should update the active card when a review is loaded', () => {
    let state = subject(undefined, Actions.navigate({ url: '/review' }));
    state = subject(state, Actions.newReview(2, 3));
    const cards = generateCards(2, 3);
    state = subject(state, Actions.reviewLoaded(cards));

    expect(state.selection.activeCardId).toBe(state.review.currentCard!._id);
  });

  it('should update the active card when the current review card changes', () => {
    let state = subject(undefined, Actions.navigate({ url: '/review' }));
    state = subject(state, Actions.newReview(2, 3));
    const cards = generateCards(2, 3);
    state = subject(state, Actions.reviewLoaded(cards));
    state = subject(state, Actions.passCard());

    expect(state.selection.activeCardId).toBe(state.review.currentCard!._id);
  });

  it('should clear the active card when the current review card is deleted', () => {
    let state = subject(undefined, Actions.navigate({ url: '/review' }));
    state = subject(state, Actions.newReview(2, 3));
    const cards = generateCards(2, 3);
    state = subject(state, Actions.reviewLoaded(cards));
    state = subject(
      state,
      Actions.deleteReviewCard(state.review.currentCard!._id)
    );

    expect(state.selection.activeCardId).toBe(undefined);
  });
});
