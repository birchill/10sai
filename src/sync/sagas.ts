import { call, takeEvery, takeLatest, put, select } from 'redux-saga/effects';
import { delay } from 'redux-saga';
import { Dispatch } from 'redux';

import { waitForDocLoad } from '../utils';
import { SyncServer } from './SyncServer';
import { DataStore } from '../store/DataStore';
import * as syncActions from './actions';
import { Action } from '../actions';
import * as settingsActions from '../settings/actions';
import { SyncServerSetting } from './settings';
import {
  getLastSyncTime,
  getOffline,
  getPaused,
  getServer,
  normalizeServer,
} from './selectors';

// Replication helpers

function* startReplication(
  dataStore: DataStore,
  server: SyncServer | undefined,
  dispatch: Dispatch<Action>
) {
  if (yield select(getOffline)) {
    return;
  }

  const syncServer = server ? server.name : undefined;
  const options = {
    onProgress: (progress: number | null) =>
      dispatch(syncActions.updateSyncProgress(progress)),
    onIdle: () => dispatch(syncActions.finishSync(new Date())),
    onActive: () => dispatch(syncActions.updateSyncProgress(null)),
    onError: (details: PouchDB.Core.Error) =>
      dispatch(syncActions.notifySyncError(details)),
    username: server ? server.username : undefined,
    password: server && server.username ? server.password : undefined,
  };

  // Wait until the doc is fully loaded first since otherwise the browser
  // might treat the long-poll resulting from this as part of the initial load
  // and will indicate that page is loading, like, forever.
  yield waitForDocLoad();

  if (server) {
    yield put(syncActions.updateSyncProgress(null));
  }

  try {
    // You probably want to look away here. Basically, Cloudant got bought out
    // by IBM and they started making ridiculously long URLs for Cloudant
    // databases--not something you can expect to type, and especially not on
    // a mobile device. So, let's add a redirect. Not so fast. You can't
    // redirect a CORS request (yet, anyway). So, basically we need either
    //
    // (a) Do a pre-fetch with a simple request and get the redirect end point
    //     and then use that, or
    // (b) Right some sort of intermediary -- either a simple reverse proxy or
    //     a some more sophisticated thing that also does the sharding etc.
    //
    // Eventually we'll need to do (b) so for now we just hardcode the redirect
    // here.
    const redirectedServer =
      typeof syncServer === 'string'
        ? syncServer.replace(
            'sync.10sai.app',
            'b62bf565-d36c-45ce-a12d-fc3bd31a256b-bluemix.cloudant.com'
          )
        : syncServer;
    yield dataStore.setSyncServer(redirectedServer, options);
  } catch (e) {
    // Ignore errors from setSyncServer since we deal with them in the onError
    // callback.
  }
}

function* stopReplication(dataStore: DataStore) {
  yield dataStore.setSyncServer();
}

function* setSyncServer(
  dataStore: DataStore,
  dispatch: Dispatch<Action>,
  action: syncActions.SetSyncServerAction
) {
  // Normalize server so we can reliably compare the new server with the old
  // in updateSetting.
  const server = normalizeServer(action.server);

  // Update the settings store next so that if the initial replication is
  // interrupted or protracted, we have the up-to-date information stored.
  if (server) {
    // Since this is a new server, just blow away old data like lastSyncTime.
    // Here and below we clear the paused state--presumably if the user is
    // setting a new sync server they want to perform a sync.
    const updatedServer: SyncServerSetting = { server };
    yield dataStore.updateSetting('syncServer', updatedServer, 'local');
  } else {
    yield dataStore.clearSetting('syncServer');
  }

  // Update UI state
  yield put(
    syncActions.updateSyncServer({
      server,
      lastSyncTime: undefined,
      paused: false,
    })
  );
  yield put(syncActions.finishEditSyncServer());

  // Kick off and/or cancel replication
  yield startReplication(dataStore, server, dispatch);
}

function* retrySync(dataStore: DataStore, dispatch: Dispatch<Action>) {
  const server = yield select(getServer);
  yield startReplication(dataStore, server, dispatch);
}

function* finishSync(
  dataStore: DataStore,
  action: syncActions.FinishSyncAction
) {
  const server = yield select(getServer);
  const updatedServer: SyncServerSetting = {
    server,
    lastSyncTime: action.lastSyncTime,
  };

  if (yield select(getPaused)) {
    updatedServer.paused = true;
  }

  yield dataStore.updateSetting('syncServer', updatedServer, 'local');
}

