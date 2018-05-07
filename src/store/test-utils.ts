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

  return () => {
    return new Promise(resolve => {
      pauseAction = resolve;
    });
  };
};

export const waitForChangeEvents = (dataStore, type, num) => {
  const events = [];

  let resolver;
  const promise = new Promise(resolve => {
    resolver = resolve;
  });

  let recordedChanges = 0;
  dataStore.changes.on(type, change => {
    events.push(change);
    if (++recordedChanges === num) {
      resolver(events);
    }
  });

  return promise;
};
