import React from 'react';
import PropTypes from 'prop-types';

type ColorKeyword = 'black' | 'green' | 'blue' | 'purple' | 'red' | 'orange';

const colors: Array<ColorKeyword> = [
  'black',
  'green',
  'blue',
  'purple',
  'red',
  'orange',
];

interface Props {
  initialSelection?: ColorKeyword;
  onSelect?: (color: string) => void;
}

interface State {
  selection: ColorKeyword;
}

export class ColorPicker extends React.PureComponent<Props, State> {
  state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      selection: props.initialSelection || 'black',
    };
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(evt: React.MouseEvent<HTMLButtonElement>) {
    const color = (evt.target as HTMLElement).dataset.color!;
    this.setState({
      selection: color as ColorKeyword,
    });
    if (this.props.onSelect) {
      this.props.onSelect(color);
    }
  }

  render() {
    return (
      <div className="color-picker">
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
