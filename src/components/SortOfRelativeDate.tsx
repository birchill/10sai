import * as React from 'react';

// A half-hearted attempt at a date thing.
//
// It:
// * Says "just now" if the date is within about 10s (to be localized
//   eventually)
// * Otherwise, displays the date using toLocaleString
// * If it shows "Just now" is waits about 10s or so then refreshes itself
// * Uses a <time> element for fancy-ness
// * Expects a UTC time

const JUST_NOW_THRESHOLD = 10 * 1000; // 10s

interface Props {
  value: Date;
}

export class SortOfRelativeDate extends React.PureComponent<Props> {
  timeoutHandle?: number;

  componentDidMount() {
    this.maybeRegisterUpdateTimeout();
  }

  componentDidUpdate(previousProps: Props) {
    if (previousProps.value === this.props.value) {
      return;
    }

    if (this.timeoutHandle) {
      window.clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }

    this.maybeRegisterUpdateTimeout();
  }

  componentWillUnmount() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }

  isJustNow(): boolean {
    return Date.now() - this.props.value.getTime() < JUST_NOW_THRESHOLD;
  }

  maybeRegisterUpdateTimeout() {
    if (this.isJustNow()) {
      this.timeoutHandle = window.setTimeout(() => {
        this.timeoutHandle = undefined;
        this.forceUpdate();
      }, JUST_NOW_THRESHOLD);
    }
  }

  render() {
    const dateString = this.isJustNow()
      ? 'just now' // TODO: Localize this
      : this.props.value.toLocaleString();

    return <time dateTime={this.props.value.toISOString()}>{dateString}</time>;
  }
}
