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

const enum QueryState {
  // Waiting to run the query
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
    initialReviewTime,
  }: {
    dataStore: DataStore;
    initialReviewTime?: Date;
  }) {
    this.dataStore = dataStore;

    // Round the review time down to the past hour. This just makes debugging
    // simpler and it shouldn't make a difference to the result since due
    // times should be rounded to the nearest hour anyway.
    //
    // However, if we are _just_ about to tick over to the next hour, then we
    // want to avoid a situation where by the time the query finishes the hour
    // has changed since that could introduce an awkward situation where we mark
    // a card as failed that has a due date in the future (and hence is not
    // treated as overdue). So we round up if we're only a few seconds away.
    //
    // To avoid needing to reproduce this logic when testing, however, we
    // provide an optional parameter to force the initialReviewTime to some
    // known value.
    if (initialReviewTime) {
      this.reviewTime = new Date(initialReviewTime);
    } else {
      const reviewTime = new Date();
      if (reviewTime.getMinutes() >= 59 && reviewTime.getSeconds() >= 45) {
        reviewTime.setHours(reviewTime.getHours() + 1, 0, 0, 0);
      } else {
        reviewTime.setMinutes(0, 0, 0);
      }
      this.reviewTime = reviewTime;
    }

    this.handleChange = this.handleChange.bind(this);
    this.dataStore.changes.on('card', this.handleChange);

    this.scheduleInitialQuery();
    this.scheduleDelayedUpdate();
    this.scheduleReviewTimeUpdate();
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
      // Update the overdueness in the map, but don't call listeners unless the
      // _order_ of overdue cards has changed.
      const prevOverdueCards = new Map(this.overdueCards);
      this.overdueCards.set(change.card.id, newOverdueness);
      changed = !areOverdueCardMapsEqual(prevOverdueCards, this.overdueCards);
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

  private scheduleInitialQuery() {
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

  private scheduleDelayedUpdate() {
    // For some reason we seem to hit a case where the index can be stale even
    // several seconds after the app has loaded. I've no idea how PouchDB
    // schedules the updates to the index (people assert that the index is
    // always up-to-date unless you use 'stale: ok' but that doesn't apply to
    // MangoDB queries which clearly do appear to be out-of-date sometimes).
    //
    // So, the best we can do is simply scheduled another delayed update and
    // hope it picks something up.
    //
    // This might not be necessary once we switch to the indexeddb adapter,
    // we'll see.
    if (this.timeoutQueryHandle !== null) {
      return;
    }

    // We set the timeout for the initial query to be 5s so we should wait at
    // least 5s.
    this.timeoutQueryHandle = self.setTimeout(() => {
      this.timeoutQueryHandle = null;
      this.runQuery();
    }, 10000);
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
    // Ignore any rejections from the existing promise.
    if (this.queryPromise) {
      const existingPromise = this.queryPromise;
      existingPromise.catch(() => {
        /* Ignore */
      });
    }

    // This does NOT update the initial query state since this can be run
    // subsequent to the initial query and we don't need to block on those
    // subsequent updates.
    this.queryPromise = new Promise((resolve, reject) => {
      const reviewTimeAsNumber = this.reviewTime.getTime();
      this.dataStore
        .getAvailableCards2({ reviewTime: this.reviewTime })
        .then(availableCards => {
          // If the review time was changed while the query was running, abort.
          if (this.reviewTime.getTime() !== reviewTimeAsNumber) {
            const abortError = new Error('Query aborted');
            abortError.name = 'AbortError';
            reject(abortError);
            return;
          }

          const prevNewCards = this.newCards;
          this.newCards = availableCards
            .filter(([_, progress]) => progress.due === null)
            .map(([id, _]) => id);

          const prevOverdueCards = this.overdueCards;
          this.overdueCards = new Map(
            availableCards
              .filter(([_, progress]) => progress.due !== null)
              .map(([id, progress]) => [
                id,
                getOverdueness(progress, reviewTimeAsNumber),
              ])
          );

          if (
            JSON.stringify(prevNewCards) !== JSON.stringify(this.newCards) ||
            !areOverdueCardMapsEqual(prevOverdueCards, this.overdueCards)
          ) {
            this.notifyListeners();
          }

          resolve();
        })
        .catch(e => reject(e));
    });
    return this.queryPromise;
  }

  private scheduleReviewTimeUpdate() {
    // We re-run the whole query every hour since review times are rounded to
    // the nearest hour.
    const newReviewTime = new Date(this.reviewTime);
    // TODO: Switch to just using jest's timers
    newReviewTime.setHours(this.reviewTime.getHours() + 1, 0, 0, 0);

    const delay = newReviewTime.getTime() - Date.now();
    if (delay <= 0) {
      console.error(`Got expected delay for updating review time: ${delay}`);
      return;
    }

    self.setTimeout(() => {
      this.setReviewTime(newReviewTime);
      this.scheduleReviewTimeUpdate();
    }, delay);
  }

  private setReviewTime(reviewTime: Date) {
    this.reviewTime = reviewTime;

    // Cancel any existing idle callback
    if (this.idleQueryHandle !== null) {
      cancelIdleCallback(this.idleQueryHandle);
      this.idleQueryHandle = null;
    }

    // No need to cancel any setTimeout call since scheduleInitialQuery does
    // that for us.

    this.scheduleInitialQuery();
  }

  getReviewTime(): Date {
    return this.reviewTime;
  }

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

  async getNewCards(): Promise<ReadonlyArray<string>> {
    await this.makeSureDataIsReady();
    return this.newCards.slice();
  }

  async getOverdueCards(): Promise<Array<string>> {
    await this.makeSureDataIsReady();
    const result = [...this.overdueCards.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, _]) => id);
    return result;
  }
}

function areOverdueCardMapsEqual(
  a: Map<string, number>,
  b: Map<string, number>
): boolean {
  const serializeOverdueCards = (map: Map<string, number>): string =>
    JSON.stringify(
      [...map.entries()].sort((a, b) => b[1] - a[1]).map(([id, _]) => id)
    );
  return serializeOverdueCards(a) === serializeOverdueCards(b);
}
