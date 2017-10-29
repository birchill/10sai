// @format
import ReviewState from '../review-states';

const initialState = {
  reviewState: ReviewState.IDLE,

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
  // most recent occurence is included.
  history: [],

  // The card currently being presented to the user. May be null if there is no
  // review in progress (or it is complete, or loading).
  currentCard: null,

  // The next card to present if the current card.
  // May be null if there are no more cards to be reviewed or if there is no
  // review in progress.
  nextCard: null,
};

export default function review(state = initialState, action) {
  switch (action.type) {
    case 'NEW_REVIEW': {
      return {
        ...initialState,
        reviewState: ReviewState.LOADING,
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
      updatedState = updateNextCard(updatedState, action.nextCardSeed);

      // When we first load, or after we have completed once, neither the next
      // card nor the current card will be filled-in so we will need to call
      // updateNextCard twice.
      if (updatedState.nextCard && !updatedState.currentCard) {
        updatedState = updateNextCard(updatedState, action.currentCardSeed);
      }

      // If we were complete but now have cards we need to go back to the
      // question state.
      if (
        (updatedState.reviewState === ReviewState.COMPLETED ||
          updatedState.reviewState === ReviewState.LOADING) &&
        updatedState.currentCard
      ) {
        updatedState.reviewState = ReviewState.QUESTION;
      }

      return updatedState;
    }

    case 'PASS_CARD': {
      // We use passedCard to search arrays
      const passedCard = state.currentCard;
      // But we push a copy of it that we will (probably) update
      const updatedCard = { ...passedCard };

      // Update failed queues
      let finished = true;
      let failedCardsLevel2 = state.failedCardsLevel2;
      let failedCardsLevel1 = state.failedCardsLevel1;
      if (passedCard.level === 0) {
        let failedIndex = failedCardsLevel2.indexOf(passedCard);
        if (failedIndex !== -1) {
          // Move from queue two queue one
          // XXX This is wrong -- splice mutates the array
          failedCardsLevel2 = failedCardsLevel2.splice(failedIndex, 1);
          failedCardsLevel1.push(updatedCard);
          finished = false;
        } else {
          failedIndex = failedCardsLevel1.indexOf(passedCard);
          if (failedIndex !== -1) {
            // Drop from queue one
            // XXX This is wrong -- splice mutates the array
            failedCardsLevel1 = failedCardsLevel1.splice(failedIndex, 1);
          }
        }
      }

      // Update the passed card
      if (finished) {
        // XXX This should take into account the review time on the card
        // Which suggests we should update the review time here
        updatedCard.level = updatedCard.level ? updatedCard.level * 2 : 1;
      }
      const completed = finished ? state.completed + 1 : state.completed;

      // Drop from history if it already exists then add to the end
      let history = state.history;
      const historyIndex = history.indexOf(passedCard);
      // XXX This is wrong -- splice mutates the array
      history =
        historyIndex === -1 ? history.slice() : history.splice(historyIndex, 1);
      history.push(updatedCard);

      const intermediateState = {
        ...state,
        reviewState: ReviewState.QUESTION,
        completed,
        failedCardsLevel2,
        failedCardsLevel1,
        history,
      };

      return updateNextCard(intermediateState, action.nextCardSeed);
    }

    case 'FAIL_CARD': {
      // TODO -- should be quite similar to PASS_CARD
      return state;
    }

    default:
      return state;
  }
}

function updateNextCard(state, seed) {
  // The fields we might update
  let reviewState = state.reviewState;
  let currentCard = state.currentCard;
  let nextCard;
  let heap = state.heap;
  let newCardsInPlay = state.newCardsInPlay;

  // Generally when we call this we want to update the current card from the
  // next card. However, if this is called as part of updating the heap (e.g. on
  // REVIEW_LOADED), that is, if we haven't already moved the current card to
  // the history, then we don't want to update it.
  //
  // TODO: This might be wrong when we're reviewing the last card and we have
  // failed it. In that case I don't think we put it in the history but then
  // maybe in that case we also don't want to update the current card?
  const updateCurrentCard =
    !currentCard || state.history.indexOf(currentCard) !== -1;

  let cardsAvailable =
    state.failedCardsLevel2.length +
    state.failedCardsLevel1.length +
    heap.length;
  if (!cardsAvailable) {
    if (updateCurrentCard) {
      reviewState = ReviewState.COMPLETE;
      currentCard = null;
      nextCard = null;
    } else {
      nextCard = null;
    }
  } else {
    if (updateCurrentCard) {
      currentCard = state.nextCard;
      // Drop current card from heap
      const heapIndex = currentCard ? heap.indexOf(currentCard) : -1;
      if (heapIndex !== -1) {
        // TODO: Use an immutable-js List here
        heap = heap.slice(0);
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
      const cardIndex = Math.floor(seed * cardsAvailable);
      const level1Start = state.failedCardsLevel2.length;
      const heapStart =
        state.failedCardsLevel2.length + state.failedCardsLevel1.length;
      if (cardIndex < level1Start) {
        nextCard = state.failedCardsLevel2[cardIndex];
      } else if (cardIndex < heapStart) {
        nextCard = state.failedCardsLevel1[cardIndex - level1Start];
      } else {
        nextCard = heap[cardIndex - heapStart];
      }
    } else {
      nextCard = null;
    }
  }

  return {
    ...state,
    reviewState,
    newCardsInPlay,
    heap,
    currentCard,
    nextCard,
  };
}
