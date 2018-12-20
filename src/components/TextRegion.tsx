import * as React from 'react';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';

type SizeKeyword = 'x-small' | 'small' | 'medium' | 'large' | 'x-large';

interface Props {
  className?: string;
  children: React.ReactElement<any>;
}

interface State {
  size: SizeKeyword;
}

// A block of text where the size of the text content is resized to more-or-less
// fill the region.
//
// Relies on there being CSS selectors defined for the region that match on the
// 'data-size' attribute with keywords 'x-small', 'small', 'medium', 'large',
// 'x-large'. Typically these will define increasing font sizes.
export class TextRegion extends React.Component<Props, State> {
  static getBestSize(
    textElem: HTMLElement,
    containerElem: HTMLElement,
    containerWidth: number,
    containerHeight: number
  ): SizeKeyword {
    // Selectors for [data-size=...] MUST be defined for each of these and they
    // must define increasing font sizes or potentially bad things could happen.
    const sizeKeywords: Array<SizeKeyword> = [
      'x-small',
      'small',
      'medium',
      'large',
      'x-large',
    ];
    let { size } = containerElem.dataset as { size: SizeKeyword };

    const dimensionDiff = (actual: number, ideal: number): number =>
      (actual - ideal) / ideal;
    const xDiff = (bbox: ClientRect): number =>
      dimensionDiff(bbox.width, containerWidth);
    const yDiff = (bbox: ClientRect): number =>
      dimensionDiff(bbox.height, containerHeight);

    let bbox = textElem.getBoundingClientRect();

    // If either dimension is too large, we need to go smaller
    if (xDiff(bbox) > 0 || yDiff(bbox) > 0) {
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
        containerElem.dataset.size = size;
        bbox = textElem.getBoundingClientRect();
        if (xDiff(bbox) <= 0 && yDiff(bbox) <= 0) {
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
    while (++index < sizeKeywords.length) {
      size = sizeKeywords[index];
      containerElem.dataset.size = size;
      bbox = textElem.getBoundingClientRect();
      // If we're too large, just use the previous size.
      if (xDiff(bbox) > 0 || yDiff(bbox) > 0) {
        size = sizeKeywords[--index];
        containerElem.dataset.size = size;
        break;
      }
      // If we're close enough, just use the current size.
      if (xDiff(bbox) > -0.2 && yDiff(bbox) > -0.2) {
        break;
      }
    }
    return size;
  }

  containerWidth: number | undefined;
  containerHeight: number | undefined;
  containerElemRef: React.RefObject<HTMLDivElement>;
  textElemRef: React.RefObject<HTMLDivElement>;
  state: State;

  constructor(props: Props) {
    super(props);

    this.containerWidth = undefined;
    this.containerHeight = undefined;
    this.state = { size: 'medium' };
    this.handleResize = this.handleResize.bind(this);
    this.containerElemRef = React.createRef<HTMLDivElement>();
    this.textElemRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize);
    this.resizeText();
  }

  shouldComponentUpdate(nextProps: Props) {
    // Currently the only thing in state is the size and we update that by
    // applying the size to the target element and measuring it.
    // That means that by the time we update the size, the target element is
    // already up-to-date so we don't need to perform any further updates.
    //
    // Instead, we only need to update if one of the properties has changed.
    return !shallowEqual(this.props, nextProps);
  }

  componentDidUpdate(previousProps: Props) {
    if (this.props.children !== previousProps.children) {
      this.resizeText();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  handleResize() {
    if (!this.containerElemRef.current) {
      return;
    }

    const bbox = this.containerElemRef.current.getBoundingClientRect();
    if (
      bbox.width === this.containerWidth &&
      bbox.height === this.containerHeight
    ) {
      return;
    }

    this.resizeText(bbox);
  }

  resizeText(containerBbox?: ClientRect) {
    if (!this.containerElemRef.current || !this.textElemRef.current) {
      return;
    }

    const bbox =
      containerBbox || this.containerElemRef.current.getBoundingClientRect();
    const size = TextRegion.getBestSize(
      this.textElemRef.current,
      this.containerElemRef.current,
      bbox.width,
      bbox.height
    );
    this.containerWidth = bbox.width;
    this.containerHeight = bbox.height;

    if (size === this.state.size) {
      return;
    }

    this.setState({ size });
  }

  render() {
    const className = `text-region ${this.props.className || ''}`;

    return (
      <div
        className={className}
        ref={this.containerElemRef}
        data-size={this.state.size}
      >
        <div className="text" ref={this.textElemRef}>
          {this.props.children}
        </div>
      </div>
    );
  }
}
