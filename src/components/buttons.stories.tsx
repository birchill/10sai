import React from 'react';
import { storiesOf } from '@storybook/react';

storiesOf('Forms|Buttons', module)
  .add('default', () => (
    <>
      <div className="series">
        <input type="submit" value="&lt;input type=&quot;submit&quot;&gt;" />
        <input type="button" value="&lt;input type=&quot;button&quot;&gt;" />
        <button>&lt;button&gt;</button>
        <a className="button" role="button">
          &lt;a class="button"&gt;
        </a>
      </div>
      <div className="series">
        <input type="button" disabled value="disabled" />
        <input type="button" className="-primary" value="-primary" />
        <input
          type="button"
          disabled
          className="-primary"
          value="disabled -primary"
        />
        <input type="button" className="-link" value="-link" />
        <input type="button" className="-large" value="-large" />
      </div>
      <div className="series">
        <button className="-icon -delete">-icon -delete</button>
        <button className="-icon -plus">-icon -plus</button>
        <button className="-icon -edit-card">-icon -edit-card</button>
        <button className="-icon -delete" disabled>
          -icon -delete disabled
        </button>
      </div>
      <div className="series">
        <button className="-icon -delete -large">-icon -delete -large</button>
        <button className="-icon -plus -large -primary">
          -icon -plus -large -primary
        </button>
        <button className="-icon -add-card -link">-icon -add-card -link</button>
      </div>
    </>
  ))
  .add('primary', () => (
    <div className="series">
      <input type="button" className="-primary" value="-primary" />
      <input
        type="button"
        className="-primary"
        value="disabled -primary"
        disabled
      />
      <button className="-icon -plus -primary">-icon -plus -primary</button>
      <button className="-icon -plus -large -primary">
        -icon -plus -large -primary
      </button>
    </div>
  ));
