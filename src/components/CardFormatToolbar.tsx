import React from 'react';
import PropTypes from 'prop-types';

interface Props {
  className?: string;
  onClick: (command: string) => void;
}

export class CardFormatToolbar extends React.PureComponent<Props> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      onClick: PropTypes.func.isRequired,
    };
  }

  constructor(props: Props) {
    super(props);

    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(evt: React.MouseEvent<HTMLButtonElement>) {
    if ((evt.target as HTMLButtonElement).dataset.action) {
      const action = (evt.target as HTMLButtonElement).dataset.action!;
      this.props.onClick(action);
    }
  }

  render() {
    let className = 'cardformat-toolbar';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    return (
      <div className={className}>
        <button
          className="bold button -icon"
          onClick={this.handleClick}
          title="Bold (Ctrl+B)"
          data-action="bold"
        >
          Bold
        </button>
        <button
          className="italic button -icon"
          onClick={this.handleClick}
          title="Italic (Ctrl+I)"
          data-action="italic"
        >
          Italic
        </button>
        <button
          className="underline button -icon"
          onClick={this.handleClick}
          title="Underline (Ctrl+U)"
          data-action="underline"
        >
          Underline
        </button>
        <button
          className="emphasis button -icon"
          onClick={this.handleClick}
          title="Dot emphasis (Ctrl+.)"
          data-action="emphasis"
        >
          Emphasis
        </button>
      </div>
    );
  }
}

export default CardFormatToolbar;