function* pauseSync(dataStore: DataStore) {
  // Update stored paused state
  const server = yield select(getServer);
  const lastSyncTime = yield select(getLastSyncTime);

  if (!server) {
    return;
  }

  const updatedServer: SyncServerSetting = {
    server,
    lastSyncTime,
    paused: true,
  };
  yield dataStore.updateSetting('syncServer', updatedServer, 'local');

  yield stopReplication(dataStore);
}

function* resumeSync(dataStore: DataStore, dispatch: Dispatch<Action>) {
  // Update stored paused state
  const server = yield select(getServer);
  const lastSyncTime = yield select(getLastSyncTime);

  if (!server) {
    return;
  }

  const updatedServer: SyncServerSetting = { server, lastSyncTime };
  yield dataStore.updateSetting('syncServer', updatedServer, 'local');

  yield startReplication(dataStore, server, dispatch);
}

function* updateSetting(
  dataStore: DataStore,
  dispatch: Dispatch<Action>,
  action: settingsActions.UpdateSettingAction
) {
  if (action.key !== 'syncServer') {
    return;
  }

  const settingValue = action.value as SyncServerSetting;
  const updatedServer = normalizeServer(settingValue.server);
  const updatedPaused = !!settingValue.paused;
  let updatedLastSyncTime = settingValue.lastSyncTime;

  const server = yield select(getServer);
  const paused = yield select(getPaused);
  const lastSyncTime = yield select(getLastSyncTime);

  // Ignore updated sync times that are in the past
  if (
    typeof lastSyncTime === typeof updatedLastSyncTime &&
    typeof lastSyncTime !== 'undefined' &&
    updatedLastSyncTime! < lastSyncTime
  ) {
    updatedLastSyncTime = lastSyncTime;
  }

  // Skip no-change case
  const serverUpdated =
    JSON.stringify(server) !== JSON.stringify(updatedServer);
  if (
    !serverUpdated &&
    paused === updatedPaused &&
    lastSyncTime === updatedLastSyncTime
  ) {
    return;
  }

  // Update UI with changes
  yield put(
    syncActions.updateSyncServer({
      server: updatedServer,
      lastSyncTime: updatedLastSyncTime,
      paused: updatedPaused,
    })
  );

  // Check if we need to trigger replication due to a change in server
  // name or being unpaused.
  if (!updatedPaused && (serverUpdated || paused)) {
    // We hit this path on startup when the server has already been set.
    // However, we don't want to trigger replication *too* quickly on startup
    // because it will cause contention with all the other queries we run on
    // startup so we add a little delay to let other things happen first.
    yield call(delay, 1500);

    // Check that the server hasn't changed while we were waiting.
    // (The proper way to do this would be to make this saga cancelable and then
    // have other sagas cancel it as appropriate, but that's quite a significant
    // refactoring for something we don't expect to happen.)
    const serverAfterDelay = yield select(getServer);
    if (JSON.stringify(serverAfterDelay) !== JSON.stringify(updatedServer)) {
      return;
    }

    yield startReplication(dataStore, updatedServer, dispatch);

    // And likewise check if we need to stop it
  } else if (updatedPaused && !paused) {
    yield stopReplication(dataStore);
  }
}

function* goOnline(dataStore: DataStore, dispatch: Dispatch<Action>) {
  if (yield select(getPaused)) {
    return;
  }

  const server = yield select(getServer);
  yield startReplication(dataStore, server, dispatch);
}

function* goOffline(dataStore: DataStore) {
  yield stopReplication(dataStore);
}

export function* syncSagas(dataStore: DataStore, dispatch: Dispatch<Action>) {
  yield* [
    takeLatest('SET_SYNC_SERVER', setSyncServer, dataStore, dispatch),
    takeLatest('RETRY_SYNC', retrySync, dataStore, dispatch),
    takeLatest('FINISH_SYNC', finishSync, dataStore),
    takeEvery('PAUSE_SYNC', pauseSync, dataStore),
    takeEvery('RESUME_SYNC', resumeSync, dataStore, dispatch),
    takeEvery('UPDATE_SETTING', updateSetting, dataStore, dispatch),
    takeEvery('GO_ONLINE', goOnline, dataStore, dispatch),
    takeEvery('GO_OFFLINE', goOffline, dataStore),
  ];
}
