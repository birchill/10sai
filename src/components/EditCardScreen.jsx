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
        <div className="search-box">
          <input
            type="text"
            placeholder="Lookup"
            className="text-box -compact" />
        </div>
        <CardFaceInput
          name="prompt"
          className="-textpanel -large"
          placeholder="Prompt"
          required />
        <CardFaceInput
          name="answer"
          className="-textpanel -large"
          placeholder="Answer" />
        <input
          type="text"
          placeholder="Keywords"
          className="-textpanel -compact -yellow" />
      </form>
    </section>
  );
}

EditCardScreen.propTypes = {
  active: PropTypes.bool.isRequired,
  card: PropTypes.string,
};

export default EditCardScreen;
