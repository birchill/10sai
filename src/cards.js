'use strict';

import PouchDB from 'pouchdb';

var db = new PouchDB('cards');

class CardDB {
  addCard(question, answer) {
    var card = {
      _id: new Date().toISOString(),
      question: question,
      answer: answer
    };
    return db.put(card);
  }

  getCards() {
    // XXX There is surely a neater way of doing this
    return new Promise((resolve, reject) => {
      db.allDocs({include_docs: true, descending: true}).then(
        result => resolve(result.rows.map(row => row.doc))
      ).catch(err => reject(err));
    });
  }

  onUpdate(func) {
    db.changes({ since: 'now', live: true }).on('change', func);
  }
}

export default new CardDB()
