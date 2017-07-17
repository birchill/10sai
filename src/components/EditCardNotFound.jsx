import React from 'react';
import PropTypes from 'prop-types';

function EditCardNotFound(props) {
  return (
    <div className="summary-panel editcard-notfound -notfound">
      <div className="icon -notfound" />
      <h4 className="summary">Card not found</h4>
      <button
        className="action -primary"
        onClick={props.onAdd}>Add a card</button>
    </div>);
}

EditCardNotFound.propTypes = {
  onAdd: PropTypes.func.isRequired,
};

export default EditCardNotFound;
