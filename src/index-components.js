import ReactDOM from 'react-dom';
import React from 'react';

import 'main.scss'; // eslint-disable-line

import CancelableTextbox from './components/CancelableTextbox.jsx';

ReactDOM.render(
  <CancelableTextbox
    value="Value"
    onChange="console.log('onChange')"
    onFocus="console.log('onFocus')" />,
  document.getElementById('cancelable-textbox-container')
);
