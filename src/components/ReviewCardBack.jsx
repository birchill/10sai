import React from 'react';
import PropTypes from 'prop-types';

function ReviewCardBack(props) {
  const className = `reviewcard-back ${props.className || ''}`;

  return (
    <div className={className}>
      {props.question}
      <hr />
      {props.answer}
    </div>
  );
}

ReviewCardBack.propTypes = {
  question: PropTypes.string.isRequired,
  answer: PropTypes.string,
  className: PropTypes.string,
};

export default ReviewCardBack;
