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

// This is just a safeguard to ensure we don't end up rendering recursively.
//
// This could happen, for example, if we update layout, determine the size of
// items, trigger a render based on that size. Then, suppose that render with
// the new size means we now need scrollbars. Then if we update layout again we
// might decide to render the items at a smaller size (due to narrower area)
// which might mean we don't overflow the screen anymore and no longer need
// scroll bars, and so on.
//
// React's lifecycle actually makes it quite hard to detect this case so we
// simply update the below when we *think* we are triggering a render and clear
// it any time return early from updating layout (this relies on the fact that
// componentDidUpdate calls updateLayout). If the depth gets greater than 2,
// then we just bail.
let layoutRenderDepth = 0;

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
                   endIndex: 0,
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
    if (this.props.cards.length !== nextProps.cards.length) {
      layoutRenderDepth = 0;
      this.updateLayout(nextProps);
      this.updateVisibleRange(nextProps);
    }
  }

  componentDidUpdate() {
    // Re-do layout since, after rendering, the template item might have
    // changed in size (e.g. due to media queries being applied).
    if (layoutRenderDepth) {
      this.updateLayout();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll',
                                               this.handleScroll,
                                               { passive: true });
    }
  }

  handleResize() {
    this.updateLayout();
  }

  handleScroll() {
    this.updateVisibleRange();
  }

  updateLayout(nextProps) {
    if (!this.grid || !this.templateItem) {
      layoutRenderDepth = 0;
      return;
    }

    // Detect possible infinite layout behavior
    if (layoutRenderDepth > 2) {
      layoutRenderDepth = 0;
      return;
    }

    const props = nextProps || this.props;

    const cards = props.cards;
    if (!cards.length) {
      if (this.state.containerHeight !== 0) {
        layoutRenderDepth++;
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

    const containerHeight = Math.ceil(this.props.cards.length / itemsPerRow) *
                            itemHeight;

    if (this.state.itemsPerRow     !== itemsPerRow ||
        this.state.itemWidth       !== itemWidth ||
        this.state.itemHeight      !== itemHeight ||
        this.state.itemScale       !== itemScale ||
        this.state.containerHeight !== containerHeight) {
      layoutRenderDepth++;
      this.setState({ itemsPerRow, itemWidth, itemHeight, itemScale,
                      containerHeight });
      this.updateVisibleRange(nextProps);
    } else {
      layoutRenderDepth = 0;
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
      const upperBound = Math.max(this.scrollContainer.scrollTop -
                                  this.grid.offsetTop, 0);
      const lowerBound = this.scrollContainer.offsetHeight -
                         this.grid.offsetTop +
                         this.scrollContainer.scrollTop;

      const firstVisibleRow = Math.floor(upperBound / this.state.itemHeight);
      const lastVisibleRow  = Math.ceil(lowerBound / this.state.itemHeight);

      startIndex = firstVisibleRow * this.state.itemsPerRow;
      endIndex   = Math.min((lastVisibleRow + 1) * this.state.itemsPerRow,
                            props.cards.length);
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
            // This is probably only needed until we make the slot assignment
            // work in the face of deletion.
            if (!card) {
              return null;
            }
            const row = Math.floor(itemIndex / this.state.itemsPerRow);
            const col = itemIndex % this.state.itemsPerRow;
            const translate = `translate(${col * this.state.itemWidth}px, ` +
                                        `${row * this.state.itemHeight}px)`;

            return (
              <div style={ { transform: `${translate} ${scale}` } }
                className="grid-item" key={i}>
                <CardPreview onDelete={this.props.onDelete} {...card} />
              </div>);
          })
        }
      </div>
    );
  }
}

export default CardGrid;
