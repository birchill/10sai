import DataStore from './DataStore';

export const syncWithWaitableRemote = async (
  dataStore: DataStore,
  remote: PouchDB.Database
) => {
  let pauseAction: () => any;
  await dataStore.setSyncServer(remote, {
    onIdle: () => {
      if (pauseAction) {
        pauseAction();
      }
    },
  });

  const waitForIdle = () => {
    return new Promise(resolve => {
      pauseAction = resolve;
    });
  };

  return waitForIdle;
};
