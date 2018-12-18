import * as ReactDOM from 'react-dom';
import * as React from 'react';

import 'main.scss';

import { CardPreview } from './components/CardPreview';
import { VirtualGrid } from './components/VirtualGrid';

interface MyItem {
  _id: string;
  question: string;
}

function renderTemplateItem() {
  return <CardPreview question="Template" />;
}

function renderItem(item: MyItem) {
  return <CardPreview {...item} />;
}

const items: Array<MyItem> = [];

for (let i = 0; i < 500; i++) {
  items.push({ _id: `item-${i}`, question: `Card ${i}` });
}

ReactDOM.render(
  <VirtualGrid
    items={items}
    className="card-grid"
    renderItem={renderItem}
    renderTemplateItem={renderTemplateItem}
  />,
  document.getElementById('grid-container')
);
