import PouchDB from 'pouchdb';

type Settings = {
  [key: string]: any;
};

type SettingContent = {
  value: any;
};

export interface SettingChange {
  setting: { [key: string]: any };
  deleted?: boolean;
}

type ExistingSettingsDoc = PouchDB.Core.ExistingDocument<SettingContent>;
type ExistingSettingDocWithChanges = PouchDB.Core.ExistingDocument<
  SettingContent & PouchDB.Core.ChangesMeta
>;
type SettingsStoreOptions = PouchDB.Configuration.LocalDatabaseConfiguration;

export const SETTING_PREFIX = 'setting-';

const isSettingChangeDoc = (
  changeDoc:
    | PouchDB.Core.ExistingDocument<any & PouchDB.Core.ChangesMeta>
    | undefined
): changeDoc is ExistingSettingDocWithChanges => {
  return changeDoc && changeDoc._id.startsWith(SETTING_PREFIX);
};

type EmitFunction = (type: string, ...args: any[]) => void;

export class SettingsStore {
  // Settings that are strictly local to this device (e.g. remote server
  // settings).
  localDb: PouchDB.Database;

  // Database for settings that should be synchronized with the remote server
  syncDb: PouchDB.Database;

  constructor(syncDb: PouchDB.Database, options: SettingsStoreOptions) {
    // We use a separate local DB rather than _local documents in order to
    // synchronize between multiple tabs.
    //
    // _local documents don't appear in changes() so if we used that, we
    // wouldn't be able to update other tabs when changing settings.
    this.localDb = new PouchDB('settings', options);
    this.syncDb = syncDb;
  }

  async destroy(): Promise<any> {
    this.localDb.destroy();
  }

  async getSettings(): Promise<Settings> {
    const queryOptions: PouchDB.Query.Options<any, any> = {
      include_docs: true,
      startkey: SETTING_PREFIX,
      endkey: SETTING_PREFIX + '\ufff0',
    };

    const appendSettings = (
      result: PouchDB.Core.AllDocsResponse<SettingContent>,
      settings: Settings
    ) => {
      result.rows
        .filter(row => !!row.doc)
        .map(row => row.doc)
        .reduce((settings: Settings, doc: ExistingSettingsDoc): Settings => {
          settings[doc._id.substring(SETTING_PREFIX.length)] = doc.value;
          return settings;
        }, settings);
    };

    // We're not expecting conflicts but it might be useful to later be able to
    // locally override remote settings so do remote settings first.
    const settings: Settings = {};
    appendSettings(
      await this.syncDb.allDocs<SettingContent>(queryOptions),
      settings
    );
    appendSettings(
      await this.localDb.allDocs<SettingContent>(queryOptions),
      settings
    );

    return settings;
  }

  async updateSetting(key: string, value: any, destination: 'local' | 'sync') {
    const db = destination === 'local' ? this.localDb : this.syncDb;
    await db.upsert<SettingContent>(SETTING_PREFIX + key, doc => ({
      ...doc,
      _id: SETTING_PREFIX + key,
      value,
    }));
  }

  async clearSetting(key: string) {
    const tryToDeleteSetting = async (database: PouchDB.Database) => {
      try {
        const setting = await database.get(SETTING_PREFIX + key);
        database.remove(setting);
      } catch (err) {
        // Not found, no problem
        if (err.status === 404) {
          return;
        }
        if (err.status !== 409) {
          console.error(`Unexpected error removing setting: ${err}`);
          return;
        }
        // Conflict: Try again
        await tryToDeleteSetting(database);
      }
    };

    await Promise.all([
      tryToDeleteSetting(this.localDb),
      tryToDeleteSetting(this.syncDb),
    ]);
  }

  async onChange(
    change: PouchDB.Core.ChangesResponseChange<{}>,
    emit: EmitFunction
  ) {
    if (!isSettingChangeDoc(change.doc)) {
      return;
    }

    const result: SettingChange = {
      setting: {
        [change.id.substring(SETTING_PREFIX.length)]: change.doc.value,
      },
    };
    if (change.deleted) {
      result.deleted = true;
    }

    emit('setting', result);
  }

  registerChangeHandler(emit: EmitFunction) {
    this.localDb
      .changes({ since: 'now', live: true, include_docs: true })
      .on('change', change => {
        this.onChange(change, emit);
      });
  }
}

export default SettingsStore;
