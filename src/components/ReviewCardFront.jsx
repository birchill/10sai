import React from 'react';
import PropTypes from 'prop-types';

function ReviewCardFront(props) {
  const className = `reviewcard-front ${props.className || ''}`;

  return (
    <div className={className}>
      <div className="question">{props.question}</div>
    </div>
  );
}

ReviewCardFront.propTypes = {
  question: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default ReviewCardFront;
