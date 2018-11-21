import React from 'react';
import PropTypes from 'prop-types';

import LookupToolbar from './LookupToolbar.tsx';

class LookupScreen extends React.PureComponent {
  static get propTypes() {
    return {
      active: PropTypes.bool.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.assignToolbar = elem => {
      this.toolbar = elem;
    };
  }

  componentDidMount() {
    if (this.props.active) this.activate();
  }

  componentDidUpdate(previousProps) {
    if (previousProps.active === this.props.active) {
      return;
    }

    if (this.props.active) {
      this.activate();
    }
  }

  activate() {
    if (this.toolbar) {
      this.toolbar.focus();
    }
  }

  render() {
    return (
      <section className="lookup-screen" aria-hidden={!this.props.active}>
        <LookupToolbar ref={this.assignToolbar} />
      </section>
    );
  }
}

export default LookupScreen;
