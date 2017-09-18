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

  // The number of cards that *were* in |newCards| but are now in one of the
  // queues or are the current card.
  newCardsInPlay: 0,

  // Cards we have queued based on their 'overdueness' score but have yet to
  // show to the user.
  overdueCards: [],

  // Cards that have never been reviewed before including in this review.
  newCards: [],

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

  // The next card to present if the current card is answered correctly.
  // May be null if there are no more cards to be reviewed or if there is no
  // review in progress.
  nextCardIfCorrect: null,

  // The next card to present if the current card is answered correctly.
  // May be null if there is no review in progress. It may also be equal to
  // |nextCardIfCorrect| or |currentCard|.
  nextCardIfIncorrect: null,
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

    case 'REVIEW_LOADED': {
      return {
        ...state,
        reviewState: ReviewState.QUESTION,
        newCards: action.newCards,
        overdueCards: action.overdueCards,
      };
    }

    // TODO: PASS_CARD -- Don't forget to check for completion
    // TODO: FAIL_CARD

    default:
      return state;
  }
}
