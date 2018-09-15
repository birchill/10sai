import ReactDOM from 'react-dom';
import React from 'react';

import 'main.scss'; // eslint-disable-line

import CardPreview from './components/CardPreview.tsx';
import VirtualGrid from './components/VirtualGrid.jsx';

function renderTemplateCard() {
  return <CardPreview _id="template" question="Template" />;
}

function renderCard(item) {
  return <CardPreview {...item} />;
}

const cards = [];

for (let i = 0; i < 500; i++) {
  cards.push({ question: `Card ${i}` });
}

ReactDOM.render(
  <VirtualGrid
    items={cards}
    className="card-grid"
    renderItem={renderCard}
    renderTemplateItem={renderTemplateCard}
  />,
  document.getElementById('grid-container')
);
