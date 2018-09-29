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
  // TODO: This shouldn't be optional but we can't use defaultProps properly
  // because we can't upgrade to TS3 because someone broke the Web Animations
  // typings in TS3 and, although I submitted a PR to fix them, after 6 weeks
  // and half a dozen attempts to ping folk in MS, no-one has bothered to press
  // the green merge button--although they still had time to release TS 3.1 in
  // the meantime. Seriously MS, get your act together.
  visible?: boolean;
  // Called whenever the menu is visible and we get a click outside of the panel
  // area. This is useful for closing the speech bubble whenever there is
  // a click anywhere else in the panel.
  //
  // If the panel is closed by clicking, e.g. a button outside the menu, then it
  // so happens that we won't end up calling this (due to the way we unregister
  // the event listener). This wasn't intended at first but proves to be useful
  // so we've kept it.
  onClickOutside?: (evt: MouseEvent) => void;
}

export class SpeechBubble extends React.Component<Props> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      left: PropTypes.number.isRequired,
      top: PropTypes.number.isRequired,
      arrowPosition: PropTypes.oneOf(['left', 'center', 'right']).isRequired,
      arrowSide: PropTypes.oneOf(['top', 'bottom']).isRequired,
    };
  }

  static defaultProps = {
    visible: true,
  };

  layer: HTMLElement;
  containerRef: React.RefObject<HTMLDivElement>;
  panelRef: React.RefObject<HTMLDivElement>;
  arrowRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);

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

    this.handleWindowClick = this.handleWindowClick.bind(this);
  }

  componentDidMount() {
    if (this.props.visible) {
      this.fadeInOut();
      // Here and below, it might be preferable to find the rootmost window and
      // listen there instead but we're currently not using <iframe>s so it
      // doesn't seem necessary yet.
      window.addEventListener('click', this.handleWindowClick);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.visible !== this.props.visible) {
      this.fadeInOut();

      if (this.props.visible) {
        // We register the click handler on the window but if this render was
        // triggered as part of a click event we can still end up calling
        // 'handleWindowClick' for _this_ event so we need to spin the event
        // loop first.
        setTimeout(() => {
          window.addEventListener('click', this.handleWindowClick);
        }, 0);
      } else {
        window.removeEventListener('click', this.handleWindowClick);
      }
    }
  }

  componentWillUnmount() {
    if (this.props.visible) {
      window.removeEventListener('click', this.handleWindowClick);
    }
  }

  fadeInOut() {
    if (!this.containerRef.current) {
      return;
    }

    const containerElem = this.containerRef.current;
    if (!this.props.visible) {
      containerElem.classList.add('-fadeout');
      containerElem.addEventListener(
        'transitionend',
        () => {
          containerElem.classList.remove('-fadeout');
        },
        { once: true }
      );
    } else {
      containerElem.classList.add('-fadein');
      getComputedStyle(containerElem).opacity;
      containerElem.classList.remove('-fadein');
    }
  }

  handleWindowClick(evt: MouseEvent) {
    if (!this.props.onClickOutside) {
      return;
    }

    if (!this.containerRef.current) {
      return;
    }

    if (evt.target && !this.containerRef.current.contains(evt.target as Node)) {
      this.props.onClickOutside(evt);
    }
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
        hidden={!this.props.visible}
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
