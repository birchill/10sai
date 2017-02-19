import React from 'react';
import CardPreview from './CardPreview.jsx';
import VirtualGrid from './VirtualGrid.jsx';

export class CardGrid extends React.Component {
  static get propTypes() {
    return {
      cards: React.PropTypes.arrayOf(React.PropTypes.shape({
        _id: React.PropTypes.string.isRequired,
        question: React.PropTypes.string.isRequired,
      })).isRequired,
      onDelete: React.PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.renderCard = this.renderCard.bind(this);
    this.renderTemplateCard = this.renderTemplateCard.bind(this);
  }

  renderCard(item) {
    return <CardPreview onDelete={this.props.onDelete} {...item} />;
  }

  renderTemplateCard() {
    return (
      <CardPreview onDelete={() => {}} _id="template"
        question="Template" />);
  }

  render() {
    return (
      <VirtualGrid items={this.props.cards} className="card-grid"
        renderItem={this.renderCard}
        renderTemplateItem={this.renderTemplateCard} />);
  }
}

export default CardGrid;
