import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { FormatButtonState, FormatToolbar } from './FormatToolbar';

storiesOf('Components|FormatToolbar', module).add('default', () => (
  <FormatToolbar
    className="-areafocus"
    buttons={[
      {
        type: 'bold',
        label: 'Bold',
        accelerator: 'Ctrl+B',
        state: FormatButtonState.Normal,
      },
      {
        type: 'italic',
        label: 'Italic',
        accelerator: 'Ctrl+I',
        state: FormatButtonState.Set,
      },
      {
        type: 'underline',
        label: 'Underline',
        accelerator: 'Ctrl+U',
        state: FormatButtonState.Disabled,
      },
      {
        type: 'emphasis',
        label: 'Dot emphasis',
        accelerator: 'Ctrl+.',
        state: FormatButtonState.Normal,
      },
      {
        type: 'color',
        label: 'Text color',
        state: FormatButtonState.Normal,
      },
      {
        type: 'dropdown',
        label: 'Text color',
        state: FormatButtonState.Normal,
      },
    ]}
    onClick={action('onChange')}
  />
));
