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

export function updateSyncState(state) {
  return {
    type: 'UPDATE_SYNC_STATE',
    state,
  };
}

export function setSyncServer(syncServer, settingsStore, cardStore) {
  return (dispatch, getState) => {
    dispatch(updateSyncState(SyncState.IN_PROGRESS));

    let settingsUpdatePromise = Promise.resolve();
    if (getState().settings.syncServer !== syncServer) {
      settingsUpdatePromise = settingsStore.updateSetting('syncServer',
                                                          syncServer);
      dispatch(updateSetting('syncServer', syncServer));
    }

    settingsUpdatePromise.then(() => {
      cardStore.setSyncServer(syncServer.server,
        { onChange: () => { /* XXX: Record last updated and other info */ },
          onPause:  () => dispatch(updateSyncState(SyncState.OK)),
          onActive: () => dispatch(updateSyncState(SyncState.IN_PROGRESS)),
          onError:  () => dispatch(updateSyncState(SyncState.ERROR)) });
    });
  };
}
