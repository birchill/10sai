import PouchDB from 'pouchdb';

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
    // XXX Fill in _id only if not set
    return this.db.put({ ...card, _id: new Date().toISOString() })
      .then(result => ({ ...card, _id: result.id, _rev: result.rev }));
  }

  onUpdate(func) {
    this.db.changes({ since: 'now', live: true }).on('change', func);
  }

  setSyncServer(syncServer, callbacks) {
    // XXX Skip this if the server hasn't, in fact, changed
    if (this.remoteSync) {
      this.remoteSync.cancel();
      this.remoteSync = undefined;
      this.remoteDb = undefined;
    }

    if (!syncServer) {
      return Promise.resolve();
    }

    this.remoteDb = new PouchDB(syncServer);

    return this.remoteDb
      // Force a connection to the server so we can detect errors immediately
      .then(() => this.remoteDb.info())
      .catch(err => {
        this.remoteDb = undefined;
        if (callbacks && callbacks.onError) {
          callbacks.onError(err);
        }
        throw err;
      }).then(() => {
        this.remoteSync = this.db.sync(this.remoteDb, {
          live: true,
          retry: true,
        })
        // XXX Go through and tidy up the input before passing along to the
        // callbacks
        .on('change',   callbacks.onChange || (() => {}))
        .on('paused',   callbacks.onPause  || (() => {}))
        .on('active',   callbacks.onActive || (() => {}))
        .on('error',    callbacks.onError  || (() => {}))
        .on('denied',   callbacks.onError  || (() => {}))
        .on('complete', callbacks.onPause  || (() => {}));

        // As far as I can tell, this.remoteSync is a then-able that resolves
        // when the sync finishes. However, since we specified live: true
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
