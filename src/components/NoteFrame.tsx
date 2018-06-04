import React from 'react';
import PropTypes from 'prop-types';

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
      <div className="cornerfiller" />
      <div className="body">{children}</div>
    </div>
  );
};

NoteFrame.propTypes = {
  className: PropTypes.string,
};

export default NoteFrame;
