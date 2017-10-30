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
      actions.newReview(1, 0, reviewTime)
    );
    const cards = getCards(1, 0, reviewTime);
    cards[0].progress.level = 3; // 3 day span
    cards[0].progress.reviewTime = new Date(reviewTime - 5 * MS_PER_DAY);
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
      actions.newReview(1, 0, reviewTime)
    );
    const cards = getCards(1, 0, reviewTime);
    cards[0].progress.level = 3; // 3 day span
    cards[0].progress.reviewTime = new Date(reviewTime - 1 * MS_PER_DAY);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.passCard());

    // Card isn't due for two days but if we just double the interval we'll end
    // up with a level *less* than the current level. Make sure that doesn't
    // happen.
    assert.strictEqual(updatedState.history[0].progress.level, 3);
  });

  it('should update the card level on for a new card on PASS_CARD', () => {
    // TODO
  });

  it('should update the review time on PASS_CARD', () => {
    // TODO
  });

  it('should update the complete count on PASS_CARD', () => {
    // TODO
  });

  it('should NOT update the complete count on PASS_CARD if the card still needs to be reviewed', () => {
    // TODO
  });

  it('should add to the history on PASS_CARD', () => {
    // TODO
  });

  it('should update the current card and next card on PASS_CARD', () => {
    // TODO
  });

  it('should update the current card and next card on PASS_CARD when it is the second last card', () => {
    // TODO
  });

  it('should update the current card and next card on PASS_CARD when it is the last card', () => {
    // TODO
  });

  it('should update the history on PASS_CARD if the card is already in the history', () => {
    // TODO
  });

  it('should update the failed cards queue on FAIL_CARD for a yet unseen card', () => {
    // TODO
  });

  it('should update the failed cards queue on FAIL_CARD for a recently failed card', () => {
    // TODO
  });

  it('should update the failed cards queue on FAIL_CARD for a card that still needs to be reviewed once more', () => {
    // TODO
  });

  it('should update the card level on FAIL_CARD', () => {
    // TODO
  });

  it('should update the review time on FAIL_CARD', () => {
    // TODO
  });

  it('should NOT update the completed count on FAIL_CARD', () => {
    // TODO
  });

  it('should update the history on FAIL_CARD', () => {
    // TODO
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
