import { call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';
import * as Actions from '../actions';
import { AvailableCardWatcher } from './available-card-watcher';
import { getReviewSummary } from './selectors';
import { ReviewPhase } from './review-phase';
import { beforeNotesScreenChange } from '../notes/sagas';
import { DataStore } from '../store/DataStore';
import { AppState } from '../reducer';
import { ReviewState } from './reducer';
import { Card } from '../model';

// Which cards to use when we update the heap.
//
// When we're updating in the middle of a review, we don't want to fetch cards
// that are already in one of our failed lists. However, we haven't yet
// implemented the logic to fetch a fixed number of cards but excluding certain
// IDs. We should, but as a kind of hack for now, we just pass a flag to the
// DataStore to tell it not to return any cards whose level is zero.
//
// This mostly works but it won't work if we don't address all failed cards in
// a review (e.g. we cancel a review while there are still failed cards) and
// then we refresh a review.
const enum CardsToSelect {
  IncludeFailed,
  SkipFailed,
}

export function* updateHeap(
  dataStore: DataStore,
  action:
    | Actions.NewReviewAction
    | Actions.SetReviewLimitAction
    | Actions.SetReviewTimeAction
): Generator<any, void, any> {
  const reviewInfo = yield select((state: AppState) =>
    state ? state.review : {}
  );

  // Don't update if we're idle. This can happen if we catch a SET_REVIEW_TIME
  // action.
  if (reviewInfo.phase === ReviewPhase.Idle) {
    return;
  }

  const cardsToSelect =
    action.type === 'SET_REVIEW_LIMIT' || action.type === 'SET_REVIEW_TIME'
      ? CardsToSelect.SkipFailed
      : CardsToSelect.IncludeFailed;
  const cards = yield* getCardsForHeap(dataStore, reviewInfo, cardsToSelect);
  yield put(Actions.reviewLoaded(cards));

  try {
    yield call([dataStore, 'putReview'], yield select(getReviewSummary));
  } catch (error) {
    // Do we really care?
  }
}

function* getCardsForHeap(
  dataStore: DataStore,
  reviewInfo: ReviewState,
  cardsToSelect: CardsToSelect
) {
  let freeSlots = Math.max(
    0,
    reviewInfo.maxCards -
      reviewInfo.completed -
      reviewInfo.failed.length -
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
  let cards: Card[] = [];
  if (newCardSlots) {
    cards = yield call([dataStore, 'getNewCards'], { limit: newCardSlots });
    freeSlots -= cards.length;
  }

  // Now fill up the overdue slots
  if (freeSlots) {
    const options = {
      limit: freeSlots,
      // If we are updating the heap mid-review then avoid getting failed cards
      // since they might already be in our failed heaps.
      skipFailedCards: cardsToSelect === CardsToSelect.SkipFailed,
    };
    cards.push(...(yield call([dataStore, 'getOverdueCards'], options)));
  }

  return cards;
}

export function* updateProgress(
  dataStore: DataStore,
  action: Actions.PassCardAction | Actions.FailCardAction
): Generator<any, void, any> {
  const reviewInfo: ReviewState = yield select((state: AppState) =>
    state ? state.review : {}
  );

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
  console.assert(card, 'Should have a card if we passed or failed one');

  const update: Partial<Card> = {
    id: card!.id,
    progress: card!.progress,
  };

  try {
    yield call([dataStore, 'putCard'], update);
    yield put(Actions.finishUpdateProgress());
  } catch (error) {
    console.error(`Failed to update progress of card: ${error}`);
    // TODO: Define the following action
    // yield put(Actions.failUpdateProgress(error));
    // For now just pretend it worked:
    yield put(Actions.finishUpdateProgress());
  }

  try {
    if (reviewInfo.phase === ReviewPhase.Complete) {
      yield call([dataStore, 'finishReview']);
    } else {
      yield call([dataStore, 'putReview'], yield select(getReviewSummary));
    }
  } catch (error) {
    // Do we really care?
  }
}

export function* updateReviewTime(
  dataStore: DataStore,
  action: Actions.SetReviewTimeAction
) {
  yield call([dataStore, 'setReviewTime'], action.reviewTime);
}

export function* loadReview(
  dataStore: DataStore,
  action: Actions.LoadReviewAction
): Generator<any, void, any> {
  // Load cards from history
  const history = yield call(
    [dataStore, 'getCardsById'],
    action.review.history
  );

  // We could do this by looking into historyCards but this action is so rare
  // it's not worth optimizing.
  const failedCards = yield call(
    [dataStore, 'getCardsById'],
    action.review.failed
  );

  // Update review time if necessary (and before we query for overdue cards)
  if (
    action.review.reviewTime &&
    action.review.reviewTime instanceof Date &&
    action.review.reviewTime.getTime() !== dataStore.reviewTime.getTime()
  ) {
    yield call([dataStore, 'setReviewTime'], action.review.reviewTime);
  }

  // Fetch and update reviewInfo so that getCardsForHeap knows how many slots it
  // needs to fill.
  const reviewInfo = yield select((state: AppState) =>
    state ? state.review : {}
  );
  reviewInfo.history = history;
  reviewInfo.failedCards = failedCards;

  const heap = yield* getCardsForHeap(
    dataStore,
    reviewInfo,
    CardsToSelect.SkipFailed
  );

  yield put(
    Actions.reviewLoaded(heap, history, failedCards, !!action.initialReview)
  );
}

export function* reviewSagas({
  dataStore,
  availableCardWatcher,
}: {
  dataStore: DataStore;
  availableCardWatcher: AvailableCardWatcher;
}) {
  yield* [
    takeEvery(
      ['NEW_REVIEW', 'SET_REVIEW_LIMITS', 'SET_REVIEW_TIME'],
      updateHeap,
      dataStore
    ),
    takeEvery(['PASS_CARD', 'FAIL_CARD'], updateProgress, dataStore),
    takeEvery(['SET_REVIEW_TIME'], updateReviewTime, dataStore),
    takeLatest(['LOAD_REVIEW'], loadReview, dataStore),
  ];
}

export function* beforeReviewScreenChange() {
  return yield* beforeNotesScreenChange({ screen: 'review' });
}
