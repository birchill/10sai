import React from 'react';
import PropTypes from 'prop-types';

function ReviewCardBack(props) {
  const className = `reviewcard-back ${props.className || ''}`;

  return (
    <div className={className}>
      <div className="question">{props.question}</div>
      <hr className="divider" />
      <div className="answer">{props.answer}</div>
    </div>
  );
}

ReviewCardBack.propTypes = {
  question: PropTypes.string.isRequired,
  answer: PropTypes.string,
  className: PropTypes.string,
};

export default ReviewCardBack;
