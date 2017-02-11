import React from 'react';
import CardPreview from './CardPreview.jsx';

function getScrollContainer(elem) {
  if (elem === null) {
    return null;
  }

  return elem.scrollHeight > elem.clientHeight
         ? elem
         : getScrollContainer(elem.parentNode);
}

// Ideal number of screens' worth of overflow to render. 0 means "just render
// what is actually on the screen".
const MAX_OVERFLOW_SCREENS = 2;

// Rather than re-rendering content on each scroll, we only regenerate content
// when we have less than the minimum amount of overflow.
const MIN_OVERFLOW_SCREENS = 1;

export class CardGrid extends React.Component {
  static get propTypes() {
    return {
      cards: React.PropTypes.arrayOf(React.PropTypes.shape({
        _id: React.PropTypes.string.isRequired,
        question: React.PropTypes.string.isRequired,
      })).isRequired,
      onDelete: React.PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);
    this.state = { itemWidth: null,
                   itemHeight: null,
                   itemsPerRow: 1,
                   itemScale: 1,
                   startIndex: 0,
                   endIndex: 1,
                   containerHeight: null,
                   slots: [] };

    // Ref callbacks
    this.assignGrid = elem => { this.grid = elem; };
    this.assignItemTemplate = elem => {
      this.templateItem = elem;
      if (this.scrollContainer) {
        this.scrollContainer.removeEventListener('scroll',
                                                 this.handleScroll,
                                                 { passive: true });
      }
      this.scrollContainer = getScrollContainer(elem);
      if (this.scrollContainer) {
        // XXX Throttle this?
        this.scrollContainer.addEventListener('scroll',
                                              this.handleScroll,
                                              { passive: true });
      }
    };

    // Event callbacks
    this.handleResize = this.handleResize.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
  }

  componentDidMount() {
    this.updateLayout();
    window.addEventListener('resize', this.handleResize);
  }

  componentWillReceiveProps(nextProps) {
    this.updateLayout(nextProps);
  }

