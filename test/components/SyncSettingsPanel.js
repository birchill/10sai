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
          server="" onSubmit={stub} onPause={stub} />
      );
    for (const state in SyncState) {
      subject.setProps({ syncState: SyncState[state] });
      subject.update();
      assert.isAbove(subject.find('.summary').text().length, 0,
                     `Summary label is filled-in in ${state} state`);
    }
  });

  it(`shows the last updated information state`, () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncState.OK}
          server="" onSubmit={stub} onPause={stub} />
      );

    for (const state of [ 'OK', 'PAUSED', 'ERROR', 'OFFLINE' ]) {
      subject.setProps({ syncState: SyncState[state] });
      assert.isAbove(subject.find('LastUpdatedLabel').length, 0,
                     `Last updated information is filled-in in the ${state}` +
                     ` state`);
    }
  });

  // -------------------------------------------------------------
  //
  // Server add/change form
  //
  // -------------------------------------------------------------

  it('shows the editing form when the Add/Change button is clicked', () => {
    for (const state in SyncState) {
      // No edit button in 'in progress' state
      if (state === 'IN_PROGRESS') {
        continue;
      }

      const subject =
        shallow(
          <SyncSettingsPanel syncState={SyncState[state]}
            server="" onSubmit={stub} onPause={stub} />
        );
      subject.find('button[name="edit-server"]').simulate('click');

      assert.strictEqual(subject.find('SyncServerForm').length, 1,
                         `Sync server form is shown in ${state} state`);
    }
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
  // In progress state
  //
  // -------------------------------------------------------------

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

  // -------------------------------------------------------------
  //
  // Error state
  //
  // -------------------------------------------------------------

  it(`shows the error information in 'error' state`, () => {
  });

  // XXX Add tests for the play/pause button and icon state
});
