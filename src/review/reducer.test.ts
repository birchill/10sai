import '../../jest/customMatchers';

import * as Actions from '../actions';
import { Card, CardPlaceholder } from '../model';
import { reducer } from '../reducer';
import { MS_PER_DAY } from '../utils/constants';
import { generateCards } from '../utils/testing';

import { review as subject, ReviewState } from './reducer';
import { ReviewPhase } from './review-phase';

// Wrapper that creates a new review and the appropriate number of cards.

function newReview({
  maxNewCards,
  maxCards,
}: {
  maxNewCards: number;
  maxCards: number;
}): [ReviewState, Array<Card>, Array<Card>] {
  const initialState = reducer(
    undefined,
    Actions.newReview({ maxNewCards, maxCards })
  );
  const { newCards, overdue } = generateCards({ maxNewCards, maxCards });

  return [initialState.review, newCards, overdue];
}

function makeFailedQueuedCard(card: Card) {
  return {
    card: { ...card, progress: { level: 0, due: new Date() } },
    status: <const>'failed',
    previousProgress: card.progress.due === null ? undefined : card.progress,
  };
}

function makeFailedQueuedCardPlaceholder(card: Card) {
  return {
    card: { id: card.id, status: <const>'missing' },
    status: <const>'failed',
    previousProgress: card.progress.due === null ? undefined : card.progress,
  };
}

