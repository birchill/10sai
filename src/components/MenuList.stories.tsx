import * as React from 'react';
import { storiesOf } from '@storybook/react';

import { MenuItem } from './MenuItem';
import { MenuList } from './MenuList';

storiesOf('Components|MenuList', module)
  .add('default', () => (
    <MenuList>
      <MenuItem className="-iconic -add" label="Add" />
      <MenuItem className="-iconic -edit" label="Edit" />
      <MenuItem className="-iconic -delete" label="Delete" />
    </MenuList>
  ));
