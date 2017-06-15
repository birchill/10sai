import React from 'react';
import PropTypes from 'prop-types';

function CardFaceInput(props) {
  const { className, ...rest } = props;

  return (
    <textarea
      className={className + ' cardface-input'}
      autoComplete="off"
      wrap="soft"
      {...rest} />
  );
}

CardFaceInput.propTypes = {
  className: PropTypes.string,
};

export default CardFaceInput;
