import { call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';
import * as reviewActions from './actions';
import { getReviewSummary } from './selectors';
import ReviewState from './states';

// Which cards to use when we update the heap.
//
// When we're updating in the middle of a review, we don't want to fetch cards
// that are already in one of our failed lists. However, we haven't yet
// implemented the logic to fetch a fixed number of cards but excluding certain
// IDs. We should, but as a kind of hack for now, we just pass a flag to the
// CardStore to tell it not to return any cards whose level is zero.
//
// This mostly works but it won't work if we don't address all failed cards in
// a review (e.g. we cancel a review while there are still failed cards) and
// then we refresh a review.
const CardsToSelect = {
  IncludeFailed: Symbol('IncludeFailed'),
  SkipFailed: Symbol('SkipFailed'),
};

export function* updateHeap(cardStore, action) {
  const reviewInfo = yield select(state => (state ? state.review : {}));

  // Don't update if we're idle. This can happen if we catch a SET_REVIEW_TIME
  // action.
  if (reviewInfo.reviewState === ReviewState.IDLE) {
    return;
  }

  const cardsToSelect =
    action.type === 'SET_REVIEW_LIMIT' || action.type === 'SET_REVIEW_TIME'
      ? CardsToSelect.SkipFailed
      : CardsToSelect.IncludeFailed;
  const cards = yield* getCardsForHeap(cardStore, reviewInfo, cardsToSelect);
  yield put(reviewActions.reviewLoaded(cards));

  try {
    yield call([cardStore, 'putReview'], yield select(getReviewSummary));
  } catch (error) {
    // Do we really care?
  }
}

function* getCardsForHeap(cardStore, reviewInfo, cardsToSelect) {
  let freeSlots = Math.max(
    0,
    reviewInfo.maxCards -
      reviewInfo.completed -
      reviewInfo.failedCardsLevel1.length -
      reviewInfo.failedCardsLevel2.length -
      (reviewInfo.currentCard ? 1 : 0)
  );
  // Note that we ignore 'nextCard' above since we assume that the reducer that
  // handles REVIEW_LOADED will update nextCard so we need to include it in the
  // set of cards we provide.

  // TODO: Error handling for the below

  // First fill up with the maximum number of new cards
  const newCardSlots = Math.max(
    Math.min(reviewInfo.maxNewCards - reviewInfo.newCardsInPlay, freeSlots),
    0
  );
  let cards = [];
  if (newCardSlots) {
    cards = yield call([cardStore, 'getCards'], {
      limit: newCardSlots,
      type: 'new',
    });
    freeSlots -= cards.length;
  }

  // Now fill up the overdue slots
  if (freeSlots) {
    const options = { type: 'overdue', limit: freeSlots };
    // If we are updating the heap mid-review then avoid getting failed cards
    // since they might already be in our failed heaps.
    if (cardsToSelect === CardsToSelect.SkipFailed) {
      options.skipFailedCards = true;
    }
    cards.push(...(yield call([cardStore, 'getCards'], options)));
  }

  return cards;
}

export function* updateProgress(cardStore, action) {
  const reviewInfo = yield select(state => (state ? state.review : {}));

  // Fetch the updated card from the state. Normally this is the last card in
  // the history, unless we happen to choose the same card twice which should
  // only happen when it is the last card and we failed it.
  //
  // As a result, when we detect that we have the last card if the action was
  // a failure, then we must assume we failed that last card so we should update
  // *that* card instead of the last card in the history.
  const isLastCard = reviewInfo.nextCard === null;
  let card;
  if (isLastCard && action.type === 'FAIL_CARD') {
    card = reviewInfo.currentCard;
  } else {
    card = reviewInfo.history[reviewInfo.history.length - 1];
  }

  const update = {
    _id: card._id,
    progress: card.progress,
  };

  try {
    yield call([cardStore, 'putCard'], update);
    yield put(reviewActions.finishUpdateProgress());
  } catch (error) {
    console.error(`Failed to update progress of card: ${error}`);
    // TODO: Define the following action
    // yield put(reviewActions.failUpdateProgress(error));
    // For now just pretend it worked:
    yield put(reviewActions.finishUpdateProgress());
  }

  try {
    if (reviewInfo.reviewState === ReviewState.COMPLETE) {
      yield call([cardStore, 'deleteReview']);
    } else {
      yield call([cardStore, 'putReview'], yield select(getReviewSummary));
    }
  } catch (error) {
    // Do we really care?
  }
}

export function* updateReviewTime(cardStore, action) {
  yield call([cardStore, 'setReviewTime'], action.reviewTime);
}

export function* queryAvailableCards(cardStore) {
  // TODO: Error handling
  const availableCards = yield call([cardStore, 'getAvailableCards']);
  yield put(reviewActions.updateAvailableCards(availableCards));
}

export function* syncReview(/* cardStore */) {
  // Load cards from history, failed cards etc.
  //   -- need bulk card getter
  //   -- how to handle failure here? Just filter out failed cards?
  // Fill in heap and trigger reviewLoaded
  //   -- need to factor out useful parts of updateHeap
  // Trigger reviewLoaded
  // Call setReviewTime on store if the review time has changed
}

export function* cancelReview(cardStore) {
  // TODO: Error handling
  yield call([cardStore, 'deleteReview']);
}

function* reviewSagas(cardStore) {
  yield* [
    takeEvery(
      ['NEW_REVIEW', 'SET_REVIEW_LIMITS', 'SET_REVIEW_TIME'],
      updateHeap,
      cardStore
    ),
    takeEvery(['PASS_CARD', 'FAIL_CARD'], updateProgress, cardStore),
    takeEvery(['SET_REVIEW_TIME'], updateReviewTime, cardStore),
    takeLatest(['QUERY_AVAILABLE_CARDS'], queryAvailableCards, cardStore),
    takeLatest(['SYNC_REVIEW'], syncReview, cardStore),
    takeLatest(['CANCEL_REVIEW'], cancelReview, cardStore),
  ];
}

export default reviewSagas;
