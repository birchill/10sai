import React from 'react';

export class SettingsPopup extends React.Component {
  static get propTypes() {
    return {
      active: React.PropTypes.bool,
    };
  }

  render() {
    return (
      <section id="settings" className={this.props.active ? 'active' : ''}>
        <h3>Sync</h3>
        <input type="button" value="Add sync server"
          className="link-button"></input>
      </section>
    );
  }
}

export default SettingsPopup;
