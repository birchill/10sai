import React from 'react';
import PropTypes from 'prop-types';

export class PopupOverlay extends React.Component {
  static get propTypes() {
    return {
      active: PropTypes.bool.isRequired,
      close: PropTypes.func.isRequired,
      children: PropTypes.any,
    };
  }

  static handleFocus(evt) {
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
        <div className={overlayClass} onClick={this.props.close} />
      </div>
    );
  }
}

export default PopupOverlay;
