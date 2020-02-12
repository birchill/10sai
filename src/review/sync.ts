import { jsonEqualish } from '@birchill/json-equalish';
import { Store } from 'redux';

import * as Actions from '../actions';
import {
  AvailableCards,
  Card,
  CardPlaceholder,
  isCardPlaceholder,
  Review,
} from '../model';
import { AppState } from '../reducer';
import { CardChange } from '../store/CardStore';
import { DataStore } from '../store/DataStore';

import { AvailableCardWatcher } from './available-card-watcher';
import { ReviewPhase } from './review-phase';
import {
  getAvailableCards,
  getNeedAvailableCards,
  getReviewSummary,
  getSavingProgress,
  getReviewPhase,
} from './selectors';

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
  let fetchingAvailableCards: boolean = false;

  store.subscribe(() => {
    const state = store.getState();

    if (fetchingAvailableCards || getSavingProgress(state)) {
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

    fetchingAvailableCards = true;
    availableCardWatcher
      .getNumAvailableCards()
      .then(availableCards => {
        store.dispatch(Actions.updateAvailableCards({ availableCards }));
      })
      .finally(() => {
        fetchingAvailableCards = false;
      });
  });

  availableCardWatcher.addListener((availableCards: AvailableCards) => {
    if (needAvailableCards) {
      store.dispatch(Actions.updateAvailableCards({ availableCards }));
    }
  });

  dataStore.changes.on('card', async (change: CardChange) => {
    let reviewCard: Card | CardPlaceholder | undefined;
    for (const queuedCard of store.getState().review.queue) {
      if (queuedCard.card.id === change.card.id) {
        reviewCard = queuedCard.card;
        break;
      }
    }

    // Ignore changes for cards that are not being reviewed
    if (!reviewCard) {
      return;
    }

    if (change.deleted) {
      store.dispatch(Actions.deleteReviewCard({ id: change.card.id }));
      return;
    }

    // If we only had a placeholder or if the contents differ somehow, update
    // the review card.
    if (
      isCardPlaceholder(reviewCard) ||
      !jsonEqualish(reviewCard, change.card)
    ) {
      store.dispatch(Actions.updateReviewCard({ card: change.card }));
    }
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
      store.dispatch(Actions.loadReviewCards({ review }));
    }
  });

  // Do initial sync
  dataStore.getReview().then(review => {
    if (review) {
      store.dispatch(Actions.loadReviewCards({ review }));
    }
  });
}
