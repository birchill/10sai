import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput.jsx';
import Link from './Link.jsx';

function EditCardScreen(props) {
  return (
    <section
      className="edit-screen"
      aria-hidden={!props.active} >
      <nav className="buttons tool-bar">
        <div>
          <input
            className="delete -icon -delete -link"
            type="button"
            value="Delete" />
        </div>
        <div className="-center">
          <input
            className="submit -primary -icon -plus"
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
          placeholder="Search"
          className="search -compact" />
        <CardFaceInput
          name="prompt"
          className="prompt"
          placeholder="Prompt"
          required />
        <CardFaceInput
          name="answer"
          className="answer"
          placeholder="Answer" />
        <input
          type="text"
          placeholder="Keywords"
          className="keywords -compact" />
      </form>
    </section>
  );
}

EditCardScreen.propTypes = {
  active: PropTypes.bool.isRequired,
  card: PropTypes.string,
};

export default EditCardScreen;
