import { takeEvery, takeLatest } from 'redux-saga';
import { put } from 'redux-saga/effects';

let currentSyncServer;

function* setSyncServer(cardStore, settingsStore, dispatch, action) {
  if (currentSyncServer !== action.server) {
    currentSyncServer = action.server;
    yield settingsStore.updateSetting('syncServer',
                                      { server: action.server });
  }

  yield put({ type: 'COMMIT_SYNC_SERVER' });
  try {
    yield cardStore.setSyncServer(currentSyncServer, {
      onChange: changes =>
        dispatch({ type: 'UPDATE_SYNC_PROGRESS', progress: changes.progress }),
      onIdle: () => dispatch({ type: 'FINISH_SYNC', lastSyncTime: Date.now() }),
      onActive: () => dispatch({ type: 'UPDATE_SYNC_PROGRESS',
                                  progress: null }),
      onError: details => {
        dispatch({ type: 'NOTIFY_SYNC_ERROR', details });
      },
    });
  } catch (e) {
    // Ignore errors from setSyncServer since we deal with them in the onError
    // callback.
    return;
  }

  // XXX Revisit this later and see what kind of flicker we get if we move
  // the COMMIT_SYNC_SERVER from above here and do:
  //   put({ type: 'CLEAR_SYNC_SERVER', server: cardStore.remoteDb
  //                                            ? action.server
  //                                            : null });
  // and then in the reducer update the state depending on if we have a
  // server or not
  if (!cardStore.remoteDb) {
    yield put({ type: 'CLEAR_SYNC_SERVER' });
  }
}

function* finishSync(settingsStore, action) {
  const updatedServer = { server: currentSyncServer,
                          lastSyncTime: action.lastSyncTime };
  yield settingsStore.updateSetting('syncServer', updatedServer);
}

function* updateSetting(action) {
  if (action.key !== 'syncServer' ||
      (action.value && action.value.server === currentSyncServer)) {
    return;
  }

  currentSyncServer = action.value ? action.value.server : null;
  yield put({ type: 'SET_SYNC_SERVER', server: currentSyncServer });
}

function* syncSagas(cardStore, settingsStore, dispatch) {
  yield* [ takeLatest('SET_SYNC_SERVER', setSyncServer,
                      cardStore, settingsStore, dispatch),
           takeLatest('FINISH_SYNC', finishSync, settingsStore),
           takeEvery('UPDATE_SETTING', updateSetting) ];
}

export default syncSagas;
