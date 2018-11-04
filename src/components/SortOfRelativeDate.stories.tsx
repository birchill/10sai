import React from 'react';
import { storiesOf } from '@storybook/react';

import { SortOfRelativeDate } from './SortOfRelativeDate';

class State {
  value: Date;
}

class SortOfRelativeDateExample extends React.PureComponent<{}, State> {
  state: State = {
    value: new Date(),
  };

  constructor(props: {}) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    this.setState({ value: new Date() });
  }

  render() {
    return (
      <div className="series">
        <SortOfRelativeDate value={this.state.value} />
        <button className="button" onClick={this.handleClick}>
          Update
        </button>
      </div>
    );
  }
}

storiesOf('Components|SortOfRelativeDate', module).add('default', () => (
  <SortOfRelativeDateExample />
));
