import * as ReactDOM from 'react-dom';
import * as React from 'react';

import 'main.scss';

import { CardPreview } from './components/CardPreview';
import { VirtualGrid } from './components/VirtualGrid';

interface MyItem {
  id: string;
  front: string;
}

function renderTemplateItem() {
  return <CardPreview front="Template" />;
}

function renderItem(item: MyItem) {
  return <CardPreview {...item} />;
}

const items: Array<MyItem> = [];

for (let i = 0; i < 500; i++) {
  items.push({ id: `item-${i}`, front: `Card ${i}` });
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
