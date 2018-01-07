import React from 'react';
import PropTypes from 'prop-types';

// A bar with three colored regions.

function TricolorProgress(props) {
  const sum = props.aItems + props.bItems + props.cItems;
  const asScaleX = numItems => `scaleX(${sum ? numItems / sum : 0})`;

  return (
    <div
      className={`tricolor-progress ${props.className || ''}`}
      title={props.title}>
      <div className="c" />
      <div
        className="b"
        style={{ transform: asScaleX(props.aItems + props.bItems) }}
      />
      <div className="a" style={{ transform: asScaleX(props.aItems) }} />
    </div>
  );
}

TricolorProgress.propTypes = {
  // Rather than provide two percentages, we accept three numbers and calculate
  // the percentages ourselves.
  aItems: PropTypes.number.isRequired,
  bItems: PropTypes.number.isRequired,
  cItems: PropTypes.number.isRequired,
  title: PropTypes.string,
  className: PropTypes.string,
};

export default TricolorProgress;
