import ReactDOM from 'react-dom';
import React from 'react';
import CardDB from './cards';
import CardOverviewScreen from './card-overview-screen.jsx';

function render() {
  CardDB.getCards().then(cards => {
    ReactDOM.render(
      <CardOverviewScreen db={CardDB} />,
      document.querySelector('main.container')
    );
  });
}

render();
