/* eslint-disable no-shadow */

import PouchDB from 'pouchdb';

PouchDB.plugin(require('pouchdb-upsert'));

let prevTimeStamp = 0;

class CardStore {
  constructor(options) {
    this.db = new PouchDB('cards', { storage: 'persistant', ...options });
  }

  async getCards() {
    const result = await this.db.allDocs({
      include_docs: true,
      descending: true,
    });
    return result.rows.map(row => row.doc);
  }

  async putCard(card) {
    // New card
    if (!card._id) {
      return (async function tryPutNewCard(card, db) {
        try {
          const result = await db.put({
            _id: CardStore.generateCardId(),
            ...card,
          });
          return { ...card, _id: result.id, _rev: result.rev };
        } catch (err) {
          if (err.status !== 409) {
            throw err;
          }
          // If we put the card and there was a conflict, it must mean we
          // chose an overlapping ID. Just keep trying until it succeeds.
          return tryPutNewCard(card, db);
        }
      }(card, this.db));
    }

    // Delta update to an existing card
    let completeCard;
    const result = await this.db.upsert(card._id, doc => {
      // Doc was not found -- must have been deleted
      if (!doc._id) {
        return false;
      }
      completeCard = { ...doc, ...card };
      return completeCard;
    });
    if (!result.updated) {
      const err = new Error('missing');
      err.status = 404;
      err.name = 'not_found';
      throw err;
    }
    return completeCard;
  }

  getCard(id) {
    return this.db.get(id);
  }

  deleteCard(card) {
    return (async function tryToDeleteCard(card, db) {
      try {
        return await db.remove(card);
      } catch (err) {
        if (err.status !== 409) {
          throw err;
        }
        // If there is a conflict, just keep trying
        card = await db.get(card._id);
        return tryToDeleteCard(card, db);
      }
    }(card, this.db));
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
    return this.db.changes({
      since: 'now',
      live: true,
      include_docs: true,
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
    this.remoteSync = this.db.sync(this.remoteDb, {
      live: true,
      retry: true,
      pull: pushPullOpts,
      push: pushPullOpts,
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
}

export default CardStore;
