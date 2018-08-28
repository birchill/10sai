import React from 'react';
import PropTypes from 'prop-types';

interface Props {
  className?: string;
  onClick: (command: string, wasKeyboard: boolean) => void;
}

interface State {
  focusIndex: number;
}

type Button = {
  action: string;
  title: string;
  accelerator: string;
};

const buttons: Array<Button> = [
  { action: 'bold', title: 'Bold', accelerator: 'Ctrl+B' },
  { action: 'italic', title: 'Italic', accelerator: 'Ctrl+I' },
  { action: 'underline', title: 'Underline', accelerator: 'Ctrl+U' },
  { action: 'emphasis', title: 'Dot emphasis', accelerator: 'Ctrl+.' },
];

export class CardFormatToolbar extends React.PureComponent<Props, State> {
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
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  handleClick(evt: React.MouseEvent<HTMLButtonElement>) {
    if ((evt.target as HTMLButtonElement).dataset.action) {
      evt.preventDefault();
      const wasKeyboardEvent = evt.screenX === 0 && evt.screenY === 0;
      const action = (evt.target as HTMLButtonElement).dataset.action!;
      this.props.onClick(action, wasKeyboardEvent);
    }
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
        if (this.state.focusIndex < buttons.length - 1) {
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
    let className = 'cardformat-toolbar';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    return (
      <div
        className={className}
        ref={this.containerRef}
        onKeyDown={this.handleKeyDown}
      >
        {buttons.map((button, i) => (
          <button
            key={button.action}
            className={`${button.action} button -icon`}
            onClick={this.handleClick}
            title={`${button.title} (${button.accelerator})`}
            data-action={button.action}
            type="button"
            tabIndex={i === this.state.focusIndex ? 0 : -1}
          >
            {button.title}
          </button>
        ))}
      </div>
    );
  }
}

export default CardFormatToolbar;
