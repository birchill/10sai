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

  render() {
    console.log(this.props.active);
    return (
      <ul
        role="tablist"
        {...this.props}
        className={`${this.props.className || ''} tab-block`}>
        {
          React.Children.map(this.props.children, child =>
            (<li className="tab-item" role="presentation">
              { React.cloneElement(child, { role: 'tab' }) }
            </li>)
          )
        }
        <div
          className="highlight-bar"
          role="presentation"
          hidden={this.props.active === undefined} />
      </ul>
    );
  }
}

export default TabBlock;
