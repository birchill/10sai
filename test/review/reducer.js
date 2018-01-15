/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import subject from '../../src/review/reducer';
import ReviewState from '../../src/review-states';
import * as actions from '../../src/review/actions';
import { generateCards } from '../testcommon';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Wrappers that creates a new review, new review time, and the appropriate
// number of cards.

function newReview(maxNewCards, maxCards) {
  const initialState = subject(
    undefined,
    actions.newReview(maxNewCards, maxCards)
  );
  const cards = generateCards(
    maxNewCards,
    maxCards,
    initialState.reviewTime
  );

  return [initialState, cards, initialState.reviewTime];
}

// Wrappers for action creators that also set the random seed values

function reviewLoaded(cards, currentCardSeed, nextCardSeed) {
  const action = actions.reviewLoaded(cards);
  action.currentCardSeed = currentCardSeed;
  action.nextCardSeed = nextCardSeed;
  return action;
}

function passCard(nextCardSeed) {
  const action = actions.passCard();
  action.nextCardSeed = nextCardSeed;
  return action;
}

function failCard(nextCardSeed) {
  const action = actions.failCard();
  action.nextCardSeed = nextCardSeed;
  return action;
}

describe('reducer:review', () => {
  it('should go to the loading state on NEW_REVIEW', () => {
    const updatedState = subject(undefined, actions.newReview(2, 10));

    assert.strictEqual(updatedState.reviewState, ReviewState.LOADING);
    assert.strictEqual(updatedState.maxNewCards, 2);
    assert.strictEqual(updatedState.maxCards, 10);
  });

  it('should go to the loading state on SET_REVIEW_LIMIT', () => {
    const [initialState, cardsIgnored, reviewTime] = newReview(1, 3);

    const updatedState = subject(initialState, actions.setReviewLimit(2, 10));

    assert.strictEqual(updatedState.reviewState, ReviewState.LOADING);
    assert.strictEqual(updatedState.maxNewCards, 2);
    assert.strictEqual(updatedState.maxCards, 10);
    assert.strictEqual(updatedState.reviewTime, reviewTime);
  });

  it('should update the review time on SET_REVIEW_TIME', () => {
    const [initialState, cardsIgnored, initialReviewTime] = newReview(1, 3);
    const newReviewTime = new Date(initialReviewTime + 1 * MS_PER_DAY);

    const updatedState = subject(
      initialState,
      actions.setReviewTime(newReviewTime)
    );

    assert.strictEqual(updatedState.maxNewCards, 1);
    assert.strictEqual(updatedState.maxCards, 3);
    assert.strictEqual(updatedState.reviewTime, newReviewTime);
  });

  it('should update the heap on REVIEW_LOADED', () => {
    const [initialState, cards] = newReview(1, 3);

    const updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    // We should only have the last two cards in the heap since the first card
    // will be the current card.
    assert.deepEqual(updatedState.heap, cards.slice(1));
  });

  it('should go to the COMPLETE state on REVIEW_LOADED if there are no cards', () => {
    const initialState = subject(undefined, actions.newReview(1, 3));

    const updatedState = subject(initialState, actions.reviewLoaded([]));

    assert.strictEqual(updatedState.reviewState, ReviewState.COMPLETE);
    assert.strictEqual(updatedState.currentCard, null, 'Current card');
    assert.strictEqual(updatedState.nextCard, null, 'Next card');
  });

  it('should update the next and current card on REVIEW_LOADED if both are unset', () => {
    const [initialState, cards] = newReview(1, 3);

    const updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    assert.strictEqual(updatedState.reviewState, ReviewState.QUESTION);
    assert.strictEqual(updatedState.currentCard, cards[0], 'Current card');
    assert.strictEqual(updatedState.nextCard, cards[1], 'Next card');
  });

  it('should update the number of new cards in play on REVIEW_LOADED when new cards are selected', () => {
    const [initialState, cards] = newReview(2, 3);

    const updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    assert.strictEqual(updatedState.newCardsInPlay, 1);
  });

  it('should NOT update the number of new cards in play on REVIEW_LOADED when new cards are not selected', () => {
    const [initialState, cards] = newReview(2, 3);

    const updatedState = subject(initialState, reviewLoaded(cards, 0, 0.99));

    assert.strictEqual(updatedState.newCardsInPlay, 0);
  });

  it('should update only the next card on REVIEW_LOADED if the current card is set', () => {
    // Set up a review state where only the current card is set
    const [initialState, cards] = newReview(0, 3);

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
    updatedState = subject(updatedState, reviewLoaded(newCards, 0, 0));

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
    const [initialState, cards] = newReview(1, 3);

    let updatedState = subject(initialState, actions.reviewLoaded([]));
    assert.strictEqual(updatedState.reviewState, ReviewState.COMPLETE);

    updatedState = subject(updatedState, actions.reviewLoaded(cards));

    assert.strictEqual(updatedState.reviewState, ReviewState.QUESTION);
  });

  it('should update the review state on SHOW_ANSWER', () => {
    const [initialState, cards] = newReview(1, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    updatedState = subject(updatedState, actions.showAnswer());

    assert.strictEqual(updatedState.reviewState, ReviewState.ANSWER);
  });

  it('should update the failed cards queues on PASS_CARD for a recently failed card', () => {
    const [initialState, cards] = newReview(1, 3);

    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    assert.deepEqual(
      updatedState.currentCard,
      cards[0],
      'Current card is first card'
    );

    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [cards[0]],
      'First card is added to second failed cards queue'
    );

    updatedState = subject(updatedState, passCard(0));
    assert.deepEqual(
      updatedState.currentCard,
      cards[0],
      'Current card is first card again'
    );

    updatedState = subject(updatedState, passCard(0));

    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [cards[0]],
      'First card is in first failed cards queue'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [],
      'Second failed cards queue is empty'
    );
  });

  it('should update the failed cards queues on PASS_CARD for a card passed once', () => {
    const [initialState, cards] = newReview(1, 3);

    // Load the card...
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    assert.deepEqual(
      updatedState.currentCard,
      cards[0],
      'Current card is first card'
    );

    // Fail it once so it is in the second failure queue...
    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [cards[0]],
      'First card is added to second failed cards queue'
    );
    assert.deepEqual(
      updatedState.currentCard,
      cards[1],
      'Current card is second card'
    );

    // Fail another card so that the first card becomes the current card...
    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.currentCard,
      cards[0],
      'Current card is first card again'
    );

    // Pass the card so that it is in the first failure queue...
    updatedState = subject(updatedState, passCard(0));
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [cards[0]],
      'First card is in first failed cards queue'
    );
    assert.deepEqual(
      updatedState.nextCard,
      cards[0],
      'Next card is first card again'
    );

    // Fail the current card so that the first card becomes the current card...
    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.currentCard,
      cards[0],
      'Current card is first card yet again'
    );

    // Finally, we can test it
    updatedState = subject(updatedState, passCard(0));

    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'First failed cards queue is empty'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [cards[1]],
      'Second failed cards queue contains the second card'
    );
  });

  it('should update the card level for an existing card on PASS_CARD (past due date)', () => {
    const [initialState, cards, reviewTime] = newReview(0, 1);
    cards[0].progress.level = 3; // 3 day span
    cards[0].progress.reviewed = new Date(reviewTime - 5 * MS_PER_DAY);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.passCard());

    // Card was due 5 days ago and we got it right, so the level should go to
    // 10.
    assert.strictEqual(updatedState.history[0].progress.level, 10);
  });

  it('should update the card level for an existing card on PASS_CARD (before due date)', () => {
    const [initialState, cards, reviewTime] = newReview(0, 1);
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
    const [initialState, cards] = newReview(1, 1);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    assert.strictEqual(updatedState.currentCard.progress.level, 0);

    updatedState = subject(updatedState, actions.passCard());

    assert.strictEqual(updatedState.history[0].progress.level, 1);
  });

  it('should update the review time on PASS_CARD', () => {
    const [initialState, cards, reviewTime] = newReview(0, 1);
    cards[0].progress.level = 4;
    cards[0].progress.reviewed = new Date(reviewTime - 10 * MS_PER_DAY);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.passCard());

    assert.strictEqual(updatedState.history[0].progress.reviewed, reviewTime);
  });

  it('should update the complete count on PASS_CARD', () => {
    const [initialState, cards] = newReview(2, 2);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    assert.strictEqual(updatedState.completed, 0, 'Initial completed count');

    updatedState = subject(updatedState, actions.passCard());
    assert.strictEqual(updatedState.completed, 1, 'Count after one card');

    updatedState = subject(updatedState, actions.passCard());
    assert.strictEqual(updatedState.completed, 2, 'Count after two cards');
  });

  it('should NOT update the complete count on PASS_CARD if the card still needs to be reviewed', () => {
    const [initialState, cards] = newReview(1, 1);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    assert.strictEqual(updatedState.completed, 0, 'Initial completed count');

    updatedState = subject(updatedState, actions.failCard());
    assert.isNotNull(
      updatedState.currentCard,
      'Has current card after failing'
    );
    assert.strictEqual(
      updatedState.completed,
      0,
      'Completed count after failing'
    );

    updatedState = subject(updatedState, actions.passCard());
    assert.isNotNull(
      updatedState.currentCard,
      'Has current card after passing failed card once'
    );
    assert.strictEqual(
      updatedState.completed,
      0,
      'Completed count after passing failed card once'
    );

    updatedState = subject(updatedState, actions.passCard());
    assert.isNull(
      updatedState.currentCard,
      'Has no current card after passing ass cards'
    );
    assert.strictEqual(
      updatedState.completed,
      1,
      'Completed count after passing failed card twice'
    );
  });

  it('should add to the history on PASS_CARD', () => {
    const [initialState, cards] = newReview(1, 1);
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
    const [initialState, cards] = newReview(0, 2);
    const firstCard = cards[0];
    const secondCard = cards[1];
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    assert.deepEqual(updatedState.history, [], 'Initial history');
    assert.deepEqual(
      updatedState.currentCard,
      firstCard,
      'Initially first card is current card'
    );

    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.history,
      [firstCard],
      'History after failing first card'
    );

    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.history,
      [secondCard],
      'History after failing second card'
    );
    assert.deepEqual(
      updatedState.currentCard,
      firstCard,
      'First card is current card again'
    );

    updatedState = subject(updatedState, passCard(0));
    assert.deepEqual(
      updatedState.history,
      [firstCard],
      'History after passing first card once'
    );
  });

  it('should update the current card and next card on PASS_CARD', () => {
    const [initialState, cards] = newReview(1, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
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
    const [initialState, cards] = newReview(0, 1);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.failCard());

    assert.deepEqual(updatedState.failedCardsLevel1, [], 'Level 1 cards');
    assert.deepEqual(updatedState.failedCardsLevel2, cards, 'Level 2 cards');
  });

  it('should update the failed cards queue on FAIL_CARD for a recently failed card', () => {
    const [initialState, cards] = newReview(3, 3);

    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'Initial level 1 failed cards list'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [],
      'Initial level 2 failed cards list'
    );

    updatedState = subject(updatedState, failCard(0.5));
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'Level 1 failed cards list after failing one card'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [cards[0]],
      'Level 2 failed cards list after failing one card'
    );

    updatedState = subject(updatedState, failCard(1));
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'Level 1 failed cards list after failing two cards'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [cards[0], cards[1]],
      'Level 2 failed cards list after failing two cards'
    );

    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'Level 1 failed cards list after failing three cards'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [cards[0], cards[1], cards[2]],
      'Level 2 failed cards list after failing three cards'
    );

    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'Level 1 failed cards list after failing the first card again'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [cards[1], cards[2], cards[0]],
      'Level 2 failed cards list after failing the first card again'
    );
  });

  it('should update the failed cards queue on FAIL_CARD for a card that still needs to be reviewed once more', () => {
    const [initialState, cards] = newReview(1, 1);

    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'Initial level 1 failed cards list'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [],
      'Initial level 2 failed cards list'
    );

    updatedState = subject(updatedState, actions.failCard());
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'Level 1 failed cards list after failing one card'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [cards[0]],
      'Level 2 failed cards list after failing one card'
    );

    updatedState = subject(updatedState, actions.passCard());
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [cards[0]],
      'Level 1 failed cards list after passing a failed card once'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [],
      'Level 2 failed cards list after passing a failed card once'
    );

    updatedState = subject(updatedState, actions.failCard());
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'Level 1 failed cards list after failing a once-passed card again'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [cards[0]],
      'Level 2 failed cards list after failing a once-passed card again'
    );

    updatedState = subject(updatedState, actions.failCard());
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'Level 1 failed cards list after failing a once-passed card yet again'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      [cards[0]],
      'Level 2 failed cards list after failing a once-passed card yet again'
    );
  });

  it('should update the card level and review time on FAIL_CARD', () => {
    const [initialState, cards, reviewTime] = newReview(0, 1);
    cards[0].progress.level = 3;
    cards[0].progress.reviewed = new Date(reviewTime - 5 * MS_PER_DAY);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.failCard());

    assert.strictEqual(updatedState.failedCardsLevel2[0].progress.level, 0);
    assert.strictEqual(
      updatedState.failedCardsLevel2[0].progress.reviewed,
      reviewTime
    );
  });

  it('should NOT update the completed count on FAIL_CARD', () => {
    const [initialState, cards] = newReview(0, 1);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    assert.strictEqual(updatedState.completed, 0, 'Initial completed count');

    updatedState = subject(updatedState, actions.failCard());

    assert.strictEqual(updatedState.completed, 0, 'Updated completed count');
  });

  it('should update the history on FAIL_CARD', () => {
    const [initialState, cards] = newReview(0, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    assert.strictEqual(
      updatedState.history.length,
      0,
      'Initial history length'
    );

    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.history,
      [cards[0]],
      'History after first fail'
    );
    assert.deepEqual(
      updatedState.nextCard,
      cards[0],
      'Should have loaded the originally failed card as the next card'
    );

    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.history,
      [cards[1]],
      'History after second fail'
    );
    assert.deepEqual(
      updatedState.currentCard,
      cards[0],
      'Should have loaded the originally failed card as the next card'
    );
    assert.deepEqual(
      updatedState.nextCard,
      cards[1],
      'Should have loaded the second failed card as the next card'
    );
  });

  it('should update the current card and next card on FAIL_CARD when it is the second last card', () => {
    const [initialState, cards] = newReview(0, 2);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    updatedState = subject(updatedState, failCard(0));
    assert.deepEqual(
      updatedState.currentCard,
      cards[1],
      'Current card should be second card'
    );
    assert.deepEqual(
      updatedState.nextCard,
      cards[0],
      'Next card should be first card'
    );
  });

  it('should update the current card and next card on FAIL_CARD when it is the last card', () => {
    const [initialState, cards] = newReview(0, 1);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    updatedState = subject(updatedState, failCard(0));
    assert.strictEqual(updatedState.reviewState, ReviewState.QUESTION);
    assert.deepEqual(
      updatedState.currentCard,
      cards[0],
      'Current card should be the same card'
    );
    assert.deepEqual(updatedState.nextCard, null, 'Next card should be null');
    assert.deepEqual(
      updatedState.failedCardsLevel2,
      cards,
      'Card should be in second failed cards list'
    );
    assert.deepEqual(
      updatedState.failedCardsLevel1,
      [],
      'First failed cards list should empty'
    );
  });
});
