import React from 'react';

export class PopupOverlay extends React.Component {
  static get propTypes() {
    return {
      active: React.PropTypes.bool.isRequired,
      close: React.PropTypes.func.isRequired,
      children: React.PropTypes.any,
    };
  }

  render() {
    const overlayClass = `popup-overlay ${this.props.active ? 'active' : ''}`;

    return (
      <div>
        {this.props.children}
        <div className={overlayClass} onClick={this.props.close}></div>
      </div>
    );
  }
}

export default PopupOverlay;
