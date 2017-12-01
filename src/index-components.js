import ReactDOM from 'react-dom';
import React from 'react';

import 'main.scss'; // eslint-disable-line

import CancelableTextbox from './components/CancelableTextbox.jsx';
import TabBlock from './components/TabBlock.jsx';

ReactDOM.render(
  <CancelableTextbox
    className="text-box"
    value="CancelableTextbox"
    onChange={() => {
      console.log('CancelableTextbox: onChange');
    }}
    onFocus={() => {
      console.log('CancelableTextbox: onFocus');
    }} />,
  document.getElementById('cancelable-textbox-container')
);

(function renderTabs(selectedTab) {
  ReactDOM.render(
    <TabBlock className="extra-class" active={selectedTab}>
      <a
        id="lookup-tab"
        href="/lookup"
        aria-controls="lookup-page"
        className="-icon -search"
        onClick={evt => { renderTabs(0); evt.preventDefault(); }}>Lookup</a>
      <a
        id="add-tab"
        href="/add"
        aria-controls="add-page"
        className="-icon -add"
        onClick={evt => { renderTabs(1); evt.preventDefault(); }}>Add</a>
      <a
        id="review-tab"
        href="/review"
        aria-controls="review-page"
        className="-icon -review -badge"
        data-badge="10%"
        onClick={evt => { renderTabs(2); evt.preventDefault(); }}>Review</a>
    </TabBlock>,
    document.getElementById('tab-block-container')
  );
})();
