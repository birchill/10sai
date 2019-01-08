import * as React from 'react';
import DocumentTitle from 'react-document-title';

import { LookupToolbar } from './LookupToolbar';

interface Props {
  active: boolean;
}

export class LookupScreen extends React.PureComponent<Props> {
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
        {this.renderTitle()}
        <LookupToolbar ref={this.toolbarRef} />
      </section>
    );
  }

  renderTitle(): React.ReactNode | null {
    if (!this.props.active) {
      return null;
    }

    return <DocumentTitle title="10sai - Lookup" />;
  }
}
