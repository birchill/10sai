// @format
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
    assert(updatedState.reviewState === ReviewState.LOADING);
    assert(updatedState.maxCards === 10);
    assert(updatedState.maxNewCards === 2);
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

  it('should go to the COMPLETE state on REVIEW_LOADED if there are no cards', () => {});

  it('should update the next and current card on REVIEW_LOADED if both are unset', () => {});

  it('should update the number of new cards in play on REVIEW_LOADED when new cards are selected', () => {});

  it('should update only the next card on REVIEW_LOADED if the current card is set', () => {});

  it('should prefer choosing new cards to existing cards on REVIEW_LOADED', () => {});

  it('should got to the QUESTION state on REVIEW_LOADED if it was completed but there are more cards', () => {});
});
