import React from 'react';

export class PopupOverlay extends React.Component {
  static get propTypes() {
    return {
      active: React.PropTypes.bool.isRequired,
      close: React.PropTypes.func.isRequired,
      children: React.PropTypes.any,
    };
  }

  constructor(props) {
    super(props);
    this.handleFocus = this.handleFocus.bind(this);
  }

  handleFocus(evt) {
    evt.stopPropagation();
    const popup = document.querySelector('.popup.active');
    if (popup) {
      popup.focus();
    }
  }

  render() {
    const overlayClass = `popup-overlay ${this.props.active ? 'active' : ''}`;

    return (
      <div onFocus={this.props.active ? this.handleFocus : ''}>
        {this.props.children}
        <div className={overlayClass} onClick={this.props.close}></div>
      </div>
    );
  }
}

export default PopupOverlay;
