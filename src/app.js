'use strict';

import ReactDOM from 'react-dom';
import React from 'react';
import CardDB from './cards';
import CardGrid from './card-grid.jsx';

let form = document.querySelector('form.add-card');

form.addEventListener('submit', function(evt) {
  evt.preventDefault();
  addCard();
});

function addCard() {
  let [ question, answer ] =
    [ 'question', 'answer' ].map(field => form[field].value.trim());
  if (!question.length || !answer.length) {
    console.warn('Empty question/answer');
    return;
  }

  CardDB.addCard(question, answer)
    .then(() => {
      console.log('saved');
      form.reset();
    })
    .catch(err => console.log(err));
}

function render() {
  CardDB.getCards().then(cards => {
    ReactDOM.render(
      <CardGrid cards={cards}/>,
      document.getElementById('card-grid')
    );
  });
}

render();
CardDB.onUpdate(() => render());

// Set up package.json script aliases

// Reference: http://pouchdb.com/getting-started.html
// Also: http://glenmaddern.com/articles/javascript-in-2015
// And: http://pouchdb.com/guides/updating-deleting.html

// Then: Deletion
// Then: Add keywords
// Then: Add hash to end of ID
// Then: Editing
// Then: Make it pretty with JSX and CSS Modules

// Then: Shared notes?
//       Deck hierarchy?
