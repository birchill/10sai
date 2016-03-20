import React from 'react';

export class SettingsScreen extends React.Component {
  render() {
    return (
      <section id="sync">
        <h3>Sync</h3>
        <input type="button" value="Add sync server"></input>
      </section>
    );
  }
}

export default CardRow;
