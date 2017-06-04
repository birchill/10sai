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
      <form className="edit-form">
        <div className="card-fields">
          <input type="text" placeholder="Keywords" />
          <input type="text" placeholder="Prompt" />
          <input type="text" placeholder="Answer" />
        </div>
        <input
          className="-primary"
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
