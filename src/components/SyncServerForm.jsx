import React from 'react';
import PropTypes from 'prop-types';

import CancelableTextbox from './CancelableTextbox.jsx';

export class SyncServerForm extends React.Component {
  static get propTypes() {
    return {
      server: PropTypes.string,
      username: PropTypes.string,
      password: PropTypes.string,
      onSubmit: PropTypes.func.isRequired,
      onCancel: PropTypes.func.isRequired,
    };
  }

  static handleTextBoxFocus(e) {
    // Until scrollIntoViewIfNeeded() gets standardized this is a very hacky
    // version that should barely work for this situation.
    const textBox = e.target;

    // Get nearest scroll container
    let scrollParent;
    for (
      let parent = e.target.parentNode;
      parent instanceof HTMLElement;
      parent = parent.parentNode
    ) {
      if (parent.scrollHeight > parent.clientHeight) {
        scrollParent = parent;
        break;
      }
    }
    if (!scrollParent) {
      return;
    }

    // Wait for window to be resized for soft keyboard.
    // (I have no idea if this works on iOS but it seems to be the way things
    // work on Android.)
    window.addEventListener('resize', function onresize() {
      window.removeEventListener('resize', onresize);

      // Check that we are still the focussed element.
      if (document.activeElement !== textBox) {
        return;
      }

      const bbox = textBox.getBoundingClientRect();
      const scrollParentBbox = scrollParent.getBoundingClientRect();
      if (bbox.bottom > scrollParentBbox.bottom) {
        textBox.scrollIntoView({ block: 'end', behavior: 'smooth' });
      } else if (bbox.top < scrollParentBbox.top) {
        textBox.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    });
  }

  constructor(props) {
    super(props);

    this.state = { server: '', username: '', password: '' };
    [
      'handleServerChange',
      'handleUsernameChange',
      'handlePasswordChange',
      'handleSubmit',
      'handleCancel',
    ].forEach(handler => {
      this[handler] = this[handler].bind(this);
    });
  }

  componentWillMount() {
    this.setState({
      server: this.props.server,
      username: this.props.username || '',
      password: this.props.password || '',
    });
  }

  componentWillReceiveProps(nextProps) {
    ['server', 'username', 'password'].forEach(field => {
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
      ? {
          name: this.state.server,
          username: this.state.username,
          password: this.state.password,
        }
      : undefined;
    this.props.onSubmit(server);
  }

  handleCancel() {
    this.setState({
      server: this.props.server,
      username: this.props.username || '',
      password: this.props.password || '',
    });
    this.props.onCancel();
  }

  render() {
    return (
      <form name="sync-server-settings" onSubmit={this.handleSubmit}>
        <CancelableTextbox
          name="server"
          type="text"
          placeholder="Server name"
          className="form-input"
          size="40"
          value={this.state.server}
          onChange={this.handleServerChange}
          onFocus={SyncServerForm.handleTextBoxFocus}
        />
        <div className="stacked-group">
          <input
            type="text"
            name="username"
            placeholder="Username"
            className="-icon -user"
            size="40"
            value={this.state.username}
            onChange={this.handleUsernameChange}
            onFocus={SyncServerForm.handleTextBoxFocus}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="-icon -lock"
            size="40"
            value={this.state.password}
            onChange={this.handlePasswordChange}
            onFocus={SyncServerForm.handleTextBoxFocus}
          />
        </div>
        <input
          type="button"
          name="submit"
          value="Ok"
          className="-primary"
          onClick={this.handleSubmit}
        />
        <input
          type="button"
          name="cancel"
          value="Cancel"
          className="-link"
          onClick={this.handleCancel}
        />
      </form>
    );
  }
}

export default SyncServerForm;
