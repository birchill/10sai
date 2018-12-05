import React from 'react';
import PropTypes from 'prop-types';

import { LookupToolbar } from './LookupToolbar';

interface Props {
  active: boolean;
}

export class LookupScreen extends React.PureComponent<Props> {
  static get propTypes() {
    return {
      active: PropTypes.bool.isRequired,
    };
  }

  toolbarRef: React.RefObject<LookupToolbar>;

  constructor(props: Props) {
    super(props);

    this.toolbarRef = React.createRef<LookupToolbar>();
  }

  componentDidMount() {
    if (this.props.active) {
      this.activate();
    }
  }

  componentDidUpdate(previousProps: Props) {
    if (previousProps.active === this.props.active) {
      return;
    }

    if (this.props.active) {
      this.activate();
    }
  }

  activate() {
    if (this.toolbarRef.current) {
      this.toolbarRef.current.focus();
    }
  }

  render() {
    return (
      <section className="lookup-screen" aria-hidden={!this.props.active}>
        <LookupToolbar ref={this.toolbarRef} />
      </section>
    );
  }
}

export default LookupScreen;