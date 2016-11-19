import SyncState from './sync-states';

export function updateLocation(screen) {
  return {
    type: 'CHANGE_LOCATION',
    screen,
  };
}

export function updateSettings(settings) {
  return {
    type: 'UPDATE_SETTINGS',
    settings,
  };
}

export function updateSetting(key, value) {
  return {
    type: 'UPDATE_SETTING',
    key,
    value,
  };
}

export function updateSettingsFromStore(settingsStore) {
  return dispatch => settingsStore.getSettings()
                     .then(settings => dispatch(updateSettings(settings)));
}

export function updateSyncState(state, detail) {
  return {
    type: 'UPDATE_SYNC_STATE',
    state,
    detail,
  };
}

export function editServer() {
  return {
    type: 'EDIT_SERVER',
  };
}

export function finishEditServer() {
  return {
    type: 'FINISH_EDIT_SERVER',
  };
}

export function setSyncServer(syncServer, settingsStore, cardStore) {
  return (dispatch, getState) => {
    // Update settings first so we don't end up in an inconsistent state
    let settingsUpdatePromise = Promise.resolve();
    if (getState().settings.syncServer !== syncServer) {
      settingsUpdatePromise = settingsStore.updateSetting('syncServer',
                                                          syncServer);
      dispatch(updateSetting('syncServer', syncServer));
    }

    settingsUpdatePromise.then(() => {
      dispatch(finishEditServer());
      dispatch(updateSyncState(SyncState.IN_PROGRESS));
      cardStore.setSyncServer(syncServer.server, {
        onChange: changes => {
          dispatch(updateSyncState(SyncState.IN_PROGRESS, changes.progress));
        },
        onIdle: () => {
          const updatedSyncServer = { ...getState().settings.syncServer,
                                      lastSyncTime: Date.now() };
          settingsStore.updateSetting('syncServer', updatedSyncServer)
          .then(() => {
            dispatch(updateSyncState(SyncState.OK));
          });
        },
        onActive: () => dispatch(updateSyncState(SyncState.IN_PROGRESS)),
        onError: details =>
                    dispatch(updateSyncState(SyncState.ERROR, details)),
      })
      .then(() => {
        if (!cardStore.remoteDb) {
          dispatch(updateSyncState(SyncState.NOT_CONFIGURED));
        }
      });
    });
  };
}
