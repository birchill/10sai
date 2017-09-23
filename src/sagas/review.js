// @format
import { call, put, select, takeEvery } from 'redux-saga/effects';
import * as reviewActions from '../actions/review';

// Selectors

const getReviewInfo = state => (state ? state.review : {});

// Sagas

export function* updateQueue(cardStore, action) {
  const reviewInfo = yield select(getReviewInfo);
  let freeSlots = Math.max(
    0,
    reviewInfo.maxCards -
      reviewInfo.completed -
      reviewInfo.failedCardsLevel1.length -
      reviewInfo.failedCardsLevel2.length
  );

  // First fill up with the maximum number of new cards
  const newCardSlots = Math.max(
    Math.min(reviewInfo.maxNewCards - reviewInfo.newCardsInPlay, freeSlots),
    0
  );
  let cards = [];
  if (newCardSlots) {
    cards = yield call([cardStore, 'getNewCards'], { limit: newCardSlots });
    freeSlots -= cards.length;
  }

  // Now fill up the overdue slots
  if (freeSlots) {
    const options = { limit: freeSlots };
    // If we are updating the queues mid-review then avoid getting cards that
    // are already in our failed queues.
    if (action.type === 'SET_REVIEW_LIMIT') {
      options.skipFailedCards = true;
    }
    cards.push(...yield call([cardStore, 'getOverdueCards'], options));
  }

  yield put(reviewActions.reviewLoaded(cards));
}

export function* updateProgress(cardStore, action) {
  // TODO: Since we choose the next card randomly, I think we probably want to
  // choose the next card here in the saga and dispatch an action to set the
  // next card (so long as we do this before triggering any long-running async
  // operations I guess we should have the next card ready in time).
  //
  // Or, instead, should we choose the order of cards once when we build the
  // queues and then just have the reducer pull things from the lists in
  // a deterministic fashion. That's probably better. If we do that we probably
  // don't even need a separate new queue.

  try {
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
    yield call([cardStore, 'updateProgress'], update);
  } catch (error) {
    console.error(`Failed to update progress of card: ${error}`);
    // TODO: Define the following action
    // yield put(reviewActions.failUpdateProgress(error));
  }
}

function* reviewSagas(cardStore) {
  yield* [
    takeEvery(['NEW_REVIEW', 'SET_REVIEW_LIMITS'], updateQueue, cardStore),
    takeEvery(['PASS_CARD', 'FAIL_CARD'], updateProgress, cardStore),
  ];
}

export default reviewSagas;
