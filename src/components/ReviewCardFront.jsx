import React from 'react';
import PropTypes from 'prop-types';

function ReviewCardFront(props) {
  const className = `card-front ${props.className || ''}`;

  return <div className={className}>{props.question}</div>;
}

ReviewCardFront.propTypes = {
  question: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default ReviewCardFront;
