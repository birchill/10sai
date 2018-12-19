import * as React from 'react';
import { storiesOf } from '@storybook/react';

import { LoadingIndicator } from './LoadingIndicator';

storiesOf('Components|LoadingIndicator', module).add('default', () => (
  <>
    <div className="row" style={{ maxWidth: '100px' }}>
      <LoadingIndicator />
    </div>
    <div className="row" style={{ maxWidth: '300px' }}>
      <LoadingIndicator />
    </div>
  </>
));
