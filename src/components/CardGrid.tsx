import * as React from 'react';

import { CardPreview } from './CardPreview';
import { Link } from './Link';
import { VirtualGrid } from './VirtualGrid';
import { Card } from '../model';
import { CardList } from '../CardList';
import { CardListContext } from './CardListContext';

interface PropsInner {
  cardList: CardList;
}

interface StateInner {
  cards: Array<Card>;
}

interface ItemType {
  id: string;
  front: string;
}

class CardGridInner extends React.PureComponent<PropsInner, StateInner> {
  static renderTemplateCard() {
    return <CardPreview front="Template" />;
  }

  static renderCard(item: ItemType) {
    return (
      <Link href={`/cards/${item.id}`}>
        <CardPreview {...item} />
      </Link>
    );
  }

  constructor(props: PropsInner) {
    super(props);

    this.state = { cards: [] };

    this.handleCardsChange = this.handleCardsChange.bind(this);
  }

  componentDidMount() {
    this.props.cardList.getCards().then(cards => {
      this.setState({ cards });
    });

    this.props.cardList.subscribe(this.handleCardsChange);
  }

  componentWillUnmount() {
    this.props.cardList.unsubscribe(this.handleCardsChange);
  }

  handleCardsChange(cards: Array<Card>) {
    this.setState({ cards });
  }

  render() {
    return (
      <VirtualGrid
        items={this.state.cards}
        className="card-grid"
        renderItem={CardGridInner.renderCard}
        renderTemplateItem={CardGridInner.renderTemplateCard}
      />
    );
  }
}

export const CardGrid = () => (
  <CardListContext.Consumer>
    {(cardList: CardList) => <CardGridInner cardList={cardList} />}
  </CardListContext.Consumer>
);
