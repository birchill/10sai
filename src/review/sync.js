import { getNeedAvailableCards } from './selectors';
import * as reviewActions from './actions';

function sync(cardStore, store) {
  let needAvailableCards;

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
    const newNeedAvailableCards = getNeedAvailableCards(store.getState());
    if (newNeedAvailableCards === needAvailableCards) {
      return;
    }

    // XXX Check availableCards is empty
    // XXX Check we are not already loading cards

    store.dispatch(reviewActions.queryAvailableCards());

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
