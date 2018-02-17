export const syncWithWaitableRemote = async (dataStore, remote) => {
  let pauseAction;
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
