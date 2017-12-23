import PouchDB from 'pouchdb';

PouchDB.plugin(require('pouchdb-upsert'));

class SettingsStore {
  constructor(options) {
    this.db = new PouchDB('settings', { storage: 'persistant', ...options });
  }

  getSettings() {
    return new Promise((resolve, reject) => {
      const settings = {};
      this.db
        .allDocs({ include_docs: true, descending: true })
        .then(result => {
          result.rows.forEach(row => {
            settings[row.doc._id] = row.doc.value;
          });
          resolve(settings);
        })
        .catch(err => reject(err));
    });
  }

  updateSetting(key, value) {
    return this.db.upsert(key, () => ({ value }));
  }

  clearSetting(key) {
    return function tryToDeleteSetting() {
      return this.db
        .get(key)
        .then(doc => this.db.remove(doc))
        .catch(err => {
          // Not found, no problem
          if (err.status === 404) {
            return null;
          }
          if (err.status !== 409) {
            console.error(`Unexpected error removing setting: ${err}`);
            return null;
          }
          // Conflict: Try again
          return tryToDeleteSetting();
        });
    }.bind(this)();
  }

  onUpdate(func) {
    this.db
      .changes({ since: 'now', live: true, include_docs: true })
      .on('change', changes => {
        const change = {};
        change[changes.doc._id] = changes.doc.value;
        func(change);
      });
  }

  // Intended for unit testing only

  destroy() {
    return this.db.destroy();
  }
}

export default SettingsStore;
