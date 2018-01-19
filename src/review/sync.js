import {
  getAvailableCards,
  getNeedAvailableCards,
  getLoadingAvailableCards,
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
    // XXX If we are newly in a state where we need available cards AND we are
    // not already loading cards
    //
    // --> If availableCards is empty
    //     - cancel any delayed update
    //     - trigger QUERY_AVAILABLE_CARDS immediately.
    // --> Otherwise if there is no delayed update,
    //     - queue a delayed update
    //
    // If we are newly *not* in a state where we need available cards
    //
    // --> Cancel any delayed update
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

    if (!hasAvailableCards) {
      store.dispatch(reviewActions.queryAvailableCards());
    } else {
      delayedCallback = setTimeout(() => {
        store.dispatch(reviewActions.queryAvailableCards());
        delayedCallback = undefined;
      }, QUERY_AVAILABLE_CARDS_DELAY);
    }

    needAvailableCards = newNeedAvailableCards;
  });

  cardStore.changes.on('change', () => {
    if (!needAvailableCards) {
      // XXX Drop the following once I finish filling this out
      // eslint-disable-next-line no-useless-return
      return;
    }

    // TODO: Ignore changes that are not to cards, or changes that are only to
    // the content of cards (not additions/removals or changes to progress).
  });
}

export default sync;
