import { AvailableCards } from '../model';
import { getOverdueness } from './overdueness';
import { CardChange } from '../store/CardStore';
import { DataStore } from '../store/DataStore';
import {
  cancelIdleCallback,
  requestIdleCallback,
} from '../utils/request-idle-callback';

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

export class AvailableCardWatcher {
  private dataStore: DataStore;
  private reviewTime: Date;

  // New cards sorted by ID (which corresponds to creation order).
  private newCards: Array<string>;

  // Overdue cards along with their overdueness.
  //
  // We don't sort these since although they will ultimately be sorted by
  // overdueness but that value can change (so we can't use it as a lookup key).
  // Instead we use a Map to accommodate quick updates when syncing.
  private overdueCards: Map<string, number>;

  private initialQueryState: QueryState;
  private queryPromise: Promise<void> | undefined;
  private idleQueryHandle: number | null;
  private timeoutQueryHandle: number | null;
  // XXX Listeners

  constructor({
    dataStore,
    reviewTime,
  }: {
    dataStore: DataStore;
    reviewTime: Date;
  }) {
    this.dataStore = dataStore;
    this.reviewTime = reviewTime;

    this.newCards = [];
    this.overdueCards = new Map();

    this.handleChange = this.handleChange.bind(this);
    this.dataStore.changes.on('card', this.handleChange);

    this.idleQueryHandle = null;
    this.triggerInitialQuery();
    // XXX Also trigger subsequent update to accommodate stale indices
    // (Do this inside triggerInitialQuery?)
  }

  disconnect() {
    this.dataStore.changes.off('card', this.handleChange);
    // XXX Cancel any idle callback
    // XXX Cancel any timeout callback
    // XXX Drop listeners to be sure
  }

  private handleChange(change: CardChange) {
    // XXX
    // Is it a new card?
    //   Is it no longer new / deleted?
    //   --> Remove from new queue
    //   Is it now overdue? (but not deleted)
    //   --> Add to overdueCards if so.
    // Is it an overdue card?
    //   Is it no longer overdue / deleted?
    //   --> Remove from the overdue set
    //   Is it now new? (but not deleted)
    //   --> Add to new queue in the sorted position
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
          this.newCards = availableCards
            .filter(([id, progress]) => progress.due === null)
            .map(([id, progress]) => id);

          this.overdueCards = new Map(
            availableCards
              .filter(([id, progress]) => progress.due !== null)
              .map(([id, progress]) => [
                id,
                getOverdueness(progress, reviewTimeAsNumber),
              ])
          );

          // XXX This needs to trigger listeners if something changed.

          resolve();
        })
        .catch(e => reject(e));
    });
    return this.queryPromise;
  }

  // XXX Methods for registering / unregistering listeners
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
