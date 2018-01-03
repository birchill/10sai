import React from 'react';
import PropTypes from 'prop-types';

class ReviewCardFront extends React.PureComponent {
  static get propTypes() {
    return {
      question: PropTypes.string.isRequired,
      className: PropTypes.string,
    };
  }

  static getIdealFontSize(elem, containerWidth, containerHeight) {
    let prevFontSize = parseInt(getComputedStyle(elem).fontSize, 10);
    const dimensionDiff = (actual, ideal) => (actual - ideal) / ideal;
    const xDiff = bbox => dimensionDiff(bbox.width, containerWidth);
    const yDiff = bbox => dimensionDiff(bbox.height, containerHeight);
    // console.log(`initial font size is ${prevFontSize}`);

    // Get our initial guess
    let bbox = elem.getBoundingClientRect();
    let fontSize = prevFontSize;
    // If either dimension is too large we need to go smaller
    // console.log(`xDiff ${xDiff(bbox)}, yDiff ${yDiff(bbox)}`);
    if (xDiff(bbox) > 0 || yDiff(bbox) > 0) {
      do {
        prevFontSize = fontSize;
        fontSize = Math.round(prevFontSize / 2);
        elem.style.fontSize = fontSize + 'px';
        bbox = elem.getBoundingClientRect();
      } while (xDiff(bbox) > 0 || yDiff(bbox) > 0);
    } else {
      do {
        prevFontSize = fontSize;
        fontSize = Math.round(fontSize * 2);
        elem.style.fontSize = fontSize + 'px';
        bbox = elem.getBoundingClientRect();
      } while (xDiff(bbox) <= 0 && yDiff(bbox) <= 0);
    }
    // console.log(`initial fontSize guess is ${fontSize}`);

    // The progressively divide subintervals until we're within range
    for (;;) {
      // Get the updated bbox
      elem.style.fontSize = fontSize + 'px';
      bbox = elem.getBoundingClientRect();
      const halfInterval = Math.round(Math.abs(fontSize - prevFontSize) / 2);
      prevFontSize = fontSize;
      // console.log(`xDiff ${xDiff(bbox)}, yDiff ${yDiff(bbox)}`);
      if (xDiff(bbox) > 0 || yDiff(bbox) > 0) {
        fontSize -= halfInterval;
      } else {
        fontSize += halfInterval;
      }
      // console.log(`Next fontSize guess is ${fontSize}`);

      // If we're 1 pixel or less off, return the result.
      // This tolerance is just to avoid a situation where we keep fluctuating
      // between being too big or too small.
      // console.log(`Current font size ${fontSize} vs previous ${prevFontSize}`);
      // console.log(`Diff: ${Math.abs(fontSize - prevFontSize)}`);
      if (Math.abs(fontSize - prevFontSize) < 2) {
        // console.log(`Within range, returning ${Math.min(fontSize, prevFontSize)}`);
        return Math.min(fontSize, prevFontSize);
      }
    }
  }

  constructor(props) {
    super(props);

    this.needsFontResize = false;
    this.state = {
      fontSize: 'inherit',
      containerHeight: undefined,
      containerWidth: undefined,
    };
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
      bbox.width !== this.state.containerWidth ||
      bbox.height !== this.state.containerHeight
    ) {
      this.resizeFont(bbox);
    }
  }

  resizeFont(containerBbox) {
    if (!this.container || !this.question) {
      return;
    }

    const bbox = containerBbox || this.container.getBoundingClientRect();
    this.setState({
      containerWidth: bbox.width,
      containerHeight: bbox.height,
      fontSize: ReviewCardFront.getIdealFontSize(
        this.question,
        bbox.width,
        bbox.height
      ),
    });
    this.needsFontResize = false;
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
