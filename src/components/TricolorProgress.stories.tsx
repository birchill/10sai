import React from 'react';
import { storiesOf } from '@storybook/react';

import { TricolorProgress } from './TricolorProgress';

const sectionStyle = {
  width: '300px',
  height: 'calc(2.5em + 10px)',
  marginBottom: '1em',
};

storiesOf('Components|TricolorProgress', module).add('default', () => (
  <>
    <div style={sectionStyle}>
      <p>Equal length</p>
      <TricolorProgress
        aItems={10}
        bItems={10}
        cItems={10}
        title="Title goes here"
      />
    </div>
    <div style={sectionStyle}>
      <p>All done</p>
      <TricolorProgress
        aItems={10}
        bItems={0}
        cItems={0}
        title="Title goes here"
      />
    </div>
    <div style={sectionStyle}>
      <p>Little bit at the end</p>
      <TricolorProgress
        aItems={10}
        bItems={1}
        cItems={0}
        title="Title goes here"
      />
    </div>
    <div style={sectionStyle}>
      <p>All zero</p>
      <TricolorProgress
        aItems={0}
        bItems={0}
        cItems={0}
        title="Title goes here"
      />
    </div>
  </>
));
