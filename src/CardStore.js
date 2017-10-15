/* eslint-disable no-shadow */

import PouchDB from 'pouchdb';

PouchDB.plugin(require('pouchdb-upsert'));

let prevTimeStamp = 0;

const CARD_PREFIX = 'card-';
const PROGRESS_PREFIX = 'progress-';

const stripCardPrefix = id => id.substr(CARD_PREFIX.length);

// Take a card from the DB and turn it into a more appropriate form for
// client consumption
const parseCard = card => ({
  ...card,
  _id: stripCardPrefix(card._id),
  // We deliberately *don't* parse the 'created' or 'modified' fields into
  // Date objects since they're currently not used in the app and so
  // speculatively parsing them would be a waste.
});

const progressFields = ['reviewed', 'level'];
const mergeRecords = (card, progress) => {
  const result = parseCard(card);
  for (const field of progressFields) {
    result[field] = progress[field];
  }
  return result;
};

const cardMapFunction = `function(doc) {
    if (!doc._id.startsWith('${PROGRESS_PREFIX}')) {
      return;
    }

    emit(doc._id, {
      _id: '${CARD_PREFIX}' + doc._id.substr('${PROGRESS_PREFIX}'.length),
      level: doc.level,
      reviewed: doc.reviewed,
    });
  }`;

const newCardMapFunction = `function(doc) {
    if (
      !doc._id.startsWith('${PROGRESS_PREFIX}') ||
      doc.reviewed !== null
    ) {
      return;
    }

    emit(doc._id, {
      _id: '${CARD_PREFIX}' + doc._id.substr('${PROGRESS_PREFIX}'.length),
      level: doc.level,
      reviewed: doc.reviewed,
    });
  }`;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// We add a small exponential factor when calculating the overdue score of
// cards. This is to prevent high-level but very overdue cards from being
// starved by low-level overdue cards.
//
// The value below is chosen so that a card of level 365 that is half a year
// overdue will have a very slightly higher overdueness than a level 1 card that
// is one day overdue.
const EXP_FACTOR = 0.00225;

const getOverduenessFunction = reviewTime =>
  `function(doc) {
    if (
      !doc._id.startsWith('${PROGRESS_PREFIX}') ||
      typeof doc.level !== 'number' ||
      typeof doc.reviewed !== 'number'
    ) {
      return;
    }

    if (doc.level === 0) {
      // Unfortunately 'Infinity' doesn't seem to work here
      emit(Number.MAX_VALUE, {
        _id: '${CARD_PREFIX}' + doc._id.substr('${PROGRESS_PREFIX}'.length),
        level: 0,
        reviewed: doc.reviewed,
      });
    }

    const daysDiff = (${reviewTime.getTime()} - doc.reviewed) / ${MS_PER_DAY};
    const daysOverdue = daysDiff - doc.level;
    const linearComponent = daysOverdue / doc.level;
    const expComponent = Math.exp(${EXP_FACTOR} * daysOverdue) - 1;
    const overdueValue = linearComponent + expComponent;
    emit(overdueValue, {
      _id: '${CARD_PREFIX}' + doc._id.substr('${PROGRESS_PREFIX}'.length),
      level: doc.level,
      reviewed: doc.reviewed,
    });
  }`;

class CardStore {
  constructor(options) {
    const pouchOptions = options && options.pouch ? options.pouch : {};
    if (typeof pouchOptions.auto_compaction === 'undefined') {
      pouchOptions.auto_compaction = true;
    }
    this.db = new PouchDB('cards', { storage: 'persistant', ...pouchOptions });

    this.reviewTime =
      options && options.reviewTime && options.reviewTime instanceof Date
        ? options.reviewTime
        : new Date();

    this.prefetchViews = !options || options.prefetchViews;
    this.initDone = this.db
      .info()
      .then(() => this.updateCardsView())
      .then(() => this.updateNewCardsView())
      .then(() => this.updateOverduenessView())
      .then(() => {
        // Don't return this since we don't want to block on it
        this.db.viewCleanup();
      });
  }

