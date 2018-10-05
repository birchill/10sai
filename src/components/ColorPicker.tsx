import React from 'react';
import PropTypes from 'prop-types';

import { ColorKeywordOrBlack } from '../text/rich-text-styles';

const colors: Array<ColorKeywordOrBlack> = [
  'black',
  'green',
  'blue',
  'purple',
  'red',
  'orange',
];

interface Props {
  initialSelection?: ColorKeywordOrBlack;
  onSelect?: (color: ColorKeywordOrBlack) => void;
}

interface State {
  selection: ColorKeywordOrBlack;
}

export class ColorPicker extends React.PureComponent<Props, State> {
  state: State;
  containerRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);

    this.state = {
      selection: props.initialSelection || 'black',
    };
    this.containerRef = React.createRef<HTMLDivElement>();

    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  handleClick(evt: React.MouseEvent<HTMLButtonElement>) {
    const color = (evt.target as HTMLElement).dataset
      .color as ColorKeywordOrBlack;
    this.setState({
      selection: color,
    });
    if (this.props.onSelect) {
      this.props.onSelect(color);
    }
  }

  handleKeyDown(evt: React.KeyboardEvent<HTMLDivElement>) {
    if (evt.key !== 'ArrowLeft' && evt.key !== 'ArrowRight') {
      return;
    }

    if (!this.containerRef.current) {
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    const containerElem = this.containerRef.current;
    const swatches = Array.from(
      containerElem.querySelectorAll('.swatch')
    ) as Array<HTMLElement>;
    const index = swatches.findIndex(
      swatch => swatch.dataset.color === this.state.selection
    );
    const isRtl = getComputedStyle(containerElem).direction === 'rtl';

    let updatedIndex: number | undefined;
    if (
      (evt.key === 'ArrowLeft' && !isRtl && index > 0) ||
      (evt.key === 'ArrowRight' && isRtl && index > 0)
    ) {
      updatedIndex = index - 1;
    } else if (
      (evt.key === 'ArrowRight' && !isRtl && index < swatches.length - 1) ||
      (evt.key === 'ArrowLeft' && isRtl && index < swatches.length - 1)
    ) {
      updatedIndex = index + 1;
    }

    if (typeof updatedIndex !== 'undefined') {
      const swatch = swatches[updatedIndex];
      this.setState({ selection: swatch.dataset.color as ColorKeywordOrBlack });
      swatch.focus();
    }
  }

  focus() {
    if (!this.containerRef.current) {
      return;
    }

    const swatch = this.containerRef.current.querySelector(
      `.swatch[data-color="${this.state.selection}"]`
    ) as HTMLButtonElement | null;
    if (swatch) {
      swatch.focus();
    }
  }

  get hasFocus(): boolean {
    return (
      !!this.containerRef.current &&
      this.containerRef.current.contains(document.activeElement)
    );
  }

  render() {
    return (
      <div
        className="color-picker"
        onKeyDown={this.handleKeyDown}
        ref={this.containerRef}
      >
        {colors.map(color => {
          let className = 'swatch';
          let selected = false;
          if (color === this.state.selection) {
            className += ' -selected';
            selected = true;
          }
          return (
            <button
              type="button"
              key={color}
              className={className}
              data-color={color}
              style={{ ['--swatch-color' as any]: `var(--text-${color})` }}
              aria-label={color}
              tabIndex={selected ? 0 : -1}
              onClick={this.handleClick}
            />
          );
        })}
      </div>
    );
  }
}

export default ColorPicker;
