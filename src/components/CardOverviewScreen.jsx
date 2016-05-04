import React from 'react';
import CardGrid from './CardGrid.jsx';

export class CardOverviewScreen extends React.Component {
  static get propTypes() {
    return { db: React.PropTypes.object.isRequired };
  }

  constructor(props) {
    super(props);
    this.state = { cards: [] };
    this.handleAdd = this.handleAdd.bind(this);
  }

  componentDidMount() {
    const updateCards = () => {
      this.props.db.getCards().then(cards => {
        this.setState({ cards });
      });
    };
    this.props.db.onUpdate(updateCards);
    updateCards();
  }

  addCard() {
    const [ question, answer ] =
      [ 'question', 'answer' ].map(field => this.refs[field].value.trim());
    if (!question.length || !answer.length) {
      console.warn('Empty question/answer');
      return;
    }

    this.props.db.addCard(question, answer)
      .then(() => {
        console.log('saved');
        this.refs.addForm.reset();
      })
      .catch(err => console.log(err));
  }

  handleAdd(e) {
    e.preventDefault();
    this.addCard();
  }

  render() {
    // XXX Add onchange handlers to text fields and store current state
    return (
      <section id="card-list">
        <form className="add-card" onSubmit={this.handleAdd} ref="addForm">
          <input type="text" name="question" className="question"
            ref="question" />
          <input type="text" name="answer" className="answer"
            ref="answer" />
          <input type="submit" value="Add" />
        </form>
        <CardGrid cards={this.state.cards} />
      </section>
    );
  }
}

export default CardOverviewScreen;
