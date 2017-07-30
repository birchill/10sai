import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import * as routeActions from '../actions/route';

// This function is copied from react-router.
const isModifiedEvent = evt =>
  !!(evt.metaKey || evt.altKey || evt.ctrlKey || evt.shiftKey);

class Link extends React.Component {
  static get propTypes() {
    return {
      href: PropTypes.string.isRequired,
      direction: PropTypes.oneOf([ 'backwards', 'replace', 'forwards' ]),
      onClick: PropTypes.func,
      children: PropTypes.node,
    };
  }

  static get defaultProps() {
    return {
      direction: 'forwards'
    };
  }

  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(e) {
    // Ignore the event if...
    if (e.button !== 0 ||      // ... it's a right-click
        isModifiedEvent(e)) {  // ... it's a ctrl-click etc.
      return;
    }

    if (this.props.onClick) {
      this.props.onClick(this.props.href);
    }

    e.preventDefault();
  }

  render() {
    const { href, ...rest } = this.props;
    return (
      <a href={href} {...rest} onClick={this.handleClick}>
        {this.props.children}
      </a>
    );
  }
}

const mapDispatchToProps = (dispatch, props) => ({
  onClick: href => {
    dispatch(routeActions.followLink(href, props.direction));
  }
});

export default connect(null, mapDispatchToProps)(Link);