describe('reducer:review', () => {
  it('should go to the loading state on NEW_REVIEW', () => {
    const updatedState = subject(
      undefined,
      Actions.newReview({ maxNewCards: 2, maxCards: 10 })
    );

    expect(updatedState.phase).toBe(ReviewPhase.Loading);
    expect(updatedState.maxNewCards).toBe(2);
    expect(updatedState.maxCards).toBe(10);
  });

  it('should update the queue on REVIEW_CARDS_LOADED for a brand new review', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 1,
      maxCards: 3,
    });

    const updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    expect(updatedState.queue).toEqual(
      [...newCards, ...overdue].map(card => ({ card, status: 'front' }))
    );
    expect(updatedState.position).toBe(0);
    expect(updatedState.phase).toBe(ReviewPhase.Reviewing);
  });

  it('should update the queue on REVIEW_CARDS_LOADED for an in-progress review', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 2,
      maxCards: 5,
    });

    // Let the history have one new card and one failed existing card.
    const history = [
      { card: newCards[0], status: <const>'passed' },
      makeFailedQueuedCard(overdue[0]),
    ];

    const updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({
        history,
        newCards: [newCards[1]],
        overdue: [overdue[1], overdue[2]],
        seed: -1,
      })
    );

    expect(updatedState.queue).toEqual([
      { card: newCards[0], status: 'passed' },
      history[1],
      { card: newCards[1], status: 'front' },
      { card: overdue[1], status: 'front' },
      { card: history[1].card, status: 'front' },
      { card: overdue[2], status: 'front' },
    ]);
    expect(updatedState.position).toBe(2);
    expect(updatedState.phase).toBe(ReviewPhase.Reviewing);
  });

  it('should shuffle the new and overdue cards in the queue on REVIEW_CARDS_LOADED', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 6,
      maxCards: 9,
    });

    // Let the history have three passed cards
    const history = [
      { card: newCards[0], status: <const>'passed' },
      { card: newCards[1], status: <const>'passed' },
      { card: newCards[2], status: <const>'passed' },
    ];

    const updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({
        history,
        newCards: newCards.slice(3),
        overdue,
        seed: 0.2,
      })
    );

    expect(updatedState.queue.map(item => item.card.id)).toEqual([
      // The first three cards (from history) should not be shuffled
      'card1',
      'card2',
      'card3',
      // But the following should be shuffled in the following order
      // (Notice that the new cards are still presented at the front)
      'card5',
      'card4',
      'card6',
      'card8',
      'card7',
      'card9',
    ]);
  });

  it('should update the queue on REVIEW_CARDS_LOADED for a review with a single failed card', () => {
    const [initialState, , overdue] = newReview({
      maxNewCards: 0,
      maxCards: 1,
    });
    const history = [makeFailedQueuedCard(overdue[0])];

    const updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history, newCards: [], overdue: [] })
    );

    expect(updatedState.queue).toEqual([
      history[0],
      { card: history[0].card, status: 'front' },
    ]);
    expect(updatedState.position).toBe(1);
    expect(updatedState.phase).toBe(ReviewPhase.Reviewing);
  });

  it('should update the queue on REVIEW_CARDS_LOADED for a review with a single failed new card', () => {
    const [initialState, newCards] = newReview({
      maxNewCards: 1,
      maxCards: 1,
    });
    const history = [makeFailedQueuedCard(newCards[0])];

    const updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history, newCards: [], overdue: [] })
    );

    expect(updatedState.queue).toEqual([
      history[0],
      { card: history[0].card, status: 'front' },
    ]);
    expect(updatedState.position).toBe(1);
    expect(updatedState.phase).toBe(ReviewPhase.Reviewing);
  });

  it('should update the queue on REVIEW_CARDS_LOADED for a review with a single passed card', () => {
    const [initialState, , overdue] = newReview({
      maxNewCards: 0,
      maxCards: 1,
    });
    const history = [{ card: overdue[0], status: <const>'passed' }];

    const updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history, newCards: [], overdue: [] })
    );

    expect(updatedState.queue).toEqual([history[0]]);
    expect(updatedState.position).toBe(1);
    expect(updatedState.phase).toBe(ReviewPhase.Complete);
  });

  it('should update the queue on REVIEW_CARDS_LOADED for a review with all passed cards', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 1,
      maxCards: 3,
    });
    const history = [
      { card: newCards[0], status: <const>'passed' },
      { card: overdue[0], status: <const>'passed' },
      { card: overdue[1], status: <const>'passed' },
    ];

    const updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history, newCards: [], overdue: [] })
    );

    expect(updatedState.queue).toEqual(history);
    expect(updatedState.position).toBe(3);
    expect(updatedState.phase).toBe(ReviewPhase.Complete);
  });

  it('should update the queue on REVIEW_CARDS_LOADED for an empty queue', () => {
    const [initialState] = newReview({ maxNewCards: 0, maxCards: 0 });

    const updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards: [], overdue: [] })
    );

    expect(updatedState.queue).toEqual([]);
    expect(updatedState.position).toBe(0);
    expect(updatedState.phase).toBe(ReviewPhase.Idle);
  });

  it('should update the queue on REVIEW_CARDS_LOADED for a queue where everything failed', () => {
    // The main purpose of this particular test is to check the generated part
    // of the queue is sane.
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 1,
      maxCards: 3,
    });
    const history = [...newCards, ...overdue].map(makeFailedQueuedCard);

    const updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history, newCards: [], overdue: [] })
    );

    expect(updatedState.queue).toEqual([
      history[0],
      history[1],
      history[2],
      // This is a little bit weird but the first card ends up getting pushed to
      // the back as part of the adjustment needed to make sure all new cards
      // are added after the current position. It doesn't really matter in the
      // end and adds some welcome randomness to the distribution of failures.
      //
      // However, if this test ever starts failing because of the order of these
      // cards we should not hesitate to update this test.
      { card: history[1].card, status: 'front' },
      { card: history[2].card, status: 'front' },
      { card: history[0].card, status: 'front' },
    ]);
    expect(updatedState.position).toBe(3);
    expect(updatedState.phase).toBe(ReviewPhase.Reviewing);
  });

  it('should ensure repeated cards are added after the current position on REVIEW_CARDS_LOADED', () => {
    const [initialState, , overdue] = newReview({
      maxNewCards: 0,
      maxCards: 5,
    });
    const history = [
      makeFailedQueuedCard(overdue[0]),
      { card: overdue[1], status: <const>'passed' },
      { card: overdue[2], status: <const>'passed' },
      { card: overdue[3], status: <const>'passed' },
      { card: overdue[4], status: <const>'passed' },
    ];

    const updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history, newCards: [], overdue: [] })
    );

    // Normally we would try to place the re-review for the first card at about
    // position 3 but since it it should appear after the current queue position
    // so its insertion position will need to be changed to 5.
    expect(updatedState.queue).toEqual([
      history[0],
      history[1],
      history[2],
      history[3],
      history[4],
      { card: history[0].card, status: 'front' },
    ]);
    expect(updatedState.position).toBe(5);
    expect(updatedState.phase).toBe(ReviewPhase.Reviewing);
  });

  it('should update the review state on SHOW_ANSWER', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 1,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    updatedState = subject(updatedState, Actions.showAnswer());

    expect(updatedState.phase).toBe(ReviewPhase.Reviewing);
    expect(updatedState.queue[0].status).toBe('back');
  });

  it('should update the card level for an existing card on PASS_CARD (past due date)', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 1,
    });
    overdue[0].progress.level = 3;
    overdue[0].progress.due = new Date(Date.now() - 2 * MS_PER_DAY);
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    updatedState = subject(updatedState, Actions.passCard());

    // Card was last reviewed 5 days ago and we got it right, so the level
    // should go to ~10.
    expect(updatedState.queue[0]).toEqual(
      expect.objectContaining({
        card: expect.objectContaining({
          progress: expect.objectContaining({
            level: expect.toBeInRange(8, 12),
          }),
        }),
        status: 'passed',
        previousProgress: overdue[0].progress,
      })
    );
  });

  it('should update the card level for an existing card on PASS_CARD (before due date)', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 1,
    });
    overdue[0].progress.level = 3; // 3 day span
    overdue[0].progress.due = new Date(Date.now() + 1 * MS_PER_DAY);
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    updatedState = subject(updatedState, Actions.passCard());

    // Card isn't due for one day but if we just double the interval we'll end
    // up with a level *less* than the current level. Make sure that doesn't
    // happen.
    expect(
      (updatedState.queue[0].card as Card).progress.level
    ).toBeGreaterThanOrEqual(3);
  });

  it('should update the card level for a new card on PASS_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 1,
      maxCards: 1,
    });
    expect(newCards[0].progress.level).toBe(0);
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    updatedState = subject(updatedState, Actions.passCard());

    // Card isn't due for one day but if we just double the interval we'll end
    // up with a level *less* than the current level. Make sure that doesn't
    // happen.
    expect((updatedState.queue[0].card as Card).progress.level).toBeInRange(
      0.4,
      0.6
    );
  });

  it('should update the due time on PASS_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 1,
    });
    overdue[0].progress.level = 4;
    overdue[0].progress.due = new Date(Date.now() - 6 * MS_PER_DAY);
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    const passAction = Actions.passCard();
    updatedState = subject(updatedState, passAction);

    // It was 10 days since the card was last reviewed, so the next
    // review time should be in roughly ~20 days time
    expect((updatedState.queue[0].card as Card).progress.due).toBeInDateRange(
      new Date(passAction.reviewTime.getTime() + 16 * MS_PER_DAY),
      new Date(passAction.reviewTime.getTime() + 24 * MS_PER_DAY)
    );
  });

  it('should use the confidence factor to update the card level and due time on PASS_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 1,
    });
    overdue[0].progress.level = 4;
    overdue[0].progress.due = new Date(Date.now() - 6 * MS_PER_DAY);
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    const passAction = Actions.passCard({ confidence: 0.5 });
    updatedState = subject(updatedState, passAction);

    // It was 10 days since the card was last reviewed, but we have a confidence
    // of only 50% which means we should review again in roughly 10 days.
    const updatedCard = updatedState.queue[0].card as Card;
    expect(updatedCard.progress.level).toBeInRange(8, 12);
    expect(updatedCard.progress.due).toBeInDateRange(
      new Date(passAction.reviewTime.getTime() + 8 * MS_PER_DAY),
      new Date(passAction.reviewTime.getTime() + 12 * MS_PER_DAY)
    );
  });

  it('should drop the failed card from the queue on PASS_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 1,
      maxCards: 3,
    });

    const history = [
      makeFailedQueuedCard(newCards[0]),
      { card: overdue[0], status: <const>'passed' },
      { card: overdue[1], status: <const>'passed' },
    ];
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history, newCards: [], overdue: [] })
    );

    // The next card should be the failed card
    expect(updatedState.position).toEqual(3);
    expect(updatedState.queue[updatedState.position].card.id).toEqual(
      newCards[0].id
    );
    expect(updatedState.phase).toBe(ReviewPhase.Reviewing);

    // Pass it...
    updatedState = subject(updatedState, Actions.passCard());

    // Check the original failure is no longer in the queue
    expect(updatedState.queue).toEqual([
      { card: overdue[0], status: 'passed' },
      { card: overdue[1], status: 'passed' },
      {
        card: expect.objectContaining({ id: newCards[0].id }),
        status: 'passed',
        previousProgress: history[0].card.progress,
      },
    ]);
    expect(updatedState.position).toBe(3);
    expect(updatedState.phase).toBe(ReviewPhase.Complete);
  });

  it('should drop a future repeat card from the queue on PASS_CARD', () => {
    // Similar to the last test, but in this case we re-review the failed card.
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 1,
      maxCards: 3,
    });

    const history = [
      makeFailedQueuedCard(newCards[0]),
      { card: overdue[0], status: <const>'passed' },
      { card: overdue[1], status: <const>'passed' },
    ];
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history, newCards: [], overdue: [] })
    );

    // We should have an extra copy of the failed card at the end of the queue.
    expect(updatedState.queue.length).toBe(4);

    // The next card should be the failed card, but let's navigate back to the
    // original instance instead.
    updatedState.position = 0;

    // Pass it...
    updatedState = subject(updatedState, Actions.passCard());

    // Check the copy is no longer in the queue
    expect(updatedState.queue).toEqual([
      {
        card: {
          ...newCards[0],
          progress: expect.objectContaining({
            level: expect.toBeInRange(0.4, 0.6),
          }),
        },
        status: 'passed',
      },
      { card: overdue[0], status: 'passed' },
      { card: overdue[1], status: 'passed' },
    ]);
    expect(updatedState.position).toBe(3);
    expect(updatedState.phase).toBe(ReviewPhase.Complete);
  });

  it('should update the card level and due time on FAIL_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 1,
    });
    overdue[0].progress.level = 3;
    overdue[0].progress.due = new Date(Date.now() - 2 * MS_PER_DAY);
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    const failAction = Actions.failCard();
    updatedState = subject(updatedState, failAction);

    const updatedCard = updatedState.queue[0].card as Card;
    expect(updatedCard.progress.level).toBe(0);
    const due = new Date(failAction.reviewTime);
    due.setMinutes(0, 0, 0);
    expect(updatedCard.progress.due).toStrictEqual(due);
  });

  it('should duplicate the failed card on FAIL_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    // Fail the first card
    updatedState = subject(updatedState, Actions.failCard());

    expect(updatedState.queue.map(item => item.card.id)).toEqual([
      'card1',
      'card2',
      'card1',
      'card3',
    ]);

    const repeatedCard = updatedState.queue[2];
    expect(repeatedCard.status).toEqual('front');

    // We should store the previous progress on the failed version, but not on
    // the repeated version.
    expect(updatedState.queue[0].previousProgress).toEqual(overdue[0].progress);
    expect(repeatedCard.previousProgress).toBeUndefined();
  });

  it('should only maintain one failed card on FAIL_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    // Fail the first card, then pass the next one
    updatedState = subject(updatedState, Actions.failCard());
    updatedState = subject(updatedState, Actions.passCard());
    expect(updatedState.position).toBe(2);
    expect(updatedState.queue.map(item => item.card.id)).toEqual([
      'card1',
      'card2',
      'card1',
      'card3',
    ]);

    // Fail the first card again...
    updatedState = subject(updatedState, Actions.failCard());
    expect(updatedState.position).toBe(2);
    expect(updatedState.queue.map(item => item.card.id)).toEqual([
      'card2',
      'card1',
      'card3',
      'card1',
    ]);
  });

  it('should preserve the old progress on FAIL_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    // Fail the first card
    updatedState = subject(updatedState, Actions.failCard());

    // We should store the previous progress on the failed version, but not on
    // the repeated version.
    const failedCard = updatedState.queue[0];
    expect(failedCard.card.id).toEqual('card1');
    expect(failedCard.status).toEqual('failed');
    expect(failedCard.previousProgress).toEqual(overdue[0].progress);

    const repeatedCard = updatedState.queue[2];
    expect(repeatedCard.card.id).toEqual('card1');
    expect(repeatedCard.status).toEqual('front');
    expect(repeatedCard.previousProgress).toBeUndefined();
  });

  it('should omit the old progress for a new card on FAIL_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 1,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    // Fail the first (new) card
    updatedState = subject(updatedState, Actions.failCard());

    // We should store the previous progress on the failed version, but not on
    // the repeated version.
    const failedCard = updatedState.queue[0];
    expect(failedCard.card.id).toEqual('card1');
    expect(failedCard.status).toEqual('failed');
    expect(failedCard.previousProgress).toBeUndefined();

    const repeatedCard = updatedState.queue[2];
    expect(repeatedCard.card.id).toEqual('card1');
    expect(repeatedCard.status).toEqual('front');
    expect(repeatedCard.previousProgress).toBeUndefined();
  });

  it('updates an unreviewed card on UPDATE_REVIEW_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    // Update the second card
    updatedState = subject(
      updatedState,
      Actions.updateReviewCard({
        card: { ...overdue[1], front: 'Updated front' },
      })
    );

    const updatedCard = updatedState.queue[1].card as Card;
    expect(updatedCard.front).toEqual('Updated front');
  });

  it('updates a passed card on UPDATE_REVIEW_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    // Pass the first card
    updatedState = subject(updatedState, Actions.passCard());

    // Then update it
    updatedState = subject(
      updatedState,
      Actions.updateReviewCard({
        card: { ...overdue[0], front: 'Updated front' },
      })
    );

    const updatedCard = updatedState.queue[0].card as Card;
    expect(updatedCard.front).toEqual('Updated front');
  });

  it('updates a failed card on UPDATE_REVIEW_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    // Fail the first card
    updatedState = subject(updatedState, Actions.failCard());

    // Check we have two copies of the card in the positions we expect
    expect(updatedState.queue[0].card.id).toBe(overdue[0].id);
    expect(updatedState.queue[2].card.id).toBe(overdue[0].id);

    // Then update it
    updatedState = subject(
      updatedState,
      Actions.updateReviewCard({
        card: { ...overdue[0], front: 'Updated front' },
      })
    );

    const failedCard = updatedState.queue[0].card as Card;
    expect(failedCard.front).toEqual('Updated front');

    const repeatedCard = updatedState.queue[2].card as Card;
    expect(repeatedCard.front).toEqual('Updated front');
  });

  it('updates and replaces a placeholder card on UPDATE_REVIEW_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    const history = [makeFailedQueuedCardPlaceholder(overdue[0])];

    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({
        history,
        newCards,
        overdue: overdue.slice(1),
      })
    );

    // Check we DON'T have a repeated version of the card
    expect(updatedState.queue.length).toBe(3);

    // Update the review card
    updatedState = subject(
      updatedState,
      Actions.updateReviewCard({ card: overdue[0] })
    );

    // Check the placeholder has been updated and we DO have a repeated version
    // of the card
    expect(updatedState.queue.length).toBe(4);
    expect(
      (updatedState.queue[0].card as CardPlaceholder).status
    ).toBeUndefined();
    expect((updatedState.queue[0].card as Card).front).toBe('Question 1');
    expect(updatedState.queue[2].card.id).toBe(overdue[0].id);
    expect(
      (updatedState.queue[2].card as CardPlaceholder).status
    ).toBeUndefined();
    expect((updatedState.queue[2].card as Card).front).toBe('Question 1');
  });

  it('should drop an unreviewed card on DELETE_REVIEW_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    // Delete the second card
    updatedState = subject(
      updatedState,
      Actions.deleteReviewCard({ id: overdue[1].id })
    );

    // Check it is dropped
    expect(updatedState.queue.map(item => item.card.id)).toEqual([
      overdue[0].id,
      overdue[2].id,
    ]);
  });

  it('should drop a passed card on DELETE_REVIEW_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 4,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({
        history: [],
        newCards,
        overdue: overdue.slice(0, 3),
        seed: -1,
      })
    );

    // Pass the first card
    updatedState = subject(updatedState, Actions.passCard());

    // Then delete it
    updatedState = subject(
      updatedState,
      Actions.deleteReviewCard({ id: overdue[0].id })
    );

    // Check it is dropped
    expect(updatedState.queue.map(item => item.card.id)).toEqual([
      overdue[1].id,
      overdue[2].id,
    ]);
  });

  it('should drop a failed card on DELETE_REVIEW_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 4,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({
        history: [],
        newCards,
        overdue: overdue.slice(0, 3),
        seed: -1,
      })
    );

    // Fail the first card
    updatedState = subject(updatedState, Actions.failCard());

    // Check we have two copies of the card in the positions we expect
    expect(updatedState.queue[0].card.id).toBe(overdue[0].id);
    expect(updatedState.queue[2].card.id).toBe(overdue[0].id);

    // Then delete it
    updatedState = subject(
      updatedState,
      Actions.deleteReviewCard({ id: overdue[0].id })
    );

    // We should drop the failed version and replace the unreviewed version.
    expect(updatedState.queue.map(item => item.card.id)).toEqual([
      overdue[1].id,
      overdue[2].id,
    ]);
    expect(updatedState.position).toBe(0);
    expect(updatedState.queue[1].status).toBe('front');
  });

  it('should drop a failed card placeholder on DELETE_REVIEW_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 4,
    });

    // Set up queue where we have a failed card placeholder
    const history = [makeFailedQueuedCardPlaceholder(overdue[0])];
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({
        history,
        newCards,
        overdue: overdue.slice(1, 3),
        seed: -1,
      })
    );

    // Then delete the placeholder
    updatedState = subject(
      updatedState,
      Actions.deleteReviewCard({
        id: overdue[0].id,
      })
    );

    // Check it is dropped
    expect(updatedState.queue.map(item => item.card.id)).toEqual([
      overdue[1].id,
      overdue[2].id,
    ]);
  });

  it('should drop a skipped card on DELETE_REVIEW_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });

    // Set up a queue with a skipped card.
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({
        history: [],
        newCards,
        overdue,
        seed: -1,
      })
    );
    updatedState = subject(updatedState, Actions.navigateReviewForward());
    expect(updatedState.queue.length).toBe(4);

    // Delete the skipped card
    updatedState = subject(
      updatedState,
      Actions.deleteReviewCard({ id: overdue[0].id })
    );

    // We should drop the skipped version and the unreviewed version.
    expect(updatedState.queue.map(item => item.card.id)).toEqual([
      overdue[1].id,
      overdue[2].id,
    ]);
  });

  it('should go to the completed phase when the last card is removed on DELETE_REVIEW_CARD', () => {
    const [initialState, , overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    const history = [
      { card: overdue[0], status: <const>'passed' },
      { card: overdue[1], status: <const>'passed' },
    ];
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({
        history,
        newCards: [],
        overdue: [overdue[2]],
      })
    );

    // Drop the current (and last) card
    updatedState = subject(
      updatedState,
      Actions.deleteReviewCard({ id: overdue[2].id })
    );
    expect(updatedState.phase).toBe(ReviewPhase.Complete);
    expect(updatedState.position).toBe(2);
  });

  it('should do something sensible when all cards are deleted on DELETE_REVIEW_CARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 1,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    // Drop the only card
    updatedState = subject(
      updatedState,
      Actions.deleteReviewCard({ id: overdue[0].id })
    );
    expect(updatedState.phase).toBe(ReviewPhase.Complete);
    expect(updatedState.position).toBe(0);
  });

  it('should integrate changes to the review state on LOAD_REVIEW', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 1,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    updatedState = subject(
      updatedState,
      Actions.loadReview({
        review: { maxNewCards: 10, maxCards: 20, history: [] },
      })
    );

    expect(updatedState).toMatchObject({
      phase: ReviewPhase.Loading,
      maxCards: 20,
      maxNewCards: 10,
    });
  });

  it('should reset the review state on CANCEL_REVIEW', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 1,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue, seed: -1 })
    );

    updatedState = subject(updatedState, Actions.cancelReview());

    const resetState = subject(undefined, { type: 'none' } as any);
    expect(updatedState).toEqual(resetState);
  });

  it('should update the position on NAVIGATE_REVIEW_BACK', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 3,
      maxCards: 6,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    updatedState = subject(updatedState, Actions.passCard());
    updatedState = subject(updatedState, Actions.passCard());
    updatedState = subject(updatedState, Actions.passCard());

    expect(updatedState.position).toBe(3);

    updatedState = subject(updatedState, Actions.navigateReviewBack());

    expect(updatedState.position).toBe(2);
  });

  it('should skip placeholders on NAVIGATE_REVIEW_BACK / NAVIGATE_REVIEW_FORWARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    const history = [
      { card: overdue[0], status: <const>'passed' },
      makeFailedQueuedCardPlaceholder(overdue[1]),
    ];

    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({
        history,
        newCards,
        overdue: overdue.slice(2),
      })
    );

    expect(updatedState.position).toBe(2);

    updatedState = subject(updatedState, Actions.navigateReviewBack());

    expect(updatedState.position).toBe(0);

    updatedState = subject(updatedState, Actions.navigateReviewForward());

    expect(updatedState.position).toBe(2);
  });

  it('should update the position on NAVIGATE_REVIEW_FORWARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 3,
      maxCards: 6,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    expect(updatedState.position).toBe(0);

    updatedState = subject(updatedState, Actions.navigateReviewForward());

    expect(updatedState.position).toBe(1);
  });

  it('should mark an unreviewed cards as skipped on NAVIGATE_REVIEW_FORWARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    expect(updatedState.position).toBe(0);
    expect(updatedState.queue.length).toBe(3);

    // Show the back just so we can test that the duplicated card is showing the
    // front.
    updatedState = subject(updatedState, Actions.showAnswer());

    updatedState = subject(updatedState, Actions.navigateReviewForward());

    expect(updatedState.position).toBe(1);
    expect(updatedState.queue.length).toBe(4);

    expect(updatedState.queue[0].skipped).toBe(true);
    expect(updatedState.queue[0].status).toBe('back');

    expect(updatedState.queue[2].card).toEqual(updatedState.queue[0].card);
    expect(updatedState.queue[2].status).toBe('front');
    expect(updatedState.queue[2].skipped).toBe(undefined);
  });

  it('should only add one duplicate card when skipping an unreviewed card on NAVIGATE_REVIEW_FORWARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    expect(updatedState.position).toBe(0);
    expect(updatedState.queue.length).toBe(3);

    for (let i = 0; i < 10; i++) {
      updatedState = subject(updatedState, Actions.navigateReviewForward());
    }

    // This is a bit odd, but basically we'll duplicate the first two cards when
    // we skip them, but since we can never navigate past the end, we'll never
    // be able to skip the last card, or something like that.
    expect(updatedState.queue.length).toBe(5);
  });

  it('should drop the skipped flag when duplicating a skipped card on NAVIGATE_REVIEW_FORWARD', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    // Skip the first card
    updatedState = subject(updatedState, Actions.navigateReviewForward());

    // Then go back to it
    updatedState = subject(updatedState, Actions.navigateReviewBack());

    // Then skip it again
    updatedState = subject(updatedState, Actions.navigateReviewForward());

    expect(updatedState.queue[0].skipped).toBe(true);
    expect(updatedState.queue[2].skipped).toBeUndefined();
  });

  it('jumps to the next unreviewed card after failing a historical card', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 3,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    // Pass the first and second cards
    updatedState = subject(updatedState, Actions.passCard());
    updatedState = subject(updatedState, Actions.passCard());

    // Then navigate back to the first card...
    updatedState = subject(updatedState, Actions.navigateReviewBack());
    updatedState = subject(updatedState, Actions.navigateReviewBack());
    expect(updatedState.position).toBe(0);

    // ... and fail it
    updatedState = subject(updatedState, Actions.failCard());

    // We should jump to the end of the queue and have a failed card to review
    expect(updatedState.position).toBe(2);
    expect(updatedState.queue.length).toBe(4);
    expect(updatedState.queue[3].card).toEqual(updatedState.queue[0].card);
    expect(updatedState.queue[3].status).toEqual('front');
  });

  it('jumps to the next unreviewed card after passing a skipped card', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 8,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    // Skip the first card, pass the second, and skip the next
    updatedState = subject(updatedState, Actions.navigateReviewForward());
    updatedState = subject(updatedState, Actions.passCard());
    updatedState = subject(updatedState, Actions.navigateReviewForward());

    // Then navigate back to the first card...
    updatedState = subject(updatedState, Actions.navigateReviewBack());
    updatedState = subject(updatedState, Actions.navigateReviewBack());
    updatedState = subject(updatedState, Actions.navigateReviewBack());
    expect(updatedState.position).toBe(0);
    expect(updatedState.queue[updatedState.position].skipped).toBe(true);
    expect(updatedState.queue.length).toBe(10);

    // ... and pass it
    updatedState = subject(updatedState, Actions.passCard());

    // We should jump to the end of the queue and have one less card to review
    expect(updatedState.position).toBe(2);
    expect(updatedState.queue.length).toBe(9);
  });

  it('positions a duplicate card between the end of history and the end of the queue', () => {
    const [initialState, newCards, overdue] = newReview({
      maxNewCards: 0,
      maxCards: 10,
    });
    let updatedState = subject(
      initialState,
      Actions.reviewCardsLoaded({ history: [], newCards, overdue })
    );

    // Pass the first seven cards
    while (updatedState.position < 7) {
      updatedState = subject(updatedState, Actions.passCard());
    }

    // Now navigate back to the very beginning
    while (updatedState.position > 0) {
      updatedState = subject(updatedState, Actions.navigateReviewBack());
    }

    // If we fail this card, we should position it between card 7 and card 10
    updatedState = subject(updatedState, Actions.failCard());

    expect(updatedState.queue.length).toBe(11);
    expect(updatedState.position).toBe(7);
    expect(updatedState.queue[9].card).toBe(updatedState.queue[0].card);
  });

  it('should update notes when the context matches', () => {
    const [initialState] = newReview({ maxNewCards: 1, maxCards: 3 });

    const updatedState = subject(
      initialState,
      Actions.addNote({ screen: 'review' })
    );

    expect(updatedState.notes).toHaveLength(1);
  });
});
