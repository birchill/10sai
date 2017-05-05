import React from 'react';
import { connect } from 'react-redux';

// This function is copied from react-router.
const isModifiedEvent = evt =>
  !!(evt.metaKey || evt.altKey || evt.ctrlKey || evt.shiftKey);

class Link extends React.Component {
  static get propTypes() {
    return {
      href: React.PropTypes.string.isRequired,
      replace: React.PropTypes.bool,
      onClick: React.PropTypes.func,
      children: React.PropTypes.node,
    };
  }

  static get childContextTypes() {
    return { store: React.PropTypes.any };
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

    // If props.onClick called preventDefault, abort.
    if (e.defaultPrevented) {
      return;
    }

    e.preventDefault();

    if (this.props.replace) {
      history.replaceState({}, null, this.props.href);
    } else {
      history.pushState({}, null, this.props.href);
    }
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

const mapDispatchToProps = dispatch => ({
  onClick: href => {
    dispatch({ type: 'NAVIGATE', url: href });
  }
});

export default connect(null, mapDispatchToProps)(Link);
