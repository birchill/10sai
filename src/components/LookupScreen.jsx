import React from 'react';
import PropTypes from 'prop-types';

export class LookupScreen extends React.Component {
  static get propTypes() {
    return {
      active: PropTypes.bool.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.assignSearchBox = elem => { this.searchBox = elem; };
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
    if (this.searchBox) {
      this.searchBox.focus();
    }
  }

  render() {
    return (
      <section className="lookup-screen" aria-hidden={!this.props.active}>
        <div className="search-box">
          <input
            name="q"
            type="search"
            placeholder="Lookup"
            className="-compact -rounded -icon -search"
            spellCheck="false"
            aria-label="Lookup"
            ref={this.assignSearchBox} />
        </div>
      </section>
    );
  }
}

export default LookupScreen;
