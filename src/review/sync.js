import deepEqual from 'deep-equal';
import {
  getAvailableCards,
  getLoadingAvailableCards,
  getNeedAvailableCards,
  getReviewCards,
  getReviewSummary,
  getSavingProgress,
} from './selectors';
import * as reviewActions from './actions';
import ReviewState from './states';

// In some circumstances we delay querying available cards. We do this so that
// changes that occur in rapid succession are batched, but also because when
// cards are, for example, deleted remotely and replicated, it takes some time
// in between when PouchDB reports the change and when it updates views that
// reference them. I'm not sure what exactly is the process here but 3s seems to
// be enough, normally, for views to be updated.
const QUERY_AVAILABLE_CARDS_DELAY = 3000;

function sync(store, stateStore) {
  let needAvailableCards;
  let delayedCallback;

  stateStore.subscribe(() => {
    const state = stateStore.getState();

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

    stateStore.dispatch(reviewActions.queryAvailableCards());
  });

  store.changes.on('card', change => {
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
      delayedCallback = setTimeout(() => {
        stateStore.dispatch(reviewActions.queryAvailableCards());
        delayedCallback = undefined;
      }, QUERY_AVAILABLE_CARDS_DELAY);
    }

    const reviewCard = getReviewCards(stateStore.getState()).find(
      card => card._id === change.id
    );

    // Ignore changes for cards that are not being reviewed
    if (!reviewCard) {
      return;
    }

    if (change.deleted) {
      stateStore.dispatch(reviewActions.deleteReviewCard(change.id));
      return;
    }

    // Ignore changes that are already reflected in the review state.
    if (deepEqual(reviewCard, change.doc)) {
      return;
    }

    stateStore.dispatch(reviewActions.updateReviewCard(change.doc));
  });

  // Synchronize changes to review document
  store.changes.on('review', review => {
    const currentState = getReviewSummary(stateStore.getState());

    // Review document was deleted
    if (!review) {
      if (
        currentState.reviewState !== ReviewState.IDLE &&
        currentState.reviewState !== ReviewState.COMPLETE
      ) {
        stateStore.dispatch(reviewActions.cancelReview());
      }
      return;
    }

    if (!deepEqual(currentState, review)) {
      stateStore.dispatch(reviewActions.loadReview(review));
    }
  });

  // Do initial sync
  store.getReview().then(review => {
    if (review) {
      stateStore.dispatch(reviewActions.loadInitialReview(review));
    }
  });
}

export default sync;
