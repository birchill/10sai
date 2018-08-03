import React from 'react';
import PropTypes from 'prop-types';

import { SaveState } from '../notes/reducer';

interface Props {
  saveState: SaveState;
  className?: string;
}

interface State {
  showOk: boolean;
  prevSaveState?: SaveState;
}

export class SaveStatus extends React.PureComponent<Props, State> {
  static get propTypes() {
    return {
      saveState: PropTypes.string.isRequired,
      className: PropTypes.string,
    };
  }

  // All this complexity is because we only want to show the "Ok" state if we
  // changed from some other state to "Ok" but NOT if we were initially "Ok".
  static getDerivedStateFromProps(props: Props, state: State): State | null {
    if (props.saveState === state.prevSaveState) {
      return null;
    }

    if (
      props.saveState === SaveState.Ok &&
      typeof state.prevSaveState !== 'undefined'
    ) {
      return {
        showOk: true,
        prevSaveState: props.saveState,
      };
    }

    return {
      showOk: false,
      prevSaveState: props.saveState,
    };
  }

  state: State;

  constructor(props: Props) {
    super(props);

    this.state = { showOk: false };
  }

  render() {
    let className = (this.props.className || '') + ' save-status';

    switch (this.props.saveState) {
      case SaveState.Ok:
        if (this.state.showOk) {
          className += ' -ok';
        }
        break;

      case SaveState.InProgress:
        className += ' -inprogress';
        break;

      case SaveState.Error:
        className += ' -error';
        break;
    }

    return (
      <div className={className}>
        <span className="label ok">Saved</span>
        <span className="label inprogress">Saving…</span>
        <span className="label error">Error</span>
      </div>
    );
  }
}

export default SaveStatus;