  async getCards(options) {
    return this.initDone
      .then(() => {
        const queryOptions = {
          include_docs: true,
          descending: true,
        };
        if (options && typeof options.limit === 'number') {
          queryOptions.limit = options.limit;
        }

        let view = 'cards';
        const type = options ? options.type : '';
        if (type === 'new') {
          view = 'new_cards';
        } else if (type === 'overdue') {
          view = 'overdueness';
          queryOptions.endkey = 0;
          if (options && options.skipFailedCards) {
            // This really should be Number.MAX_VALUE - .0001 or something like
            // that but that doesn't seem to work and I haven't debugged far
            // enough into PouchDB to find out why.
            //
            // (Really getOverduenessFunction should use Infinity and this
            // should use Number.MAX_VALUE but that too doesn't work.)
            queryOptions.startkey = Number.MAX_SAFE_INTEGER;
          }
        }

        return this.db.query(view, queryOptions);
      })
      .then(result =>
        result.rows.map(row => ({
          ...parseCard(row.doc),
          level: row.value.level,
          reviewed: row.value.reviewed,
        }))
      );
  }

  async updateCardsView() {
    return this._updateMapView('cards', cardMapFunction);
  }

  async updateNewCardsView() {
    return this._updateMapView('new_cards', newCardMapFunction);
  }

  async _updateMapView(view, mapFunction) {
    return this.db
      .upsert(`_design/${view}`, currentDoc => {
        const doc = {
          _id: `_design/${view}`,
          views: {
            [view]: {
              map: mapFunction,
            },
          },
        };

        if (
          currentDoc &&
          currentDoc.views &&
          currentDoc.views[view] &&
          currentDoc.views[view].map &&
          currentDoc.views[view].map === doc.views[view].map
        ) {
          return false;
        }

        return doc;
      })
      .then(result => {
        if (!result.updated || !this.prefetchViews) {
          return;
        }

        this.db.query(view, { limit: 0 }).catch(() => {
          // Ignore errors from this. We hit this often during unit tests where
          // we destroy the database before the query gets a change to run.
        });
      });
  }

  async putCard(card) {
    // New card
    if (!card._id) {
      return this._putNewCard(card);
    }

    // Split out changes into changes to the progress record vs changes to the
    // card itself.
    const commonFields = ['_id', '_rev'];
    const progressUpdate = {};
    const cardUpdate = {};
    for (const [field, value] of Object.entries(card)) {
      if (commonFields.includes(field)) {
        continue;
      }

      if (progressFields.includes(field)) {
        progressUpdate[field] = value;
      } else {
        cardUpdate[field] = value;
      }
    }

    const cardRecord = await this._updateCard(card._id, cardUpdate);
    const progressRecord = await this._updateProgress(card._id, progressUpdate);

    return mergeRecords(cardRecord, progressRecord);
  }

  async _putNewCard(card) {
    const cardToPut = {
      ...card,
      created: JSON.parse(JSON.stringify(new Date())),
      modified: JSON.parse(JSON.stringify(new Date())),
    };

    return (async function tryPutNewCard(card, db, id) {
      let putCardResult;
      try {
        putCardResult = await db.put({ ...cardToPut, _id: CARD_PREFIX + id });
      } catch (err) {
        if (err.status !== 409) {
          throw err;
        }
        // If we put the card and there was a conflict, it must mean we
        // chose an overlapping ID. Just keep trying until it succeeds.
        return tryPutNewCard(card, db, CardStore.generateCardId());
      }

      const newCard = {
        ...cardToPut,
        _id: CARD_PREFIX + id,
        _rev: putCardResult.rev,
      };

      // Succeeded in putting the card. Now to add a corresponding progress
      // record. We have a unique card ID so there can't be any overlapping
      // progress record unless something is very wrong.
      const progressToPut = {
        _id: PROGRESS_PREFIX + id,
        reviewed: null,
        level: 0,
      };
      try {
        await db.put(progressToPut);
      } catch (err) {
        console.error(`Unexpected error putting progress record: ${err}`);
        await db.remove({ _id: CARD_PREFIX + id, _rev: putCardResult.rev });
        throw err;
      }

      return mergeRecords(newCard, progressToPut);
    })(cardToPut, this.db, CardStore.generateCardId());
  }

