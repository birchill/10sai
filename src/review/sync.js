import {
  getAvailableCards,
  getNeedAvailableCards,
  getLoadingAvailableCards,
  getReviewCardIds,
} from './selectors';
import * as reviewActions from './actions';

// In some circumstances we delay querying available cards. We do this so that
// changes that occur in rapid succession are batched, but also because when
// cards are, for example, deleted, it takes some time before PouchDB updates
// views that reference them. I'm not sure what exactly is the process here but
// 3s seems to be enough, normally, for the view to be updated.
const QUERY_AVAILABLE_CARDS_DELAY = 3000;

function sync(cardStore, store) {
  let needAvailableCards;
  let delayedCallback;

  store.subscribe(() => {
    const state = store.getState();

    if (getLoadingAvailableCards(state)) {
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

    if (!hasAvailableCards) {
      store.dispatch(reviewActions.queryAvailableCards());
    } else {
      delayedCallback = setTimeout(() => {
        store.dispatch(reviewActions.queryAvailableCards());
        delayedCallback = undefined;
      }, QUERY_AVAILABLE_CARDS_DELAY);
    }
  });

  cardStore.changes.on('change', change => {
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
        store.dispatch(reviewActions.queryAvailableCards());
        delayedCallback = undefined;
      }, QUERY_AVAILABLE_CARDS_DELAY);
    }

    // Ignore changes for cards that are not being reviewed
    if (!getReviewCardIds(store.getState()).includes(change.id)) {
      return;
    }

    if (change.deleted) {
      store.dispatch(reviewActions.deleteReviewCard(change.id));
      return;
    }

    store.dispatch(reviewActions.updateReviewCard(change.doc));
  });
}

export default sync;
