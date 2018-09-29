import React from 'react';
import PropTypes from 'prop-types';
import { Omit, stripFields } from '../utils/type-helpers';

import { SpeechBubble, Props as SpeechBubbleProps } from './SpeechBubble';

interface Props
  extends Omit<
      SpeechBubbleProps,
      'left' | 'top' | 'arrowPosition' | 'arrowSide'
    > {
  // Preferred direction to which the speech bubble should hang
  align: 'center' | 'largest-side' | 'inline-direction';
  // Preferred side to show the speech bubble on
  position: 'above' | 'below';
  // The element at which to point the speech bubble at
  anchorElement: Element | null;
}

interface State {
  left: number;
  top: number;
  arrowPosition: 'left' | 'center' | 'right';
  arrowSide: 'top' | 'bottom';
}

export class AnchoredSpeechBubble extends React.PureComponent<Props, State> {
  static get propTypes() {
    return {
      ...stripFields(SpeechBubble.propTypes, [
        'left',
        'top',
        'arrowPosition',
        'arrowSide',
      ]),
      position: PropTypes.oneOf(['above', 'below']),
      align: PropTypes.oneOf(['center', 'largest-side', 'inline-direction']),
      anchorElement: PropTypes.instanceOf(Element),
    };
  }

  state: State;
  speechBubbleRef: React.RefObject<SpeechBubble>;

  constructor(props: Props) {
    super(props);

    this.state = {
      left: 0,
      top: 0,
      arrowPosition: 'left',
      arrowSide: 'top',
    };

    this.speechBubbleRef = React.createRef<SpeechBubble>();
  }

  componentDidMount() {
    this.updatePosition();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.anchorElement !== this.props.anchorElement ||
      prevProps.position !== this.props.position ||
      prevProps.align !== this.props.align
    ) {
      this.updatePosition();
    }
  }

  updatePosition() {
    const { anchorElement } = this.props;
    if (!anchorElement) {
      return;
    }

    const anchorBbox = anchorElement.getBoundingClientRect();
    const contentBbox = this.speechBubbleRef.current
      ? this.speechBubbleRef.current.bbox
      : null;
    const viewport = document.documentElement.getBoundingClientRect();

    // Find the horizontal position
    const left = anchorBbox.left + anchorBbox.width / 2;
    let arrowPosition: 'left' | 'center' | 'right' = 'left';
    switch (this.props.align) {
      case 'largest-side':
        {
          const viewCenter = Math.round(viewport.width / 2);
          const anchorCenter = Math.round(left);
          if (anchorCenter > viewCenter) {
            arrowPosition = 'right';
          }
        }
        break;

      case 'inline-direction':
        {
          const isRtl = getComputedStyle(anchorElement).direction === 'rtl';
          arrowPosition = isRtl ? 'right' : 'left';

          // Check if fits.
          if (contentBbox) {
            // It's easier to do this in logical space.
            const inlineMax = viewport.width;
            const inlineOffset = isRtl ? inlineMax - left : left;

            // Get the distance from the center of the arrow to the far edge.
            const speechBubble = this.speechBubbleRef.current!;
            const extent =
              speechBubble.props.arrowPosition === 'left'
                ? contentBbox.right - speechBubble.props.left
                : speechBubble.props.left - contentBbox.left;
            const inlineEnd = inlineOffset + extent;
            if (inlineEnd > inlineMax) {
              // Flip the arrow position
              arrowPosition = isRtl ? 'left' : 'right';
            }
          }
        }
        break;

      case 'center':
        arrowPosition = 'center';

        // Check if fits.
        if (contentBbox) {
          if (left + contentBbox.width / 2 > viewport.right) {
            arrowPosition = 'right';
          } else if (left - contentBbox.width / 2 < 0) {
            arrowPosition = 'left';
          }
        }
        break;
    }

    // Find the vertical position
    let top =
      this.props.position === 'above' ? anchorBbox.top : anchorBbox.bottom;
    let arrowSide: 'top' | 'bottom' =
      this.props.position === 'above' ? 'bottom' : 'top';
    if (contentBbox) {
      if (
        this.props.position === 'above' &&
        top - contentBbox.height < 0 &&
        anchorBbox.bottom + contentBbox.height < viewport.bottom
      ) {
        top = anchorBbox.bottom;
        arrowSide = 'top';
      } else if (
        this.props.position === 'below' &&
        top + contentBbox.height > viewport.bottom &&
        anchorBbox.top - contentBbox.height > 0
      ) {
        top = anchorBbox.top;
        arrowSide = 'bottom';
      }
    }

    this.setState({ left, top, arrowPosition, arrowSide });
  }

  render() {
    return (
      <SpeechBubble
        left={this.state.left}
        top={this.state.top}
        arrowSide={this.state.arrowSide}
        arrowPosition={this.state.arrowPosition}
        {...stripFields(this.props, ['position', 'align', 'anchorElement'])}
        ref={this.speechBubbleRef}
      />
    );
  }
}
