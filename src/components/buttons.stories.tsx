import React from 'react';
import { storiesOf } from '@storybook/react';

storiesOf('Forms|Buttons', module)
  .add('default', () => (
    <>
      <input type="submit" value="&lt;input type=&quot;submit&quot;&gt;" />
      <input type="button" value="&lt;input type=&quot;button&quot;&gt;" />
      <button>&lt;button&gt;</button>
      <a className="button" role="button">
        &lt;a class="button"&gt;
      </a>
    </>
  ))
  .add('primary', () => (
    <input type="button" className="-primary" value="-primary" />
  ));
