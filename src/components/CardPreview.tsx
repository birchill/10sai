import React from 'react';
import PropTypes from 'prop-types';

interface Props {
  question: string;
}

export const CardPreview: React.SFC<Props> = props => {
  // I thought flexbox was supposed to fix all the problems with CSS but
  // we still have to add an extra div just to use it :/
  return (
    <div className="card-preview">
      <div className="flex-container">
        <span className="question">{props.question}</span>
      </div>
    </div>
  );
};

CardPreview.propTypes = {
  question: PropTypes.string.isRequired,
};

export default CardPreview;
