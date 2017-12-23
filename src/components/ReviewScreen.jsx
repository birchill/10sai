import React from 'react';
import PropTypes from 'prop-types';

function ReviewScreen(props) {
  return (
    <section className="review-screen" aria-hidden={!props.active} />
  );
}

ReviewScreen.propTypes = {
  active: PropTypes.bool.isRequired,
};

export default ReviewScreen;
