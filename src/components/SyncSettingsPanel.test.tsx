/* global describe, expect, it, jest */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/jsx-max-props-per-line */

import React from 'react';
import { configure, shallow, ShallowWrapper } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import SyncState from '../sync/states';
import SyncSettingsPanel from './SyncSettingsPanel';
import SyncServerForm from './SyncServerForm';

configure({ adapter: new Adapter() });

describe('<SyncSettingsPanel />', () => {
  const stub = jest.fn();

  // -------------------------------------------------------------
  //
  // Common properties
  //
  // -------------------------------------------------------------

  it('has a summary label in all states', () => {
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.NOT_CONFIGURED}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
      />
    );
    for (const state of Object.keys(SyncState) as Array<
      keyof typeof SyncState
    >) {
      subject.setProps({ syncState: SyncState[state] });
      subject.update();
      expect(subject.find('.heading').text().length).toBeGreaterThan(0);
    }
  });

  it('shows the last updated information state', () => {
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.OK}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
        lastSyncTime={new Date()}
      />
    );

    for (const state of ['OK', 'PAUSED', 'ERROR', 'OFFLINE'] as Array<
      keyof typeof SyncState
    >) {
      subject.setProps({ syncState: SyncState[state] });
      expect(subject.find('ServerStatus').prop('lastSyncTime')).toBeInstanceOf(
        Date
      );
    }
  });

  // -------------------------------------------------------------
  //
  // Server add/change form
  //
  // -------------------------------------------------------------

  it('calls the edit callback when the Add/Change button is clicked', () => {
    const onEdit = jest.fn();
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.NOT_CONFIGURED}
        onSubmit={stub}
        onRetry={stub}
        onEdit={onEdit}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
      />
    );

    subject.find('button[name="edit-server"]').simulate('click');

    expect(onEdit).toHaveBeenCalled();
  });

  it('calls the cancel callback when the Cancel button is clicked', () => {
    const onCancel = jest.fn();
    const subject = shallow<SyncSettingsPanel>(
      <SyncSettingsPanel
        syncState={SyncState.NOT_CONFIGURED}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={onCancel}
        onPause={stub}
        onResume={stub}
        editingServer
      />
    );

    subject.find(SyncServerForm).prop('onCancel')();
    subject.update();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls the callback when the server is edited', () => {
    const onSubmit = jest.fn();
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.NOT_CONFIGURED}
        onSubmit={onSubmit}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
        editingServer
      />
    );

    subject.find(SyncServerForm).prop('onSubmit')({ name: 'abc' });

    expect(onSubmit).toHaveBeenCalledWith({ name: 'abc' });
  });

  // -------------------------------------------------------------
  //
  // In progress state
  //
  // -------------------------------------------------------------

  it("shows a progress bar in 'in progress' state", () => {
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.IN_PROGRESS}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
      />
    );

    expect(subject.find('progress')).toHaveLength(1);
  });

  it('does NOT show progress bar in other states', () => {
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.IN_PROGRESS}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
      />
    );
    for (const state of Object.keys(SyncState) as Array<
      keyof typeof SyncState
    >) {
      if (state === 'IN_PROGRESS') {
        continue;
      }

      subject.setProps({ syncState: SyncState[state] });
      expect(subject.find('progress')).toHaveLength(0);
    }
  });

  it('pauses syncing when the Cancel button is clicked', () => {
    const onPause = jest.fn();
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.IN_PROGRESS}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={onPause}
        onResume={stub}
      />
    );

    subject.find('button[name="cancel-sync"]').simulate('click');

    expect(onPause).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------
  //
  // Error state
  //
  // -------------------------------------------------------------

  it("shows the error information in 'error' state", () => {
    const errorMessage = { message: 'Oh dear' };
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.ERROR}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
        errorDetail={errorMessage}
      />
    );

    expect(subject.find('.error-details').text()).toBe('Oh dear');
  });

  // XXX Add tests for the play/pause button and icon state
});
