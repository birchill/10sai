import * as React from 'react';
import { storiesOf } from '@storybook/react';

storiesOf('Forms|Text boxes', module)
  .add('default', () => (
    <div className="row">
      <input type="text" value="Text box" />
      <input className="-icon -search" type="search" value="-icon -search" />
      <input
        className="-icon -search -rounded"
        type="search"
        value="-icon -search -rounded"
      />
    </div>
  ))
  .add('stacked', () => (
    <div className="stacked-group">
      <input className="-icon -user" type="text" value="-user" />
      <input className="-icon -lock" type="password" value="-password" />
    </div>
  ));
