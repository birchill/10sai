import PouchDB from 'pouchdb';

const db = new PouchDB('settings');

class SettingsStore {
  getSettings() {
    return new Promise((resolve, reject) => {
      const settings = {};
      db.allDocs({ include_docs: true, descending: true }).then(
        result => {
          result.rows.forEach(
            row => { settings[row.doc._id] = row.doc.value; });
          resolve(settings);
        }
      ).catch(err => reject(err));
    });
  }

  updateSetting(key, value) {
    return new Promise((resolve, reject) => {
      db.get(key).then(
        doc => resolve(db.put({ _id: key, _rev: doc._rev, value }))
      ).catch(err => {
        if (err) {
          if (err.name !== 'not_found') {
            return reject(err);
          }
        }
        return resolve(db.put({ _id: key, value }));
      });
    });
  }

  /*
  clearSetting(key) {
    (function tryToDeleteSetting() {
      return db.get(key).then(doc => db.remove(doc))
      .catch(err => {
        // Not found, no problem
        if (err.status === 404) {
          return null;
        }
        if (err.status !== 409) {
          // eslint-disable-next-line no-console
          console.log(`Unexpected error removing setting: ${err}`);
          return null;
        }
        // Conflict: Try again
        return tryToDeleteSetting();
      });
    }());
  }
  */

  onUpdate(func) {
    db.changes({ since: 'now', live: true }).on('change', func);
  }
}

export default SettingsStore;
