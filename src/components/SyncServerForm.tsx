import React from 'react';
import PropTypes from 'prop-types';

import { SyncServer } from '../sync/SyncServer';
import CancelableTextbox from './CancelableTextbox';

interface Props {
  className?: string;
  server?: string;
  username?: string;
  password?: string;
  onSubmit: (server?: SyncServer) => void;
  onCancel: () => void;
}

interface State {
  server: string;
  username: string;
  password: string;
}

export class SyncServerForm extends React.PureComponent<Props, State> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      server: PropTypes.string,
      username: PropTypes.string,
      password: PropTypes.string,
      onSubmit: PropTypes.func.isRequired,
      onCancel: PropTypes.func.isRequired,
    };
  }

  static handleTextBoxFocus(e: React.FocusEvent<HTMLInputElement>) {
    // Until scrollIntoViewIfNeeded() gets standardized this is a very hacky
    // version that should barely work for this situation.
    const textBox = e.target;

    // Get nearest scroll container
    let scrollParent: HTMLElement | undefined;
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
      const scrollParentBbox = scrollParent!.getBoundingClientRect();
      if (bbox.bottom > scrollParentBbox.bottom) {
        textBox.scrollIntoView({ block: 'end', behavior: 'smooth' });
      } else if (bbox.top < scrollParentBbox.top) {
        textBox.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    });
  }

  state: State = {
    server: '',
    username: '',
    password: '',
  };

  constructor(props: Props) {
    super(props);

    this.handleServerChange = this.handleServerChange.bind(this);
    this.handleUsernameChange = this.handleUsernameChange.bind(this);
    this.handlePasswordChange = this.handlePasswordChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
  }

  componentDidMount() {
    this.setState({
      server: this.props.server || '',
      username: this.props.username || '',
      password: this.props.password || '',
    });
  }

  componentDidUpdate(previousProps: Props) {
    const fields: Array<keyof Props> = ['server', 'username', 'password'];
    const stateChange: Partial<State> = {};
    for (const field of fields) {
      if (this.props[field] !== previousProps[field]) {
        stateChange[field as keyof State] =
          (this.props[field] as string | undefined) || '';
      }
    }

    if (Object.keys(stateChange).length) {
      this.setState(stateChange as State);
    }
  }

  handleServerChange(value: string) {
    this.setState({ server: value });
    // When clearing the server, also clear the username/password
    if (!value) {
      this.setState({ username: '', password: '' });
    }
  }

  handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ username: e.target.value });
  }

  handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ password: e.target.value });
  }

  handleSubmit(e: React.FormEvent) {
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
      server: this.props.server || '',
      username: this.props.username || '',
      password: this.props.password || '',
    });
    this.props.onCancel();
  }

  render() {
    return (
      <form
        className={`${this.props.className || ''} server-settings`}
        name="sync-server-settings"
        method="post"
        onSubmit={this.handleSubmit}
      >
        <CancelableTextbox
          type="text"
          name="server"
          autoComplete="url"
          placeholder="Server name"
          className="server"
          size={40}
          value={this.state.server}
          onChange={this.handleServerChange}
          onFocus={SyncServerForm.handleTextBoxFocus}
        />
        <div className="stacked-group">
          <input
            type="text"
            name="username"
            autoComplete="username"
            placeholder="Username"
            className="username -icon -user"
            size={40}
            value={this.state.username}
            onChange={this.handleUsernameChange}
            onFocus={SyncServerForm.handleTextBoxFocus}
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            className="password -icon -lock"
            size={40}
            value={this.state.password}
            onChange={this.handlePasswordChange}
            onFocus={SyncServerForm.handleTextBoxFocus}
          />
        </div>
        <input
          type="button"
          name="submit"
          value="Ok"
          className="submit -primary"
          onClick={this.handleSubmit}
        />
        <input
          type="button"
          name="cancel"
          value="Cancel"
          className="cancel -link"
          onClick={this.handleCancel}
        />
      </form>
    );
  }
}

export default SyncServerForm;
