import React from 'react';
import PropTypes from 'prop-types';

import { AnchoredSpeechBubble } from './AnchoredSpeechBubble';
import { ColorPicker } from './ColorPicker';

interface Props {
  className?: string;
  buttons: Array<FormatButtonConfig>;
  onClick: (command: FormatButtonCommand) => void;
}

interface State {
  focusIndex: number;
  colorDropDownOpen: boolean;
}

export type FormatButtonType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'emphasis'
  | 'color'
  | 'dropdown';

export type DropDownType = 'color';

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
  accelerator?: string;
  state: FormatButtonState;
  dropDownType?: DropDownType;
}

export class FormatToolbar extends React.Component<Props, State> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      onClick: PropTypes.func.isRequired,
    };
  }

  containerRef: React.RefObject<HTMLDivElement>;
  colorDropDownRef: React.RefObject<HTMLButtonElement>;
  state: State;

  constructor(props: Props) {
    super(props);

    this.state = {
      focusIndex: 0,
      colorDropDownOpen: false,
    };
    this.containerRef = React.createRef<HTMLDivElement>();
    this.colorDropDownRef = React.createRef<HTMLButtonElement>();

    this.handleClick = this.handleClick.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.toggleColorDropDown = this.toggleColorDropDown.bind(this);
  }

  handleClick(evt: React.MouseEvent<HTMLButtonElement>) {
    if ((evt.target as HTMLButtonElement).dataset.action) {
      evt.preventDefault();
      const action = (evt.target as HTMLButtonElement).dataset
        .action as FormatButtonCommand;

      if (action === 'dropdown') {
        this.toggleColorDropDown();
      } else {
        this.props.onClick(action);
      }
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

  toggleColorDropDown() {
    this.setState({ colorDropDownOpen: !this.state.colorDropDownOpen });
  }

  get element(): HTMLElement | null {
    return this.containerRef.current;
  }

  render() {
    let className = 'format-toolbar';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    return (
      <div
        className={className}
        ref={this.containerRef}
        onKeyDown={this.handleKeyDown}
      >
        {this.props.buttons.map(this.renderButton.bind(this))}
      </div>
    );
  }

  renderButton(button: FormatButtonConfig, index: number) {
    let title = button.label;
    if (button.accelerator) {
      title += ` (${button.accelerator})`;
    }

    let styles: React.CSSProperties = {};
    if (button.type === 'color') {
      (styles as any)['--selected-color'] = 'blue';
    }

    let menu: React.ReactNode | undefined;
    let ref: React.RefObject<HTMLButtonElement> | undefined;
    if (button.type === 'dropdown' && button.dropDownType === 'color') {
      menu = (
        <AnchoredSpeechBubble
          className="format-toolbar-color"
          position="below"
          align="center"
          anchorElement={this.colorDropDownRef.current}
          visible={this.state.colorDropDownOpen}
          onClickOutside={this.toggleColorDropDown}
        >
          <ColorPicker onSelect={() => {}} />
        </AnchoredSpeechBubble>
      );
      ref = this.colorDropDownRef;
    }

    const getButtonClass = (button: FormatButtonConfig): string => {
      const classes = ['button', button.type, '-icon'];
      if (button.state === FormatButtonState.Set) {
        classes.push('-set');
      }
      return classes.join(' ');
    };

    return (
      <React.Fragment key={button.type}>
        <button
          className={getButtonClass(button)}
          style={styles}
          onMouseDown={this.handleMouseDown}
          onClick={this.handleClick}
          title={title}
          data-action={button.type}
          type="button"
          tabIndex={index === this.state.focusIndex ? 0 : -1}
          ref={ref}
        >
          {button.label}
        </button>
        {menu}
      </React.Fragment>
    );
  }
}

export default FormatToolbar;
