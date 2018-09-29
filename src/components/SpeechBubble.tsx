import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

export interface Props {
  className?: string;
  // Physical position of the arrow point.
  //
  // This is typically calculated by AnchoredSpeechBubble which takes care to
  // respect RTL mode etc.
  left: number;
  top: number;
  // Physical horizontal position of the arrow with regards to the panel.
  arrowPosition: 'left' | 'center' | 'right';
  arrowSide: 'top' | 'bottom';
}

interface State {
  visible: boolean;
}

export class SpeechBubble extends React.Component<Props, State> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      left: PropTypes.number.isRequired,
      top: PropTypes.number.isRequired,
      arrowPosition: PropTypes.oneOf(['left', 'center', 'right']).isRequired,
      arrowSide: PropTypes.oneOf(['top', 'bottom']).isRequired,
    };
  }

  state: State;
  layer: HTMLElement;
  containerRef: React.RefObject<HTMLDivElement>;
  panelRef: React.RefObject<HTMLDivElement>;
  arrowRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);

    this.state = {
      visible: false,
    };

    let layer: HTMLElement | null = document.getElementById('speech-bubbles');
    if (!layer) {
      const parent = document.body || document.documentElement;
      layer = document.createElement('div');
      layer.setAttribute('id', 'speech-bubbles');
      parent.appendChild(layer);
    }
    this.layer = layer;

    this.containerRef = React.createRef<HTMLDivElement>();
    this.panelRef = React.createRef<HTMLDivElement>();
    this.arrowRef = React.createRef<HTMLDivElement>();
  }

  render() {
    const classes = ['speech-bubble'];
    classes.push(this.props.arrowSide === 'top' ? '-bottom' : '-top');
    if (this.props.className) {
      classes.push(...this.props.className.split(' '));
    }

    const { containerLeft, containerTop, arrowLeft } = this.getPosition();

    const containerStyle = {
      left: `${containerLeft}px`,
      top: `${containerTop}px`,
    };

    const arrowStyle = {
      left: `${arrowLeft - containerLeft}px`,
    };

    return ReactDOM.createPortal(
      <div
        className={classes.join(' ')}
        style={containerStyle}
        ref={this.containerRef}
      >
        <div className="panel" ref={this.panelRef}>
          {this.props.children}
        </div>
        <div className="arrow" style={arrowStyle} ref={this.arrowRef} />
      </div>,
      this.layer
    );
  }

  getPosition(): {
    containerLeft: number;
    containerTop: number;
    arrowLeft: number;
  } {
    if (!this.arrowRef.current || !this.panelRef.current) {
      return {
        containerLeft: this.props.left,
        containerTop: this.props.top,
        arrowLeft: this.props.left,
      };
    }

    // Get arrow dimensions
    const arrowElem = this.arrowRef.current;
    const arrowWidth =
      parseFloat(
        getComputedStyle(arrowElem).getPropertyValue('--arrow-width')
      ) +
      parseFloat(
        getComputedStyle(arrowElem).getPropertyValue('--shadow-radius')
      );
    const arrowMargin = parseFloat(
      getComputedStyle(arrowElem).getPropertyValue('--arrow-margin')
    );

    // Calculate horizontal position
    const arrowLeft = this.props.left - arrowWidth / 2;
    const panelElem = this.panelRef.current;
    let containerLeft: number;
    switch (this.props.arrowPosition) {
      case 'left':
        containerLeft = arrowLeft - arrowMargin;
        break;

      case 'center':
        containerLeft =
          this.props.left - panelElem.getBoundingClientRect().width / 2;
        break;

      case 'right':
        containerLeft =
          this.props.left -
          panelElem.getBoundingClientRect().width +
          arrowWidth / 2 +
          arrowMargin;
        break;
    }

    // Calculate the vertical position
    let containerTop: number;
    switch (this.props.arrowSide) {
      case 'top':
        containerTop = this.props.top;
        break;

      case 'bottom':
        containerTop =
          this.props.top -
          panelElem.getBoundingClientRect().height -
          arrowWidth / 2;
        break;
    }

    return {
      containerLeft: containerLeft!,
      containerTop: containerTop!,
      arrowLeft,
    };
  }

  get bbox(): ClientRect | null {
    if (!this.containerRef.current) {
      return null;
    }

    return this.containerRef.current.getBoundingClientRect();
  }
}

export default SpeechBubble;
