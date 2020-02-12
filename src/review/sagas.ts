import { call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';

import * as Actions from '../actions';
import {
  Card,
  CardPlaceholder,
  isCardPlaceholder,
  ReviewCardStatus,
} from '../model';
import { beforeNotesScreenChange } from '../notes/sagas';
import { DataStore } from '../store/DataStore';

import { ReviewedCard } from './actions';
import { AvailableCardWatcher } from './available-card-watcher';
import { ReviewPhase } from './review-phase';
import { getReviewState, getReviewSummary } from './selectors';

export function* newReview(
  dataStore: DataStore,
  availableCardWatcher: AvailableCardWatcher
): Generator<any, void, any> {
  const reviewState = yield select(getReviewState);

  const unreviewed = yield* getUnreviewedCards({
    dataStore,
    availableCardWatcher,
    maxCards: reviewState.maxCards,
    maxNewCards: reviewState.maxNewCards,
    existingCardIds: [],
    existingNewCards: 0,
  });
  yield put(Actions.reviewCardsLoaded({ history: [], unreviewed }));

  try {
    yield call([dataStore, 'putReview'], yield select(getReviewSummary));
  } catch (error) {
    // Do we really care?
  }
}

function* getUnreviewedCards({
  dataStore,
  availableCardWatcher,
  maxCards,
  maxNewCards,
  existingCardIds,
  existingNewCards,
}: {
  dataStore: DataStore;
  availableCardWatcher: AvailableCardWatcher;
  maxCards: number;
  maxNewCards: number;
  existingCardIds: ReadonlyArray<string>;
  existingNewCards: number;
}): Generator<any, Array<Card>, any> {
  let freeSlots = Math.max(0, maxCards - existingCardIds.length);

  // TODO: Error handling for the below

  const idsToSkip = new Set(existingCardIds);

  // First fill up with the maximum number of new cards
  const newCardSlots = Math.max(
    Math.min(maxNewCards - existingNewCards, freeSlots),
    0
  );
  let cards: Array<Card> = [];
  if (newCardSlots) {
    let newIds: Array<string> = yield call([
      availableCardWatcher,
      'getNewCards',
    ]);
    newIds = newIds.filter(id => !idsToSkip.has(id));
    newIds.splice(newCardSlots);

    if (newIds.length) {
      cards = yield call([dataStore, 'getCardsById'], newIds);
      freeSlots -= cards.length;
    }
  }

  // Now fill up the overdue slots
  if (freeSlots) {
    let overdueIds: Array<string> = yield call([
      availableCardWatcher,
      'getOverdueCards',
    ]);
    overdueIds = overdueIds.filter(id => !idsToSkip.has(id));
    overdueIds.splice(freeSlots);

    if (overdueIds.length) {
      cards.push(...(yield call([dataStore, 'getCardsById'], overdueIds)));
    }
  }

  return cards;
}

export function* updateProgress(
  dataStore: DataStore,
  action: Actions.PassCardAction | Actions.FailCardAction
): Generator<any, void, any> {
  const reviewState = yield select(getReviewState);

  if (!reviewState.queue.length || !reviewState.position) {
    return;
  }

  const card = reviewState.queue[reviewState.position - 1].card;
  if (isCardPlaceholder(card)) {
    console.warn("Passed/failed a placeholder card? That's odd");
    return;
  }

  const update: Partial<Card> = {
    id: card.id,
    progress: card.progress,
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
    if (reviewState.phase === ReviewPhase.Complete) {
      yield call([dataStore, 'finishReview']);
    } else {
      yield call([dataStore, 'putReview'], yield select(getReviewSummary));
    }
  } catch (error) {
    // Do we really care?
  }
}

export function* loadReviewCards(
  dataStore: DataStore,
  availableCardWatcher: AvailableCardWatcher,
  action: Actions.LoadReviewCardsAction
): Generator<any, void, any> {
  // Load cards from history
  const existingCardIds = action.review.history.map(item => item.id);
  const historyCards: Array<Card | CardPlaceholder> = yield call(
    [dataStore, 'getCardsById'],
    existingCardIds
  );
  if (existingCardIds.length !== historyCards.length) {
    throw new Error(
      `Mismatched sets of history cards and fetched cards ({$existingCardIds.length} vs ${historyCards.length})`
    );
  }

  const history: Array<ReviewedCard> = [];
  for (const [i, historyItem] of action.review.history.entries()) {
    if (historyItem.id !== historyCards[i].id) {
      throw new Error(
        `Mismatched card IDs at position #${i} (${historyItem.id} vs ${historyCards[i].id})`
      );
    }

    const reviewedCard: ReviewedCard = {
      card: historyCards[i],
      state:
        historyItem.status === ReviewCardStatus.Passed ? 'passed' : 'failed',
    };
    if (historyItem.previousProgress) {
      reviewedCard.previousProgress = historyItem.previousProgress;
    }
    history.push(reviewedCard);
  }

  const reviewState = yield select(getReviewState);
  const existingNewCards = action.review.history.filter(
    item => !item.previousProgress
  ).length;

  const unreviewed = yield* getUnreviewedCards({
    dataStore,
    availableCardWatcher,
    maxCards: reviewState.maxCards,
    maxNewCards: reviewState.maxNewCards,
    existingCardIds,
    existingNewCards,
  });

  // XXX This needs to shuffle the cards appropriately

  yield put(Actions.reviewCardsLoaded({ history, unreviewed }));
}

export function* reviewSagas({
  dataStore,
  availableCardWatcher,
}: {
  dataStore: DataStore;
  availableCardWatcher: AvailableCardWatcher;
}) {
  yield* [
    takeEvery(['NEW_REVIEW'], newReview, dataStore, availableCardWatcher),
    takeEvery(['PASS_CARD', 'FAIL_CARD'], updateProgress, dataStore),
    takeLatest(
      ['LOAD_REVIEW_CARDS'],
      loadReviewCards,
      dataStore,
      availableCardWatcher
    ),
  ];
}

export function* beforeReviewScreenChange() {
  return yield* beforeNotesScreenChange({ screen: 'review' });
}
