import { DataStore } from './DataStore';

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
    return new Promise((resolve) => {
      // Debounce
      const idleTimeout = 50; // ms
      let timeout: ReturnType<typeof setTimeout> | null;
      pauseAction = () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(resolve, idleTimeout);
      };
    });
  };
};

export const waitForChangeEvents = <EventType>(
  dataStore: DataStore,
  type: string,
  num: number
): Promise<Array<EventType>> => {
  const events: EventType[] = [];

  let resolver: (e: typeof events) => void;
  const promise = new Promise<typeof events>((resolve) => {
    resolver = resolve;
  });

  let recordedChanges = 0;
  dataStore.changes.on(type, (change) => {
    events.push(change);
    if (++recordedChanges === num) {
      resolver(events);
    }
  });

  return promise;
};
