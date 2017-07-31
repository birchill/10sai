import React from 'react';

import Link from './Link.jsx';

function EditCardNotFound() {
  return (
    <div className="summary-panel editcard-notfound -notfound">
      <div className="icon -notfound" />
      <h4 className="summary">Card not found</h4>
      <Link
        href="/cards/new"
        className="action -primary">Add a card</Link>
    </div>);
}

export default EditCardNotFound;
