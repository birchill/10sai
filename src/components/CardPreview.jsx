import React from 'react';

export class CardPreview extends React.Component {
  static get propTypes() {
    return {
      _id: React.PropTypes.string.isRequired,
      question: React.PropTypes.string.isRequired,
      answer: React.PropTypes.string.isRequired,
      onDelete: React.PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);
    this.handleDelete  = this.handleDelete.bind(this);
  }

  handleDelete() {
    this.props.onDelete(this.props._id);
  }

  render() {
    return (
      <tr>
        <td className="question">{this.props.question}</td>
        <td className="answer">{this.props.answer}</td>
        <td className="delete"><button className="link"
          onClick={this.handleDelete}>X</button></td>
      </tr>
    );
  }
}

export default CardPreview;
