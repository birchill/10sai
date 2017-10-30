/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import subject from '../../src/reducers/review';
import ReviewState from '../../src/review-states';
import * as actions from '../../src/actions/review';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getCards(maxNewCards, maxExistingCards, reviewTime) {
  const cards = new Array(Math.max(maxNewCards, maxExistingCards));
  for (let i = 0; i < cards.length; i++) {
    const newCard = i < maxNewCards;
    cards[i] = {
      question: `Question ${i + 1}`,
      answer: `Answer ${i + 1}`,
      progress: {
        level: newCard ? 0 : 1,
        reviewed: newCard ? null : new Date(reviewTime - 3 * MS_PER_DAY),
      },
    };
  }
  return cards;
}

describe('reducer:review', () => {
  it('should go to the loading state on NEW_REVIEW', () => {
    const updatedState = subject(
      undefined,
      actions.newReview(2, 10, new Date())
    );
    assert.strictEqual(updatedState.reviewState, ReviewState.LOADING);
    assert.strictEqual(updatedState.maxCards, 10);
    assert.strictEqual(updatedState.maxNewCards, 2);
  });

  it('should update the heap on REVIEW_LOADED', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(1, 3, reviewTime)
    );
    const cards = getCards(1, 3, reviewTime);

    // Make the cards we choose deterministic
    const action = actions.reviewLoaded(cards);
    action.currentCardSeed = 0;
    action.nextCardSeed = 0;
    const updatedState = subject(initialState, action);

    // We should only have the last two cards in the heap since the first card
    // will be the current card.
    assert.deepEqual(updatedState.heap, cards.slice(1));
  });

  it('should go to the COMPLETE state on REVIEW_LOADED if there are no cards', () => {
    const initialState = subject(
      undefined,
      actions.newReview(1, 3, new Date())
    );

    const updatedState = subject(initialState, actions.reviewLoaded([]));

    assert.strictEqual(updatedState.reviewState, ReviewState.COMPLETE);
    assert.strictEqual(updatedState.currentCard, null, 'Current card');
    assert.strictEqual(updatedState.nextCard, null, 'Next card');
  });

  it('should update the next and current card on REVIEW_LOADED if both are unset', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(1, 3, reviewTime)
    );
    const cards = getCards(1, 3, reviewTime);
    const action = actions.reviewLoaded(cards);
    action.currentCardSeed = 0;
    action.nextCardSeed = 0;

    const updatedState = subject(initialState, action);

    assert.strictEqual(updatedState.reviewState, ReviewState.QUESTION);
    assert.strictEqual(updatedState.currentCard, cards[0], 'Current card');
    assert.strictEqual(updatedState.nextCard, cards[1], 'Next card');
  });

  it('should update the number of new cards in play on REVIEW_LOADED when new cards are selected', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(2, 3, reviewTime)
    );
    const cards = getCards(2, 3, reviewTime);
    const action = actions.reviewLoaded(cards);
    action.currentCardSeed = 0;
    action.nextCardSeed = 0;

    const updatedState = subject(initialState, action);

    assert.strictEqual(updatedState.newCardsInPlay, 1);
  });

  it('should NOT update the number of new cards in play on REVIEW_LOADED when new cards are not selected', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(2, 3, reviewTime)
    );
    const cards = getCards(2, 3, reviewTime);
    const action = actions.reviewLoaded(cards);
    action.currentCardSeed = 0;
    action.nextCardSeed = 0.99;

    const updatedState = subject(initialState, action);

    assert.strictEqual(updatedState.newCardsInPlay, 0);
  });

  it('should update only the next card on REVIEW_LOADED if the current card is set', () => {
    // Set up a review state where only the current card is set
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(0, 3, reviewTime)
    );
    const cards = getCards(0, 3, reviewTime);
    const originalCard = cards[0];
    const originalLoad = actions.reviewLoaded([originalCard]);
    let updatedState = subject(initialState, originalLoad);
    assert.strictEqual(
      updatedState.currentCard,
      originalCard,
      'Current card after first load'
    );
    assert.strictEqual(
      updatedState.nextCard,
      null,
      'Next card after first load'
    );

    // Then load the review again
    const newCards = cards.slice(1);
    const secondLoad = actions.reviewLoaded(newCards);
    secondLoad.currentCardSeed = 0;
    secondLoad.nextCardSeed = 0;
    updatedState = subject(updatedState, secondLoad);

    assert.strictEqual(
      updatedState.currentCard,
      originalCard,
      'Current card after second load'
    );
    assert.strictEqual(
      updatedState.nextCard,
      newCards[0],
      'Next card after second load'
    );
  });

  it('should go to the QUESTION state on REVIEW_LOADED if it was completed but there are more cards', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(1, 3, reviewTime)
    );
    let updatedState = subject(initialState, actions.reviewLoaded([]));
    assert.strictEqual(updatedState.reviewState, ReviewState.COMPLETE);
    const cards = getCards(1, 3, reviewTime);

    updatedState = subject(updatedState, actions.reviewLoaded(cards));

    assert.strictEqual(updatedState.reviewState, ReviewState.QUESTION);
  });

  it('should update the failed cards queues on PASS_CARD for a recently failed card', () => {
    // TODO
  });

  it('should update the failed cards queues on PASS_CARD for a card passed once', () => {
    // TODO
  });

  it('should update the card level for an existing card on PASS_CARD (past due date)', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(0, 1, reviewTime)
    );
    const cards = getCards(0, 1, reviewTime);
    cards[0].progress.level = 3; // 3 day span
    cards[0].progress.reviewed = new Date(reviewTime - 5 * MS_PER_DAY);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.passCard());

    // Card was due 5 days ago and we got it right, so the level should go to
    // 10.
    assert.strictEqual(updatedState.history[0].progress.level, 10);
  });

  it('should update the card level for an existing card on PASS_CARD (before due date)', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(0, 1, reviewTime)
    );
    const cards = getCards(0, 1, reviewTime);
    cards[0].progress.level = 3; // 3 day span
    cards[0].progress.reviewed = new Date(reviewTime - 1 * MS_PER_DAY);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.passCard());

    // Card isn't due for two days but if we just double the interval we'll end
    // up with a level *less* than the current level. Make sure that doesn't
    // happen.
    assert.strictEqual(updatedState.history[0].progress.level, 3);
  });

  it('should update the card level on for a new card on PASS_CARD', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(1, 1, reviewTime)
    );
    const cards = getCards(1, 1, reviewTime);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    assert.strictEqual(updatedState.currentCard.progress.level, 0);

    updatedState = subject(updatedState, actions.passCard());

    assert.strictEqual(updatedState.history[0].progress.level, 1);
  });

  it('should update the review time on PASS_CARD', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(0, 1, reviewTime)
    );
    const cards = getCards(0, 1, reviewTime);
    cards[0].progress.level = 4;
    cards[0].progress.reviewed = new Date(reviewTime - 10 * MS_PER_DAY);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.passCard());

    assert.strictEqual(updatedState.history[0].progress.reviewed, reviewTime);
  });

  it('should update the complete count on PASS_CARD', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(2, 2, reviewTime)
    );
    const cards = getCards(2, 2, reviewTime);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    assert.strictEqual(updatedState.completed, 0, 'Initial completed count');

    updatedState = subject(updatedState, actions.passCard());
    assert.strictEqual(updatedState.completed, 1, 'Count after one card');

    updatedState = subject(updatedState, actions.passCard());
    assert.strictEqual(updatedState.completed, 2, 'Count after two cards');
  });

  it('should NOT update the complete count on PASS_CARD if the card still needs to be reviewed', () => {
    // TODO
  });

  it('should add to the history on PASS_CARD', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(1, 1, reviewTime)
    );
    const cards = getCards(1, 1, reviewTime);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    assert.strictEqual(updatedState.history.length, 0, 'Initial history');

    updatedState = subject(updatedState, actions.passCard());
    assert.strictEqual(
      updatedState.history.length,
      1,
      'History length after passing'
    );
    assert.deepEqual(updatedState.history[0], cards[0], 'Card in history');
  });

  it('should update the history on PASS_CARD if the card is already in the history', () => {
    // TODO
  });

  it('should update the current card and next card on PASS_CARD', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(1, 3, reviewTime)
    );

    const cards = getCards(1, 3, reviewTime);
    const loadAction = actions.reviewLoaded(cards);
    loadAction.nextCardSeed = 0;
    loadAction.currentCardSeed = 0;
    let updatedState = subject(initialState, loadAction);
    assert.deepEqual(
      updatedState.currentCard,
      cards[0],
      'Initial current card'
    );
    assert.deepEqual(updatedState.nextCard, cards[1], 'Initial next card');

    updatedState = subject(updatedState, actions.passCard());
    assert.deepEqual(
      updatedState.currentCard,
      cards[1],
      'Updated current card after first pass'
    );
    assert.deepEqual(
      updatedState.nextCard,
      cards[2],
      'Updated next card after first pass'
    );

    updatedState = subject(updatedState, actions.passCard());
    assert.deepEqual(
      updatedState.currentCard,
      cards[2],
      'Updated current card after second pass'
    );
    assert.strictEqual(
      updatedState.nextCard,
      null,
      'Updated next card after second pass'
    );

    updatedState = subject(updatedState, actions.passCard());
    assert.deepEqual(
      updatedState.currentCard,
      null,
      'Updated current card after third pass'
    );
    assert.strictEqual(
      updatedState.nextCard,
      null,
      'Updated next card after third pass'
    );
  });

  it('should update the failed cards queue on FAIL_CARD for a yet unseen card', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(0, 1, reviewTime)
    );
    const cards = getCards(0, 1, reviewTime);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.failCard());

    assert.deepEqual(updatedState.failedCardsLevel1, [], 'Level 1 cards');
    assert.deepEqual(updatedState.failedCardsLevel2, cards, 'Level 2 cards');
  });

  it('should update the failed cards queue on FAIL_CARD for a recently failed card', () => {
    // TODO
  });

  it('should update the failed cards queue on FAIL_CARD for a card that still needs to be reviewed once more', () => {
    // TODO
  });

  it('should update the card level and review time on FAIL_CARD', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(0, 1, reviewTime)
    );
    const cards = getCards(0, 1, reviewTime);
    cards[0].progress.level = 3;
    cards[0].progress.reviewed = new Date(reviewTime - 5 * MS_PER_DAY);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.failCard());

    assert.strictEqual(updatedState.history[0].progress.level, 0);
    assert.strictEqual(updatedState.history[0].progress.reviewed, reviewTime);
  });

  it('should NOT update the completed count on FAIL_CARD', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(0, 1, reviewTime)
    );
    const cards = getCards(0, 1, reviewTime);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    assert.strictEqual(updatedState.completed, 0, 'Initial completed count');

    updatedState = subject(updatedState, actions.failCard());

    assert.strictEqual(updatedState.completed, 0, 'Updated completed count');
  });

  it('should update the history on FAIL_CARD', () => {
    const reviewTime = new Date();
    const initialState = subject(
      undefined,
      actions.newReview(0, 3, reviewTime)
    );
    const cards = getCards(0, 3, reviewTime);
    const loadAction = actions.reviewLoaded(cards);
    loadAction.currentCardSeed = 0;
    loadAction.nextCardSeed = 0;
    let updatedState = subject(initialState, loadAction);
    assert.strictEqual(
      updatedState.history.length,
      0,
      'Initial history length'
    );

    const failAction = actions.failCard();
    failAction.nextCardSeed = 0;
    updatedState = subject(updatedState, actions.failCard());

    assert.deepEqual(
      updatedState.history,
      [cards[0]],
      'History after first fail'
    );

    updatedState = subject(updatedState, actions.failCard());
    assert.deepEqual(
      updatedState.history,
      [cards[0], cards[1]],
      'History after first fail'
    );
    // TODO Actually this might be wrong---need to actually implement the failed
    // queues part first
    /*
    assert.deepEqual(updatedState.nextCard, cards[0],
      'Should have loaded the originally failed card as the current card');
    */
  });

  it('should update the current card and next card on FAIL_CARD when it is the second last card', () => {
    // TODO
  });

  it('should update the current card and next card on FAIL_CARD when it is the last card', () => {
    // TODO
  });
});

// TODO: Tests for SET_REVIEW_LIMIT
// TODO: Tests for SET_REVIEW_TIME
// TODO: There's lots of repeated code in the above tests--factor it out better
