import * as React from 'react';

import { Link, Props as LinkProps } from './Link';

type Props = LinkProps & { label: string; disabled?: boolean };

export const MenuItemLink: React.FC<Props> = props => {
  const linkAttributes: Props = {
    ...props,
    className: 'command',
  };

  if (props.className) {
    linkAttributes.className += ` ${props.className}`;
  }

  if (props.disabled) {
    linkAttributes.className += ` -disabled`;
  }

  return (
    <li className="menu-item" role="presentation">
      <Link {...linkAttributes} role="menuitem">
        <span className="label">{props.label}</span>
      </Link>
    </li>
  );
};
