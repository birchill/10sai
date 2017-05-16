import React from 'react';
import PropTypes from 'prop-types';

export class CardPreview extends React.Component {
  static get propTypes() {
    return {
      _id: PropTypes.string.isRequired,
      question: PropTypes.string.isRequired,
      onDelete: PropTypes.func.isRequired,
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
    // I thought flexbox was supposed to fix all the problems with CSS but
    // we still have to add an extra div just to use it :/
    return (
      <div className="card-preview">
        <div className="flex-container">
          <span className="question">{this.props.question}</span>
          <button
            className="-link delete"
            onClick={this.handleDelete}>X</button>
        </div>
      </div>
    );
  }
}

export default CardPreview;
