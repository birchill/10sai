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
      className += ' -active';
    }
    return (
      <li className={className} role="presentation">
        {React.cloneElement(child, { role: 'tab', 'aria-selected': isActive })}
      </li>
    );
  }

  componentWillUpdate(nextProps) {
    // If we are going from inactive to active we need to make sure the
    // underlying transform has the correct translation so that only the scale
    // transitions.
    if (typeof this.props.active === 'undefined' &&
        typeof nextProps.active !== 'undefined' &&
        this.highlightBar) {
      // Don't transition from whatever underlying 'transform' style we set when
      // we went inactive.
      this.highlightBar.style.transitionProperty = 'none';
      this.highlightBar.style.transformOrigin =
        `${100 * nextProps.active + 50}%`;
      this.highlightBar.style.transform =
        `scale(0, 1) translate(${100 * nextProps.active}%)`;

      // Flush the old style
      // eslint-disable-next-line no-unused-expressions
      getComputedStyle(this.highlightBar).transform;

      // Re-enable transitions
      this.highlightBar.style.transitionProperty = 'transform';
    }
  }

  componentDidUpdate(prevProps) {
    // If we are going from active to inactive we need to make sure the
    // transition endpoint has the correct translation so that only the scale
    // transitions.
    if (typeof this.props.active === 'undefined' &&
        typeof prevProps.active !== 'undefined' &&
        this.highlightBar) {
      this.highlightBar.style.transformOrigin =
        `${100 * prevProps.active + 50}%`;
      this.highlightBar.style.transform =
        `scale(0, 1) translate(${100 * prevProps.active}%)`;
    }
  }

  render() {
    const highlightStyle = {
      width: `${100 / React.Children.count(this.props.children)}%`
    };
    if (typeof this.props.active !== 'undefined') {
      highlightStyle.transform = `scale(1, 1) translate(${100 *
        this.props.active}%)`;
    }

    return (
      <ul role="tablist" className={`${this.props.className || ''} tab-block`}>
        {React.Children.map(this.props.children, (child, index) =>
          TabBlock.renderChild(child, index === this.props.active)
        )}
        <div
          className="highlight-bar"
          style={highlightStyle}
          role="presentation"
          ref={highlightBar => { this.highlightBar = highlightBar; }}
        />
      </ul>
    );
  }
}

export default TabBlock;
