import { getNeedAvailableCards } from './selectors';
import * as reviewActions from './actions';

let delayedCallback;

if (typeof window === 'object') {
  if ('requestIdleCallback' in window) {
    delayedCallback = requestIdleCallback;
  } else {
    delayedCallback = requestAnimationFrame;
  }
} else {
  delayedCallback = setImmediate;
}

function sync(cardStore, store) {
  let prevNeedAvailableCards;
  let queuedAvailabilityUpdate;

  store.subscribe(() => {
    const currentNeedAvailableCards = getNeedAvailableCards(store.getState());
    if (
      currentNeedAvailableCards &&
      !prevNeedAvailableCards &&
      !queuedAvailabilityUpdate
    ) {
      queueAvailabilityUpdate();
    }

    prevNeedAvailableCards = currentNeedAvailableCards;
  });

  cardStore.changes.on('change', () => {
    if (!prevNeedAvailableCards) {
      return;
    }

    // TODO: Ignore changes that are not to cards, or changes that are only to
    // the content of cards (not additions/removals or changes to progress).
    queueAvailabilityUpdate();
  });

  function queueAvailabilityUpdate() {
    if (queuedAvailabilityUpdate) {
      return;
    }

    queuedAvailabilityUpdate = delayedCallback(async () => {
      await updateAvailableCards();
      queuedAvailabilityUpdate = undefined;
    });
  }

  async function updateAvailableCards() {
    const availableCards = await cardStore.getAvailableCards();
    store.dispatch(reviewActions.updateAvailableCards(availableCards));
  }
}

export default sync;
