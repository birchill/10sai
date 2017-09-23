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
  // most recentl occurence is included.
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
      // TODO: This should replace the next card regardless. The 'cards'
      // included in the action *includes* a card to be used for the next card
      // since that simplifies the case where the review limits are adjusted
      // such that there should no longer be a next card.
      return {
        ...state,
        reviewState: ReviewState.QUESTION,
        heap: action.cards,
      };
    }

    // TODO: PASS_CARD -- Don't forget to check for completion
    // TODO: FAIL_CARD

    default:
      return state;
  }
}
