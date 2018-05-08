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

export const waitForChangeEvents = <Type>(
  dataStore: DataStore,
  type: string,
  num: number
) => {
  type EventType = Partial<Type> & { deleted?: boolean };
  const events: EventType[] = [];

  let resolver: (e: typeof events) => void;
  const promise = new Promise<typeof events>(resolve => {
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
