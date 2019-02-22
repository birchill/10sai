import * as React from 'react';
import { storiesOf } from '@storybook/react';

storiesOf('Forms|Buttons', module)
  .add('default', () => (
    <>
      <div className="series">
        <input
          className="button"
          type="submit"
          value='&lt;input type="submit"&gt;'
        />
        <input
          className="button"
          type="button"
          value='&lt;input type="button"&gt;'
        />
        <button className="button">&lt;button&gt;</button>
        <a className="button" role="button">
          &lt;a class="button"&gt;
        </a>
      </div>
      <div className="series">
        <input type="button" className="button" disabled value="disabled" />
        <input type="button" className="button -primary" value="-primary" />
        <input
          type="button"
          disabled
          className="button -primary"
          value="disabled -primary"
        />
        <input
          type="button"
          className="button -borderless"
          value="-borderless"
        />
        <input type="button" className="button -large" value="-large" />
      </div>
      <div className="series">
        <button className="button -icon -delete">-icon -delete</button>
        <button className="button -icon -plus">-icon -plus</button>
        <button className="button -icon -edit-card">-icon -edit-card</button>
        <button className="button -icon -delete" disabled>
          -icon -delete disabled
        </button>
      </div>
      <div className="series">
        <button className="button -icon -delete -large">
          -icon -delete -large
        </button>
        <button className="button -icon -plus -large -primary">
          -icon -plus -large -primary
        </button>
        <button className="button -borderless -icon -add-card">
          -borderless -icon -add-card
        </button>
      </div>
    </>
  ))
  .add('primary', () => (
    <div className="series">
      <input type="button" className="button -primary" value="-primary" />
      <input
        type="button"
        className="button -primary"
        value="disabled -primary"
        disabled
      />
      <button className="button -icon -plus -primary">
        -icon -plus -primary
      </button>
      <button className="button -icon -plus -large -primary">
        -icon -plus -large -primary
      </button>
    </div>
  ));
