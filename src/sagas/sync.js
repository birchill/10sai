import { takeEvery, takeLatest } from 'redux-saga';
import { put, select } from 'redux-saga/effects';

// Selector wrappers

const getFromSync = func => state => func(state.sync);

// Sync-selectors
//
// (These actually expect |obj| to be just the 'sync' member of the state and
// need to be combined with getFromSync when using in select())

const getServerName = obj => (obj &&
                              obj.server &&
                              obj.server.name
                              ? obj.server.name.trim() || undefined
                              : undefined);
const getLastSyncTime = obj => (obj ? obj.lastSyncTime : undefined);
const getPaused = obj => !!(obj && obj.paused);
const getOffline = obj => !!(obj && obj.offline);

// Replication helpers

function* startReplication(cardStore, server, dispatch) {
  const offline = yield select(getFromSync(getOffline));
  if (offline) {
    return;
  }

  if (server) {
    yield put({ type: 'UPDATE_SYNC_PROGRESS', progress: undefined });
  }
  try {
    yield cardStore.setSyncServer(server, {
      onChange: changes => dispatch({ type: 'UPDATE_SYNC_PROGRESS',
                                      progress: changes.progress }),
      onIdle: () => dispatch({ type: 'FINISH_SYNC', lastSyncTime: Date.now() }),
      onActive: () => dispatch({ type: 'UPDATE_SYNC_PROGRESS',
                                 progress: undefined }),
      onError: details => dispatch({ type: 'NOTIFY_SYNC_ERROR', details }),
    });
  } catch (e) {
    // Ignore errors from setSyncServer since we deal with them in the onError
    // callback.
    return;
  }
}

function* stopReplication(cardStore) {
  yield cardStore.setSyncServer();
}

function* setSyncServer(cardStore, settingsStore, dispatch, action) {
  // Trim strings and convert all falsey values to 'undefined' so we can
  // reliably compare the new server with the old in updateSetting.
  const serverName = getServerName(action);

  // Update the settings store next so that if the initial replication is
  // interrupted or protracted, we have the up-to-date information stored.
  if (serverName) {
    // Since this is a new server, just blow away old data like lastSyncTime.
    // Here and below we clear the paused state--presumably if the user is
    // setting a new sync server they want to perform a sync.
    const updatedServer = { server: { name: serverName } };
    yield settingsStore.updateSetting('syncServer', updatedServer);
  } else {
    yield settingsStore.clearSetting('syncServer');
  }

  // Update UI state
  yield put({ type: 'UPDATE_SYNC_SERVER',
              server: serverName ? { name: serverName } : undefined,
              lastSyncTime: undefined,
              paused: false,
            });
  yield put({ type: 'FINISH_EDIT_SYNC_SERVER' });

  // Kick off and/or cancel replication
  yield startReplication(cardStore, serverName, dispatch);
}

function* retrySync(cardStore, dispatch) {
  const serverName = yield select(getFromSync(getServerName));
  yield startReplication(cardStore, serverName, dispatch);
}

function* finishSync(settingsStore, action) {
  const serverName = yield select(getFromSync(getServerName));
  const updatedServer = { server: { name: serverName },
                          lastSyncTime: action.lastSyncTime };

  const paused = yield select(getFromSync(getPaused));
  if (paused) {
    updatedServer.paused = true;
  }

  yield settingsStore.updateSetting('syncServer', updatedServer);
}

function* pauseSync(cardStore, settingsStore) {
  // Update stored paused state
  const serverName = yield select(getFromSync(getServerName));
  const lastSyncTime = yield select(getFromSync(getLastSyncTime));

  if (!serverName) {
    return;
  }

  const updatedServer = { server: { name: serverName },
                          lastSyncTime,
                          paused: true };
  yield settingsStore.updateSetting('syncServer', updatedServer);

  yield stopReplication(cardStore);
}

function* resumeSync(cardStore, settingsStore, dispatch) {
  // Update stored paused state
  const serverName = yield select(getFromSync(getServerName));
  const lastSyncTime = yield select(getFromSync(getLastSyncTime));

  if (!serverName) {
    return;
  }

  const updatedServer = { server: { name: serverName }, lastSyncTime };
  yield settingsStore.updateSetting('syncServer', updatedServer);

  yield startReplication(cardStore, serverName, dispatch);
}

function* updateSetting(cardStore, dispatch, action) {
  if (action.key !== 'syncServer') {
    return;
  }

  const updatedServerName   = getServerName(action.value);
  const updatedPaused       = getPaused(action.value);
  let   updatedLastSyncTime = getLastSyncTime(action.value);

  const serverName   = yield select(getFromSync(getServerName));
  const paused       = yield select(getFromSync(getPaused));
  const lastSyncTime = yield select(getFromSync(getLastSyncTime));

  // Ignore updated sync times that are in the past
  if (typeof lastSyncTime === typeof updatedLastSyncTime &&
      updatedLastSyncTime < lastSyncTime) {
    updatedLastSyncTime = lastSyncTime;
  }

  // Skip no-change case
  if (serverName === updatedServerName &&
      paused === updatedPaused &&
      lastSyncTime === updatedLastSyncTime) {
    return;
  }

  // Update UI with changes
  yield put({ type: 'UPDATE_SYNC_SERVER',
              server: updatedServerName
                      ? { name: updatedServerName }
                      : undefined,
              lastSyncTime: updatedLastSyncTime,
              paused: updatedPaused,
            });

  // Check if we need to trigger replication due to a change in server
  // name or being unpaused.
  if (!updatedPaused &&
      (updatedServerName !== serverName || paused)) {
    yield startReplication(cardStore, updatedServerName, dispatch);
  // And likewise check if we need to stop it
  } else if (updatedPaused && !paused) {
    yield stopReplication(cardStore);
  }
}

function* goOnline(cardStore, dispatch) {
  const paused = yield select(getFromSync(getPaused));
  if (paused) {
    return;
  }

  const serverName = yield select(getFromSync(getServerName));
  yield startReplication(cardStore, serverName, dispatch);
}

function* goOffline(cardStore) {
  yield stopReplication(cardStore);
}

function* syncSagas(cardStore, settingsStore, dispatch) {
  yield* [ takeLatest('SET_SYNC_SERVER', setSyncServer,
                      cardStore, settingsStore, dispatch),
           takeLatest('RETRY_SYNC', retrySync, cardStore, dispatch),
           takeLatest('FINISH_SYNC', finishSync, settingsStore),
           takeEvery('PAUSE_SYNC', pauseSync, cardStore, settingsStore),
           takeEvery('RESUME_SYNC', resumeSync, cardStore, settingsStore,
                     dispatch),
           takeEvery('UPDATE_SETTING', updateSetting, cardStore, dispatch),
           takeEvery('GO_ONLINE', goOnline, cardStore, dispatch),
           takeEvery('GO_OFFLINE', goOffline, cardStore) ];
}

export default syncSagas;
