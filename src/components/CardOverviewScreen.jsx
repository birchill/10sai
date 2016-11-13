import React from 'react';
import CardGrid from './CardGrid.jsx';

export class CardOverviewScreen extends React.Component {
  static get propTypes() {
    return {
      db: React.PropTypes.object.isRequired,
    };
  }

  constructor(props) {
    super(props);
    this.state = { cards: [], question: '', answer: '' };

    // Bind handlers
    [ 'handleAdd', 'handleQuestionChange', 'handleAnswerChange' ].forEach(
      handler => { this[handler] = this[handler].bind(this); }
    );
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
      [ 'question', 'answer' ].map(field => this.state[field].trim());
    if (!question.length || !answer.length) {
      return;
    }

    this.props.db.putCard({ question, answer })
      .then(() => {
        this.setState({ question: '', answer: '' });
      })
      // eslint-disable-next-line no-console
      .catch(err => console.log(err));
  }

  handleQuestionChange(e) {
    this.setState({ question: e.target.value });
  }

  handleAnswerChange(e) {
    this.setState({ answer: e.target.value });
  }

  handleAdd(e) {
    e.preventDefault();
    this.addCard();
  }

  render() {
    return (
      <section id="card-list" tabIndex="-1">
        <form className="add-card" onSubmit={this.handleAdd}>
          <input type="text" name="question" className="question"
            placeholder="Question" value={this.state.question}
            onChange={this.handleQuestionChange} />
          <input type="text" name="answer" className="answer"
            placeholder="Answer" value={this.state.answer}
            onChange={this.handleAnswerChange} />
          <input type="submit" value="Add" />
        </form>
        <CardGrid cards={this.state.cards} />
      </section>
    );
  }
}

export default CardOverviewScreen;
