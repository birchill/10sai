import PouchDB from 'pouchdb';

const remoteDb = 'http://localhost:5984/cards';
const db = new PouchDB('cards');

class CardDB {
  constructor() {
    if (remoteDb) {
      this.remoteDb = new PouchDb(remoteDb);

      db.sync(this.remoteDb, {
        live: true,
        retry: true
      }).on('change', function (change) {
        // yo, something changed!
        if (this.updateFunc) {
          updateFunc(change);
        }
      }).on('paused', function (info) {
        // replication was paused, usually because of a lost connection
        // TODO: Update UI
      }).on('active', function (info) {
        // replication was resumed
        // TODO: Update UI
      }).on('error', function (err) {
        // totally unhandled error (shouldn't happen)
        // TODO: Update UI
        console.error(err);
      })));
    }
  }

  addCard(question, answer) {
    const card = {
      _id: new Date().toISOString(),
      question,
      answer,
    };
    return db.put(card);
  }

  getCards() {
    // XXX There is surely a neater way of doing this
    return new Promise((resolve, reject) => {
      db.allDocs({ include_docs: true, descending: true }).then(
        result => resolve(result.rows.map(row => row.doc))
      ).catch(err => reject(err));
    });
  }

  onUpdate(func) {
    this.updateFunc = func;
    db.changes({ since: 'now', live: true }).on('change', func);
  }
}

export default new CardDB();
