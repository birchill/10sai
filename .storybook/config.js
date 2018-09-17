import { configure } from '@storybook/react';
import { setOptions } from '@storybook/addon-options';
import 'main.scss'; // eslint-disable-line

setOptions({ hierarchyRootSeparator: /\|/ });

const req = require.context('../src/components', true, /\.stories\.tsx?$/);

function loadStories() {
  req.keys().forEach(filename => req(filename));
}

configure(loadStories, module);
