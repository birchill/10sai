import React from 'react';
import PropTypes from 'prop-types';

import { ColorKeywordOrBlack } from '../text/rich-text-styles';
import { AnchoredSpeechBubble } from './AnchoredSpeechBubble';
import { ColorPicker } from './ColorPicker';

interface Props {
  className?: string;
  buttons: Array<FormatButtonConfig>;
  onClick: (command: FormatButtonCommand, params?: ColorParams) => void;
}

type ColorParams = ColorKeywordOrBlack;

export type FormatButtonType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'emphasis'
  | 'color'
  | 'color-dropdown';

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
  initialValue?: ColorKeywordOrBlack;
}

interface State {
  focusIndex: number;
  colorDropDownOpen: boolean;
  selectedColor?: ColorKeywordOrBlack;
}

export class FormatToolbar extends React.Component<Props, State> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      buttons: PropTypes.arrayOf(
        PropTypes.shape({
          type: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
          accelerator: PropTypes.string,
          state: PropTypes.number,
          initialValue: PropTypes.any,
        })
      ),
      onClick: PropTypes.func.isRequired,
    };
  }

  containerRef: React.RefObject<HTMLDivElement>;
  colorDropDownRef: React.RefObject<HTMLButtonElement>;
  colorPickerRef: React.RefObject<ColorPicker>;
  previousFocus?: HTMLElement;
  pointerMediaQuery?: MediaQueryList;
  state: State;

  constructor(props: Props) {
    super(props);

    this.state = {
      focusIndex: 0,
      colorDropDownOpen: false,
    };

    const colorButton = props.buttons.find(button => button.type === 'color');
    if (colorButton) {
      this.state.selectedColor = colorButton.initialValue || 'blue';
    }

    this.containerRef = React.createRef<HTMLDivElement>();
    this.colorDropDownRef = React.createRef<HTMLButtonElement>();
    this.colorPickerRef = React.createRef<ColorPicker>();

    this.handleClick = this.handleClick.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.toggleColorDropDown = this.toggleColorDropDown.bind(this);
    this.handleColorSelect = this.handleColorSelect.bind(this);
    this.handleDropDownKey = this.handleDropDownKey.bind(this);
  }

  handleClick(evt: React.MouseEvent<HTMLButtonElement>) {
    if ((evt.target as HTMLButtonElement).dataset.action) {
      evt.preventDefault();
      const action = (evt.target as HTMLButtonElement).dataset
        .action as FormatButtonCommand;

      if (action === 'color-dropdown') {
        this.toggleColorDropDown();
      } else if (action === 'color') {
        this.props.onClick(action, this.state.selectedColor);
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
        {
          let nextFocusable = this.state.focusIndex - 1;
          while (
            nextFocusable >= 0 &&
            this.props.buttons[nextFocusable].state ===
              FormatButtonState.Disabled
          ) {
            --nextFocusable;
          }

          if (nextFocusable >= 0) {
            this.setState({ focusIndex: nextFocusable }, () =>
              this.updateFocus()
            );
          }
          evt.preventDefault();
        }
        return;

      case 'ArrowRight':
        let nextFocusable = this.state.focusIndex + 1;
        while (
          nextFocusable < this.props.buttons.length &&
          this.props.buttons[nextFocusable].state === FormatButtonState.Disabled
        ) {
          ++nextFocusable;
        }

        if (nextFocusable < this.props.buttons.length) {
          this.setState({ focusIndex: nextFocusable }, () =>
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

  handleColorSelect(color: ColorKeywordOrBlack) {
    this.toggleColorDropDown();
    this.props.onClick('color', color);
    this.setState({ selectedColor: color });
  }

  handleDropDownKey(evt: React.KeyboardEvent<{}>) {
    if (evt.key === 'Escape') {
      this.setState({ colorDropDownOpen: false });
      evt.preventDefault();
    }
  }

  get element(): HTMLElement | null {
    return this.containerRef.current;
  }

  toggleColor() {
    this.props.onClick('color', this.state.selectedColor);
  }

  selectColor() {
    this.toggleColorDropDown();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Update the focus when opening/closing the color drop-down
    if (
      prevState.colorDropDownOpen !== this.state.colorDropDownOpen &&
      this.colorPickerRef.current
    ) {
      const colorPicker = this.colorPickerRef.current;
      // If the menu is newly-opened focus the color picker
      if (this.state.colorDropDownOpen) {
        this.previousFocus = document.activeElement as HTMLElement;
        colorPicker.focus();
        // If the menu is newly closed and the color picker is still focussed,
        // focus the drop-down button instead.
      } else if (
        !this.state.colorDropDownOpen &&
        colorPicker.hasFocus &&
        this.previousFocus
      ) {
        this.previousFocus.focus();
        this.previousFocus = undefined;
      }
    }
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
      (styles as any)['--selected-color'] = `var(--text-${
        this.state.selectedColor
      })`;
    }

    let menu: React.ReactNode | undefined;
    let ref: React.RefObject<HTMLButtonElement> | undefined;
    if (button.type === 'color-dropdown') {
      menu = (
        <AnchoredSpeechBubble
          className="format-toolbar-color"
          position="below"
          align="center"
          anchorElement={this.colorDropDownRef.current}
          visible={this.state.colorDropDownOpen}
          onClickOutside={this.toggleColorDropDown}
          onUnhandledKeyPress={this.handleDropDownKey}
        >
          <ColorPicker
            initialSelection={this.state.selectedColor}
            onSelect={this.handleColorSelect}
            ref={this.colorPickerRef}
          />
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
          disabled={button.state === FormatButtonState.Disabled}
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
