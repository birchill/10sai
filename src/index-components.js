import ReactDOM from 'react-dom';
import React from 'react';

import 'main.scss'; // eslint-disable-line

import CancelableTextbox from './components/CancelableTextbox.jsx';

ReactDOM.render(
  <CancelableTextbox
    className="text-box"
    value="CancelableTextbox"
    onChange={() => { console.log('CancelableTextbox: onChange'); }}
    onFocus={() => { console.log('CancelableTextbox: onFocus'); }} />,
  document.getElementById('cancelable-textbox-container')
);
