import React from 'react';
import PropTypes from 'prop-types';

interface Props {
  className?: string;
  onClick?: () => void;
}

interface StretchParams {
  left: number;
  top: number;
  width: number;
  height: number;
  duration: number;
}

export class AddNoteButton extends React.PureComponent<Props> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      onClick: PropTypes.func,
    };
  }

  buttonRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);

    this.buttonRef = React.createRef<HTMLDivElement>();

    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    if (this.props.onClick) {
      this.props.onClick();
    }
  }

  stretchTo(params: StretchParams) {
    if (!this.buttonRef.current) {
      return;
    }

    // XXX Test for Element.animate support

    const topBit = this.buttonRef.current.querySelector(
      '.top'
    ) as HTMLDivElement;
    // 'corner' is actually an SVGSVGElement but the Typescript DOM typings
    // incorrectly put animate() on HTMLElement (instead of Element) so we just
    // pretend corner is an HTMLElement.
    const corner = this.buttonRef.current.querySelector(
      '.corner'
    ) as HTMLElement;
    const body = this.buttonRef.current.querySelector(
      '.body'
    ) as HTMLDivElement;

    const timing = {
      duration: params.duration,
      easing: 'ease',
    };

    const bbox = this.buttonRef.current.getBoundingClientRect();
    const oneEm = corner.getBoundingClientRect().width;

    const topScale = (params.width - oneEm) / (bbox.width - oneEm);
    const topTranslateX = params.left - bbox.left;
    const topTranslateY = params.top - bbox.top;
    topBit.animate(
      {
        transform: [
          `translate(${topTranslateX}px, ${topTranslateY}px) scaleX(${topScale})`,
        ],
      },
      timing
    );

    const cornerTranslateX = params.left + params.width - bbox.right;
    const cornerTranslateY = params.top - bbox.top;
    corner.animate(
      {
        transform: [`translate(${cornerTranslateX}px, ${cornerTranslateY}px)`],
      },
      timing
    );

    const bodyScaleX = params.width / bbox.width;
    const bodyScaleY = (params.height - oneEm) / (bbox.height - oneEm);
    body.animate(
      {
        transform: [
          `translate(${topTranslateX}px, ${topTranslateY}px) scale(${bodyScaleX}, ${bodyScaleY})`,
        ],
      },
      timing
    );

    const label = body.querySelector('.label') as HTMLSpanElement;
    label.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 0, offset: 0.2 },
        { opacity: 0, offset: 1 },
      ],
      timing
    );

    // XXX Fade out label
    // XXX Fade out dotted outline
    // XXX Animate shadow
    // XXX Get it to run on the compositor (drop excessive will-change usage
    //     elsewhere and add it here?)
  }

  render() {
    let className = 'addnote-button';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    return (
      <div
        className={className}
        role="button"
        tabIndex={0}
        onClick={this.handleClick}
        ref={this.buttonRef}
      >
        <div className="shadow" />
        <div className="front">
          <div className="toprow">
            <div className="top" />
            {/* XXX Factor this out into a component */}
            <svg className="corner" viewBox="0 0 100 100">
              <polygon fill="#FEFACF" points="0,0 100,100 0,100" />
              <path
                fill="#CCB92D"
                d="M0,0l100,100c0,0-69.5-4.5-78.4-7.09S8.9,85.5,7.2,78.76S0,0,0,0"
              />
              <path
                fill="#FCFBF1"
                d="M0,0l100,100c0,0-62.2-10.3-71-12.8s-12.7-7.4-14.4-14.1S0,0,0,0"
              />
            </svg>
          </div>
          <div className="body">
            <span className="label">Add note</span>
          </div>
        </div>
      </div>
    );
  }
}

export default AddNoteButton;
