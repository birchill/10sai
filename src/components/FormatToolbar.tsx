import React from 'react';
import PropTypes from 'prop-types';

interface Props {
  className?: string;
  buttons: Array<FormatButtonConfig>;
  onClick: (command: FormatButtonCommand) => void;
}

interface State {
  focusIndex: number;
}

export type FormatButtonType = 'bold' | 'italic' | 'underline' | 'emphasis';

// Note to self: In future I expect this to be a union of different objects
// each with a 'type' field where, for example, the 'color' command includes the
// color to set.
export type FormatButtonCommand = FormatButtonType;

export const enum FormatButtonState {
  Normal,
  Disabled,
  Set,
}

export interface FormatButtonConfig {
  type: FormatButtonType;
  label: string;
  accelerator: string;
  state: FormatButtonState;
}

export class FormatToolbar extends React.Component<Props, State> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      onClick: PropTypes.func.isRequired,
    };
  }

  containerRef: React.RefObject<HTMLDivElement>;
  state: State;

  constructor(props: Props) {
    super(props);

    this.state = {
      focusIndex: 0,
    };
    this.containerRef = React.createRef<HTMLDivElement>();

    this.handleClick = this.handleClick.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  handleClick(evt: React.MouseEvent<HTMLButtonElement>) {
    if ((evt.target as HTMLButtonElement).dataset.action) {
      evt.preventDefault();
      const action = (evt.target as HTMLButtonElement).dataset
        .action as FormatButtonCommand;
      this.props.onClick(action);
    }
  }

  handleMouseDown(evt: React.MouseEvent<HTMLButtonElement>) {
    // Stop the button from stealing focus
    evt.preventDefault();
  }

  handleKeyDown(evt: React.KeyboardEvent<HTMLDivElement>) {
    switch (evt.key) {
      case 'ArrowLeft':
        if (this.state.focusIndex) {
          this.setState({ focusIndex: this.state.focusIndex - 1 }, () =>
            this.updateFocus()
          );
        }
        evt.preventDefault();
        return;

      case 'ArrowRight':
        if (this.state.focusIndex < this.props.buttons.length - 1) {
          this.setState({ focusIndex: this.state.focusIndex + 1 }, () =>
            this.updateFocus()
          );
        }
        evt.preventDefault();
        return;

      default:
        return;
    }
  }

  updateFocus() {
    if (!this.containerRef.current) {
      return;
    }

    const getNthButton = (i: number) =>
      this.containerRef.current!.querySelector(
        `button:nth-of-type(${i + 1})`
      ) as HTMLButtonElement;
    getNthButton(this.state.focusIndex).focus();
  }

  get element(): HTMLElement | null {
    return this.containerRef.current;
  }

  render() {
    let className = 'format-toolbar';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    const getButtonClass = (button: FormatButtonConfig): string => {
      const classes = ['button', button.type, '-icon'];
      if (button.state === FormatButtonState.Set) {
        classes.push('-set');
      }
      return classes.join(' ');
    };

    return (
      <div
        className={className}
        ref={this.containerRef}
        onKeyDown={this.handleKeyDown}
      >
        {this.props.buttons.map((button, i) => (
          <button
            key={button.type}
            className={getButtonClass(button)}
            onMouseDown={this.handleMouseDown}
            onClick={this.handleClick}
            title={`${button.label} (${button.accelerator})`}
            data-action={button.type}
            type="button"
            tabIndex={i === this.state.focusIndex ? 0 : -1}
          >
            {button.label}
          </button>
        ))}
      </div>
    );
  }
}

export default FormatToolbar;
