import * as React from 'react';

interface Props {
  id?: string;
  className?: string;
  label: string;
  onClick?: () => void;
}

export const MenuItem: React.SFC<Props> = props => {
  const buttonAttributes: React.ButtonHTMLAttributes<HTMLButtonElement> = {
    className: 'command',
  };

  if (props.id) {
    buttonAttributes.id = props.id;
  }

  if (props.className) {
    buttonAttributes.className += ` ${props.className}`;
  }

  if (props.onClick) {
    buttonAttributes.onClick = props.onClick;
  }

  return (
    <li className="menu-item" role="presentation">
      <button {...buttonAttributes} role="menuitem">
        <span className="label">{props.label}</span>
      </button>
    </li>
  );
};
