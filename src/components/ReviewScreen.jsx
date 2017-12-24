import React from 'react';
import PropTypes from 'prop-types';

import Link from './Link.jsx';

function ReviewScreen(props) {
  return (
    <section className="review-screen" aria-hidden={!props.active}>
      <div className="buttons">
        <Link href="/review/settings" className="settings-button">
          Settings
        </Link>
        <Link href="/" className="close-button" direction="backwards">
          Close
        </Link>
      </div>
    </section>
  );
}

ReviewScreen.propTypes = {
  active: PropTypes.bool.isRequired,
};

export default ReviewScreen;
