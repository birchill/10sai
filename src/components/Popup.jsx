import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import * as routeActions from '../actions/route';
import Link from './Link.jsx';

export class Popup extends React.Component {
  static get propTypes() {
    return {
      active: PropTypes.bool.isRequired,
      children: PropTypes.node,
      currentScreenLink: PropTypes.string.isRequired,
      close: PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.assignPopup = elem => { this.popup = elem; };
  }

  componentDidMount() {
    if (this.props.active) this.activatePopup();
  }

  componentDidUpdate(previousProps) {
    if (previousProps.active === this.props.active) {
      return;
    }

    if (this.props.active) {
      this.activatePopup();
    } else {
      this.deactivatePopup();
    }
  }

  componentWillUnmount() {
    if (this.props.active) this.deactivatePopup();
  }

  activatePopup() {
    this.previousFocus = document.activeElement;
    if (this.popup) {
      this.popup.focus();
    }
    document.addEventListener('keydown', this.handleKeyDown);
  }

  deactivatePopup() {
    if (this.previousFocus) {
      this.previousFocus.focus();
      this.previousFocus = undefined;
    }
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(e) {
    if (!e.keyCode || e.keyCode === 27) {
      this.props.close();
    }
  }

  render() {
    const overlayClass = `overlay ${this.props.active ? '-active' : ''}`;

    // We should use the new fragment syntax here but something in our toolchain
    // doesn't support it yet.
    return (
      <div className="pop-up">
        <div className={overlayClass} onClick={this.props.close} />
        <section
          className="content"
          aria-hidden={!this.props.active}
          role="dialog"
          ref={this.assignPopup}>
          <Link
            href={this.props.currentScreenLink}
            className="close-button"
            direction="backwards">Close</Link>
          {this.props.children}
        </section>
      </div>
    );
  }
}

const mapDispatchToProps = (dispatch, props) => ({
  close: () => {
    dispatch(routeActions.followLink(props.currentScreenLink, 'backwards'));
  }
});

const ConnectedPopup = connect(undefined, mapDispatchToProps)(Popup);

export default ConnectedPopup;
