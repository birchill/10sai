import React from 'react';
import PropTypes from 'prop-types';

import NoteCorner from './NoteCorner';

interface Props {
  className?: string;
}

const NoteFrame: React.SFC<Props> = props => {
  let className = 'note-frame';
  if (props.className) {
    className += ' ' + props.className;
  }

  const children = React.Children.toArray(props.children);
  const header = children.length > 1 ? children.splice(0, 1)[0] : null;

  return (
    <div className={className}>
      <div className="header">{header}</div>
      <NoteCorner />
      <div className="cornerfiller" />
      <div className="body">{children}</div>
    </div>
  );
};

NoteFrame.propTypes = {
  className: PropTypes.string,
};

export default NoteFrame;
