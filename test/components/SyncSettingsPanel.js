/* global define, it, describe */

import React from 'react';
import { shallow } from 'enzyme';
import { assert } from 'chai';
import sinon from 'sinon';
import SyncStatus from '../../src/sync-status';
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
        <SyncSettingsPanel syncState={SyncStatus.NOT_CONFIGURED}
          server="" onSubmit={stub} />
      );

    assert.isAbove(subject.find('.summary').text().length, 0,
                   'Summary label is filled-in');
  });

  it('shows the editing form when the Add button is clicked', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncStatus.NOT_CONFIGURED}
          server="" onSubmit={stub} />
      );

    subject.find('button[name="edit-server"]').simulate('click');

    assert.strictEqual(subject.find('SyncServerForm').length, 1);
  });

  it('hides the editing form when the Cancel button is clicked', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncStatus.NOT_CONFIGURED}
          server="" onSubmit={stub} />
      );

    subject.find('button[name="edit-server"]').simulate('click');
    subject.find('SyncServerForm').prop('onCancel')();
    subject.update();

    assert.strictEqual(subject.find('SyncServerForm').length, 0);
  });

  it('calls the callback when the server is edited', () => {
    const onSubmit = sinon.spy();
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncStatus.NOT_CONFIGURED}
          server="" onSubmit={onSubmit} />
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
        <SyncSettingsPanel syncState={SyncStatus.IN_PROGRESS}
          server="" onSubmit={stub} />
      );

    assert.isAbove(subject.find('.summary').text().length, 0,
                   'Summary label is filled-in');
  });

  it('shows a progress bar in \'in progress\' state', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncStatus.IN_PROGRESS}
          server="" onSubmit={stub} />
      );

    assert.strictEqual(subject.find('progress').length, 1);
  });

  it('does NOT show progress bar in other states', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncStatus.IN_PROGRESS}
          server="" onSubmit={stub} />
      );
    for (const status in SyncStatus) {
      if (status === 'IN_PROGRESS') {
        continue;
      }

      subject.setProps({ syncState: SyncStatus[status] });
      assert.strictEqual(subject.find('progress').length, 0,
                         `No progress bar in ${status} state`);
    }
  });

  it('pauses syncing when the Cancel button is clicked', () => {
  });

  it('shows the editing form when the Change button is clicked', () => {
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
