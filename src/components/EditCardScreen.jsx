import React from 'react';
import PropTypes from 'prop-types';

import Link from './Link.jsx';

function EditCardScreen(props) {
  return (
    <section
      className="edit-screen"
      aria-hidden={!props.active} >
      <nav className="buttons button-bar">
        <div>
          <input
            className="delete"
            type="button"
            value="Delete" />
        </div>
        <div className="-center">
          <input
            className="submit -primary -center"
            type="submit"
            value={props.card ? 'OK' : 'Add'} />
        </div>
        <div>
          <Link
            href="/"
            className="close-button"
            direction="backwards">Close</Link>
        </div>
      </nav>
      <form className="form edit-form" autoComplete="off">
        <input
          type="text"
          placeholder="🔑 Keywords"
          className="keywords -compact" />
        <input type="text" placeholder="Prompt" className="prompt" />
        <input type="text" placeholder="Answer" className="answer" />
      </form>
    </section>
  );
}

EditCardScreen.propTypes = {
  active: PropTypes.bool.isRequired,
  card: PropTypes.string,
};

export default EditCardScreen;
