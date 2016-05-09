import React from 'react';

export class SyncServerForm extends React.Component {
  static get propTypes() {
    return {
      server: React.PropTypes.string,
      onCancel: React.PropTypes.func.isRequired,
      verify: React.PropTypes.func.isRequired,
      onChange: React.PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);
    this.state = { server: null, doingVerify: false };

    // Bind handlers
    [
      'handleServerChange',
      'handleSubmit',
      'handleCancel',
      'handleCancelVerify',
    ].forEach(
      handler => { this[handler] = this[handler].bind(this); }
    );
  }

  handleServerChange(e) {
    this.setState({ server: e.target.value });
  }

  handleSubmit(e) {
    // XXX
    // - this.setState({ doingVerify: true });
    // - Call this.props.verify
    //   -- Returns a promise?
    //      On success: doingVerify -> false
    //                  call onChange
    //                  server this.state.server
    //      On failure: Show error message?
    //                  doingVerify -> false
  }

  handleCancel(e) {
    this.setState({ server: null });
    // XXX Call this.props.onCancel
  }

  handleVerifyCancel(e) {
    // XXX Call this.props.cancelVerify --- might be better if
    // this.props.verify() returns a tuple, of a Promise and a cancel method?
    // Cancelling is probably specified to the request?
    // So maybe even return a request object that contains a promise and
    // a cancel method?
  }

  render() {
    const server = this.state.server || this.props.server;

    return (
      if (this.state.doingVerify) {
        <form name="sync-server-settings" onSubmit={handleSubmit}>
          <input name="server" type="text" placeholder="Server name"
            value={server}/>
          <input type="submit" value="Ok" />
          <input type="button" value="Cancel" onClick={handleCancel} />
        </form>
      } else {
        <p>Connecting&hellip;</p>
        <input type="button" value="Cancel" onClick={handleCancelVerify} />
      }
    );
  }
}

export default SyncServerForm;
