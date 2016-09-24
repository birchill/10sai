import PouchDB from 'pouchdb';

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
    return this.db.put({ _id: CardStore.generateCardId(), ...card })
      .then(result => ({ ...card, _id: result.id, _rev: result.rev }));
  }

  deleteCard(card) {
    return this.db.remove(card);
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

  // Sets a server for synchronizing with an begins live synchonization.
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
    // Fill out callbacks with empty functions as-needed
    if (!callbacks) {
      callbacks = {};
    }
    [ 'onChange', 'onPause', 'onActive', 'onError' ].forEach(key => {
      callbacks[key] = callbacks[key] || (() => {});
    });

    // Validate syncServer argument
    if (typeof syncServer !== 'string' &&
        syncServer !== null &&
        syncServer !== undefined &&
        !(typeof syncServer === 'object' &&
          syncServer.constructor === PouchDB)) {
      const err = { code: 'INVALID_SERVER',
                    message: 'Unrecognized type of sync server' };
      setImmediate(() => { callbacks.onError(err); });
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
        setImmediate(() => { callbacks.onError(err); });
        return Promise.reject(err);
      }
    }

    // XXX Skip this if the server hasn't, in fact, changed
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
        setImmediate(() => { callbacks.onError(err); });
        throw err;
      }).then(() => {
        this.remoteSync = this.db.sync(this.remoteDb, {
          live: true,
          retry: true,
        })
        // XXX Go through and tidy up the input before passing along to the
        // callbacks
        // XXX Doesn't onUpdate above cover the 'change' case?
        .on('change',   callbacks.onChange)
        .on('paused',   callbacks.onPause)
        .on('active',   callbacks.onActive)
        .on('error',    callbacks.onError)
        .on('denied',   callbacks.onError)
        .on('complete', callbacks.onPause);

        // As far as I can tell, this.remoteSync is a then-able that resolves
        // when the sync finishes. However, since we specified 'live: true'
        // that's not going to happen any time soon, so we need to be careful
        // *not* to return this.remoteSync here.
        // resolve until the sync finishes.
        return this.remoteDb;
      });
  }

  // Intended for unit testing only

  destroy() { return this.db.destroy(); }
  getSyncServer() { return this.remoteDb; }
}

export default CardStore;
