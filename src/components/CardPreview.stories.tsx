import React from 'react';
import { storiesOf } from '@storybook/react';
import { CardPreview } from './CardPreview';

storiesOf('CardPreview', module).add('regular', () => (
  <CardPreview question="かんせい" />
));
