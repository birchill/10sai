import { takeEvery, takeLatest } from 'redux-saga';
import { put } from 'redux-saga/effects';

let currentServerName;
let lastSyncTime;

function fetchAndNormalizeServerName(parentObj) {
  return parentObj &&
         parentObj.server &&
         parentObj.server.name
         ? parentObj.server.name.trim() || undefined
         : undefined;
}

function* startReplication(cardStore, server, dispatch) {
  try {
    yield cardStore.setSyncServer(server, {
      onChange: changes =>
        dispatch({ type: 'UPDATE_SYNC_PROGRESS', progress: changes.progress }),
      onIdle: () => {
        lastSyncTime = Date.now();
        return dispatch({ type: 'FINISH_SYNC', lastSyncTime });
      },
      onActive: () => dispatch({ type: 'UPDATE_SYNC_PROGRESS',
                                 progress: undefined }),
      onError: details => {
        dispatch({ type: 'NOTIFY_SYNC_ERROR', details });
      },
    });
  } catch (e) {
    // Ignore errors from setSyncServer since we deal with them in the onError
    // callback.
    return;
  }
}

function* setSyncServer(cardStore, settingsStore, dispatch, action) {
  // Trim strings and convert all falsey values to 'undefined' so we can
  // reliably compare the new server with the old, both here and in
  // updateSetting below.
  const updatedServerName = fetchAndNormalizeServerName(action);

  if (currentServerName === updatedServerName) {
    // TODO: If there has been a sync error, make this retrigger duplication
    // (i.e. do a retry).
    yield put({ type: 'CANCEL_EDIT_SYNC_SERVER' });
    return;
  }

  // Update currentServerName first so we ignore any actions triggered by
  // updating the settings store.
  currentServerName = updatedServerName;
  lastSyncTime = undefined;

  // Update the settings store next so that if the initial replication is
  // interrupted or protracted, we have the up-to-date information stored.
  if (updatedServerName) {
    // Since this is a new server, just blow away old data like lastSyncTime
    const updatedServer = { server: { name: updatedServerName } };
    yield settingsStore.updateSetting('syncServer', updatedServer);
  } else {
    yield settingsStore.clearSetting('syncServer');
  }

  // Update the UI now that we have done an initial validation of the data.
  yield put({ type: 'COMMIT_SYNC_SERVER',
              server: updatedServerName ? { name: updatedServerName }
                                        : undefined,
            });

  // Kick off and/or cancel replication
  yield startReplication(cardStore, updatedServerName, dispatch);
}

function* retrySync(cardStore, dispatch) {
  yield startReplication(cardStore, currentServerName, dispatch);
}

function* finishSync(settingsStore, action) {
  lastSyncTime = action.lastSyncTime;
  const updatedServer = { server: { name: currentServerName }, lastSyncTime };
  yield settingsStore.updateSetting('syncServer', updatedServer);
}

function* updateSetting(action) {
  if (action.key !== 'syncServer') {
    return;
  }

  const updatedServerName = fetchAndNormalizeServerName(action.value);
  if (updatedServerName !== currentServerName) {
    yield put({ type: 'SET_SYNC_SERVER',
                server: updatedServerName
                        ? { name: updatedServerName }
                        : undefined,
              });
  } else {
    const updatedSyncTime = action.value && action.value.lastSyncTime
                            ? action.value.lastSyncTime
                            : undefined;
    if (typeof lastSyncTime !== typeof updatedSyncTime ||
        lastSyncTime < updatedSyncTime) {
      lastSyncTime = updatedSyncTime;
      yield put({ type: 'UPDATE_SYNC_TIME', lastSyncTime });
    }
  }
}

function* syncSagas(cardStore, settingsStore, dispatch) {
  yield* [ takeLatest('SET_SYNC_SERVER', setSyncServer,
                      cardStore, settingsStore, dispatch),
           takeLatest('RETRY_SYNC', retrySync, cardStore, dispatch),
           takeLatest('FINISH_SYNC', finishSync, settingsStore),
           takeEvery('UPDATE_SETTING', updateSetting) ];
}

export default syncSagas;
