import { ReviewPhase } from './review-phase';
import { Action } from '../actions';
import { AvailableCards, Card } from '../model';
import { notes as notesReducer, NoteState } from '../notes/reducer';
import { isNoteAction } from '../notes/actions';
import { KeysOfType } from '../utils/type-helpers';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface ReviewState {
  phase: ReviewPhase;

  // The maximum number of unique cards that will be presented to the user in
  // this review. The actual number presented may be less if there are
  // insufficient new and overdue cards.
  maxCards: number;

  // The maximum number of as-yet unreviewed cards that will be presented to the
  // user in this review.
  maxNewCards: number;

  // The number of cards that have been correctly answered and will not be
  // presented again in this review.
  completed: number;

  // The number of new cards that *were* in the heap but which have been
  // reviewed or are the current card. This is so we can accurately gauge how
  // many new cards to add when re-building the heap.
  newCardsInPlay: number;

  // Cards we have queued up but have yet to show to the user.
  heap: Card[];

  // Cards which we failed.
  failed: Card[];

  // An array of the cards we've presented to the user in order from most
  // to least recently seen. If a card has been shown more than once only the
  // most recent occurence is included. Note that the currentCard is not
  // included in the history.
  history: Card[];

  // The card currently being presented to the user. May be null if there is no
  // review in progress (or it is complete, or loading).
  currentCard: Card | null;

  // The next card to present if the current card.
  // May be null if there are no more cards to be reviewed or if there is no
  // review in progress.
  nextCard: Card | null;

  // An object describing the cards available for review.
  //
  // This is only ever set in the IDLE / COMPLETE states and even then it is not
  // always set.
  availableCards?: AvailableCards;

  // True if we are still saving the progress.
  // We use this to determine if it is ok to query the available cards or if we
  // should wait.
  savingProgress: boolean;

  // Notes relevant to the current card
  notes: Array<NoteState>;
}

const initialState: ReviewState = {
  phase: ReviewPhase.Idle,
  maxCards: 0,
  maxNewCards: 0,
  completed: 0,
  newCardsInPlay: 0,
  heap: [],
  failed: [],
  history: [],
  currentCard: null,
  nextCard: null,
  availableCards: undefined,
  savingProgress: false,
  notes: [],
};

// When we update the current / next cards there are two modes:
const enum UpdateMode {
  // Updates the current card with the next card before updating the next card.
  // If the current card is not null, it will be added to the history. This is
  // the normal mode used when reviewing.
  UpdateCurrentCard,
  // Simply replaces the next card without modifying the current card. This is
  // the mode used when we re-load cards from the database.
  ReplaceNextCard,
}

