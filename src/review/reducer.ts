import { Action } from '../actions';
import {
  AvailableCards,
  Card,
  CardPlaceholder,
  isCardPlaceholder,
  Progress,
} from '../model';
import { notes as notesReducer, NoteState } from '../notes/reducer';
import { isNoteAction } from '../notes/actions';
import { MS_PER_DAY } from '../utils/constants';
import { shuffleWithSeed } from '../utils/seed-shuffle';

import { ReviewPhase } from './review-phase';
import { getReviewInterval } from './utils';

export type QueuedCard = {
  card: Card | CardPlaceholder;
  status: 'front' | 'back' | 'passed' | 'failed';
  // True if the card was skipped. This is a sub-state of 'front' / 'back'
  // and mostly just helps us when counting how many cards we actually have.
  skipped?: boolean;
  // The level of this card before we passed or failed it.
  // We need this in case we re-visit the card and re-pass it.
  //
  // This will be undefined in the 'front' and 'back' states as well as for
  // a card that was a new card.
  previousProgress?: Progress;
};

export interface ReviewState {
  phase: ReviewPhase;

  // The cards we have shown, are showing, and will show to the user.
  //
  // For any given card the following patterns are possible:
  //
  // - appears once as unreviewed (i.e. status is front/back)
  // - appears once as passed
  // - appears once as failed followed by once as unreviewed
  // - appears twice as unreviewed where the first instance is marked as
  //   skipped: true
  //
  // In order to maintain the above invariants, for example, as soon as we pass
  // a card, we drop any previous (failed) instance of it.
  //
  // Likewise, as soon as we fail a card, we drop any previous failed instances
  // and add a new unreviewed instance later in the queue.
  //
  // Note that placeholder cards only ever appear once.
  queue: ReadonlyArray<QueuedCard>;

  // The position of the current card in the queue or queue.length + 1 in the
  // complete and idle states (and possibly sometimes in the loading state, who
  // knows).
  position: number;

  // The maximum number of unique cards that will be presented to the user in
  // this review. The actual number presented may be less if there are
  // insufficient new and overdue cards.
  //
  // This is only used to build the initial queue.
  maxCards: number;

  // The maximum number of as-yet unreviewed cards that will be presented to the
  // user in this review.
  //
  // This is only used to build the initial queue.
  maxNewCards: number;

  // An object describing the cards available for review.
  //
  // This is only ever set in the IDLE / COMPLETE states and even then it is not
  // set if we are still loading the available cards.
  availableCards?: AvailableCards;

  // True if we are still saving the progress.
  // We use this to determine if it is ok to query the available cards or if we
  // should wait.
  //
  // TODO: It's not clear we still need this. Try removing it.
  savingProgress: boolean;

  // Notes relevant to the current card
  notes: Array<NoteState>;
}

const initialState: ReviewState = {
  phase: ReviewPhase.Idle,
  queue: [],
  position: 0,
  maxCards: 0,
  maxNewCards: 0,
  availableCards: undefined,
  savingProgress: false,
  notes: [],
};

