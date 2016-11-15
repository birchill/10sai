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
  // Common properties
  //
  // -------------------------------------------------------------

  it('has a summary label in all states', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.NOT_CONFIGURED}
          server="" onEdit={stub} onSubmit={stub} onCancel={stub}
          onPause={stub} />
      );
    for (const state of Object.keys(SyncState)) {
      subject.setProps({ syncState: SyncState[state] });
      subject.update();
      assert.isAbove(subject.find('.summary').text().length, 0,
                    `Summary label is filled-in in ${state} state`);
    }
  });

  it('shows the last updated information state', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.OK}
          server="" onEdit={stub} onSubmit={stub} onCancel={stub}
          onPause={stub} lastSyncTime={new Date()} />
      );

    for (const state of [ 'OK', 'PAUSED', 'ERROR', 'OFFLINE' ]) {
      subject.setProps({ syncState: SyncState[state] });
      assert.isAbove(subject.find('.server-sync-time').length, 0,
                     `Last updated information is filled-in in the ${state}` +
                     ' state');
    }
  });

  // -------------------------------------------------------------
  //
  // Server add/change form
  //
  // -------------------------------------------------------------

  it('calls the edit callback when the Add/Change button is clicked', () => {
    for (const state of Object.keys(SyncState)) {
      // No edit button in 'in progress' state
      if (state === 'IN_PROGRESS') {
        continue;
      }

      const onEdit = sinon.spy();

      const subject =
        shallow(
          <SyncSettingsPanel syncState={SyncState[state]}
            server="" onEdit={onEdit} onSubmit={stub} onCancel={stub}
            onPause={stub} />
        );
      subject.find('button[name="edit-server"]').simulate('click');

      assert.calledOnce(onEdit);
    }
  });

  it('calls the cancel callback when the Cancel button is clicked', () => {
    const onCancel = sinon.spy();
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.NOT_CONFIGURED}
          server="" onEdit={stub} onSubmit={stub} onCancel={onCancel}
          onPause={stub} editingServer />
      );

    subject.find('SyncServerForm').prop('onCancel')();
    subject.update();

    assert.calledOnce(onCancel);
  });

  it('calls the callback when the server is edited', () => {
    const onSubmit = sinon.spy();
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.NOT_CONFIGURED}
          server="" onEdit={stub} onSubmit={onSubmit} onCancel={stub}
          onPause={stub} editingServer />
      );

    subject.find('SyncServerForm').prop('onSubmit')({ server: 'abc' });

    assert.calledWith(onSubmit, { server: 'abc' });
  });

  // -------------------------------------------------------------
  //
  // In progress state
  //
  // -------------------------------------------------------------

  it('shows a progress bar in \'in progress\' state', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.IN_PROGRESS}
          server="" onEdit={stub} onSubmit={stub} onCancel={stub}
          onPause={stub} />
      );

    assert.strictEqual(subject.find('progress').length, 1);
  });

  it('does NOT show progress bar in other states', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.IN_PROGRESS}
          server="" onEdit={stub} onSubmit={stub} onCancel={stub}
          onPause={stub} />
      );
    for (const state of Object.keys(SyncState)) {
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
          server="" onEdit={stub} onSubmit={stub} onCancel={stub}
          onPause={onPause} />
      );

    subject.find('button[name="cancel-sync"]').simulate('click');

    assert.calledOnce(onPause);
  });

  // -------------------------------------------------------------
  //
  // Error state
  //
  // -------------------------------------------------------------

  it("shows the error information in 'error' state", () => {
    const errorMessage = { message: 'Oh dear' };
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.ERROR}
          server="" onEdit={stub} onSubmit={stub} onCancel={stub}
          onPause={stub} errorDetail={errorMessage} />
      );

    assert.equal(subject.find('.error-details').text(), 'Oh dear',
                  'Error message is filled-in');
  });

  // XXX Add tests for the play/pause button and icon state
});
