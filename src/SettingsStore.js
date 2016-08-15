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

  onUpdate(func) {
    db.changes({ since: 'now', live: true }).on('change', func);
  }
}

export default SettingsStore;