  async _updateCard(id, update) {
    let card;
    let missing = false;
    await this.db.upsert(CARD_PREFIX + id, doc => {
      // Doc was not found -- must have been deleted
      if (!doc._id) {
        missing = true;
        return false;
      }

      // If we ever end up speculatively parsing date fields into Date objects
      // in parseCard, then we'll need special handling here to make sure we
      // write and return the correct formats.
      card = {
        ...doc,
        ...update,
        _id: CARD_PREFIX + id,
      };

      if (!Object.keys(update).length) {
        return false;
      }

      card.modified = JSON.parse(JSON.stringify(new Date()));

      return card;
    });

    if (missing) {
      const err = new Error('missing');
      err.status = 404;
      err.name = 'not_found';
      throw err;
    }

    return card;
  }

  async _updateProgress(id, update) {
    let progress;
    let missing = false;
    await this.db.upsert(PROGRESS_PREFIX + id, doc => {
      // Doc was not found -- must have been deleted
      if (!doc._id) {
        missing = true;
        return false;
      }

      let hasChange = false;
      if (
        update &&
        update.reviewed &&
        update.reviewed instanceof Date &&
        doc.reviewed !== update.reviewed.getTime()
      ) {
        doc.reviewed = update.reviewed.getTime();
        hasChange = true;
      }
      if (update && update.level && doc.level !== update.level) {
        doc.level = update.level;
        hasChange = true;
      }

      progress = doc;

      if (!hasChange) {
        return false;
      }

      return doc;
    });

    if (missing) {
      const err = new Error('missing');
      err.status = 404;
      err.name = 'not_found';
      throw err;
    }

    return progress;
  }

  async getCard(id) {
    const card = await this.db.get(CARD_PREFIX + id);
    const progress = await this.db.get(PROGRESS_PREFIX + id);

    // We stack the card fields on top of the progress fields since parseCard
    // expects the _id to be prefixed by CARD_PREFIX not PROGRESS_PREFIX.
    return parseCard({ ...progress, ...card });
  }

  async deleteCard(card) {
    const stubbornDelete = async (doc, db) => {
      try {
        return await db.remove(doc);
      } catch (err) {
        if (err.status !== 409) {
          throw err;
        }
        // If there is a conflict, just keep trying
        doc = await db.get(doc._id);
        return stubbornDelete(doc, db);
      }
    };

    await stubbornDelete({ ...card, _id: CARD_PREFIX + card._id }, this.db);

    let progress;
    try {
      progress = await this.db.get(PROGRESS_PREFIX + card._id);
    } catch (err) {
      // If the progress record doesn't exist, that's fine.
      if (err.status === 404) {
        return;
      }
      throw err;
    }

    await stubbornDelete(progress, this.db);
  }

  static generateCardId() {
    // Start off with the number of milliseconds since 1 Jan 2016.
    let timestamp = Date.now() - Date.UTC(2016, 0, 1);

    // We need to make sure we don't overlap with previous records however.
    // If we do, we just keep incrementing the timestamp---that might mean the
    // sorting results are slightly off if, for example, we do a bulk import of
    // 10,000 cards while simultaneously adding cards on another device, but
    // it's good enough.
    if (timestamp <= prevTimeStamp) {
      timestamp = ++prevTimeStamp;
    }
    prevTimeStamp = timestamp;

    const id =
      // We take the timestamp, converted to base 36, and zero-pad it so it
      // collates correctly for at least 50 years...
      `0${timestamp.toString(36)}`.slice(-8) +
      // ...then add a random 3-digit sequence to the end in case we
      // simultaneously add a card on another device at precisely the same
      // millisecond.
      `00${Math.floor(Math.random() * 46656).toString(36)}`.slice(-3);
    return id;
  }

