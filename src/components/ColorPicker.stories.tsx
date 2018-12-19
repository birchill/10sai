import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { ColorPicker } from './ColorPicker';

storiesOf('Components|ColorPicker', module).add('default', () => (
  <ColorPicker onSelect={action('onSelect')} />
));
