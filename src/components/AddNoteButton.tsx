import React from 'react';
import PropTypes from 'prop-types';

interface Props {
  className?: string;
}

const AddNoteButton: React.SFC<Props> = props => {
  let className = 'addnote-button';
  if (props.className) {
    className += ' ' + props.className;
  }
  return (
    <div className={className} role="button" tabIndex={0}>
      <div className="topleft -shadow" />
      <div className="top -shadow" />
      <div className="topright -shadow" />
      <div className="left -shadow" />
      <div className="label -shadow" />
      <div className="right -shadow" />
      <div className="bottomleft -shadow" />
      <div className="bottom -shadow" />
      <div className="bottomright -shadow" />
      <div className="topleft" />
      <div className="top" />
      <div className="topright">
        {/* XXX Factor this out into a component */}
        <svg className="corner" viewBox="0 0 100 100">
          <polygon fill="#FEFACF" points="0,0 100,100 0,100" />
          <path
            fill="#CCB92D"
            d="M0,0l100,100c0,0-69.5-4.5-78.4-7.09S8.9,85.5,7.2,78.76S0,0,0,0"
          />
          <path
            fill="#FCFBF1"
            d="M0,0l100,100c0,0-62.2-10.3-71-12.8s-12.7-7.4-14.4-14.1S0,0,0,0"
          />
        </svg>
      </div>
      <div className="left" />
      <div className="label">Add note</div>
      <div className="right" />
      <div className="bottomleft" />
      <div className="bottom" />
      <div className="bottomright" />
    </div>
  );
};

AddNoteButton.propTypes = {
  className: PropTypes.string,
};

export default AddNoteButton;