  get changes() {
    const eventEmitter = this.db.changes({
      since: 'now',
      live: true,
      include_docs: true,
    });

    // Wrap callbacks to strip ID prefix
    const originalOnFn = eventEmitter.on;
    eventEmitter.on = (eventName, listener) => {
      if (eventName !== 'change') {
        console.error("Events other than 'change' are not yet supported");
        // (Read: I haven't botherered wrapping them yet.)
        return;
      }
      originalOnFn.call(eventEmitter, eventName, async arg => {
        console.assert(arg.changes && arg.doc, 'Unexpected changes event');

        if (arg.doc._id.startsWith(CARD_PREFIX)) {
          const id = stripCardPrefix(arg.id);
          const progress = await this.db.get(PROGRESS_PREFIX + id);
          listener({
            ...arg,
            id,
            doc: parseCard({ ...progress, ...arg.doc }),
          });
        } else if (arg.doc._id.startsWith(PROGRESS_PREFIX)) {
          // TODO
        }
      });
    };

    return eventEmitter;
  }

  async updateOverduenessView() {
    return this.db
      .upsert('_design/overdueness', () => ({
        _id: '_design/overdueness',
        views: {
          overdueness: {
            map: getOverduenessFunction(this.reviewTime),
          },
        },
      }))
      .then(() => {
        if (!this.prefetchViews) {
          return;
        }

        // Don't return the promise from this. Just trigger the query so it can
        // run in the background.
        this.db.query('overdueness', { limit: 0 }).catch(() => {
          // Ignore errors from this. We hit this often during unit tests where
          // we destroy the database before the query gets a change to run.
        });
      });
  }

  async setReviewTime(reviewTime) {
    this.reviewTime = reviewTime;
    return this.initDone.then(() => this.updateOverduenessView()).then(() => {
      // Don't return this because we don't want to block on it
      this.db.viewCleanup();
    });
  }

