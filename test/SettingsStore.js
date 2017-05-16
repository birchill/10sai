/* global afterEach, beforeEach, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import { assert } from 'chai';
import SettingsStore from '../src/SettingsStore';
import { waitForEvents } from './testcommon';

describe('SettingsStore', () => {
  let subject;

  beforeEach('setup new store', () => {
    subject = new SettingsStore({ db: memdown });
  });

  afterEach('clean up store', () => subject.destroy());

  it('is initially empty', () => {
    return subject.getSettings()
      .then(settings => {
        assert.strictEqual(Object.getOwnPropertyNames(settings).length, 0,
                           'Number of items in getSettings() result');
      });
  });

  it('returns added settings', () => {
    return subject.updateSetting('my-setting', { abc: 123 })
      .then(() => subject.getSettings())
      .then(settings => {
        assert.deepEqual(settings, { 'my-setting': { abc: 123 } });
      });
  });

  it('reports added settings', () => {
    let updateInfo;

    subject.onUpdate(info => { updateInfo = info; });

    return subject.updateSetting('my-setting', { abc: 123 })
      // Wait for a few rounds of events so the update can take place
      .then(() => waitForEvents(3))
      .then(() => {
        assert.isOk(updateInfo, 'Change was recorded');
        assert.deepEqual(updateInfo, { 'my-setting': { abc: 123 } },
                         'Updated setting is returned');
      });
  });

  it('adds new settings to existing ones', () => {
    return subject.updateSetting('setting-1', 'a')
      .then(() => subject.updateSetting('setting-2', 'b'))
      .then(() => subject.getSettings())
      .then(settings => {
        assert.deepEqual(settings, { 'setting-1': 'a',
                                     'setting-2': 'b' });
      });
  });

  it('only reports the new settings', () => {
    let updateInfo;

    return subject.updateSetting('setting-1', 'a')
      .then(() => { subject.onUpdate(info => { updateInfo = info; }); })
      .then(() => subject.updateSetting('setting-2', 'b'))
      .then(() => waitForEvents(3))
      .then(() => {
        assert.deepEqual(updateInfo, { 'setting-2': 'b' },
                         'Only updated setting is returned');
      });
  });

  it('returns updated settings', () => {
    return subject.updateSetting('my-setting', { abc: 123 })
      .then(() => subject.updateSetting('my-setting', { abc: 456 }))
      .then(() => subject.getSettings())
      .then(settings => {
        assert.deepEqual(settings, { 'my-setting': { abc: 456 } });
      });
  });

  it('reports updated settings', () => {
    let updateInfo;

    return subject.updateSetting('my-setting', { abc: 123 })
      .then(() => { subject.onUpdate(info => { updateInfo = info; }); })
      .then(() => subject.updateSetting('my-setting', { abc: 456 }))
      .then(() => waitForEvents(3))
      .then(() => {
        assert.deepEqual(updateInfo, { 'my-setting': { abc: 456 } },
                         'Updated setting is returned');
      });
  });

  it('clears settings', () => {
    return subject.updateSetting('my-setting', { abc: 123 })
      .then(() => subject.clearSetting('my-setting'))
      .then(() => subject.getSettings())
      .then(settings => {
        assert.strictEqual(Object.getOwnPropertyNames(settings).length, 0,
                           'Number of items in getSettings() result');
      });
  });

  it('reports cleared settings', () => {
    let updateInfo;

    return subject.updateSetting('setting', 'a')
      .then(() => { subject.onUpdate(info => { updateInfo = info; }); })
      .then(() => subject.clearSetting('setting'))
      .then(() => waitForEvents(3))
      .then(() => {
        assert.deepEqual(updateInfo, { setting: undefined },
                         'Cleared setting is returned');
      });
  });

  it('fails silently when clearing missing settings', () => {
    return subject.clearSetting('doesnt-exist')
      .then(() => subject.getSettings())
      .then(settings => {
        assert.strictEqual(Object.getOwnPropertyNames(settings).length, 0,
                           'Number of items in getSettings() result');
      });
  });
});
