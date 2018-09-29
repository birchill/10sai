import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

interface Props {
  className?: string;
  position: 'top' | 'bottom';
  direction: 'center' | 'side';
  referenceElement: Element | null;
}

interface State {
  visible: boolean;
}

export class SpeechBubble extends React.Component<Props, State> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      position: PropTypes.oneOf(['top', 'bottom']),
      direction: PropTypes.oneOf(['center', 'side']),
      referenceElement: PropTypes.instanceOf(Element),
    };
  }

  state: State;
  layer: HTMLElement;

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
  }

  render() {
    const classes = ['speech-bubble'];
    classes.push(this.props.position === 'top' ? '-top' : '-bottom');
    if (this.props.className) {
      classes.push(...this.props.className.split(' '));
    }

    return ReactDOM.createPortal(
      <div className={classes.join(' ')}>
        <div className="panel">{this.props.children}</div>
        <div className="arrow" />
      </div>,
      this.layer
    );
  }
}

export default SpeechBubble;
