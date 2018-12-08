import { RouteAction } from './route/actions';
import { SyncAction } from './sync/actions';
import { SettingsAction } from './settings/actions';

export type Action = RouteAction | SettingsAction | SyncAction;
