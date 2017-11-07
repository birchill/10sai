import ReviewState from '../review-states';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const initialState = {
  reviewState: ReviewState.IDLE,

  // The time to use to update cards and calculating their next level etc.
  reviewTime: new Date(),

  // The maximum number of unique cards that will be presented to the user in
  // this review. The actual number presented may be less if there are
  // insufficient new and overdue cards.
  maxCards: 0,

  // The maximum number of as-yet unreviewed cards that will be presented to the
  // user in this review.
  maxNewCards: 0,

  // The number of cards that have been correctly answered and will not be
  // presented again in this review.
  completed: 0,

  // The number of cards that *were* in the heap but are now in one of
  // the failed heaps or are the current card.
  newCardsInPlay: 0,

  // Cards we have queued up but have yet to show to the user.
  heap: [],

  // Cards which we once failed but have since answered correctly once.
  failedCardsLevel1: [],

  // Cards which we have failed and have since yet to answer correctly.
  failedCardsLevel2: [],

  // An array of the IDs of cards we've presented to the user in order from most
  // to least recently seen. If a card has been shown more than once only the
  // most recent occurence is included. Note that the currentCard is not
  // included in the history.
  history: [],

  // The card currently being presented to the user. May be null if there is no
  // review in progress (or it is complete, or loading).
  currentCard: null,

  // The next card to present if the current card.
  // May be null if there are no more cards to be reviewed or if there is no
  // review in progress.
  nextCard: null,
};

// When we update the current / next cards there are two modes:
const Update = {
  // Updates the current card with the next card before updating the next card.
  // If the current card is not null, it will be added to the history. This is
  // the normal mode used when reviewing.
  UpdateCurrentCard: Symbol('UpdateCurrentCard'),
  // Simply replaces the next card without modifying the current card. This is
  // the mode used when we re-load cards from the database.
  ReplaceNextCard: Symbol('ReplaceNextCard'),
};

