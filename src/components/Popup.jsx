import React from 'react';

export class Popup extends React.Component {
  static get propTypes() {
    return {
      active: React.PropTypes.bool.isRequired,
      close: React.PropTypes.func.isRequired,
      children: React.PropTypes.any,
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
    const popupClass = `popup ${this.props.active ? 'active' : ''}`;

    return (
      <section className={popupClass}
        aria-hidden={!this.props.active} aria-role="dialog"
        tabIndex={this.props.active ? 0 : -1 }
        ref={this.assignPopup}>
        {this.props.children}
      </section>
    );
  }
}

export default Popup;
