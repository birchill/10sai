/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import SettingsStore from './SettingsStore';
import { waitForEvents } from '../test/testcommon';

describe('SettingsStore', () => {
  let subject;

  beforeEach(() => {
    subject = new SettingsStore({ db: memdown });
  });

  afterEach(() => subject.destroy());

  it('is initially empty', () => {
    return subject.getSettings().then(settings => {
      expect(Object.getOwnPropertyNames(settings).length).toBe(0);
    });
  });

  it('returns added settings', () => {
    return subject
      .updateSetting('my-setting', { abc: 123 })
      .then(() => subject.getSettings())
      .then(settings => {
        expect(settings).toEqual({ 'my-setting': { abc: 123 } });
      });
  });

  it('reports added settings', () => {
    let updateInfo;

    subject.onUpdate(info => {
      updateInfo = info;
    });

    return (
      subject
        .updateSetting('my-setting', { abc: 123 })
        // Wait for a few rounds of events so the update can take place
        .then(() => waitForEvents(3))
        .then(() => {
          expect(updateInfo).toBeTruthy();
          expect(updateInfo).toEqual({ 'my-setting': { abc: 123 } });
        })
    );
  });

  it('adds new settings to existing ones', () => {
    return subject
      .updateSetting('setting-1', 'a')
      .then(() => subject.updateSetting('setting-2', 'b'))
      .then(() => subject.getSettings())
      .then(settings => {
        expect(settings).toEqual({
          'setting-1': 'a',
          'setting-2': 'b',
        });
      });
  });

  it('only reports the new settings', () => {
    let updateInfo;

    return subject
      .updateSetting('setting-1', 'a')
      .then(() => {
        subject.onUpdate(info => {
          updateInfo = info;
        });
      })
      .then(() => subject.updateSetting('setting-2', 'b'))
      .then(() => waitForEvents(3))
      .then(() => {
        expect(updateInfo).toEqual({ 'setting-2': 'b' });
      });
  });

  it('returns updated settings', () => {
    return subject
      .updateSetting('my-setting', { abc: 123 })
      .then(() => subject.updateSetting('my-setting', { abc: 456 }))
      .then(() => subject.getSettings())
      .then(settings => {
        expect(settings).toEqual({ 'my-setting': { abc: 456 } });
      });
  });

  it('reports updated settings', () => {
    let updateInfo;

    return subject
      .updateSetting('my-setting', { abc: 123 })
      .then(() => {
        subject.onUpdate(info => {
          updateInfo = info;
        });
      })
      .then(() => subject.updateSetting('my-setting', { abc: 456 }))
      .then(() => waitForEvents(3))
      .then(() => {
        expect(updateInfo).toEqual({ 'my-setting': { abc: 456 } });
      });
  });

  it('clears settings', () => {
    return subject
      .updateSetting('my-setting', { abc: 123 })
      .then(() => subject.clearSetting('my-setting'))
      .then(() => subject.getSettings())
      .then(settings => {
        expect(Object.getOwnPropertyNames(settings).length).toBe(0);
      });
  });

  it('reports cleared settings', () => {
    let updateInfo;

    return subject
      .updateSetting('setting', 'a')
      .then(() => {
        subject.onUpdate(info => {
          updateInfo = info;
        });
      })
      .then(() => subject.clearSetting('setting'))
      .then(() => waitForEvents(3))
      .then(() => {
        expect(updateInfo).toEqual({ setting: undefined });
      });
  });

  it('fails silently when clearing missing settings', () => {
    return subject
      .clearSetting('doesnt-exist')
      .then(() => subject.getSettings())
      .then(settings => {
        expect(Object.getOwnPropertyNames(settings).length).toBe(0);
      });
  });
});
