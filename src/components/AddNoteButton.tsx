import React from 'react';
import PropTypes from 'prop-types';

interface Props {
  className?: string;
}

const AddNoteButton: React.SFC<Props> = props => {
  let className = 'addnote-button -icon -plus -yellow';
  if (props.className) {
    className += ' ' + props.className;
  }
  return <button className={className}>Add note</button>;
};

AddNoteButton.propTypes = {
  className: PropTypes.string,
};

export default AddNoteButton;
