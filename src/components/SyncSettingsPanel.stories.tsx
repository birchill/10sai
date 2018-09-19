import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { SyncSettingsPanel } from './SyncSettingsPanel';
import { SyncState } from '../sync/states';

const server = {
  name: 'http://server.server.server/path',
  username: 'Username',
  password: 'Password',
};

storiesOf('Components|SyncSettingsPanel', module)
  .add('not configured', () => (
    <SyncSettingsPanel
      syncState={SyncState.NOT_CONFIGURED}
      onSubmit={action('onSubmit')}
      onRetry={action('onRetry')}
      onEdit={action('onEdit')}
      onCancel={action('onCancel')}
      onPause={action('onPause')}
      onResume={action('onResume')}
    />
  ))
  .add('up to date', () => (
    <SyncSettingsPanel
      syncState={SyncState.OK}
      server={server}
      lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
      onSubmit={action('onSubmit')}
      onRetry={action('onRetry')}
      onEdit={action('onEdit')}
      onCancel={action('onCancel')}
      onPause={action('onPause')}
      onResume={action('onResume')}
    />
  ))
  .add('in progress', () => (
    <SyncSettingsPanel
      syncState={SyncState.IN_PROGRESS}
      onSubmit={action('onSubmit')}
      onRetry={action('onRetry')}
      onEdit={action('onEdit')}
      onCancel={action('onCancel')}
      onPause={action('onPause')}
      onResume={action('onResume')}
    />
  ))
  .add('paused', () => (
    <SyncSettingsPanel
      syncState={SyncState.PAUSED}
      server={server}
      lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
      onSubmit={action('onSubmit')}
      onRetry={action('onRetry')}
      onEdit={action('onEdit')}
      onCancel={action('onCancel')}
      onPause={action('onPause')}
      onResume={action('onResume')}
    />
  ))
  .add('offline', () => (
    <SyncSettingsPanel
      syncState={SyncState.OFFLINE}
      server={server}
      lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
      onSubmit={action('onSubmit')}
      onRetry={action('onRetry')}
      onEdit={action('onEdit')}
      onCancel={action('onCancel')}
      onPause={action('onPause')}
      onResume={action('onResume')}
    />
  ))
  .add('error', () => (
    <SyncSettingsPanel
      syncState={SyncState.ERROR}
      server={server}
      lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
      errorDetail={{ status: 0 }}
      onSubmit={action('onSubmit')}
      onRetry={action('onRetry')}
      onEdit={action('onEdit')}
      onCancel={action('onCancel')}
      onPause={action('onPause')}
      onResume={action('onResume')}
    />
  ))
  .add('configure', () => (
    <SyncSettingsPanel
      syncState={SyncState.OK}
      server={server}
      lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
      editingServer
      onSubmit={action('onSubmit')}
      onRetry={action('onRetry')}
      onEdit={action('onEdit')}
      onCancel={action('onCancel')}
      onPause={action('onPause')}
      onResume={action('onResume')}
    />
  ));
