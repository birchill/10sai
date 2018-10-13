import PouchDB from 'pouchdb';

import { DataStore } from './DataStore';
import { SettingsStore, SettingChange } from './SettingsStore';
import { waitForChangeEvents } from './test-utils';

PouchDB.plugin(require('pouchdb-adapter-memory'));

describe('SettingsStore', () => {
  let dataStore: DataStore;
  let subject: SettingsStore;

  beforeEach(() => {
    dataStore = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });
    subject = dataStore.settingsStore;
  });

  afterEach(() => dataStore.destroy());

  it('is initially empty', async () => {
    const settings = subject.getSettings();
    expect(Object.getOwnPropertyNames(settings).length).toBe(0);
  });

  it('returns added local settings', async () => {
    await subject.updateSetting('my-setting', { abc: 123 }, 'local');
    const settings = await subject.getSettings();
    expect(settings).toEqual({ 'my-setting': { abc: 123 } });
  });

  it('returns added sync settings', async () => {
    await subject.updateSetting('my-setting', { abc: 123 }, 'sync');
    const settings = await subject.getSettings();
    expect(settings).toEqual({ 'my-setting': { abc: 123 } });
  });

  it('adds new settings to existing ones', async () => {
    await subject.updateSetting('setting-1', 'a', 'local');
    await subject.updateSetting('setting-2', 'b', 'local');
    const settings = await subject.getSettings();
    expect(settings).toEqual({
      'setting-1': 'a',
      'setting-2': 'b',
    });
  });

  it('returns updated settings', async () => {
    await subject.updateSetting('my-setting', { abc: 123 }, 'local');
    await subject.updateSetting('my-setting', { abc: 456 }, 'local');
    const settings = await subject.getSettings();
    expect(settings).toEqual({ 'my-setting': { abc: 456 } });
  });

  it('clears local settings', async () => {
    await subject.updateSetting('my-setting', { abc: 123 }, 'local');
    await subject.clearSetting('my-setting');
    const settings = await subject.getSettings();
    expect(Object.getOwnPropertyNames(settings).length).toBe(0);
  });

  it('clears sync settings', async () => {
    await subject.updateSetting('my-setting', { abc: 123 }, 'sync');
    await subject.clearSetting('my-setting');
    const settings = await subject.getSettings();
    expect(Object.getOwnPropertyNames(settings).length).toBe(0);
  });

  it('fails silently when clearing missing settings', async () => {
    await subject.clearSetting('doesnt-exist');
    const settings = await subject.getSettings();
    expect(Object.getOwnPropertyNames(settings).length).toBe(0);
  });

  it('reports added local settings', async () => {
    const changesPromise = waitForChangeEvents<SettingChange>(
      dataStore,
      'setting',
      1
    );

    await subject.updateSetting('my-setting', { abc: 123 }, 'local');

    const changes = await changesPromise;
    expect(changes[0].setting).toEqual({ 'my-setting': { abc: 123 } });
  });

  it('reports added sync settings', async () => {
    const changesPromise = waitForChangeEvents<SettingChange>(
      dataStore,
      'setting',
      1
    );

    await subject.updateSetting('my-setting', { abc: 123 }, 'sync');

    const changes = await changesPromise;
    expect(changes[0].setting).toEqual({ 'my-setting': { abc: 123 } });
  });

  it('only reports the new settings', async () => {
    const batchOne = waitForChangeEvents<SettingChange>(
      dataStore,
      'setting',
      1
    );

    await subject.updateSetting('setting-1', 'a', 'local');
    await batchOne;

    const batchTwo = waitForChangeEvents<SettingChange>(
      dataStore,
      'setting',
      1
    );
    await subject.updateSetting('setting-2', 'b', 'local');

    const changes = await batchTwo;
    expect(changes[0].setting).toEqual({ 'setting-2': 'b' });
  });

  it('reports updated settings', async () => {
    const changesPromise = waitForChangeEvents<SettingChange>(
      dataStore,
      'setting',
      2
    );

    await subject.updateSetting('my-setting', { abc: 123 }, 'local');
    await subject.updateSetting('my-setting', { abc: 456 }, 'local');

    const changes = await changesPromise;
    expect(changes[1].setting).toEqual({ 'my-setting': { abc: 456 } });
  });

  it('reports cleared settings', async () => {
    const changesPromise = waitForChangeEvents<SettingChange>(
      dataStore,
      'setting',
      2
    );

    await subject.updateSetting('setting', 'a', 'local');
    await subject.clearSetting('setting');

    const changes = await changesPromise;
    expect(changes[1].setting).toEqual({ setting: undefined });
    expect(changes[1].deleted).toEqual(true);
  });
});
