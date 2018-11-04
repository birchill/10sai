import React from 'react';
import { storiesOf } from '@storybook/react';

import { SaveStatus } from './SaveStatus';
import { SaveState } from '../notes/reducer';

interface State {
  saveState: SaveState;
}

class SaveStatusExample extends React.PureComponent<{}, State> {
  state: State = {
    saveState: SaveState.Ok,
  };

  constructor(props: {}) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }

  onClick() {
    let saveState: SaveState;
    do {
      saveState = [
        SaveState.Ok,
        SaveState.InProgress,
        SaveState.Error,
        SaveState.New,
      ][Math.floor(Math.random() * 4)];
    } while (saveState === this.state.saveState);
    this.setState({ saveState });
  }

  render() {
    return (
      <div className="series">
        <SaveStatus
          saveState={this.state.saveState}
          saveError={'Error message'}
        />
        <button className="button" onClick={this.onClick}>
          Update
        </button>
        <span className="currentstatus">{`Current: ${
          this.state.saveState
        }`}</span>
      </div>
    );
  }
}

storiesOf('Components|SaveStatus', module).add('default', () => (
  <SaveStatusExample />
));
