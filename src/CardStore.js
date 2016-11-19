/* eslint-disable no-shadow */

import PouchDB from 'pouchdb';

PouchDB.plugin(require('pouchdb-upsert'));

let prevTimeStamp = 0;

class CardStore {
  constructor(options) {
    this.db = new PouchDB('cards', { storage: 'persistant', ...options });
  }

  getCards() {
    return new Promise((resolve, reject) => {
      this.db.allDocs({ include_docs: true, descending: true }).then(
        result => resolve(result.rows.map(row => row.doc))
      ).catch(err => reject(err));
    });
  }

  putCard(card) {
    // New card
    if (!card._id) {
      return (function tryPutNewCard(card, db) {
        return db.put({ _id: CardStore.generateCardId(), ...card })
          .then(
            result => ({ ...card, _id: result.id, _rev: result.rev }),
            err => {
              if (err.status !== 409) {
                throw err;
              }
              // If we put the card and there was a conflict, it must mean we
              // chose an overlapping ID. Just keep trying until it succeeds.
              return tryPutNewCard(card, db);
            }
          );
      }(card, this.db));
    }

    // Delta update to an existing card
    let completeCard;
    return this.db.upsert(card._id, doc => {
      // Doc was not found -- must have been deleted
      if (!doc._id) {
        return false;
      }
      completeCard = { ...doc, ...card };
      return completeCard;
    }).then(res => {
      if (!res.updated) {
        const err = new Error('missing');
        err.status = 404;
        err.name = 'not_found';
        throw err;
      }
      return completeCard;
    });
  }

  deleteCard(card) {
    return (function tryToDeleteCard(card, db) {
      return db.remove(card)
        .catch(err => {
          if (err.status !== 409) {
            throw err;
          }
          // If there is a conflict, just keep trying
          return db.get(card._id).then(card => { tryToDeleteCard(card, db); });
        });
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
      (`0${timestamp.toString(36)}`).slice(-8)
      // ...then add a random 3-digit sequence to the end in case we
      // simultaneously add a card on another device at precisely the same
      // millisecond.
      + (`00${Math.floor(Math.random() * 46656).toString(36)}`).slice(-3);
    return id;
  }

  onUpdate(func) {
    this.db.changes({ since: 'now',
                      live: true,
                      include_docs: true }).on('change', func);
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
  // |callbacks| is an optional object argument which may provide the following
  // callback functions:
  // - onChange
  // - onPause
  // - onActive
  // - onError
  setSyncServer(syncServer, callbacks) {
    // Setup an alias for error handling
    const reportErrorAsync = err => {
      if (callbacks && callbacks.onError) {
        setImmediate(() => { callbacks.onError(err); });
      }
    };

    // Validate syncServer argument
    if (typeof syncServer !== 'string' &&
        syncServer !== null &&
        syncServer !== undefined &&
        !(typeof syncServer === 'object' &&
          syncServer.constructor === PouchDB)) {
      const err = { code: 'INVALID_SERVER',
                    message: 'Unrecognized type of sync server' };
      reportErrorAsync(err);
      return Promise.reject(err);
    }

    if (typeof syncServer === 'string') {
      syncServer = syncServer.trim();
      if (syncServer &&
          !syncServer.startsWith('http://') &&
          !syncServer.startsWith('https://')) {
        const err = { code: 'INVALID_SERVER',
                      message: 'Only http and https remote servers are'
                              + ' recognized' };
        reportErrorAsync(err);
        return Promise.reject(err);
      }
    }

    if (this.remoteSync) {
      this.remoteSync.cancel();
      this.remoteSync = undefined;
      this.remoteDb = undefined;
    }

    if (!syncServer) {
      return Promise.resolve();
    }

    this.remoteDb = typeof syncServer === 'string'
                    ? new PouchDB(syncServer)
                    : syncServer;

    // Force a connection to the server so we can detect errors immediately
    return this.remoteDb.info()
      .catch(err => {
        this.remoteDb = undefined;
        reportErrorAsync(err);
        throw err;
      }).then(() => {
        this.remoteSync = this.db.sync(this.remoteDb, {
          live: true,
          retry: true,
        });

        // Wrap and set callbacks
        const callbackMap = { change:   'onChange',
                              paused:   'onPause',
                              active:   'onActive',
                              error:    'onError',
                              denied:   'onError',
                              complete: 'onPause' };
        const originalDbName = this.remoteDb.name;
        for (const evt in callbackMap) {
          if (callbacks && callbacks[callbackMap[evt]]) {
            this.remoteSync.on(evt, (...args) => {
              // Skip events if they are from an old remote DB
              if (originalDbName !== this.remoteDb.name) {
                return;
              }
              callbacks[callbackMap[evt]].apply(this, args);
            });
          }
        }

        // As far as I can tell, this.remoteSync is a then-able that resolves
        // when the sync finishes. However, since we specified 'live: true'
        // that's not going to happen any time soon, so we need to be careful
        // *not* to return this.remoteSync here.
        return this.remoteDb;
      });
  }

  // Intended for unit testing only

  destroy() { return this.db.destroy(); }
  getSyncServer() { return this.remoteDb; }
}

export default CardStore;
