import { EditAction } from './edit/actions';
import { NoteAction } from './notes/actions';
import { ReviewAction } from './review/actions';
import { RouteAction } from './route/actions';
import { SettingsAction } from './settings/actions';
import { SyncAction } from './sync/actions';

export type Action =
  | EditAction
  | NoteAction
  | ReviewAction
  | RouteAction
  | SettingsAction
  | SyncAction;

// Re-export so we can do `import * as actions from '../actions';`

export * from './edit/actions';
export * from './notes/actions';
export * from './review/actions';
export * from './route/actions';
export * from './settings/actions';
export * from './sync/actions';
