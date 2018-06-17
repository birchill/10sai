/* global describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import { review as subject, ReviewState } from './reducer';
import ReviewPhase from './ReviewPhase';
import * as actions from './actions';
import { getReviewSummary } from './selectors';
import { generateCards } from '../../test/testcommon';
import { Card } from '../model';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Wrappers that creates a new review, new review time, and the appropriate
// number of cards.

function newReview(maxNewCards, maxCards): [ReviewState, Card[], Date] {
  const initialState = subject(
    undefined,
    actions.newReview(maxNewCards, maxCards)
  );
  const cards = generateCards(
    maxNewCards,
    maxCards,
    initialState.reviewTime.getTime()
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

function deleteReviewCard(id, nextCardSeed) {
  const action = actions.deleteReviewCard(id);
  action.nextCardSeed = nextCardSeed;
  return action;
}

describe('reducer:review', () => {
  it('should go to the loading state on NEW_REVIEW', () => {
    const updatedState = subject(undefined, actions.newReview(2, 10));

    expect(updatedState.phase).toBe(ReviewPhase.LOADING);
    expect(updatedState.maxNewCards).toBe(2);
    expect(updatedState.maxCards).toBe(10);
  });

  it('should go to the loading state on SET_REVIEW_LIMIT', () => {
    const [initialState, cardsIgnored, reviewTime] = newReview(1, 3);

    const updatedState = subject(initialState, actions.setReviewLimit(2, 10));

    expect(updatedState.phase).toBe(ReviewPhase.LOADING);
    expect(updatedState.maxNewCards).toBe(2);
    expect(updatedState.maxCards).toBe(10);
    expect(updatedState.reviewTime).toBe(reviewTime);
  });

  it('should update the review time on SET_REVIEW_TIME', () => {
    const [initialState, cardsIgnored, initialReviewTime] = newReview(1, 3);
    const newReviewTime = new Date(
      initialReviewTime.getTime() + 1 * MS_PER_DAY
    );

    const updatedState = subject(
      initialState,
      actions.setReviewTime(newReviewTime)
    );

    expect(updatedState.maxNewCards).toBe(1);
    expect(updatedState.maxCards).toBe(3);
    expect(updatedState.reviewTime).toBe(newReviewTime);
  });

  it('should update the heap on REVIEW_LOADED', () => {
    const [initialState, cards] = newReview(1, 3);

    const updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    // We should only have the last two cards in the heap since the first card
    // will be the current card.
    expect(updatedState.heap).toEqual(cards.slice(1));
  });

  it('should go to the COMPLETE state on REVIEW_LOADED if there are no cards', () => {
    const initialState = subject(undefined, actions.newReview(1, 3));

    const updatedState = subject(initialState, actions.reviewLoaded([]));

    expect(updatedState.phase).toBe(ReviewPhase.COMPLETE);
    expect(updatedState.currentCard).toBe(null);
    expect(updatedState.nextCard).toBe(null);
  });

  it('should update the next and current card on REVIEW_LOADED if both are unset', () => {
    const [initialState, cards] = newReview(1, 3);

    const updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    expect(updatedState.phase).toBe(ReviewPhase.QUESTION);
    expect(updatedState.currentCard).toBe(cards[0]);
    expect(updatedState.nextCard).toBe(cards[1]);
  });

  it('should update the number of new cards in play on REVIEW_LOADED when new cards are selected', () => {
    const [initialState, cards] = newReview(2, 3);

    const updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    expect(updatedState.newCardsInPlay).toBe(1);
  });

  it('should NOT update the number of new cards in play on REVIEW_LOADED when new cards are not selected', () => {
    const [initialState, cards] = newReview(2, 3);

    const updatedState = subject(initialState, reviewLoaded(cards, 0, 0.99));

    expect(updatedState.newCardsInPlay).toBe(0);
  });

  it('should update only the next card on REVIEW_LOADED if the current card is set', () => {
    // Set up a review state where only the current card is set
    const [initialState, cards] = newReview(0, 3);

    const originalCard = cards[0];
    const originalLoad = actions.reviewLoaded([originalCard]);

    let updatedState = subject(initialState, originalLoad);
    expect(updatedState.currentCard).toBe(originalCard);
    expect(updatedState.nextCard).toBe(null);

    // Then load the review again
    const newCards = cards.slice(1);
    updatedState = subject(updatedState, reviewLoaded(newCards, 0, 0));

    expect(updatedState.currentCard).toBe(originalCard);
    expect(updatedState.nextCard).toBe(newCards[0]);
  });

  it('should go to the QUESTION state on REVIEW_LOADED if it was completed but there are more cards', () => {
    const [initialState, cards] = newReview(1, 3);

    let updatedState = subject(initialState, actions.reviewLoaded([]));
    expect(updatedState.phase).toBe(ReviewPhase.COMPLETE);

    updatedState = subject(updatedState, actions.reviewLoaded(cards));

    expect(updatedState.phase).toBe(ReviewPhase.QUESTION);
  });

  it('should update the review state on SHOW_ANSWER', () => {
    const [initialState, cards] = newReview(1, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    updatedState = subject(updatedState, actions.showAnswer());

    expect(updatedState.phase).toBe(ReviewPhase.ANSWER);
  });

  it('should update the failed cards queues on PASS_CARD for a recently failed card', () => {
    const [initialState, cards] = newReview(1, 3);

    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    expect(updatedState.currentCard).toEqual(cards[0]);

    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.failedCardsLevel2).toEqual([cards[0]]);

    updatedState = subject(updatedState, passCard(0));
    expect(updatedState.currentCard).toEqual(cards[0]);

    updatedState = subject(updatedState, passCard(0));

    expect(updatedState.failedCardsLevel1).toEqual([cards[0]]);
    expect(updatedState.failedCardsLevel2).toEqual([]);
  });

  it('should update the failed cards queues on PASS_CARD for a card passed once', () => {
    const [initialState, cards] = newReview(1, 3);

    // Load the card...
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    expect(updatedState.currentCard).toEqual(cards[0]);

    // Fail it once so it is in the second failure queue...
    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.failedCardsLevel2).toEqual([cards[0]]);
    expect(updatedState.currentCard).toEqual(cards[1]);

    // Fail another card so that the first card becomes the current card...
    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.currentCard).toEqual(cards[0]);

    // Pass the card so that it is in the first failure queue...
    updatedState = subject(updatedState, passCard(0));
    expect(updatedState.failedCardsLevel1).toEqual([cards[0]]);
    expect(updatedState.nextCard).toEqual(cards[0]);

    // Fail the current card so that the first card becomes the current card...
    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.currentCard).toEqual(cards[0]);

    // Finally, we can test it
    updatedState = subject(updatedState, passCard(0));

    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual([cards[1]]);
  });

  it('should update the failed cards queues on PASS_CARD for a recently failed card with incorrect progress', () => {
    const [initialState, cards] = newReview(1, 3);

    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    expect(updatedState.currentCard).toEqual(cards[0]);

    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.failedCardsLevel2).toEqual([cards[0]]);

    // Make the progress incorrect. I'm not sure exactly how this
    // happens--probably a messed-up sync--but it has been observed to happen
    // at least once anyway.
    updatedState.failedCardsLevel2[0].progress.level = 13;

    updatedState = subject(updatedState, passCard(0));
    expect(updatedState.currentCard).toEqual(cards[0]);

    updatedState = subject(updatedState, passCard(0));

    expect(updatedState.failedCardsLevel1).toEqual([cards[0]]);
    expect(updatedState.failedCardsLevel1[0].progress.level).toEqual(0);
    expect(updatedState.failedCardsLevel2).toEqual([]);
  });

  it('should update the card level for an existing card on PASS_CARD (past due date)', () => {
    const [initialState, cards, reviewTime] = newReview(0, 1);
    cards[0].progress.level = 3; // 3 day span
    cards[0].progress.reviewed = new Date(
      reviewTime.getTime() - 5 * MS_PER_DAY
    );
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.passCard());

    // Card was due 5 days ago and we got it right, so the level should go to
    // 10.
    expect(updatedState.history[0].progress.level).toBe(10);
  });

  it('should update the card level for an existing card on PASS_CARD (before due date)', () => {
    const [initialState, cards, reviewTime] = newReview(0, 1);
    cards[0].progress.level = 3; // 3 day span
    cards[0].progress.reviewed = new Date(
      reviewTime.getTime() - 1 * MS_PER_DAY
    );
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.passCard());

    // Card isn't due for two days but if we just double the interval we'll end
    // up with a level *less* than the current level. Make sure that doesn't
    // happen.
    expect(updatedState.history[0].progress.level).toBe(3);
  });

  it('should update the card level on for a new card on PASS_CARD', () => {
    const [initialState, cards] = newReview(1, 1);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    expect(updatedState.currentCard.progress.level).toBe(0);

    updatedState = subject(updatedState, actions.passCard());

    expect(updatedState.history[0].progress.level).toBe(0.5);
  });

  it('should update the review time on PASS_CARD', () => {
    const [initialState, cards, reviewTime] = newReview(0, 1);
    cards[0].progress.level = 4;
    cards[0].progress.reviewed = new Date(
      reviewTime.getTime() - 10 * MS_PER_DAY
    );
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.passCard());

    expect(updatedState.history[0].progress.reviewed).toBe(reviewTime);
  });

  it('should update the complete count on PASS_CARD', () => {
    const [initialState, cards] = newReview(2, 2);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    expect(updatedState.completed).toBe(0);

    updatedState = subject(updatedState, actions.passCard());
    expect(updatedState.completed).toBe(1);

    updatedState = subject(updatedState, actions.passCard());
    expect(updatedState.completed).toBe(2);
  });

  it('should NOT update the complete count on PASS_CARD if the card still needs to be reviewed', () => {
    const [initialState, cards] = newReview(1, 1);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    expect(updatedState.completed).toBe(0);

    updatedState = subject(updatedState, actions.failCard());
    expect(updatedState.currentCard).not.toBeNull();
    expect(updatedState.completed).toBe(0);

    updatedState = subject(updatedState, actions.passCard());
    expect(updatedState.currentCard).not.toBeNull();
    expect(updatedState.completed).toBe(0);

    updatedState = subject(updatedState, actions.passCard());
    expect(updatedState.currentCard).toBeNull();
    expect(updatedState.completed).toBe(1);
  });

  it('should add to the history on PASS_CARD', () => {
    const [initialState, cards] = newReview(1, 1);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    expect(updatedState.history.length).toBe(0);

    updatedState = subject(updatedState, actions.passCard());
    expect(updatedState.history.length).toBe(1);
    expect(updatedState.history[0]).toEqual(cards[0]);
  });

  it('should update the history on PASS_CARD if the card is already in the history', () => {
    const [initialState, cards] = newReview(0, 2);
    const firstCard = cards[0];
    const secondCard = cards[1];
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    expect(updatedState.history).toEqual([]);
    expect(updatedState.currentCard).toEqual(firstCard);

    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.history).toEqual([firstCard]);

    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.history).toEqual([secondCard]);
    expect(updatedState.currentCard).toEqual(firstCard);

    updatedState = subject(updatedState, passCard(0));
    expect(updatedState.history).toEqual([firstCard]);
  });

  it('should update the current card and next card on PASS_CARD', () => {
    const [initialState, cards] = newReview(1, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    expect(updatedState.currentCard).toEqual(cards[0]);
    expect(updatedState.nextCard).toEqual(cards[1]);

    updatedState = subject(updatedState, actions.passCard());
    expect(updatedState.currentCard).toEqual(cards[1]);
    expect(updatedState.nextCard).toEqual(cards[2]);

    updatedState = subject(updatedState, actions.passCard());
    expect(updatedState.currentCard).toEqual(cards[2]);
    expect(updatedState.nextCard).toBe(null);

    updatedState = subject(updatedState, actions.passCard());
    expect(updatedState.currentCard).toEqual(null);
    expect(updatedState.nextCard).toBe(null);
  });

  it('should update the failed cards queue on FAIL_CARD for a yet unseen card', () => {
    const [initialState, cards] = newReview(0, 1);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.failCard());

    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual(cards);
  });

  it('should update the failed cards queue on FAIL_CARD for a recently failed card', () => {
    const [initialState, cards] = newReview(3, 3);

    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual([]);

    updatedState = subject(updatedState, failCard(0.5));
    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual([cards[0]]);

    updatedState = subject(updatedState, failCard(1));
    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual([cards[0], cards[1]]);

    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual([
      cards[0],
      cards[1],
      cards[2],
    ]);

    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual([
      cards[1],
      cards[2],
      cards[0],
    ]);
  });

  it('should update the failed cards queue on FAIL_CARD for a card that still needs to be reviewed once more', () => {
    const [initialState, cards] = newReview(1, 1);

    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual([]);

    updatedState = subject(updatedState, actions.failCard());
    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual([cards[0]]);

    updatedState = subject(updatedState, actions.passCard());
    expect(updatedState.failedCardsLevel1).toEqual([cards[0]]);
    expect(updatedState.failedCardsLevel2).toEqual([]);

    updatedState = subject(updatedState, actions.failCard());
    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual([cards[0]]);

    updatedState = subject(updatedState, actions.failCard());
    expect(updatedState.failedCardsLevel1).toEqual([]);
    expect(updatedState.failedCardsLevel2).toEqual([cards[0]]);
  });

  it('should update the card level and review time on FAIL_CARD', () => {
    const [initialState, cards, reviewTime] = newReview(0, 1);
    cards[0].progress.level = 3;
    cards[0].progress.reviewed = new Date(
      reviewTime.getTime() - 5 * MS_PER_DAY
    );
    let updatedState = subject(initialState, actions.reviewLoaded(cards));

    updatedState = subject(updatedState, actions.failCard());

    expect(updatedState.failedCardsLevel2[0].progress.level).toBe(0);
    expect(updatedState.failedCardsLevel2[0].progress.reviewed).toBe(
      reviewTime
    );
  });

  it('should NOT update the completed count on FAIL_CARD', () => {
    const [initialState, cards] = newReview(0, 1);
    let updatedState = subject(initialState, actions.reviewLoaded(cards));
    expect(updatedState.completed).toBe(0);

    updatedState = subject(updatedState, actions.failCard());

    expect(updatedState.completed).toBe(0);
  });

  it('should update the history on FAIL_CARD', () => {
    const [initialState, cards] = newReview(0, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    expect(updatedState.history.length).toBe(0);

    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.history).toEqual([cards[0]]);
    expect(updatedState.nextCard).toEqual(cards[0]);

    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.history).toEqual([cards[1]]);
    expect(updatedState.currentCard).toEqual(cards[0]);
    expect(updatedState.nextCard).toEqual(cards[1]);
  });

  it('should update the current card and next card on FAIL_CARD when it is the second last card', () => {
    const [initialState, cards] = newReview(0, 2);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.currentCard).toEqual(cards[1]);
    expect(updatedState.nextCard).toEqual(cards[0]);
  });

  it('should update the current card and next card on FAIL_CARD when it is the last card', () => {
    const [initialState, cards] = newReview(0, 1);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    updatedState = subject(updatedState, failCard(0));
    expect(updatedState.phase).toBe(ReviewPhase.QUESTION);
    expect(updatedState.currentCard).toEqual(cards[0]);
    expect(updatedState.nextCard).toEqual(null);
    expect(updatedState.failedCardsLevel2).toEqual(cards);
    expect(updatedState.failedCardsLevel1).toEqual([]);
  });

  it('should update the current card on UPDATE_REVIEW_CARD', () => {
    const [initialState, cards] = newReview(0, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    const updatedCurrentCard = {
      ...updatedState.currentCard,
      question: 'Updated question',
    };
    updatedState = subject(
      updatedState,
      actions.updateReviewCard(updatedCurrentCard)
    );
    expect(updatedState.currentCard).toEqual(updatedCurrentCard);
  });

  it('should update the next card on UPDATE_REVIEW_CARD', () => {
    const [initialState, cards] = newReview(0, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    const updatedNextCard = {
      ...updatedState.nextCard,
      question: 'Updated question',
    };
    updatedState = subject(
      updatedState,
      actions.updateReviewCard(updatedNextCard)
    );
    expect(updatedState.nextCard).toEqual(updatedNextCard);
  });

  it('should update the heap card on UPDATE_REVIEW_CARD', () => {
    const [initialState, cards] = newReview(0, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    const updatedHeapCard = {
      ...updatedState.heap[0],
      question: 'Updated question',
    };
    updatedState = subject(
      updatedState,
      actions.updateReviewCard(updatedHeapCard)
    );
    expect(updatedState.heap[0]).toEqual(updatedHeapCard);
  });

  it('should NOT update anything if no cards match on UPDATE_REVIEW_CARD', () => {
    const [initialState, cards] = newReview(0, 3);
    const stateBeforeUpdate = subject(initialState, reviewLoaded(cards, 0, 0));
    const updatedCard = {
      ...stateBeforeUpdate.heap[0],
      _id: 'something-random',
    };
    const stateAfterUpdate = subject(
      stateBeforeUpdate,
      actions.updateReviewCard(updatedCard)
    );
    expect(stateAfterUpdate).toBe(stateBeforeUpdate);
  });

  it('should update the current card on DELETE_REVIEW_CARD', () => {
    const [initialState, cards] = newReview(0, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    const originalCurrentCard = updatedState.currentCard;
    const originalNextCard = updatedState.nextCard;
    updatedState = subject(
      updatedState,
      deleteReviewCard(updatedState.currentCard._id, 0)
    );
    expect(updatedState.currentCard).toBe(originalNextCard);
    expect(updatedState.nextCard).not.toBe(originalNextCard);
    expect(updatedState.nextCard).toBe(updatedState.heap[0]);
    expect(updatedState.history).not.toContainEqual(originalCurrentCard);
  });

  it('should got to COMPLETED state if the last card is deleted', () => {
    const [initialState, cards] = newReview(0, 1);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    expect(updatedState.nextCard).toBe(null);
    expect(updatedState.heap).toHaveLength(0);

    updatedState = subject(
      updatedState,
      deleteReviewCard(updatedState.currentCard._id, 0)
    );
    expect(updatedState.currentCard).toBe(null);
    expect(updatedState.nextCard).toBe(null);
    expect(updatedState.history).toHaveLength(0);
    expect(updatedState.phase).toBe(ReviewPhase.COMPLETE);
  });

  it('should update the next card on DELETE_REVIEW_CARD', () => {
    const [initialState, cards] = newReview(0, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    updatedState = subject(
      updatedState,
      deleteReviewCard(updatedState.nextCard._id, 0)
    );
    expect(updatedState.nextCard).toBe(updatedState.heap[0]);
  });

  it('should update the heap on DELETE_REVIEW_CARD', () => {
    const [initialState, cards] = newReview(0, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));
    const originalHeap = updatedState.heap;
    updatedState = subject(
      updatedState,
      actions.deleteReviewCard(updatedState.heap[1]._id)
    );
    expect(updatedState.heap.length).toEqual(originalHeap.length - 1);
    expect(updatedState.heap).not.toBe(originalHeap);
  });

  it('should NOT update anything if no cards match on DELETE_REVIEW_CARD', () => {
    const [initialState, cards] = newReview(0, 3);
    const stateBeforeUpdate = subject(initialState, reviewLoaded(cards, 0, 0));
    const stateAfterUpdate = subject(
      stateBeforeUpdate,
      actions.deleteReviewCard('random-id')
    );
    expect(stateAfterUpdate).toBe(stateBeforeUpdate);
  });

  it('should reset the review state on CANCEL_REVIEW', () => {
    const [initialState, cards] = newReview(1, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    updatedState = subject(updatedState, actions.cancelReview());

    const resetState = subject(undefined, { type: 'none' } as any);
    expect(updatedState).toEqual(resetState);
  });

  it('should integrate changes to the review state on LOAD_REVIEW', () => {
    const [initialState, cards] = newReview(1, 3);
    let updatedState = subject(initialState, reviewLoaded(cards, 0, 0));

    const reviewSummary = getReviewSummary({ review: updatedState });
    reviewSummary.completed = 1;
    reviewSummary.newCardsCompleted = 1;
    reviewSummary.heap = [cards[0]._id];
    updatedState = subject(updatedState, actions.loadReview(reviewSummary));

    expect(updatedState).toMatchObject({
      phase: ReviewPhase.LOADING,
      completed: 1,
      newCardsInPlay: 1,
    });
  });
});
