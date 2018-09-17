import React from 'react';
import { storiesOf } from '@storybook/react';
import { CardPreview } from './CardPreview';

storiesOf('Components|CardPreview', module).add('default', () => (
  <CardPreview question="かんせい" />
));
