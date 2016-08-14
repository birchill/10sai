/* global define, it, describe */

import React from 'react';
import { shallow } from 'enzyme';
import { assert } from 'chai';
import sinon from 'sinon';
import SyncState from '../../src/sync-states';
import SyncSettingsPanel from '../../src/components/SyncSettingsPanel';

sinon.assert.expose(assert, { prefix: '' });

describe('<SyncSettingsPanel />', () => {
  const stub = sinon.stub();

  // -------------------------------------------------------------
  //
  // Not configured
  //
  // -------------------------------------------------------------

  it('has a summary label in not configured state', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.NOT_CONFIGURED}
          server="" onSubmit={stub} onPause={stub} />
      );

    assert.isAbove(subject.find('.summary').text().length, 0,
                   'Summary label is filled-in');
  });

  it('shows the editing form when the Add button is clicked', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.NOT_CONFIGURED}
          server="" onSubmit={stub} onPause={stub} />
      );

    subject.find('button[name="edit-server"]').simulate('click');

    assert.strictEqual(subject.find('SyncServerForm').length, 1);
  });

  it('hides the editing form when the Cancel button is clicked', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.NOT_CONFIGURED}
          server="" onSubmit={stub} onPause={stub} />
      );

    subject.find('button[name="edit-server"]').simulate('click');
    subject.find('SyncServerForm').prop('onCancel')();
    subject.update();

    assert.strictEqual(subject.find('SyncServerForm').length, 0);
  });

  it('returns to the not configured state when the Cancel button is clicked',
    () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.NOT_CONFIGURED}
          server="" onSubmit={stub} onPause={stub} />
      );

    subject.find('button[name="edit-server"]').simulate('click');
    subject.find('SyncServerForm').prop('onCancel')();
    subject.update();

    assert.isAbove(subject.find('.summary').text().length, 0,
                   'Summary label is filled-in');
  });

  it('calls the callback when the server is edited', () => {
    const onSubmit = sinon.spy();
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.NOT_CONFIGURED}
          server="" onSubmit={onSubmit} onPause={stub} />
      );

    subject.find('button[name="edit-server"]').simulate('click');
    subject.find('SyncServerForm').prop('onSubmit')({ server: 'abc' });

    assert.calledWith(onSubmit, { server: 'abc' });
  });

  // -------------------------------------------------------------
  //
  // In progress
  //
  // -------------------------------------------------------------

  it('has a summary label in \'in progress\' state', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.IN_PROGRESS}
          server="" onSubmit={stub} onPause={stub} />
      );

    assert.isAbove(subject.find('.summary').text().length, 0,
                   'Summary label is filled-in');
  });

  it('shows a progress bar in \'in progress\' state', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.IN_PROGRESS}
          server="" onSubmit={stub} onPause={stub} />
      );

    assert.strictEqual(subject.find('progress').length, 1);
  });

  it('does NOT show progress bar in other states', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.IN_PROGRESS}
          server="" onSubmit={stub} onPause={stub} />
      );
    for (const state in SyncState) {
      if (state === 'IN_PROGRESS') {
        continue;
      }

      subject.setProps({ syncState: SyncState[state] });
      assert.strictEqual(subject.find('progress').length, 0,
        `There should be no progress bar in the ${state} state`);
    }
  });

  it('pauses syncing when the Cancel button is clicked', () => {
    const onPause = sinon.spy();
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.IN_PROGRESS}
          server="" onSubmit={stub} onPause={onPause} />
      );

    subject.find('button[name="cancel-sync"]').simulate('click');

    assert.calledOnce(onPause);
  });

  it('shows the editing form when the Change button is clicked', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.IN_PROGRESS}
          server="" onSubmit={stub} onPause={stub} />
      );

    subject.find('button[name="edit-server"]').simulate('click');

    assert.strictEqual(subject.find('SyncServerForm').length, 1);
  });

  // -------------------------------------------------------------
  //
  // Up to date
  //
  // -------------------------------------------------------------

  // -------------------------------------------------------------
  //
  // Paused
  //
  // -------------------------------------------------------------

  // -------------------------------------------------------------
  //
  // Offline
  //
  // -------------------------------------------------------------

  // -------------------------------------------------------------
  //
  // Error
  //
  // -------------------------------------------------------------

  // XXX Add tests for the play/pause button and icon state
});
