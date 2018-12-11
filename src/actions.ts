import { EditAction } from './edit/actions';
import { ReviewAction } from './review/actions';
import { RouteAction } from './route/actions';
import { SettingsAction } from './settings/actions';
import { SyncAction } from './sync/actions';

export type Action =
  | EditAction
  | ReviewAction
  | RouteAction
  | SettingsAction
  | SyncAction;
