import React from 'react';
import CardGrid from './card-grid.jsx';

export class CardOverviewScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = { cards: [] };
  }

  componentDidMount() {
    const updateCards = () => {
      this.props.db.getCards().then(cards => {
        this.setState({ cards });
      });
    }
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
        <form className="add-card" onSubmit={e => this.handleAdd(e)}
          ref="addForm">
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
