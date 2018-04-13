import React from 'react';
import PropTypes from 'prop-types';

import Link from './Link';

interface Props {
  deleted: boolean;
}

const EditCardNotFound: React.SFC<Props> = props => {
  return (
    <div className="summary-panel editcard-notfound -notfound">
      <div className="icon -notfound" />
      <h4 className="summary">
        {props.deleted ? 'Card deleted' : 'Card not found'}
      </h4>
      <Link href="/cards/new" className="action -primary">
        Add a card
      </Link>
    </div>
  );
};

EditCardNotFound.propTypes = {
  deleted: PropTypes.bool,
};

export default EditCardNotFound;
