import React from 'react';
import PropTypes from 'prop-types';

import NoteCorner from './NoteCorner';

interface Props {
  className?: string;
  onClick?: () => void;
}

interface StretchParams {
  width: number;
  height: number;
  duration: number;
  holdDuration: number;
  easing: string;
}

export class AddNoteButton extends React.PureComponent<Props> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      onClick: PropTypes.func,
    };
  }

  buttonRef: React.RefObject<HTMLButtonElement>;

  constructor(props: Props) {
    super(props);

    this.buttonRef = React.createRef<HTMLButtonElement>();

    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    if (this.props.onClick) {
      this.props.onClick();
    }
  }

  get elem(): HTMLButtonElement | null {
    return this.buttonRef.current;
  }

  stretchTo(params: StretchParams) {
    if (!this.buttonRef.current) {
      return;
    }

    // Check for Web Animations support
    if (typeof this.buttonRef.current.animate !== 'function') {
      return;
    }

    // Set up the common timing
    const totalDuration = params.duration + params.holdDuration;
    const offset = params.duration / totalDuration;
    const timing = { duration: totalDuration };

    // Calculate a few useful numbers
    const bbox = this.buttonRef.current.getBoundingClientRect();
    const scaleX = params.width / bbox.width;
    const scaleY = params.height / bbox.height;

    // Animate the corner
    //
    // We do this first because we need to know its size to position the other
    // elements.
    //
    // 'corner' is actually an SVGSVGElement but the Typescript DOM typings
    // incorrectly put animate() on HTMLElement (instead of Element) so we just
    // pretend corner is an HTMLElement.
    const corner = this.buttonRef.current.querySelector(
      '.corner'
    ) as HTMLElement;
    const oneEm = corner.getBoundingClientRect().width;
    const cornerTranslateX = (params.width - bbox.width) / 2;
    const cornerTranslateY = (params.height - bbox.height) / -2;
    const cornerTransform = `translate(${cornerTranslateX}px, ${cornerTranslateY}px)`;
    // (There are more compact was of writing this but this format should have
    // the best backwards compatibility with old versions of Firefox and
    // Chrome.)
    corner.animate(
      [
        { transform: 'none', easing: params.easing },
        { transform: cornerTransform, offset },
        { transform: cornerTransform, offset: 1 },
      ],
      timing
    );

    // Animate the top row
    const topBit = this.buttonRef.current.querySelector(
      '.top'
    ) as HTMLDivElement;
    const topScaleX = (params.width - oneEm) / (bbox.width - oneEm);
    const topTransform = `translateY(${cornerTranslateY}px) scaleX(${topScaleX})`;
    topBit.animate(
      [
        { transform: 'none', easing: params.easing },
        { transform: topTransform, offset },
        { transform: topTransform, offset: 1 },
      ],
      timing
    );

    // Animate the body
    const body = this.buttonRef.current.querySelector(
      '.body'
    ) as HTMLDivElement;
    const bodyScaleY = (params.height - oneEm) / (bbox.height - oneEm);
    const bodyTransform = `scale(${scaleX}, ${bodyScaleY})`;
    body.animate(
      [
        { transform: 'none', easing: params.easing },
        { transform: bodyTransform, offset },
        { transform: bodyTransform, offset: 1 },
      ],
      timing
    );

    // Animate the shadow
    const shadow = this.buttonRef.current.querySelector(
      '.shadow'
    ) as HTMLDivElement;
    const shadowTransform = `scale(${scaleX}, ${scaleY})`;
    shadow.animate(
      [
        { transform: 'none', easing: params.easing },
        { transform: shadowTransform, offset },
        { transform: shadowTransform, offset: 1 },
      ],
      timing
    );

    // Fade out the label
    const label = body.querySelector('.label') as HTMLSpanElement;
    label.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 0, offset: 0.2 * offset },
        { opacity: 0, offset: 1 },
      ],
      timing
    );
  }

  render() {
    let className = 'addnote-button';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    return (
      <button
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
            <NoteCorner />
          </div>
          <div className="body">
            <span className="label">Add note</span>
          </div>
        </div>
      </button>
    );
  }
}

export default AddNoteButton;
