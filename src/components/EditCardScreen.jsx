import React from 'react';
import PropTypes from 'prop-types';

import Link from './Link.jsx';

function EditCardScreen(props) {
  return (
    <section
      className="edit-screen"
      aria-hidden={!props.active} >
      <Link
        href="/"
        className="close-button"
        direction="backwards">Close</Link>
      <form className="form edit-form" autoComplete="off">
        <div className="cardfields">
          <input
            type="text"
            placeholder="🔑 Keywords"
            className="keywords -compact" />
          <input type="text" placeholder="Prompt" className="prompt" />
          <input type="text" placeholder="Answer" className="answer" />
        </div>
        <input
          className="submit -primary"
          type="submit"
          value={props.card ? 'OK' : 'Add'} />
      </form>
    </section>
  );
}

EditCardScreen.propTypes = {
  active: PropTypes.bool.isRequired,
  card: PropTypes.string,
};

export default EditCardScreen;
