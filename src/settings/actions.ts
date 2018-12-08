export type SettingsAction = UpdateSettingAction;

export interface UpdateSettingAction {
  type: 'UPDATE_SETTING';
  key: string;
  value: any;
}

export function updateSetting(key: string, value: any): UpdateSettingAction {
  return {
    type: 'UPDATE_SETTING',
    key,
    value,
  };
}
