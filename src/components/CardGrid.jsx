import React from 'react';
import CardPreview from './CardPreview.jsx';

export class CardGrid extends React.Component {
  static get propTypes() {
    return { cards: React.PropTypes.array.isRequired };
  }
  render() {
    return (
      <table className="grid">
        <tbody>
          {
            this.props.cards.map(
              card => <CardPreview key={card._id} {...card} />
            )
          }
        </tbody>
      </table>
    );
  }
}

export default CardGrid;
