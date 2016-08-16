import PouchDB from 'pouchdb';

class CardStore {
  constructor(options) {
    this.db = new PouchDB('cards', options);
  }

  getCards() {
    return new Promise((resolve, reject) => {
      this.db.allDocs({ include_docs: true, descending: true }).then(
        result => resolve(result.rows.map(row => row.doc))
      ).catch(err => reject(err));
    });
  }

  addCard(question, answer) {
    const card = {
      _id: new Date().toISOString(),
      question,
      answer,
    };
    return this.db.put(card);
  }

  onUpdate(func) {
    this.db.changes({ since: 'now', live: true }).on('change', func);
  }

  setSyncServer(syncServer, callbacks) {
    // XXX Skip this if the server hasn't, in fact, changed
    if (this.remoteSync) {
      this.remoteSync.cancel();
      this.remoteSync = undefined;
      this.removeDb = undefined;
    }

    if (!syncServer) {
      return;
    }

    this.remoteDb = new PouchDB(syncServer);
    this.remoteSync = this.db.sync(this.remoteDb, {
      live: true,
      retry: true,
    // XXX Go through and tidy up the input before passing along to the
    // callbacks
    })
    .on('change', callbacks.onChange || (() => {}))
    .on('paused', callbacks.onPause  || (() => {}))
    .on('active', callbacks.onActive || (() => {}))
    .on('error',  callbacks.onError  || (() => {}))
    .on('denied', callbacks.onError  || (() => {}))
    .on('complete', () => {
      console.log('Completed sync. What does that even mean?');
    });
  }
}

export default CardStore;
