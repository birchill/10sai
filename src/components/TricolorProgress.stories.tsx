import React from 'react';
import { storiesOf } from '@storybook/react';

import { TricolorProgress } from './TricolorProgress';

const sectionStyle = {
  width: '300px',
  height: 'calc(2.5em + 10px)',
  marginBottom: '1em',
};

storiesOf('Components|TricolorProgress', module)
  .add('default', () => (
    <>
      <div style={sectionStyle}>
        <p>Equal length</p>
        <TricolorProgress
          aItems={10}
          bItems={10}
          cItems={10}
          title="Title goes here"
        />
      </div>
      <div style={sectionStyle}>
        <p>All done</p>
        <TricolorProgress
          aItems={10}
          bItems={0}
          cItems={0}
          title="Title goes here"
        />
      </div>
      <div style={sectionStyle}>
        <p>Little bit at the end</p>
        <TricolorProgress
          aItems={10}
          bItems={1}
          cItems={0}
          title="Title goes here"
        />
      </div>
      <div style={sectionStyle}>
        <p>All zero</p>
        <TricolorProgress
          aItems={0}
          bItems={0}
          cItems={0}
          title="Title goes here"
        />
      </div>
    </>
  ))
  .add('animated', () => <ActiveTricolorProgress />);

class State {
  a: number;
  b: number;
  c: number;
}

const sumTotal = 10;

class ActiveTricolorProgress extends React.PureComponent<{}, State> {
  state: State = {
    a: 0,
    b: 0,
    c: sumTotal,
  };

  constructor(props: {}) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (this.state.c === 0) {
      this.setState({ a: 0, b: 0, c: sumTotal });
    } else {
      const bucket: keyof State = Math.random() < 0.5 ? 'a' : 'b';
      const stateChange: Partial<State> = { c: this.state.c - 1 };
      stateChange[bucket] = this.state[bucket] + 1;
      this.setState(stateChange as State);
    }
  }

  render() {
    return (
      <div style={sectionStyle}>
        <TricolorProgress
          aItems={this.state.a}
          bItems={this.state.b}
          cItems={this.state.c}
          title="Title goes here"
        />
        <button
          className="button"
          onClick={this.handleClick}
          style={{ marginTop: '1em' }}
        >
          Update
        </button>
      </div>
    );
  }
}
