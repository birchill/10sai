import React from 'react';

export class CardRow extends React.Component {
  get propTypes() {
    return {
      question: React.PropTypes.string.isRequired,
      answer: React.PropTypes.string.isRequired,
    };
  }
  render() {
    return (
      <tr>
        <td className="question">{this.props.question}</td>
        <td className="answer">{this.props.answer}</td>
        <td className="delete">X</td>
      </tr>
    );
  }
}

export default CardRow;