  componentDidUpdate() {
    // Re-do layout since, after rendering, the template item might have
    // changed in size (e.g. due to media queries).
    this.updateLayout();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll',
                                               this.handleScroll,
                                               { passive: true });
    }
  }

  // XXX
  // - Animate deletion and subsequent movement
  //   - Requires doing a minimal update to cards set? (Maybe not?)
  // - Animate addition and prior movement (i.e. making room)
  // - Animate initial reveal (and reveal on scroll)

  handleResize() {
    this.updateLayout();
  }

  handleScroll() {
    this.updateVisibleRange();
  }

  updateLayout(nextProps) {
    if (!this.grid || !this.templateItem) {
      return;
    }

    const props = nextProps || this.props;

    const cards = props.cards;
    if (!cards.length) {
      if (this.state.containerHeight !== 0) {
        this.setState({ containerHeight: 0 });
      }
      return;
    }

    // We want to be able to define the item size using the stylesheet (e.g.
    // so we can use media queries to change the size) but, at the same time,
    // we assume all items are the same size since that allows us to optimize
    // the layout to only produce a limited set of DOM nodes.
    // To do that we use a representative template item to get the initial size.

    const bbox     = this.templateItem.getBoundingClientRect();
    let itemWidth  = bbox.width;
    let itemHeight = bbox.height;

    // Adjust item width to make full use of the available screen space.
    // If less than 20% of an item is overhanging the edge, shrink all the
    // items, otherwise stretch them all.
    const gridWidth = this.grid.offsetWidth;
    let itemsPerRow = gridWidth / itemWidth;
    if (itemsPerRow % 1 < 0.2) {
      itemsPerRow = Math.floor(itemsPerRow);
    } else {
      itemsPerRow = Math.ceil(itemsPerRow);
    }

    const itemScale = gridWidth / itemsPerRow / itemWidth;

    itemWidth  = Math.floor(itemWidth * itemScale);
    itemHeight = Math.floor(itemHeight * itemScale);

    const containerHeight = Math.floor(this.props.cards.length / itemsPerRow) *
                            itemHeight;

    // XXX We probably need some sort of safeguard against recursion here in
    // case updating this state causes the templateItem's size to change.
    if (this.state.itemsPerRow     !== itemsPerRow ||
        this.state.itemWidth       !== itemWidth ||
        this.state.itemHeight      !== itemHeight ||
        this.state.itemScale       !== itemScale ||
        this.state.containerHeight !== containerHeight) {
      this.setState({ itemsPerRow, itemWidth, itemHeight, itemScale,
                      containerHeight });
      this.updateVisibleRange(nextProps);
    }
  }

  updateVisibleRange(nextProps) {
    // We haven't finished doing the initial layout yet
    if (!this.state.itemWidth || !this.state.itemHeight) {
      return;
    }

    const props = nextProps || this.props;

    let startIndex;
    let endIndex;

    if (this.scrollContainer) {
      // Calculate visible height
      const screenHeight = this.scrollContainer.offsetHeight;

      // ("Upper" here refers to the vertical axis, like "up". I know,
      // confusing.)

      // What is actually on screen?
      const upperBound = Math.max(this.scrollContainer.scrollTop -
                                  this.grid.offsetTop, 0);
      const lowerBound = screenHeight -
                         this.grid.offsetTop +
                         this.scrollContainer.scrollTop;

      // Define calculation for getting the item index for the first item
      // we need to render in order to produce |numOverflowScreens|.
      const getStartIndexForOverflow = numOverflowScreens => {
        const overflowUpperBound =
          Math.max(upperBound - screenHeight * numOverflowScreens, 0);
        const firstRow = Math.floor(overflowUpperBound / this.state.itemHeight);
        return firstRow * this.state.itemsPerRow;
      };
      // Likewise for the last item...
      const getEndIndexForOverflow = numOverflowScreens => {
        const overflowLowerBound =
          Math.min(lowerBound + screenHeight * numOverflowScreens,
                   this.state.containerHeight);
        const lastRow = Math.ceil(overflowLowerBound / this.state.itemHeight);
        return Math.min((lastRow + 1) * this.state.itemsPerRow,
                        props.cards.length);
      };

      // What is the range for the minimum overflow we would accept?
      const minStartIndex = getStartIndexForOverflow(MIN_OVERFLOW_SCREENS);
      const minEndIndex = getEndIndexForOverflow(MIN_OVERFLOW_SCREENS);

      // If the current range covers the minimum overflow region, don't
      // update the indices and just use the existing rendering.
      if (minStartIndex >= this.state.startIndex &&
          minEndIndex <= this.state.endIndex) {
        startIndex = this.state.startIndex;
        endIndex = this.state.endIndex;
      } else {
        startIndex = getStartIndexForOverflow(MAX_OVERFLOW_SCREENS);
        endIndex = getEndIndexForOverflow(MAX_OVERFLOW_SCREENS);
      }
    } else {
      // No scroll container? All the items must be visible, I guess.
      startIndex = 0;
      endIndex = props.length;
    }

    if (this.state.startIndex === startIndex &&
        this.state.endIndex === endIndex) {
      return;
    }

    // Update slots
    const slots = this.state.slots.slice();

    // Collect empty and existing slots
    const emptySlots = [];
    const existingItems = [];
    slots.forEach((itemIndex, i) => {
      if (itemIndex === null ||
          itemIndex < startIndex ||
          itemIndex >= endIndex) {
        emptySlots.push(i);
      } else {
        existingItems[itemIndex] = i;
      }
    });

    const distanceFromVisibleRange = slot => {
      // We use max because we want to find the distance from the closest edge
      // but the distance from the other edge should be negative.
      return Math.max(startIndex - slot, slot - endIndex);
    };
    // Sort in ascending order of distance so we can just pop() off the end
    // of the array.
    emptySlots.sort((a, b) => distanceFromVisibleRange(a) -
                              distanceFromVisibleRange(b));

    // Fill in missing items
    for (let i = startIndex; i < endIndex; i++) {
      if (existingItems[i] || existingItems[i] === 0) {
        continue;
      }
      if (emptySlots.length) {
        const emptyIndex = emptySlots.pop();
        slots[emptyIndex] = i;
      } else {
        slots.push(i);
      }
    }

    this.setState({ startIndex, endIndex, slots });
  }

  render() {
    const containerHeight = this.state.containerHeight === null
                            ? window.innerHeight + 10
                            : this.state.containerHeight;
    const gridStyle = { height: `${containerHeight}px` };
    const scale = `scale(${this.state.itemScale})`;

    return (
      <div className="card-grid" ref={this.assignGrid} style={gridStyle}>
        <div style={ { opacity: 0,
                       pointerEvents: 'none' } } ref={this.assignItemTemplate}>
          <CardPreview onDelete={() => {}} _id="template"
            question="Template" />
        </div>
        {
          this.state.slots.map((itemIndex, i) => {
            const card = this.props.cards[itemIndex];
            const row = Math.floor(itemIndex / this.state.itemsPerRow);
            const col = itemIndex % this.state.itemsPerRow;
            const translate = `translate(${col * this.state.itemWidth}px, ` +
                                        `${row * this.state.itemHeight}px)`;

            // XXX Set the transform-origin in the stylesheet instead
            return (
              <div style={ { transform: `${translate} ${scale}`,
                             transformOrigin: '0% 0%' } }
                key={i}>
                <CardPreview onDelete={this.props.onDelete} {...card} />
              </div>);
          })
        }
      </div>
    );
  }
}

export default CardGrid;
