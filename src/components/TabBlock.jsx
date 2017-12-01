import React from 'react';
import PropTypes from 'prop-types';

export class TabBlock extends React.Component {
  static get propTypes() {
    return {
      className: PropTypes.string,
      active: PropTypes.number,
      children: PropTypes.arrayOf(PropTypes.element),
    };
  }

  static renderChild(child, isActive) {
    let className = 'tab-item';
    if (isActive) {
      className += ' active';
    }
    return (
      <li className={className} role="presentation">
        {React.cloneElement(child, { role: 'tab', 'aria-selected': isActive })}
      </li>
    );
  }

  render() {
    return (
      <ul
        role="tablist"
        className={`${this.props.className || ''} tab-block`}>
        {React.Children.map(this.props.children, (child, index) =>
          TabBlock.renderChild(child, index === this.props.active)
        )}
        <div
          className="highlight-bar"
          role="presentation"
          hidden={this.props.active === undefined} />
      </ul>
    );
  }
}

export default TabBlock;
