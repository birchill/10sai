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
import * as Actions from '../actions';
import { Review } from '../model';
import { ReviewPhase } from './review-phase';
import { DataStore } from '../store/DataStore';
import { CardChange } from '../store/CardStore';
import { AppState } from '../reducer';

// In some circumstances we delay querying available cards. We do this so that
// changes that occur in rapid succession are batched, but also because when
// cards are, for example, deleted remotely and replicated, it takes some time
// in between when PouchDB reports the change and when it updates views that
// reference them. I'm not sure what exactly is the process here but 3s seems to
// be enough, normally, for views to be updated.
const QUERY_AVAILABLE_CARDS_DELAY = 3000;

export function sync(dataStore: DataStore, store: Store<AppState>) {
  let needAvailableCards: boolean;
  let delayedCallback: number | undefined;

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

    if (delayedCallback) {
      clearTimeout(delayedCallback);
      delayedCallback = undefined;
    }

    needAvailableCards = newNeedAvailableCards;

    if (!needAvailableCards) {
      return;
    }

    store.dispatch(Actions.queryAvailableCards());
  });

  dataStore.changes.on('card', (change: CardChange) => {
    // Update available cards if needed
    if (needAvailableCards) {
      if (delayedCallback) {
        clearTimeout(delayedCallback);
      }

      // We could try to be more clever and ignore changes that are to the
      // content of cards (i.e. not additions/removals or changes to progress)
      // but in future we anticipate having review criteria that depend on the
      // content of cards so for now its simplest just to re-query cards when
      // anything changes. Since we debounce and delay these updates, and only
      // do them when we're looking at the review screen it should be fine.
      delayedCallback = window.setTimeout(() => {
        store.dispatch(Actions.queryAvailableCards());
        delayedCallback = undefined;
      }, QUERY_AVAILABLE_CARDS_DELAY);
    }

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
