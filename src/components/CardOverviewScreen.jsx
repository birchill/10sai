import React from 'react';
import CardGrid from './CardGrid.jsx';

export class CardOverviewScreen extends React.Component {
  static get contextTypes() {
    return { cardStore: React.PropTypes.object };
  }

  constructor(props) {
    super(props);
    this.state = { question: '', answer: '' };

    // Bind handlers
    [ 'handleAdd',
      'handleQuestionChange',
      'handleAnswerChange' ].forEach(
      handler => { this[handler] = this[handler].bind(this); }
    );
  }

  addCard() {
    const [ question, answer ] =
      [ 'question', 'answer' ].map(field => this.state[field].trim());
    if (!question.length || !answer.length) {
      return;
    }

    this.context.cardStore.putCard({ question, answer })
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
          <input
            type="text"
            name="question"
            className="question"
            placeholder="Question"
            value={this.state.question}
            onChange={this.handleQuestionChange} />
          <input
            type="text"
            name="answer"
            className="answer"
            placeholder="Answer"
            value={this.state.answer}
            onChange={this.handleAnswerChange} />
          <input type="submit" value="Add" />
        </form>
        <CardGrid />
      </section>
    );
  }
}

export default CardOverviewScreen;