  // Sets a server for synchronizing with and begins live synchonization.
  //
  // |syncServer| may be any of the following:
  // - A string with the address of a remote server (beginning 'http://' or
  //   'https://')
  // - A PouchDB instance (for unit testing -- we should have have waited on
  //   then() before calling this since PouchDB seems to drop then() after
  //   calling it. Odd.)
  // - Null / undefined / empty string to clear the association with the
  //   existing remote server, if any.
  //
  // |options| is an optional object argument which may provide the following
  // callback functions:
  // - onChange
  // - onPause
  // - onActive
  // - onError
  // as well as the |batchSize| member for specifying the number of records
  // to include in a batch.
  async setSyncServer(syncServer, options) {
    // Setup an alias for error handling
    const reportErrorAsync = err => {
      if (options && options.onError) {
        setImmediate(() => {
          options.onError(err);
        });
      }
    };

    // Validate syncServer argument
    if (
      typeof syncServer !== 'string' &&
      syncServer !== null &&
      syncServer !== undefined &&
      !(typeof syncServer === 'object' && syncServer.constructor === PouchDB)
    ) {
      const err = {
        code: 'INVALID_SERVER',
        message: 'Unrecognized type of sync server',
      };
      reportErrorAsync(err);
      throw err;
    }

    if (typeof syncServer === 'string') {
      syncServer = syncServer.trim();
      if (
        syncServer &&
        !syncServer.startsWith('http://') &&
        !syncServer.startsWith('https://')
      ) {
        const err = {
          code: 'INVALID_SERVER',
          message: 'Only http and https remote servers are recognized',
        };
        reportErrorAsync(err);
        throw err;
      }
    }

    await this.initDone;

    if (this.remoteSync) {
      this.remoteSync.cancel();
      this.remoteSync = undefined;
    }

    this.remoteDb = undefined;

    if (!syncServer) {
      return;
    }

    let dbOptions;
    if (options && options.username) {
      dbOptions = {
        auth: {
          username: options.username,
          password: options.password,
        },
      };
    }
    this.remoteDb =
      typeof syncServer === 'string'
        ? new PouchDB(syncServer, dbOptions)
        : syncServer;

    const originalDbName = this.remoteDb.name;

    // Initial sync
    let localUpdateSeq;
    let remoteUpdateSeq;
    try {
      const localInfo = await this.db.info();
      localUpdateSeq = parseInt(localInfo.update_seq, 10);

      const remoteInfo = await this.remoteDb.info();
      remoteUpdateSeq = parseInt(remoteInfo.update_seq, 10);
    } catch (err) {
      // Skip error if the remote DB has already been changed.
      // This happens, for example, if we cancel while attempting to connect
      // to a server.
      if (!this.remoteDb || originalDbName !== this.remoteDb.name) {
        return;
      }
      this.remoteDb = undefined;
      reportErrorAsync(err);
      throw err;
    }

    const pushPullOpts =
      options && options.batchSize
        ? { batch_size: options.batchSize }
        : undefined;
    // Don't push design docs since in many cases we'll be authenticating as
    // a user that doesn't have permission to write design docs. Some of the
    // design docs we create are also very temporary.
    const pushOpts = {
      ...pushPullOpts,
      filter: doc => {
        return !doc._id.startsWith('_design/');
      },
    };
    this.remoteSync = this.db.sync(this.remoteDb, {
      live: true,
      retry: true,
      pull: pushPullOpts,
      push: pushOpts,
    });

    // Wrap and set callbacks
    const wrapCallback = (evt, callback) => {
      return (...args) => {
        // Skip events if they are from an old remote DB
        if (!this.remoteDb || originalDbName !== this.remoteDb.name) {
          return;
        }

        // Calculate progress. Null means 'indeterminate' which is
        // what we report for all but the initial sync.
        if (evt === 'change') {
          let progress = null;
          if (
            typeof localUpdateSeq === 'number' &&
            typeof remoteUpdateSeq === 'number' &&
            args[0] &&
            args[0].change &&
            args[0].change.last_seq
          ) {
            const upper = Math.max(localUpdateSeq, remoteUpdateSeq);
            const lower = Math.min(localUpdateSeq, remoteUpdateSeq);
            const current = parseInt(args[0].change.last_seq, 10);

            // In some cases such as when our initial sync is
            // a bidirectional sync, we can't really produce a reliable
            // progress value. In future we will fix this by using CouchDB
            // 2.0's 'pending' value (once PouchDB exposes it) and possibly
            // do a separate download then upload as part of the initial
            // sync. For now, we just fall back to using an indeterminate
            // progress value if we detect such a case.
            if (current < lower || upper === lower) {
              localUpdateSeq = undefined;
              remoteUpdateSeq = undefined;
            } else {
              progress = (current - lower) / (upper - lower);
            }
          }
          args[0].progress = progress;
        }

        // We only report progress for the initial sync
        if (evt === 'paused') {
          localUpdateSeq = undefined;
          remoteUpdateSeq = undefined;
        }

        if (callback) {
          callback.apply(this, args);
        }
      };
    };

    const callbackMap = {
      change: 'onChange',
      paused: 'onIdle',
      active: 'onActive',
      error: 'onError',
      denied: 'onError',
    };
    if (options) {
      // eslint-disable-next-line guard-for-in
      for (const evt in callbackMap) {
        // TODO: This probably needs to call parseCard for the onChange
        // callback.
        this.remoteSync.on(evt, wrapCallback(evt, options[callbackMap[evt]]));
      }
    }

    // As far as I can tell, this.remoteSync is a then-able that resolves
    // when the sync finishes. However, since we specified 'live: true'
    // that's not going to happen any time soon, so we need to be careful
    // *not* to wait on this.remoteSync here.
    await this.remoteDb;
  }

  // Intended for unit testing only

  destroy() {
    return this.db.destroy();
  }
  getSyncServer() {
    return this.remoteDb;
  }
  async hasProgressRecord(id) {
    try {
      await this.db.get(PROGRESS_PREFIX + id);
      return true;
    } catch (err) {
      return false;
    }
  }
}

export default CardStore;
