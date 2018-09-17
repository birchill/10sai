import React from 'react';
import { storiesOf } from '@storybook/react';
import { CancelableTextbox } from './CancelableTextbox';

storiesOf('Components|CancelableTextbox', module).add('default', () => (
  <CancelableTextbox
    value="CancelableTextbox"
    onChange={() => {
      console.log('CancelableTextbox: onChange');
    }}
    onFocus={() => {
      console.log('CancelableTextbox: onFocus');
    }}
  />
));
