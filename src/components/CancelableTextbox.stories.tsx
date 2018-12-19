import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { CancelableTextbox } from './CancelableTextbox';

storiesOf('Components|CancelableTextbox', module).add('default', () => (
  <CancelableTextbox
    value="CancelableTextbox"
    onChange={action('onChange')}
    onFocus={action('onFocus')}
  />
));
