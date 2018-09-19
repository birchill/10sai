import React from 'react';
import PropTypes from 'prop-types';

import { Omit } from '../utils/type-helpers';

interface Props
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

interface State {
  value: string;
}

export class CancelableTextbox extends React.PureComponent<Props, State> {
  static get propTypes() {
    return {
      value: PropTypes.string,
      onChange: PropTypes.func,
      onFocus: PropTypes.func,
    };
  }

  constructor(props: Props) {
    super(props);

    this.state = { value: '' };
    this.handleChange = this.handleChange.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleClear = this.handleClear.bind(this);
  }

  componentWillMount() {
    this.setState({ value: this.props.value || '' });
  }

  componentWillReceiveProps(nextProps: Props) {
    this.setState({ value: nextProps.value || '' });
  }

  handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ value: e.target.value });
    if (this.props.onChange) {
      this.props.onChange(e.target.value);
    }
  }

  handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    if (this.props.onFocus) {
      this.props.onFocus(e);
    }
  }

  handleClear() {
    this.setState({ value: '' });
    if (this.props.onChange) {
      this.props.onChange('');
    }
  }

  render() {
    const hidden = !this.state.value.length;

    return (
      <div className="cancelable-textbox">
        <input
          {...this.props}
          value={this.state.value}
          onChange={this.handleChange}
          onFocus={this.handleFocus}
        />
        <button
          type="reset"
          className="cancel"
          aria-hidden={hidden}
          tabIndex={-1}
          onClick={this.handleClear}
        >
          <span className="label">Clear</span>
        </button>
      </div>
    );
  }
}

export default CancelableTextbox;
