import * as React from 'react';

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
    this.updatePosition = this.updatePosition.bind(this);
  }

  componentDidMount() {
    this.updatePosition();
    window.addEventListener('resize', this.updatePosition);
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.anchorElement !== this.props.anchorElement ||
      prevProps.position !== this.props.position ||
      prevProps.align !== this.props.align ||
      (!prevProps.visible && this.props.visible)
    ) {
      this.updatePosition();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updatePosition);
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

        // We _could_ check if the box fits, and, if not switch the arrow
        // position to left / right accordingly but that's not actually what you
        // want in a lot of cases.
        //
        // For example, if the box just overlaps the right edge, by switching
        // the panel so that it hangs to the left we might end up making it
        // overlap the left edge.
        //
        // In that case, though it's probably more desirable to just let the
        // arrow be a bit off-center. We do that adjustment inside SpeechBubble
        // since we want to keep the 'left' position we pass to SpeechBubble the
        // same.
        break;
    }

    // Find the vertical position
    const topOverlap = 5;
    const topPoint = anchorBbox.top + topOverlap;
    const bottomOverlap = 7;
    const bottomPoint = anchorBbox.bottom - bottomOverlap;
    let top = this.props.position === 'above' ? topPoint : bottomPoint;
    let arrowSide: 'top' | 'bottom' =
      this.props.position === 'above' ? 'bottom' : 'top';
    if (contentBbox) {
      if (
        this.props.position === 'above' &&
        top - contentBbox.height < 0 &&
        bottomPoint + contentBbox.height < viewport.bottom
      ) {
        top = bottomPoint;
        arrowSide = 'top';
      } else if (
        this.props.position === 'below' &&
        top + contentBbox.height > viewport.bottom &&
        topPoint - contentBbox.height > 0
      ) {
        top = topPoint;
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
