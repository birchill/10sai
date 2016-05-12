import React from 'react';

export class SyncServerForm extends React.Component {
  static get propTypes() {
    return {
      server: React.PropTypes.string,
      onSubmit: React.PropTypes.func.isRequired,
      onCancel: React.PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.state = { server: '' };
    [ 'handleServerChange', 'handleSubmit', 'handleCancel' ].forEach(
      handler => { this[handler] = this[handler].bind(this); }
    );
  }

  componentWillMount() {
    this.setState({ server: this.props.server });
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.server !== nextProps.server) {
      this.setState({ server: nextProps.server });
    }
  }

  handleServerChange(e) {
    this.setState({ server: e.target.value });
  }

  handleSubmit() {
    this.props.onSubmit(this.state.server);
  }

  handleCancel() {
    this.setState({ server: this.props.server });
    this.onCancel();
  }

  render() {
    return (
      <form name="sync-server-settings" onSubmit={this.handleSubmit}>
        <input name="server" type="text" placeholder="Server name"
          value={this.state.server} />
        <input type="submit" value="Ok" />
        <input type="button" value="Cancel" onClick={this.handleCancel} />
      </form>
    );
  }
}

export default SyncServerForm;
