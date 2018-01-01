// Wrapper around CardStore that listens for various changes relating to review
// state.

let delayedCallback;
let cancelDelayedCallback;

if (typeof window === 'object') {
  if ('requestIdleCallback' in window) {
    delayedCallback = requestIdleCallback;
    cancelDelayedCallback = cancelIdleCallback;
  } else {
    delayedCallback = requestAnimationFrame;
    cancelDelayedCallback = cancelAnimationFrame;
  }
} else {
  delayedCallback = setImmediate;
  cancelDelayedCallback = clearImmediate;
}

class ReviewSyncListener {
  constructor(cardStore) {
    this.cardStore = cardStore;

    this.listeners = {
      availableCards: [],
    };
    this.availableCards = undefined;

    this.queuedAvailabilityUpdate = undefined;
    this.cardStore.changes.on('change', () => {
      // TODO: If the change is only a change to the card contents we probably
      // don't need to update this.
      if (
        this.listeners.availableCards.length &&
        !this.queuedAvailabilityUpdate
      ) {
        this.queuedAvailabilityUpdate = delayedCallback(async () => {
          await this._updateAvailableCards();
          this.queuedAvailabilityUpdate = undefined;
        });
      }
    });
  }

  subscribe(topic, listener) {
    if (!this.listeners.hasOwnProperty(topic)) {
      console.error(`Unrecognized topic: ${topic}`);
      return;
    }

    const topicListeners = this.listeners[topic];
    if (topicListeners.includes(listener)) {
      console.warn(`Listener for ${topic} already registered`);
      return;
    }

    topicListeners.push(listener);

    // If this is the first listener for availableCards, look it up right away.
    if (
      topic === 'availableCards' &&
      typeof this.availableCards === 'undefined' &&
      topicListeners.length === 1
    ) {
      if (this.queuedAvailabilityUpdate) {
        cancelDelayedCallback(this.queuedAvailabilityUpdate);
      }
      this._updateAvailableCards();
    }
  }

  unsubscribe(topic, listener) {
    if (!this.listeners.hasOwnProperty(topic)) {
      console.error(`Unrecognized topic: ${topic}`);
      return;
    }

    const topicListeners = this.listeners[topic];
    const index = topicListeners.indexOf(listener);
    if (index === -1) {
      console.warn(`Couldn't find listener to remove for ${topic}`);
      return;
    }

    topicListeners.splice(index, 1);

    // If there are no more listeners for availableCards, clear the cached
    // version so we don't return stale data.
    if (topic === 'availableCards' && topicListeners.length === 0) {
      this.availableCards = undefined;
    }
  }

  async _updateAvailableCards() {
    this.availableCards = await this.cardStore.getAvailableCards();
    for (const listener of this.listeners.availableCards) {
      listener(this.availableCards);
    }
  }
}

export default ReviewSyncListener;