export function review(
  state: ReviewState = initialState,
  action: Action
): ReviewState {
  switch (action.type) {
    case 'NEW_REVIEW': {
      const updatedState = {
        ...initialState,
        phase: ReviewPhase.Loading,
        maxCards: action.maxCards,
        maxNewCards: action.maxNewCards,
      };
      updatedState.availableCards = undefined;
      return updatedState;
    }

    case 'REVIEW_CARDS_LOADED': {
      // Get the current position
      const position = action.history.length;

      // Build up the queue
      const queue: Array<QueuedCard> = action.history.slice();

      // Sort the new and overdue arrays independently.
      const shuffledNewCards = shuffleWithSeed(
        action.newCards.slice(),
        action.seed
      );
      const shuffledOverdueCards = shuffleWithSeed(
        action.overdue.slice(),
        action.seed
      );

      for (const card of [...shuffledNewCards, ...shuffledOverdueCards]) {
        queue.push({
          card,
          status: 'front',
        });
      }

      // Duplicate failed cards into the queue at a later point.
      for (const [i, queuedCard] of action.history.entries()) {
        if (
          isCardPlaceholder(queuedCard.card) ||
          queuedCard.status !== 'failed'
        ) {
          continue;
        }

        const cardDuplicate: QueuedCard = { ...queuedCard, status: 'front' };
        delete cardDuplicate.previousProgress;

        // The ideal position to place the card is mid-way between the failure
        // position and the end of the queue.
        //
        // We don't, however, want to put it before the current position.
        let insertPoint = Math.floor(i + (queue.length - i) / 2) + 1;
        if (insertPoint < position) {
          insertPoint = position;
        }
        // We don't need to check for insertPoint > queue.length since splice()
        // already clamps it to the length of the array.
        queue.splice(insertPoint, 0, cardDuplicate);
      }

      // We shouldn't typically have an empty queue, but just in case...
      if (!queue.length) {
        const updatedState = { ...state, phase: ReviewPhase.Idle, queue };
        updatedState.position = 0;
        return updatedState;
      }

      // Check we're not already finished.
      if (position >= queue.length) {
        return {
          ...state,
          phase: ReviewPhase.Complete,
          queue,
          position: Math.min(position, queue.length),
        };
      }

      validateQueue(queue, position);

      return {
        ...state,
        phase: ReviewPhase.Reviewing,
        queue,
        position,
      };
    }

    case 'SHOW_ANSWER': {
      if (state.phase !== ReviewPhase.Reviewing) {
        return state;
      }

      const originalQueuedCard = state.queue[state.position];
      if (originalQueuedCard.status !== 'front') {
        return state;
      }
      const queuedCard: QueuedCard = { ...originalQueuedCard, status: 'back' };

      const queue = state.queue.slice();
      queue[state.position] = queuedCard;

      validateQueue(queue, state.position);

      return {
        ...state,
        queue,
      };
    }

    case 'PASS_CARD': {
      if (state.phase !== ReviewPhase.Reviewing) {
        return state;
      }

      const originalQueuedCard = state.queue[state.position];
      const queuedCard: QueuedCard = {
        ...originalQueuedCard,
        status: 'passed',
      };
      delete queuedCard.skipped;

      // Update the passed card
      if (!isCardPlaceholder(queuedCard.card)) {
        // Preserve the original progress so that if we revisit the card and
        // fail and then pass it, we keep the original interval.
        //
        // There are two exceptions, however.
        //
        // Firstly, if we are re-passing a card that was already failed or
        // passed, we should just preserve the original previousProgress (or
        // lack thereof).
        //
        // Secondly, if we are dealing with a new card (i.e. progress.due is
        // null), we use the lack of previousProgress to indicate that this was
        // a new card so that when we later go to load the review and fill in
        // the remaining cards, we know how many new cards we already have in
        // the queue.
        if (
          !['passed', 'failed'].includes(originalQueuedCard.status) &&
          queuedCard.card.progress.due !== null
        ) {
          queuedCard.previousProgress = { ...queuedCard.card.progress };
        }

        // If we are re-reviewing a card from the same review, use the original
        // progress it had before we marked it as pass/fail.
        const progressToUse =
          originalQueuedCard.previousProgress || queuedCard.card.progress;

        // Add random jitter to add to the newly calculated level so that cards
        // added or reviewed together get spread out somewhat.
        const jitter = action.levelSeed * 0.4 + 0.8;

        let level = getReviewInterval({
          card: { ...queuedCard.card, progress: progressToUse },
          confidence: action.confidence,
          reviewTime: action.reviewTime,
          jitter,
        });

        // Round level to make the stored representation a little more compact
        level = Math.round(level * 1000) / 1000;

        // Calculate the due date rounded down to the previous hour.
        const due = new Date(action.reviewTime.getTime() + level * MS_PER_DAY);
        due.setMinutes(0, 0, 0);

        queuedCard.card = {
          ...queuedCard.card,
          progress: {
            ...queuedCard.card.progress,
            level,
            due,
          },
        };
      }

      let { position } = state;
      const queue = state.queue.slice();
      queue[position] = queuedCard;

      // Drop any (past) failed/unreviewed instances or (future) unreviewed
      // instances of this card from the queue.
      for (let i = 0; i < queue.length; i++) {
        const current = queue[i];
        if (
          current.card.id === queuedCard.card.id &&
          current.status !== 'passed'
        ) {
          queue.splice(i, 1);
          if (i < position) {
            position--;
          }
          i--;

          // Since we maintain a variant that a card can only appear at most
          // twice in the queue, we can bail here.
          break;
        }
      }

      // Advance position
      let { phase, position: updatedPosition } = advancePosition({
        queue,
        position,
      });
      position = updatedPosition;

      validateQueue(queue, position, phase);

      return {
        ...state,
        phase,
        queue,
        position,
        savingProgress: true,
      };
    }

    case 'FAIL_CARD': {
      if (state.phase !== ReviewPhase.Reviewing) {
        return state;
      }

      const originalQueuedCard = state.queue[state.position];
      const queuedCard: QueuedCard = {
        ...originalQueuedCard,
        status: 'failed',
      };
      delete queuedCard.skipped;

      // Update the failed card
      if (!isCardPlaceholder(queuedCard.card)) {
        // As with PASS_CARD, store the original progress information, but only
        // if we're not re-reviewing a card or a new card.
        if (
          !['passed', 'failed'].includes(originalQueuedCard.status) &&
          queuedCard.card.progress.due !== null
        ) {
          queuedCard.previousProgress = { ...queuedCard.card.progress };
        }

        // Setting the due date is important helps us distinguish between a new
        // card and a failed card.
        const due = new Date(action.reviewTime);
        due.setMinutes(0, 0, 0);

        queuedCard.card = {
          ...queuedCard.card,
          progress: {
            ...queuedCard.card.progress,
            level: 0,
            due,
          },
        };
      }

      // Update queue
      let { position } = state;
      const queue = state.queue.slice();
      queue[position] = queuedCard;

      // Drop any other instances of this card in the queue.
      for (let i = 0; i < queue.length; i++) {
        const current = queue[i];
        if (current.card.id === queuedCard.card.id && i !== position) {
          queue.splice(i, 1);
          if (i < position) {
            position--;
          }
          i--;

          // Since we maintain a variant that a card can only appear at most
          // twice in the queue, we can bail here.
          break;
        }
      }

      // Add a copy of the card later in the queue.
      const cardDuplicate: QueuedCard = { ...queuedCard, status: 'front' };
      delete cardDuplicate.previousProgress;

      queue.splice(getInsertPoint(queue), 0, cardDuplicate);

      // Advance position
      let { phase, position: updatedPosition } = advancePosition({
        queue,
        position,
      });
      position = updatedPosition;

      validateQueue(queue, position, phase);

      return {
        ...state,
        phase,
        queue,
        position,
        savingProgress: true,
      };
    }

    case 'FINISH_UPDATE_PROGRESS': {
      if (!state.savingProgress) {
        return state;
      }

      return {
        ...state,
        savingProgress: false,
      };
    }

    case 'UPDATE_AVAILABLE_CARDS': {
      return {
        ...state,
        availableCards: action.availableCards,
      };
    }

    case 'UPDATE_REVIEW_CARD': {
      if (state.phase !== ReviewPhase.Reviewing) {
        return state;
      }

      const queue = state.queue.slice();
      for (const [i, queuedCard] of state.queue.entries()) {
        if (queuedCard.card.id !== action.card.id) {
          continue;
        }

        // We got an update to an existing card. We need to be careful to NOT
        // replace the previousProgress in this case because we'll often get the
        // following sequence:
        //
        // - Fail a card
        // - Update its progress and save
        // - Get a notification that the card changed
        // - Get here and attempt to update it
        const updatedQueuedCard = { ...queuedCard, card: action.card };
        queue[i] = updatedQueuedCard;

        // Check if we had a missing card that now, after syncing,
        // exists.
        if (isCardPlaceholder(queuedCard.card)) {
          // If we this card was skipped or failed we should add a duplicate
          // later to the queue so that we can review it again.
          if (queuedCard.skipped || queuedCard.status === 'failed') {
            const cardDuplicate: QueuedCard = {
              ...updatedQueuedCard,
              status: 'front',
            };
            delete cardDuplicate.skipped;

            // Use the same logic as when we build up the initial queue to try
            // and put the card roughly half way between where it first appeared
            // and the end of the queue.
            //
            // This should mean that if we have a bunch of failed cards that
            // later get synced they don't all end up being inserted at the same
            // point in the queue.
            let insertPoint = Math.floor(i + (queue.length - i) / 2) + 1;
            if (insertPoint < state.position) {
              insertPoint = state.position;
            }
            queue.splice(insertPoint, 0, cardDuplicate);
          }

          // Placeholders only appear once in the the queue.
          break;
        }
      }

      validateQueue(queue, state.position);

      return {
        ...state,
        queue,
      };
    }

    case 'DELETE_REVIEW_CARD': {
      if (state.phase !== ReviewPhase.Reviewing) {
        return state;
      }

      let { position } = state;
      const queue = state.queue.slice();

      for (const [i, queuedCard] of queue.entries()) {
        if (queuedCard.card.id !== action.id) {
          continue;
        }

        queue.splice(i, 1);
        if (i < position) {
          position--;
        }

        // Unless we have are failed or skipped (in which case there will be
        // a subsequent duplicate card) we should be done by this point.
        if (queuedCard.status !== 'failed' && !queuedCard.skipped) {
          break;
        }
      }

      // Update the phase in case the current card was deleted from out
      // underneath us.
      let phase: ReviewPhase = ReviewPhase.Reviewing;
      if (position >= queue.length) {
        phase = ReviewPhase.Complete;
      }

      validateQueue(queue, position, phase);

      return {
        ...state,
        phase,
        position,
        queue,
      };
    }

    case 'LOAD_REVIEW': {
      return {
        ...state,
        phase: ReviewPhase.Loading,
        maxCards: action.review.maxCards,
        maxNewCards: action.review.maxNewCards,
      };
    }

    case 'CANCEL_REVIEW': {
      if (
        state.phase === ReviewPhase.Idle ||
        state.phase === ReviewPhase.Complete
      ) {
        return state;
      }

      return {
        ...initialState,
        savingProgress: state.savingProgress,
        availableCards: state.availableCards,
      };
    }

    case 'NAVIGATE_REVIEW_BACK': {
      if (
        state.phase === ReviewPhase.Idle ||
        state.phase === ReviewPhase.Complete
      ) {
        return state;
      }

      let position = state.position - 1;
      while (position >= 0 && isCardPlaceholder(state.queue[position].card)) {
        position--;
      }

      if (position < 0) {
        return state;
      }

      validateQueue(state.queue, position);

      return {
        ...state,
        position,
      };
    }

    case 'NAVIGATE_REVIEW_FORWARD': {
      if (
        state.phase === ReviewPhase.Idle ||
        state.phase === ReviewPhase.Complete
      ) {
        return state;
      }

      // First check we have room to skip forwards
      let nextPosition = state.position + 1;
      while (
        nextPosition < state.queue.length &&
        isCardPlaceholder(state.queue[nextPosition].card)
      ) {
        nextPosition++;
      }

      if (nextPosition >= state.queue.length) {
        return state;
      }

      // If the current card is unreviewed, mark it as skipped and add
      // a duplicate copy for later review.
      let { queue, position } = state;
      const queuedCard = queue[position];
      if (queuedCard.status !== 'passed' && queuedCard.status !== 'failed') {
        queue = queue.slice();
        const mutableQueue = queue as Array<QueuedCard>;

        // Drop any other copies of this card in the queue leaving only the
        // skipped one (and the one we are about to add).
        for (let i = 0; i < mutableQueue.length; i++) {
          const current = mutableQueue[i];
          if (current.card.id === queuedCard.card.id && i !== position) {
            (mutableQueue as Array<QueuedCard>).splice(i, 1);
            if (i < position) {
              position--;
            }
            i--;
          }
        }

        // Add a copy of the card later in the queue.
        const cardDuplicate: QueuedCard = { ...queuedCard, status: 'front' };
        delete cardDuplicate.skipped;
        (mutableQueue as Array<QueuedCard>).splice(
          getInsertPoint(mutableQueue),
          0,
          cardDuplicate
        );

        // Mark the current card as skipped
        (mutableQueue as Array<QueuedCard>)[position] = {
          ...queuedCard,
          skipped: true,
        };
      }

      validateQueue(queue, nextPosition);

      return {
        ...state,
        queue,
        position: nextPosition,
      };
    }
  }

  if (isNoteAction(action) && action.context.screen === 'review') {
    return {
      ...state,
      notes: notesReducer(state.notes, action),
    };
  }

  return state;
}

