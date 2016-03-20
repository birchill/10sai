import ReactDOM from 'react-dom';
import React from 'react';
import CardDB from './cards';
import CardOverviewScreen from './card-overview-screen.jsx';

ReactDOM.render(
  <CardOverviewScreen db={CardDB} />,
  document.querySelector('main.container')
);
