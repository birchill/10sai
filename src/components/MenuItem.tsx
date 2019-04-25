import * as React from 'react';

import { hasPhysicalKeyboard } from '../utils/keyboard';

interface Props {
  id?: string;
  className?: string;
  label: string;
  accelerator?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export const MenuItem: React.FC<Props> = props => {
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
      <button {...buttonAttributes} role="menuitem" disabled={props.disabled}>
        <span className="label">{props.label}</span>
        {props.accelerator && hasPhysicalKeyboard ? (
          <span className="accelerator">{props.accelerator}</span>
        ) : null}
      </button>
    </li>
  );
};
