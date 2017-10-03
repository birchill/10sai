// @format
import { call, put, select, takeEvery } from 'redux-saga/effects';
import * as reviewActions from '../actions/review';

// Selectors

const getReviewInfo = state => (state ? state.review : {});

// Sagas

export function* updateHeap(cardStore, action) {
  const reviewInfo = yield select(getReviewInfo);
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
      newOnly: true,
    });
    freeSlots -= cards.length;
  }

  // Now fill up the overdue slots
  if (freeSlots) {
    const options = { limit: freeSlots };
    // If we are updating the heap mid-review then avoid getting cards that
    // are already in our failed heaps.
    if (action.type === 'SET_REVIEW_LIMIT') {
      options.skipFailedCards = true;
    }
    cards.push(...(yield call([cardStore, 'getOverdueCards'], options)));
  }

  yield put(reviewActions.reviewLoaded(cards));
}

export function* updateProgress(cardStore, action) {
  // XXX This should not happen here, but in the reducer instead.
  // Instead, we need to be careful to read the level from *state* and not from
  // the action.
  let level;
  if (action.type === 'FAIL_CARD') {
    level = 0;
  } else if (action.card.level === 0) {
    level = 1;
  } else {
    level = action.card.level * 2;
  }

  const update = {
    // Using the CardStore's review time (as opposed to, say, `new Date()`
    // means that say you review just after 7am each morning then the next
    // morning any failed cards will show up in the 7am window the next
    // morning).
    // TODO: This is after we normalize CardStore's review times to hour
    // intervals.
    reviewed: cardStore.reviewTime,
    level,
  };

  try {
    yield call([cardStore, 'updateProgress'], update);
  } catch (error) {
    console.error(`Failed to update progress of card: ${error}`);
    // TODO: Define the following action
    // yield put(reviewActions.failUpdateProgress(error));
  }
}

function* reviewSagas(cardStore) {
  yield* [
    takeEvery(['NEW_REVIEW', 'SET_REVIEW_LIMITS'], updateHeap, cardStore),
    takeEvery(['PASS_CARD', 'FAIL_CARD'], updateProgress, cardStore),
  ];
}

export default reviewSagas;