export default function review(state = initialState, action) {
  switch (action.type) {
    case 'NEW_REVIEW': {
      return {
        ...initialState,
        reviewState: ReviewState.LOADING,
        reviewTime: action.reviewTime,
        maxCards: action.maxCards,
        maxNewCards: action.maxNewCards,
      };
    }

    case 'SET_REVIEW_LIMIT': {
      return {
        ...state,
        reviewState: ReviewState.LOADING,
        maxCards: action.maxCards,
        maxNewCards: action.maxNewCards,
      };
    }

    case 'SET_REVIEW_TIME': {
      return {
        ...state,
        reviewTime: action.reviewTime,
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

      // Update the next card
      updatedState = updateNextCard(
        updatedState,
        action.nextCardSeed,
        Update.ReplaceNextCard
      );

      // When we first load, or after we have completed once, neither the next
      // card nor the current card will be filled-in so we will need to call
      // updateNextCard twice but this time we want to update the current card
      // too.
      if (updatedState.nextCard && !updatedState.currentCard) {
        updatedState = updateNextCard(
          updatedState,
          action.currentCardSeed,
          Update.UpdateCurrentCard
        );
      }

      // If we were complete but now have cards we need to go back to the
      // question state.
      if (
        (updatedState.reviewState === ReviewState.COMPLETE ||
          updatedState.reviewState === ReviewState.LOADING) &&
        updatedState.currentCard
      ) {
        updatedState.reviewState = ReviewState.QUESTION;
      }

      return updatedState;
    }

    case 'PASS_CARD': {
      if (state.reviewState !== ReviewState.ANSWER &&
          state.reviewState !== ReviewState.QUESTION) {
        return state;
      }

      // We use passedCard to search arrays
      const passedCard = state.currentCard;
      // But we push a copy of it that we will (probably) update
      const updatedCard = { ...passedCard };

      // Update failed queues
      let finished = true;
      let failedCardsLevel2 = state.failedCardsLevel2;
      let failedCardsLevel1 = state.failedCardsLevel1;
      if (passedCard.progress.level === 0) {
        let failedIndex = failedCardsLevel2.indexOf(passedCard);
        if (failedIndex !== -1) {
          // Move from queue two queue one
          failedCardsLevel2 = failedCardsLevel2.slice();
          failedCardsLevel2.splice(failedIndex, 1);
          failedCardsLevel1 = failedCardsLevel1.slice();
          failedCardsLevel1.push(updatedCard);
          finished = false;
        } else {
          failedIndex = failedCardsLevel1.indexOf(passedCard);
          if (failedIndex !== -1) {
            // Drop from queue one
            failedCardsLevel1 = failedCardsLevel1.slice();
            failedCardsLevel1.splice(failedIndex, 1);
          }
        }
      }

      // Update the passed card
      if (finished) {
        if (updatedCard.progress.level && updatedCard.progress.reviewed) {
          const intervalInDays =
            (state.reviewTime.getTime() -
              updatedCard.progress.reviewed.getTime()) /
            MS_PER_DAY;
          updatedCard.progress.level = Math.max(
            intervalInDays * 2,
            updatedCard.progress.level,
            1
          );
        } else {
          // New / reset card: Review in a day
          updatedCard.progress.level = 1;
        }
        updatedCard.progress.reviewed = state.reviewTime;
      }
      const completed = finished ? state.completed + 1 : state.completed;

      // Add to end of history
      const history = state.history.slice();
      console.assert(
        history.indexOf(passedCard) === -1,
        'The current card should not be in the history'
      );
      history.push(updatedCard);

      const intermediateState = {
        ...state,
        reviewState: ReviewState.QUESTION,
        completed,
        failedCardsLevel2,
        failedCardsLevel1,
        history,
        currentCard: updatedCard,
      };

      return updateNextCard(
        intermediateState,
        action.nextCardSeed,
        Update.UpdateCurrentCard
      );
    }

    case 'FAIL_CARD': {
      if (state.reviewState !== ReviewState.ANSWER &&
          state.reviewState !== ReviewState.QUESTION) {
        return state;
      }

      // We use failedCard to search arrays
      const failedCard = state.currentCard;
      // But we push a copy of it that we will (probably) update
      const updatedCard = { ...failedCard };

      // Update failed queues

      // Remove from queue one if it's there
      let failedCardsLevel1 = state.failedCardsLevel1;
      let failedIndex = failedCardsLevel1.indexOf(failedCard);
      if (failedIndex !== -1) {
        failedCardsLevel1 = failedCardsLevel1.slice();
        failedCardsLevel1.splice(failedIndex, 1);
      }

      // Append to queue 2 but remove it first if it's already there
      const failedCardsLevel2 = state.failedCardsLevel2.slice();
      // (If we already found it in queue one it won't be in queue two)
      if (failedIndex === -1) {
        failedIndex = failedCardsLevel2.indexOf(failedCard);
        if (failedIndex !== -1) {
          // It's not in level 2, so add it there
          failedCardsLevel2.splice(failedIndex, 1);
        }
      }
      failedCardsLevel2.push(updatedCard);

      // Update the failed card
      updatedCard.progress.level = 0;
      updatedCard.progress.reviewed = state.reviewTime;

      // Drop from history if it already exists then add to the end
      const history = state.history.slice();
      console.assert(
        history.indexOf(failedCard) === -1,
        'The current card should not be in the history'
      );
      history.push(updatedCard);

      const intermediateState = {
        ...state,
        reviewState: ReviewState.QUESTION,
        failedCardsLevel1,
        failedCardsLevel2,
        history,
        currentCard: updatedCard,
      };

      return updateNextCard(
        intermediateState,
        action.nextCardSeed,
        Update.UpdateCurrentCard
      );
    }

    default:
      return state;
  }
}

// TODO: I'm sure I can factor this out better---perhaps into two methods? One
// for updating the current card and one for updating the next card?
function updateNextCard(state, seed, updateMode) {
  // The fields we might update
  let reviewState = state.reviewState;
  let currentCard = state.currentCard;
  let nextCard;
  let heap = state.heap;
  let history = state.history;
  let newCardsInPlay = state.newCardsInPlay;

  let cardsAvailable =
    state.failedCardsLevel2.length +
    state.failedCardsLevel1.length +
    heap.length;
  if (!cardsAvailable) {
    if (updateMode === Update.UpdateCurrentCard || !currentCard) {
      reviewState = ReviewState.COMPLETE;
      currentCard = null;
      nextCard = null;
    } else {
      nextCard = null;
    }
  } else {
    // Update current card
    if (updateMode === Update.UpdateCurrentCard) {
      currentCard = state.nextCard;
      // Drop current card from heap
      const heapIndex = currentCard ? heap.indexOf(currentCard) : -1;
      if (heapIndex !== -1) {
        // TODO: Use an immutable-js List here
        heap = heap.slice();
        heap.splice(heapIndex, 1);
        cardsAvailable--;
        // If we found a level zero card that hasn't been reviewed in the heap
        // it's fair to say it's a new card.
        if (
          currentCard.progress &&
          currentCard.progress.level === 0 &&
          currentCard.progress.reviewed === null
        ) {
          newCardsInPlay++;
        }
      }
    }

    // Find next card
    if (cardsAvailable) {
      let cardIndex = Math.floor(seed * cardsAvailable);
      const getCardAtIndex = cardIndex => {
        const level1Start = state.failedCardsLevel2.length;
        const heapStart =
          state.failedCardsLevel2.length + state.failedCardsLevel1.length;
        if (cardIndex < level1Start) {
          return state.failedCardsLevel2[cardIndex];
        } else if (cardIndex < heapStart) {
          return state.failedCardsLevel1[cardIndex - level1Start];
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
    reviewState,
    newCardsInPlay,
    heap,
    history,
    currentCard,
    nextCard,
  };
}
