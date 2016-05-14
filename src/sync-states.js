export const SyncState = {
  OK: Symbol('OK'),
  IN_PROGRESS: Symbol('IN_PROGRESS'),
  PAUSED: Symbol('PAUSED'),
  OFFLINE: Symbol('OFFLINE'),
  ERROR: Symbol('ERROR'),
  NOT_CONFIGURED: Symbol('NOT_CONFIGURED'),
};

export default SyncState;