export function review(
  state: ReviewState = initialState,
  action: Action
): ReviewState {
  switch (action.type) {
    case 'NEW_REVIEW': {
      return {
        ...initialState,
        phase: ReviewPhase.Loading,
        maxCards: action.maxCards,
        maxNewCards: action.maxNewCards,
        availableCards: undefined,
      };
    }

    case 'SET_REVIEW_LIMIT': {
      return {
        ...state,
        phase: ReviewPhase.Loading,
        maxCards: action.maxCards,
        maxNewCards: action.maxNewCards,
      };
    }

    case 'REVIEW_LOADED': {
      // This should replace the next card regardless. The 'cards' included in
      // the action *includes* a card to be used for the next card since that
      // simplifies the case where the review limits are adjusted such that
      // there should no longer be a next card.
      let updatedState = {
        ...state,
        heap: action.cards,
      };

      // Fill in extra fields (only set when doing a sync)
      for (const field of ['history', 'failed'] as ('history' | 'failed')[]) {
        if (typeof action[field] !== 'undefined') {
          updatedState[field] = action[field]!;
        }
      }

      // Update the next card
      updatedState = updateNextCard(
        updatedState,
        action.nextCardSeed,
        UpdateMode.ReplaceNextCard
      );

      // When we first load, or after we have completed once, neither the next
      // card nor the current card will be filled-in so we will need to call
      // updateNextCard twice but this time we want to update the current card
      // too.
      if (updatedState.nextCard && !updatedState.currentCard) {
        updatedState = updateNextCard(
          updatedState,
          action.currentCardSeed,
          UpdateMode.UpdateCurrentCard
        );
      }

      // If we were complete but now have cards we need to go back to the
      // showing cards.
      if (
        (updatedState.phase === ReviewPhase.Complete ||
          updatedState.phase === ReviewPhase.Loading) &&
        updatedState.currentCard
      ) {
        updatedState.phase = ReviewPhase.Front;
      }

      // If we are complete but this is the initial load, then it makes more
      // sense to show the user the idle state.
      if (updatedState.phase === ReviewPhase.Complete && action.initialReview) {
        updatedState.phase = ReviewPhase.Idle;
      }

      return updatedState;
    }

    case 'PASS_CARD': {
      if (
        state.phase !== ReviewPhase.Back &&
        state.phase !== ReviewPhase.Front
      ) {
        return state;
      }

      // We use passedCard to search arrays
      const passedCard = state.currentCard!;
      // But we push a copy of it that we will (probably) update
      const updatedCard = { ...passedCard };

      // Update failed queue
      let { failed } = state;
      let failedIndex = failed.indexOf(passedCard);
      if (failedIndex !== -1) {
        // Drop from the queue
        failed = failed.slice();
        failed.splice(failedIndex, 1);
        // Sometimes it seems like we can end up with a card in the failed queue
        // without a progress of zero. It's not clear why this happens: a sync
        // where the chosen review record and progress record don't match? In
        // any case, to be sure, force the progress to zero here.
        updatedCard.progress.level = 0;
      }

      // Update the passed card
      //
      // Add random jitter to add to the newly calculated level so that cards
      // added or reviewed together get spread out somewhat.
      const jitter = action.levelSeed * 0.2 + 0.9;
      if (updatedCard.progress.level && updatedCard.progress.due) {
        // Account for the fact that we might have reviewed this early, or
        // late.
        const reviewedIntervalInDays =
          (action.reviewTime.getTime() - updatedCard.progress.due.getTime()) /
            MS_PER_DAY +
          updatedCard.progress.level;
        const nextIntervalInDays =
          reviewedIntervalInDays * 2 * action.confidence * jitter;

        updatedCard.progress.level = Math.max(nextIntervalInDays, 0.5);
      } else {
        // New / reset card: Review in 12 hours' time
        updatedCard.progress.level = 0.5 * action.confidence * jitter;
      }

      // Calculate the due date rounded down to the previous hour.
      const dueDate = new Date(
        action.reviewTime.getTime() + updatedCard.progress.level * MS_PER_DAY
      );
      dueDate.setMinutes(0, 0, 0);
      updatedCard.progress.due = dueDate;

      // Add to end of history
      const history = state.history.slice();
      console.assert(
        history.indexOf(passedCard) === -1,
        'The current card should not be in the history'
      );
      history.push(updatedCard);

      const intermediateState = {
        ...state,
        phase: ReviewPhase.Front,
        completed: state.completed + 1,
        failed,
        history,
        currentCard: updatedCard,
        savingProgress: true,
      };

      return updateNextCard(
        intermediateState,
        action.nextCardSeed,
        UpdateMode.UpdateCurrentCard
      );
    }

    case 'SHOW_ANSWER': {
      if (state.phase !== ReviewPhase.Front) {
        return state;
      }

      return {
        ...state,
        phase: ReviewPhase.Back,
      };
    }

    case 'FAIL_CARD': {
      if (
        state.phase !== ReviewPhase.Back &&
        state.phase !== ReviewPhase.Front
      ) {
        return state;
      }

      // We use failedCard to search arrays
      const failedCard = state.currentCard!;
      // But we push a copy of it that we will (probably) update
      const updatedCard = { ...failedCard };

      // Append to failed queue but remove it first if it's already there
      const failed = state.failed.slice();
      const failedIndex = failed.indexOf(failedCard);
      if (failedIndex !== -1) {
        failed.splice(failedIndex, 1);
      }
      failed.push(updatedCard);

      // Update the failed card
      updatedCard.progress.level = 0;
      const dueDate = new Date(action.reviewTime);
      dueDate.setMinutes(0, 0, 0);
      updatedCard.progress.due = dueDate;

      // Add to the end of history
      const history = state.history.slice();
      console.assert(
        history.indexOf(failedCard) === -1,
        'The current card should not be in the history'
      );
      history.push(updatedCard);

      const intermediateState = {
        ...state,
        phase: ReviewPhase.Front,
        failed,
        history,
        currentCard: updatedCard,
        savingProgress: true,
      };

      return updateNextCard(
        intermediateState,
        action.nextCardSeed,
        UpdateMode.UpdateCurrentCard
      );
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
      const update: Partial<ReviewState> = {};
      const fieldsWithCards: Array<KeysOfType<
        ReviewState,
        Card[] | Card | null
      >> = ['currentCard', 'nextCard', 'heap', 'failed', 'history'];
      const isArrayOfCards = (
        value: ReviewState[keyof ReviewState]
      ): value is Card[] => !!value && Array.isArray(value);
      const isCard = (value: ReviewState[keyof ReviewState]): value is Card =>
        !!value && typeof value === 'object' && value.hasOwnProperty('id');

      for (const field of fieldsWithCards) {
        const value = state[field];

        if (isArrayOfCards(value)) {
          let found = false;
          const updatedArray = value.map(card => {
            if (card.id === action.card.id) {
              found = true;
              return action.card;
            }
            return card;
          });

          if (found) {
            update[field as KeysOfType<ReviewState, Card[]>] = updatedArray;
          }
        } else if (isCard(value) && value.id === action.card.id) {
          update[field as KeysOfType<ReviewState, Card | null>] = action.card;
        }
      }

      if (Object.keys(update).length === 0) {
        return state;
      }

      return {
        ...state,
        ...update,
      };
    }

    case 'DELETE_REVIEW_CARD': {
      const arrayFieldsWithCards: ('heap' | 'failed' | 'history')[] = [
        'heap',
        'failed',
        'history',
      ];
      const update: Partial<ReviewState> = {};
      for (const field of arrayFieldsWithCards) {
        if (!state[field]) {
          continue;
        }

        const index = state[field].findIndex(card => card.id === action.id);
        if (index === -1) {
          continue;
        }

        // We're currently assuming we only add cards once to any of these
        // arrays which I *think* is true.
        update[field] = state[field].slice();
        update[field]!.splice(index, 1);
      }

      if (state.nextCard && state.nextCard.id === action.id) {
        return updateNextCard(
          { ...state, ...update },
          action.nextCardSeed,
          UpdateMode.ReplaceNextCard
        );
      }

      if (state.currentCard && state.currentCard.id === action.id) {
        return updateNextCard(
          { ...state, ...update, currentCard: null },
          action.nextCardSeed,
          UpdateMode.UpdateCurrentCard
        );
      }

      if (Object.keys(update).length === 0) {
        return state;
      }

      return {
        ...state,
        ...update,
      };
    }

    case 'LOAD_REVIEW': {
      return {
        ...state,
        phase: ReviewPhase.Loading,
        maxCards: action.review.maxCards,
        maxNewCards: action.review.maxNewCards,
        completed: action.review.completed,
        newCardsInPlay: action.review.newCardsCompleted,
        // We set the current card to null simply to reflect the fact that
        // newCardsInPlay will not count the current card if it was a new card.
        currentCard: null,
        nextCard: null,
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
        ...state,
        phase: ReviewPhase.Idle,
        maxCards: 0,
        maxNewCards: 0,
        completed: 0,
        newCardsInPlay: 0,
        heap: [],
        failed: [],
        history: [],
        currentCard: null,
        nextCard: null,
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

// TODO: I'm sure I can factor this out better---perhaps into two methods? One
// for updating the current card and one for updating the next card?
function updateNextCard(
  state: ReviewState,
  seed: number,
  updateMode: UpdateMode
): ReviewState {
  // The fields we might update
  let { phase, currentCard, heap, history, newCardsInPlay } = state;
  let nextCard;

  let cardsAvailable = state.failed.length + heap.length;
  if (!cardsAvailable) {
    if (updateMode === UpdateMode.UpdateCurrentCard || !currentCard) {
      phase = ReviewPhase.Complete;
      currentCard = null;
      nextCard = null;
    } else {
      nextCard = null;
    }
  } else {
    // Update current card
    if (updateMode === UpdateMode.UpdateCurrentCard) {
      currentCard = state.nextCard;
      // Drop current card from heap
      const heapIndex = currentCard ? heap.indexOf(currentCard) : -1;
      if (heapIndex !== -1) {
        // TODO: Use an immutable-js List here
        heap = heap.slice();
        heap.splice(heapIndex, 1);
        cardsAvailable--;
        // If we found a level zero card that has not due date in the heap
        // it's fair to say it's a new card.
        if (
          currentCard!.progress &&
          currentCard!.progress.level === 0 &&
          currentCard!.progress.due === null
        ) {
          newCardsInPlay++;
        }
      }
    }

    // Find next card
    if (cardsAvailable) {
      let cardIndex = Math.floor(seed * cardsAvailable);
      const getCardAtIndex = (cardIndex: number) => {
        const heapStart = state.failed.length;
        if (cardIndex < heapStart) {
          return state.failed[cardIndex];
        }
        return heap[cardIndex - heapStart];
      };
      nextCard = getCardAtIndex(cardIndex);
      // If next card matches the current card then choose the next card, or
      // previous card if there is no next card.
      if (nextCard === currentCard) {
        if (cardsAvailable === 1) {
          nextCard = null;
        } else {
          cardIndex =
            cardIndex < cardsAvailable - 1 ? cardIndex + 1 : cardIndex - 1;
          nextCard = getCardAtIndex(cardIndex);
        }
      }
    } else {
      nextCard = null;
    }

    // If the current card went null, but we have a next card then we must have
    // just failed the last card and should revisit it.
    if (!currentCard && state.currentCard && nextCard) {
      currentCard = nextCard;
      nextCard = null;
    }

    // Drop current card from history: We need to do this after we've finalized
    // the current card.
    if (currentCard) {
      const historyIndex = history.indexOf(currentCard);
      if (historyIndex !== -1) {
        // TODO: Use an immutable-js List here
        history = history.slice();
        history.splice(historyIndex, 1);
      }
    }
  }

  return {
    ...state,
    phase,
    newCardsInPlay,
    heap,
    history,
    currentCard,
    nextCard,
  };
}
