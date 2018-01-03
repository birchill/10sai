import React from 'react';
import PropTypes from 'prop-types';

class ReviewCardFront extends React.PureComponent {
  static get propTypes() {
    return {
      question: PropTypes.string.isRequired,
      className: PropTypes.string,
    };
  }

  // We used to do a very thorough job of getting the maximum font size down to
  // the pixel. The trouble is it would cause several re-layouts and would not
  // necessary look all that great anyway--since the text filling the box is not
  // always the best layout.
  //
  // Instead, we simplify this to choosing from a number of preset font sizes
  // that we know are going to be sensible.
  static getGoodFontSize(elem, containerWidth, containerHeight) {
    const fixedSizes = [12, 24, 48, 72, 96];
    let fontSize = parseInt(getComputedStyle(elem).fontSize, 10);
    console.assert(
      fixedSizes.includes(fontSize),
      'Font size not initialized to one of the fixed sizes'
    );

    const dimensionDiff = (actual, ideal) => (actual - ideal) / ideal;
    const xDiff = bbox => dimensionDiff(bbox.width, containerWidth);
    const yDiff = bbox => dimensionDiff(bbox.height, containerHeight);

    let bbox = elem.getBoundingClientRect();

    // If either dimension is too large, we need to go smaller
    if (xDiff(bbox) >= 0 || yDiff(bbox) >= 0) {
      // Just keep trying smaller fixed sizes while we have them.
      //
      // Technically it would be faster to do a binary subdivision of intervals
      // here but assuming we don't have massive changes to content size (we
      // don't expect to), or sudden changes to container size (uncommon except
      // when flipping a tablet/phone), and assuming we start somewhere at the
      // middle of the range (which is true); then the most a binary subdivision
      // would save would be ~1 relayout, but at the cost of code complexity.
      // And many times it wouldn't save any relayouts at all because word
      // wrapping means the ratio of differences to font size is not constant.

      // We could use indexOf here but just in case fontSize is not in
      // fixedSizes, let's play it safe.
      let index = fixedSizes.findIndex(size => size >= fontSize);
      while (--index >= 0) {
        fontSize = fixedSizes[index];
        elem.style.fontSize = fontSize + 'px';
        bbox = elem.getBoundingClientRect();
        if (xDiff(bbox) < 0 && yDiff(bbox) < 0) {
          break;
        }
      }
      return fontSize;
    }

    // Both dimensions are smaller.
    //
    // If they're both within 20% of filling the space just keep the font size
    // as-is.
    if (xDiff(bbox) > -0.2 && yDiff(bbox) > -0.2) {
      return fontSize;
    }

    // Just keep trying larger fixed sizes while we have them.
    //
    // As before, we could do this *slightly* more efficiently, but this way is
    // fine for now.
    let index = fixedSizes.findIndex(size => size > fontSize);
    while (index < fixedSizes.length) {
      fontSize = fixedSizes[index];
      elem.style.fontSize = fontSize + 'px';
      bbox = elem.getBoundingClientRect();
      // If we're too large, just use the previous size;
      if (xDiff(bbox) > 0 || yDiff(bbox) > 0) {
        fontSize = fixedSizes[--index];
        elem.style.fontSize = fontSize + 'px';
        break;
      }
      // If we're close enough, just the current size
      if (xDiff(bbox) > -0.2 && yDiff(bbox) > -0.2) {
        break;
      }
      index++;
    }
    return fontSize;
  }

  constructor(props) {
    super(props);

    this.needsFontResize = false;
    this.containerWidth = undefined;
    this.containerHeight = undefined;
    this.state = { fontSize: '48px' };
    this.handleResize = this.handleResize.bind(this);
    this.assignContainer = elem => {
      this.container = elem;
    };
    this.assignQuestion = elem => {
      this.question = elem;
    };
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize);
    this.resizeFont();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.question !== nextProps.question) {
      this.needsFontResize = true;
    }
  }

  // XXX Implement shouldComponentUpdate and make it return false when we're
  // only changing the fontSize and we've already updated the computed style
  // of the element (as part of determining the fontSize).

  componentDidUpdate() {
    if (this.needsFontResize) {
      this.resizeFont();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    this.container = undefined;
    this.question = undefined;
  }

  handleResize() {
    if (!this.container) {
      return;
    }

    const bbox = this.container.getBoundingClientRect();
    if (
      bbox.width === this.containerWidth ||
      bbox.height === this.containerHeight
    ) {
      return;
    }

    this.containerWidth = bbox.width;
    this.containerHeight = bbox.height;
    this.resizeFont(bbox);
  }

  resizeFont(containerBbox) {
    if (!this.container || !this.question) {
      return;
    }

    const bbox = containerBbox || this.container.getBoundingClientRect();
    const fontSize = ReviewCardFront.getGoodFontSize(
      this.question,
      bbox.width,
      bbox.height
    );
    this.needsFontResize = false;

    if (fontSize === this.state.fontSize) {
      return;
    }

    this.setState({ fontSize });
  }

  render() {
    const className = `reviewcard-front ${this.props.className || ''}`;
    const style = { fontSize: this.state.fontSize };

    return (
      <div className={className} style={style} ref={this.assignContainer}>
        <div className="question" ref={this.assignQuestion}>
          {this.props.question}
        </div>
      </div>
    );
  }
}

export default ReviewCardFront;
