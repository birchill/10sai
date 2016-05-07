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
    // XXX Store active element
    // XXX Focus first form control / popup itself
    document.addEventListener('keydown', this.handleKeyDown);
  }

  deactivatePopup() {
    // XXX Restore active element
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(e) {
    if (!e.keyCode || e.keyCode === 27) {
      this.props.close();
    }
  }

  render() {
    const classes = `popup ${this.props.active ? 'active' : ''}`;

    return (
      <section id="settings" className={classes}
        aria-hidden={!this.props.active} aria-role="dialog">
        {this.props.children}
      </section>
    );
  }
}

export default Popup;
