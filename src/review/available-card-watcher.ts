import { AvailableCards } from '../model';
import { getOverdueness } from './overdueness';
import { CardChange } from '../store/CardStore';
import { DataStore } from '../store/DataStore';
import {
  cancelIdleCallback,
  requestIdleCallback,
} from '../utils/request-idle-callback';
import { findIdInArray } from '../utils/search-id-array';

// A wrapper around a DataStore that watches the set of new and overdue cards
// so that we can quickly populate new reviews, update existing reviews, and
// provide status about how many cards are available to review.

// XXX We should also use this class to:
//
// - Pre-emptively fetch the available cards on load so that we're not waiting
//   for it.
// - Re-run the initial query at some point shortly after since it seems like
//   sometimes the index can get stale.
// - Re-run the query whenever the review time is updated.
//
// XXX This should also mean we drop the review time from the DataStore and also
// drop the getOverdueCards / getNewCards / getAvailableCards methods from
// CardStore/DataStore and leave just a version of getAvailableCards that
// returhs a list of IDs + progress information.

const enum QueryState {
  // Waiting to run the query for the current reviewTime
  Waiting,
  // Actually running the query
  Updating,
  // Query complete
  Ok,
  // Query failed
  Error,
}

export type AvailableCardsCallback = (availableCards: AvailableCards) => void;

export class AvailableCardWatcher {
  private dataStore: DataStore;
  private reviewTime: Date;

  // New cards sorted by ID (which corresponds to creation order).
  private newCards: Array<string> = [];

  // Overdue cards along with their overdueness.
  //
  // We don't sort these since although they will ultimately be sorted by
  // overdueness but that value can change (so we can't use it as a lookup key).
  // Instead we use a Map to accommodate quick updates when syncing.
  private overdueCards: Map<string, number> = new Map();

  private initialQueryState: QueryState = QueryState.Waiting;
  private queryPromise: Promise<void> | undefined;
  private idleQueryHandle: number | null = null;
  private timeoutQueryHandle: number | null = null;

  private listeners: Array<AvailableCardsCallback> = [];

  constructor({
    dataStore,
    reviewTime,
  }: {
    dataStore: DataStore;
    reviewTime: Date;
  }) {
    this.dataStore = dataStore;
    this.reviewTime = reviewTime;

    this.handleChange = this.handleChange.bind(this);
    this.dataStore.changes.on('card', this.handleChange);

    this.triggerInitialQuery();
    // XXX Also trigger subsequent update to accommodate stale indices
    // (Do this inside triggerInitialQuery?)
  }

  disconnect() {
    this.dataStore.changes.off('card', this.handleChange);

    if (this.idleQueryHandle !== null) {
      cancelIdleCallback(this.idleQueryHandle);
      this.idleQueryHandle = null;
    }

    if (this.timeoutQueryHandle !== null) {
      clearTimeout(this.timeoutQueryHandle);
      this.timeoutQueryHandle = null;
    }

    this.listeners = [];
  }

  addListener(callback: AvailableCardsCallback) {
    if (this.listeners.indexOf(callback) !== -1) {
      return;
    }
    this.listeners.push(callback);
  }

  removeListener(callback: AvailableCardsCallback) {
    const index = this.listeners.indexOf(callback);
    if (index === -1) {
      return;
    }
    this.listeners.splice(index, 1);
  }

