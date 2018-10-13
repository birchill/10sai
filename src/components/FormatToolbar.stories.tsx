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
        state: FormatButtonState.Normal,
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
        accelerator: 'Ctrl+/',
        state: FormatButtonState.Normal,
        initialValue: 'blue',
      },
      {
        type: 'color-dropdown',
        label: 'Text color',
        accelerator: 'Ctrl+Alt+/',
        state: FormatButtonState.Normal,
      },
      {
        type: 'cloze',
        label: 'Cloze',
        accelerator: 'Ctrl+[',
        state: FormatButtonState.Disabled,
      },
    ]}
    onClick={action('onChange')}
  />
));
