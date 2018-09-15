import React from 'react';
import PropTypes from 'prop-types';
import CardPreview from './CardPreview.tsx';
import Link from './Link.tsx';
import VirtualGrid from './VirtualGrid.jsx';

export class CardGrid extends React.PureComponent {
  static get contextTypes() {
    return { cardList: PropTypes.object };
  }

  static renderTemplateCard() {
    return <CardPreview _id="template" question="Template" />;
  }

  static renderCard(item) {
    return (
      <Link href={`/cards/${item._id}`}>
        <CardPreview {...item} />
      </Link>
    );
  }

  constructor(props) {
    super(props);
    this.state = { cards: [] };

    this.handleCardsChange = this.handleCardsChange.bind(this);
  }

  componentDidMount() {
    this.context.cardList.getCards().then(cards => {
      this.setState({ cards });
    });

    this.context.cardList.subscribe(this.handleCardsChange);
  }

  componentWillUnmount() {
    this.context.cardList.unsubscribe(this.handleCardsChange);
  }

  handleCardsChange(cards) {
    this.setState({ cards });
  }

  render() {
    return (
      <VirtualGrid
        items={this.state.cards}
        className="card-grid"
        renderItem={CardGrid.renderCard}
        renderTemplateItem={CardGrid.renderTemplateCard}
      />
    );
  }
}

export default CardGrid;
