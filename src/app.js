import ReactDOM from 'react-dom';
import React from 'react';
import CardDB from './cards';
import CardGrid from './card-grid.jsx';

const form = document.querySelector('form.add-card');

function addCard() {
  const [ question, answer ] =
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

form.addEventListener('submit', evt => {
  evt.preventDefault();
  addCard();
});

function render() {
  CardDB.getCards().then(cards => {
    ReactDOM.render(
      <CardGrid cards={cards} />,
      document.getElementById('card-grid')
    );
  });
}

render();
CardDB.onUpdate(() => render());