function advancePosition({
  queue,
  position,
}: {
  queue: ReadonlyArray<QueuedCard>;
  position: number;
}) {
  let phase: ReviewPhase;
  if (position < queue.length - 1) {
    position = endOfHistory(queue);
  } else {
    position = queue.length;
  }

  phase =
    position === queue.length ? ReviewPhase.Complete : ReviewPhase.Reviewing;

  return { phase, position };
}

function endOfHistory(queue: ReadonlyArray<QueuedCard>): number {
  // Find the item after the last reviewed item
  let index = queue.length;
  while (index) {
    const status = queue[index - 1].status;
    if (status === 'passed' || status === 'failed') {
      break;
    }
    index--;
  }

  // Skip over any placeholders
  while (index < queue.length && isCardPlaceholder(queue[index].card)) {
    index++;
  }

  return index;
}

function getInsertPoint(queue: ReadonlyArray<QueuedCard>): number {
  const start = endOfHistory(queue);
  return Math.ceil(start + (queue.length - start) / 2);
}

// We should possibly move this to the saga so we can trigger side effects like
// reporting to bugsnag etc. if it fails.
function validateQueue(
  queue: ReadonlyArray<QueuedCard>,
  position: number,
  phase: ReviewPhase = ReviewPhase.Reviewing
) {
  const cardMap = new Map<string, string>();

  for (const queuedCard of queue) {
    let status =
      queuedCard.status === 'front' || queuedCard.status === 'back'
        ? 'unreviewed'
        : queuedCard.status;
    if (queuedCard.skipped) {
      status += ':skipped';
    }
    if (isCardPlaceholder(queuedCard.card)) {
      status = `placeholder:${status}`;
    }

    const existingStatus = cardMap.get(queuedCard.card.id);
    if (existingStatus) {
      status = `${existingStatus}-${status}`;
    }
    cardMap.set(queuedCard.card.id, status);
  }

  const error = (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      throw new Error(message);
    } else {
      console.error(message);
    }
  };

  const VALID_STATUSES = [
    'passed',
    'failed',
    'failed-unreviewed',
    'unreviewed',
    'unreviewed:skipped-unreviewed',
    'placeholder:passed',
    'placeholder:failed',
  ];
  for (const [id, status] of cardMap.entries()) {
    if (!VALID_STATUSES.includes(status)) {
      error(`Card ${id} has invalid status: ${status}`);
    }
  }

  // Check position
  //
  // All states:
  if (position < 0 || position > queue.length) {
    error(`Position out of range: ${position} (queue length: ${queue.length}`);
  }

  // Complete / idle:
  if (
    (phase === ReviewPhase.Complete || phase === ReviewPhase.Idle) &&
    position !== queue.length
  ) {
    error(
      `In idle / complete phase, the position should point to the end of the queue (expected: ${queue.length}, got: ${position})`
    );
  }

  // Reviewing:
  if (phase === ReviewPhase.Reviewing && position === queue.length) {
    error(
      'In the reviewing phase, the position should NOT point to the end of the queue'
    );
  }

  // The position should never point to a placeholder so long as we are
  // reviewing.
  if (
    phase === ReviewPhase.Reviewing &&
    isCardPlaceholder(queue[position].card)
  ) {
    error('The current card should never be a placeholder');
  }
}
