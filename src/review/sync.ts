import { jsonEqualish } from '@birchill/json-equalish';
import { Store } from 'redux';

import {
  getAvailableCards,
  getLoadingAvailableCards,
  getNeedAvailableCards,
  getReviewCards,
  getReviewSummary,
  getSavingProgress,
  getReviewPhase,
} from './selectors';
import { AvailableCardWatcher } from './available-card-watcher';
import * as Actions from '../actions';
import { AvailableCards, Review } from '../model';
import { ReviewPhase } from './review-phase';
import { DataStore } from '../store/DataStore';
import { CardChange } from '../store/CardStore';
import { AppState } from '../reducer';

export function sync({
  dataStore,
  store,
  availableCardWatcher,
}: {
  dataStore: DataStore;
  store: Store<AppState>;
  availableCardWatcher: AvailableCardWatcher;
}) {
  let needAvailableCards: boolean;

  store.subscribe(() => {
    const state = store.getState();

    if (getLoadingAvailableCards(state) || getSavingProgress(state)) {
      return;
    }

    const newNeedAvailableCards = getNeedAvailableCards(state);
    const hasAvailableCards = !!getAvailableCards(state);

    if (newNeedAvailableCards === needAvailableCards && hasAvailableCards) {
      return;
    }

    needAvailableCards = newNeedAvailableCards;

    if (!needAvailableCards) {
      return;
    }

    store.dispatch(Actions.queryAvailableCards());
  });

  availableCardWatcher.addListener((availableCards: AvailableCards) => {
    if (needAvailableCards) {
      store.dispatch(Actions.updateAvailableCards(availableCards));
    }
  });

  dataStore.changes.on('card', (change: CardChange) => {
    const reviewCard = getReviewCards(store.getState()).find(
      card => card.id === change.card.id
    );

    // Ignore changes for cards that are not being reviewed
    if (!reviewCard) {
      return;
    }

    if (change.deleted) {
      store.dispatch(Actions.deleteReviewCard(change.card.id));
      return;
    }

    // Ignore changes that are already reflected in the review state.
    if (jsonEqualish(reviewCard, change.card)) {
      return;
    }

    store.dispatch(Actions.updateReviewCard(change.card));
  });

  // Synchronize changes to review document
  dataStore.changes.on('review', (review: Review | null) => {
    const currentState = getReviewSummary(store.getState());
    const currentPhase = getReviewPhase(store.getState());

    // Review was finished
    if (!review) {
      if (
        currentPhase !== ReviewPhase.Idle &&
        currentPhase !== ReviewPhase.Complete
      ) {
        store.dispatch(Actions.cancelReview());
      }
      return;
    }

    if (!jsonEqualish(currentState, review)) {
      store.dispatch(Actions.loadReview(review));
    }
  });

  // Do initial sync
  dataStore.getReview().then(review => {
    if (review) {
      store.dispatch(Actions.loadInitialReview(review));
    }
  });
}
