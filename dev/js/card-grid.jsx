'use strict';

import React from 'react';
import CardRow from './card-row.jsx!';

export class CardGrid extends React.Component {
  render() {
    return (
      <table className="grid">
        <tbody>
          {
            this.props.cards.map(function(card) {
              return <CardRow key={card._id} {...card}/>;
            })
          }
        </tbody>
      </table>
    );
  }
}

export default CardGrid;
