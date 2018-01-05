import React from 'react';
import PropTypes from 'prop-types';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';

class ReviewCardFront extends React.Component {
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
  static getBestSize(elem, containerWidth, containerHeight) {
    // Selectors for [data-size=...] MUST be defined for each of these and they
    // must define increasing font sizes or potentially bad things could happen.
    const sizeKeywords = ['x-small', 'small', 'medium', 'large', 'x-large'];
    let { size } = elem.dataset;

    const dimensionDiff = (actual, ideal) => (actual - ideal) / ideal;
    const xDiff = bbox => dimensionDiff(bbox.width, containerWidth);
    const yDiff = bbox => dimensionDiff(bbox.height, containerHeight);

    let bbox = elem.getBoundingClientRect();

    // If either dimension is too large, we need to go smaller
    if (xDiff(bbox) >= 0 || yDiff(bbox) >= 0) {
      // Just keep trying smaller sizes while we have them.
      //
      // Technically it would be faster to do a binary subdivision of intervals
      // here but assuming we don't have massive changes to content size (we
      // don't expect to), or sudden changes to container size (uncommon except
      // when flipping a tablet/phone), and assuming we start somewhere at the
      // middle of the range (which is true); then the most a binary subdivision
      // would save would be ~1 relayout, but at the cost of code complexity.
      // And many times it wouldn't save any relayouts at all because word
      // wrapping means the ratio of differences to sizes is not constant.

      let index = sizeKeywords.indexOf(size);
      while (--index >= 0) {
        size = sizeKeywords[index];
        elem.dataset.size = size;
        bbox = elem.getBoundingClientRect();
        if (xDiff(bbox) < 0 && yDiff(bbox) < 0) {
          break;
        }
      }
      return size;
    }

    // Both dimensions are smaller.
    //
    // If they're both within 20% of filling the space just keep the font size
    // as-is.
    if (xDiff(bbox) > -0.2 && yDiff(bbox) > -0.2) {
      return size;
    }

    // Just keep trying larger fixed sizes while we have them.
    //
    // As before, we could do this *slightly* more efficiently, but this way is
    // fine for now.
    let index = sizeKeywords.indexOf(size);
    while (index < sizeKeywords.length) {
      size = sizeKeywords[index];
      elem.dataset.size = size;
      bbox = elem.getBoundingClientRect();
      // If we're too large, just use the previous size;
      if (xDiff(bbox) > 0 || yDiff(bbox) > 0) {
        size = sizeKeywords[--index];
        elem.dataset.size = size;
        break;
      }
      // If we're close enough, just the current size
      if (xDiff(bbox) > -0.2 && yDiff(bbox) > -0.2) {
        break;
      }
      index++;
    }
    return size;
  }

  constructor(props) {
    super(props);

    this.needsFontResize = false;
    this.containerWidth = undefined;
    this.containerHeight = undefined;
    this.state = { size: 'medium' };
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

  shouldComponentUpdate(nextProps) {
    // Currently the only thing in state is the size and we update that by
    // applying the size to the target element and measuring it.
    // That means that by the time we update the size, the target element is
    // already up-to-date so we don't need to perform any further updates.
    //
    // Instead, we only need to update if one of the properties has changed.
    return shallowEqual(this.props, nextProps);
  }

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
    const size = ReviewCardFront.getBestSize(
      this.question,
      bbox.width,
      bbox.height
    );
    this.needsFontResize = false;

    if (size === this.state.size) {
      return;
    }

    this.setState({ size });
  }

  render() {
    const className = `reviewcard-front ${this.props.className || ''}`;

    return (
      <div className={className} ref={this.assignContainer}>
        <div
          className="question"
          ref={this.assignQuestion}
          data-size={this.state.size}>
          {this.props.question}
        </div>
      </div>
    );
  }
}

export default ReviewCardFront;
