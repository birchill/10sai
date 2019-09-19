import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { DecoratorFunction } from '@storybook/addons';
import { action as notifyAction } from '@storybook/addon-actions';
import { createStore, Store } from 'redux';
import { Provider } from 'react-redux';

import { MenuItem } from './MenuItem';
import { MenuItemLink } from './MenuItemLink';
import { MenuList } from './MenuList';

type Direction = 'forwards' | 'backwards' | 'replace';

export interface FollowLinkAction {
  type: 'FOLLOW_LINK';
  url: string;
  direction: Direction;
  active: boolean;
}

const reducer = (state: any, action: FollowLinkAction) => {
  switch (action.type) {
    case 'FOLLOW_LINK':
      notifyAction('followLink');
      break;
  }

  return state;
};

const store: Store = createStore(reducer);
const withStore: DecoratorFunction<React.ReactElement> = story => (
  <Provider store={store}>{story()}</Provider>
);

storiesOf('Components|MenuList', module)
  .addDecorator(withStore)
  .add('default', () => (
    <MenuList>
      <MenuItem
        className="-iconic -add"
        label="Add"
        accelerator="Ctrl+Shift+N"
      />
      <MenuItem className="-iconic -edit" label="Edit" />
      <MenuItem className="-iconic -delete" label="Delete" />
      <MenuItem className="-iconic -yellow" label="Yellow" />
      <MenuItemLink className="-iconic -add" href="/new" label="Link" />
      <MenuItemLink
        className="-iconic -add"
        href="/new"
        label="Link"
        accelerator="Ctrl+Shift+L"
      />
      <MenuItem
        className="-iconic -add"
        label="Disabled button"
        disabled
        onClick={notifyAction('disabled?')}
      />
      <MenuItemLink
        className="-iconic -add"
        href="/new"
        label="Disabled link"
        disabled
      />
    </MenuList>
  ));
