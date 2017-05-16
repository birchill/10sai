import React from 'react';
import PropTypes from 'prop-types';

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

export class SortOfRelativeDate extends React.Component {

  static get propTypes() {
    return {
      value: PropTypes.instanceOf(Date).isRequired,
    };
  }

  static isJustNow(date) {
    return Date.now() - date < JUST_NOW_THRESHOLD;
  }

  constructor(props) {
    super(props);

    this.update = this.update.bind(this);
    this.state = { justNow: SortOfRelativeDate.isJustNow(props.value) };
    this.maybeRegisterUpdateTimeout();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.value === this.props.value) {
      return;
    }

    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }

    this.setState({ justNow: SortOfRelativeDate.isJustNow(nextProps.value) });
    this.maybeRegisterUpdateTimeout();
  }

  componentWillUnmount() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }

  maybeRegisterUpdateTimeout() {
    if (this.state.justNow) {
      this.timeoutHandle = setTimeout(this.update, JUST_NOW_THRESHOLD);
    }
  }

  update() {
    // We just assume that the timeout will always put us at a point where
    // we no longer need to show a relative date.
    this.setState({ justNow: false });
    this.timeoutHandle = undefined;
  }

  render() {
    const dateString = this.state.justNow
                       ? 'just now' // TODO: Localize this
                       : this.props.value.toLocaleString();

    return <time dateTime={this.props.value}>{dateString}</time>;
  }
}

export default SortOfRelativeDate;
