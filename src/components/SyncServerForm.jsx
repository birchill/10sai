import React from 'react';
import CancelableTextbox from './CancelableTextbox.jsx';

export class SyncServerForm extends React.Component {
  static get propTypes() {
    return {
      server: React.PropTypes.string,
      username: React.PropTypes.string,
      password: React.PropTypes.string,
      onSubmit: React.PropTypes.func.isRequired,
      onCancel: React.PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.state = { server: '', username: '', password: '' };
    [ 'handleServerChange',
      'handleUsernameChange',
      'handlePasswordChange',
      'handleSubmit',
      'handleCancel' ].forEach(
      handler => { this[handler] = this[handler].bind(this); }
    );
  }

  componentWillMount() {
    this.setState({ server: this.props.server,
                    username: this.props.username || '',
                    password: this.props.password || '' });
  }

  componentWillReceiveProps(nextProps) {
    [ 'server', 'username', 'password' ].forEach(field => {
      if (this.props[field] !== nextProps[field]) {
        this.setState({ [field]: nextProps[field] || '' });
      }
    });
  }

  handleServerChange(value) {
    this.setState({ server: value });
    // When clearing the server, also clear the username/password
    if (!value) {
      this.setState({ username: '', password: '' });
    }
  }
  handleUsernameChange(e) {
    this.setState({ username: e.target.value });
  }
  handlePasswordChange(e) {
    this.setState({ password: e.target.value });
  }

  handleSubmit(e) {
    e.preventDefault();
    const server = this.state.server.trim()
                   ? { name: this.state.server,
                       username: this.state.username,
                       password: this.state.password }
                   : undefined;
    this.props.onSubmit(server);
  }

  handleCancel() {
    this.setState({ server: this.props.server,
                    username: this.props.username || '',
                    password: this.props.password || '' });
    this.props.onCancel();
  }

  render() {
    return (
      <form name="sync-server-settings" onSubmit={this.handleSubmit}>
        <CancelableTextbox name="server" type="text" placeholder="Server name"
          className="form-input" size="40"
          value={this.state.server} onChange={this.handleServerChange} />
        <div className="stacked-group">
          <input type="text" name="username" placeholder="Username"
            size="40" value={this.state.username}
            onChange={this.handleUsernameChange} />
          <input type="password" name="password" placeholder="Password"
            size="40" value={this.state.password}
            onChange={this.handlePasswordChange} />
        </div>
        <input type="button" name="submit" value="Ok"
          className="primary" onClick={this.handleSubmit} />
        <input type="button" name="cancel" value="Cancel" className="link"
          onClick={this.handleCancel} />
      </form>
    );
  }
}

export default SyncServerForm;
