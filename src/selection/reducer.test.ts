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
      id: 'abc',
      front: 'Question',
      back: 'Answer',
    } as Card;

    state = subject(state, Actions.finishLoadCard(formId, card));

    expect(state.selection.activeCardId).toBe('abc');
  });

  it('should update the active card when a card finishes saving', () => {
    let state = subject(undefined, Actions.newCard());
    const formId = state.edit.forms.active.formId;

    state = subject(
      state,
      Actions.editCard(formId, { front: 'Question', back: 'Answer' })
    );
    state = subject(state, Actions.saveCard(formId));
    state = subject(
      state,
      Actions.finishSaveCard(formId, {
        id: 'def',
        front: 'Question',
        back: 'Answer',
      })
    );

    expect(state.selection.activeCardId).toBe('def');
  });

  it('should clear the active card when a new card is started', () => {
    let state = subject(undefined, Actions.loadCard('tuv'));
    const formId = state.edit.forms.active.formId;
    const card = {
      id: 'tuv',
      front: 'Question',
      back: 'Answer',
    } as Card;

    state = subject(state, Actions.finishLoadCard(formId, card));
    state = subject(state, Actions.newCard());

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear the active card when it is deleted', () => {
    let state = subject(undefined, Actions.loadCard('ghi'));
    const formId = state.edit.forms.active.formId;
    const card = {
      id: 'ghi',
      front: 'Question',
      back: 'Answer',
    } as Card;

    state = subject(state, Actions.finishLoadCard(formId, card));
    state = subject(state, Actions.deleteCard(formId, 'ghi'));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear a newly-created active card when it is deleted', () => {
    let state = subject(undefined, Actions.newCard(undefined, 7));

    const card = {
      front: 'Question',
      back: 'Answer',
    };
    state = subject(state, Actions.editCard(7, card));
    state = subject(state, Actions.saveCard(7));
    state = subject(state, Actions.finishSaveCard(7, { ...card, id: 'ghi' }));

    state = subject(state, Actions.deleteCard(7, 'ghi'));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear the active card when it is deleted', () => {
    let state = subject(undefined, Actions.loadCard('ghi'));
    const formId = state.edit.forms.active.formId;
    const card = {
      id: 'ghi',
      front: 'Question',
      back: 'Answer',
    } as Card;

    state = subject(state, Actions.finishLoadCard(formId, card));
    state = subject(state, Actions.deleteCard(formId, 'ghi'));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should clear the active card when it is deleted through sync', () => {
    let state = subject(undefined, Actions.loadCard('xyz'));
    const formId = state.edit.forms.active.formId;
    const card = {
      id: 'xyz',
      front: 'Question',
      back: 'Answer',
    } as Card;

    state = subject(state, Actions.finishLoadCard(formId, card));
    state = subject(state, Actions.syncEditCard({ card, deleted: true }));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should update the active card when navigating to the review screen', () => {
    let state = subject(
      undefined,
      Actions.newReview({ maxNewCards: 2, maxCards: 3 })
    );
    const { newCards, overdue } = generateCards({
      maxNewCards: 2,
      maxCards: 3,
    });
    state = subject(
      state,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );
    state = subject(state, Actions.navigate({ url: '/review' }));

    const currentCard = state.review.queue[state.review.position].card;
    expect(state.selection.activeCardId).toBe(currentCard.id);
  });

  it('should clear the active card when navigating to the home screen', () => {
    let state = subject(
      undefined,
      Actions.newReview({ maxNewCards: 2, maxCards: 3 })
    );
    const { newCards, overdue } = generateCards({
      maxNewCards: 2,
      maxCards: 3,
    });
    state = subject(
      state,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );
    state = subject(state, Actions.navigate({ url: '/review' }));
    state = subject(state, Actions.navigate({ url: '/' }));

    expect(state.selection.activeCardId).toBe(undefined);
  });

  it('should update the active card when a review is loaded', () => {
    let state = subject(undefined, Actions.navigate({ url: '/review' }));
    state = subject(state, Actions.newReview({ maxNewCards: 2, maxCards: 3 }));
    const { newCards, overdue } = generateCards({
      maxNewCards: 2,
      maxCards: 3,
    });
    state = subject(
      state,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    const currentCard = state.review.queue[state.review.position].card;
    expect(state.selection.activeCardId).toBe(currentCard.id);
  });

  it('should update the active card when the current review card changes', () => {
    let state = subject(undefined, Actions.navigate({ url: '/review' }));
    state = subject(state, Actions.newReview({ maxNewCards: 2, maxCards: 3 }));
    const { newCards, overdue } = generateCards({
      maxNewCards: 2,
      maxCards: 3,
    });
    state = subject(
      state,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );
    state = subject(state, Actions.passCard());

    const currentCard = state.review.queue[state.review.position].card;
    expect(state.selection.activeCardId).toBe(currentCard.id);
  });

  it('should clear the active card when the current review card is deleted', () => {
    let state = subject(undefined, Actions.navigate({ url: '/review' }));
    state = subject(state, Actions.newReview({ maxNewCards: 2, maxCards: 3 }));
    const { newCards, overdue } = generateCards({
      maxNewCards: 2,
      maxCards: 3,
    });
    state = subject(
      state,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );
    const currentCard = state.review.queue[state.review.position].card;
    state = subject(state, Actions.deleteReviewCard({ id: currentCard.id }));

    expect(state.selection.activeCardId).toBe(undefined);
  });
});