  private handleChange(change: CardChange) {
    let changed = false;

    // Is it an existing new card?
    const [isInNewCardQueue, newCardIndex] = findIdInArray(
      change.card.id,
      this.newCards
    );
    const isNewCard = !change.deleted && change.card.progress.due === null;
    if (isInNewCardQueue) {
      if (isNewCard) {
        return;
      }
      // Remove from new card queue
      this.newCards.splice(newCardIndex, 1);
      changed = true;
    } else if (isNewCard) {
      // Add to new card queue
      this.newCards.splice(newCardIndex, 0, change.card.id);
      changed = true;
    }

    // Is it an existing overdue card?
    const existingOverdueness = this.overdueCards.get(change.card.id);
    const wasOverdue = typeof existingOverdueness !== 'undefined';
    // Calculate an overdueness score that will be negative if the card is not
    // overdue.
    const isOverdue =
      !change.deleted &&
      change.card.progress.due !== null &&
      change.card.progress.due <= this.reviewTime;
    const newOverdueness = isOverdue
      ? getOverdueness(change.card.progress!, this.reviewTime.getTime())
      : -1;

    if (!wasOverdue && isOverdue) {
      this.overdueCards.set(change.card.id, newOverdueness);
      changed = true;
    } else if (wasOverdue && !isOverdue) {
      this.overdueCards.delete(change.card.id);
      changed = true;
    } else if (
      wasOverdue &&
      isOverdue &&
      newOverdueness !== existingOverdueness
    ) {
      this.overdueCards.set(change.card.id, newOverdueness);
      changed = true;
    }

    if (changed) {
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    const availableCards: AvailableCards = {
      newCards: this.newCards.length,
      overdueCards: this.overdueCards.size,
    };

    // Copy listeners first in case one of the listeners mutates the array
    const listeners = this.listeners.slice();
    for (const listener of listeners) {
      listener(availableCards);
    }
  }

  private triggerInitialQuery() {
    if (this.idleQueryHandle !== null) {
      return;
    }

    // Avoid having two overlapping delayed queries
    if (this.timeoutQueryHandle !== null) {
      clearTimeout(this.timeoutQueryHandle);
      this.timeoutQueryHandle = null;
    }

    this.initialQueryState = QueryState.Waiting;
    this.idleQueryHandle = requestIdleCallback(
      async () => {
        this.idleQueryHandle = null;
        this.initialQueryState = QueryState.Updating;
        try {
          await this.runQuery();
          this.initialQueryState = QueryState.Ok;
        } catch (e) {
          console.error('Failed to query database.');
          console.error(e);
          this.initialQueryState = QueryState.Error;
        }
      },
      { timeout: 5000 }
    );
  }

  private async makeSureDataIsReady() {
    switch (this.initialQueryState) {
      case QueryState.Ok:
        return;

      case QueryState.Waiting:
        console.assert(
          this.idleQueryHandle !== null,
          'We should have an idle callback handle if we are in the waiting state'
        );

        cancelIdleCallback(this.idleQueryHandle!);
        this.idleQueryHandle = null;

        this.initialQueryState = QueryState.Updating;
        this.runQuery(); // Don't await, we'll do that below.

        break;

      case QueryState.Error:
        // Retry
        this.initialQueryState = QueryState.Updating;
        this.runQuery(); // Don't await, we'll do that below.
        break;

      case QueryState.Updating:
        // Nothing extra to do here.
        break;
    }

    console.assert(
      this.initialQueryState === QueryState.Updating,
      'Should be in the updating state'
    );
    console.assert(
      typeof this.queryPromise !== 'undefined',
      'Should have a query promise if we are in the updating state'
    );

    try {
      await this.queryPromise;
      this.initialQueryState = QueryState.Ok;
    } catch (e) {
      this.initialQueryState = QueryState.Error;
      throw e;
    }
  }

  private runQuery(): Promise<void> {
    // This does NOT update the initial query state since this can be run
    // subsequent to the initial query and we don't need to block on those
    // subsequent updates.
    this.queryPromise = new Promise((resolve, reject) => {
      const reviewTimeAsNumber = this.reviewTime.getTime();
      this.dataStore
        .getAvailableCards2({ reviewTime: this.reviewTime })
        .then(availableCards => {
          const prevNewCards = this.newCards;
          this.newCards = availableCards
            .filter(([id, progress]) => progress.due === null)
            .map(([id, progress]) => id);

          const prevOverdueCards = this.overdueCards;
          this.overdueCards = new Map(
            availableCards
              .filter(([id, progress]) => progress.due !== null)
              .map(([id, progress]) => [
                id,
                getOverdueness(progress, reviewTimeAsNumber),
              ])
          );

          const serializeOverdueCards = (map: Map<string, number>): string =>
            JSON.stringify(
              [...map.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([id, _]) => id)
            );
          if (
            JSON.stringify(prevNewCards) !== JSON.stringify(this.newCards) ||
            serializeOverdueCards(prevOverdueCards) !==
              serializeOverdueCards(this.overdueCards)
          ) {
            this.notifyListeners();
          }

          resolve();
        })
        .catch(e => reject(e));
    });
    return this.queryPromise;
  }

  // XXX Method for updating the review time
  //   -- Needs to cancel idle callback
  //   -- Needs to cancel timeout callback

  isLoading(): boolean {
    return this.initialQueryState !== QueryState.Ok;
  }

  async getNumAvailableCards(): Promise<AvailableCards> {
    await this.makeSureDataIsReady();
    return {
      newCards: this.newCards.length,
      overdueCards: this.overdueCards.size,
    };
  }

  async getNewCards(limit: number): Promise<Array<string>> {
    await this.makeSureDataIsReady();
    return this.newCards.slice(0, limit);
  }

  async getOverdueCards(limit: number): Promise<Array<string>> {
    await this.makeSureDataIsReady();
    const result = [...this.overdueCards.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, progress]) => id);
    return result;
  }
}
