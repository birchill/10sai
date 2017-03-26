import React from 'react';

function getScrollContainer(elem) {
  if (elem === null) {
    return null;
  }

  return elem.scrollHeight > elem.clientHeight
         ? elem
         : getScrollContainer(elem.parentNode);
}

function getInclusiveAncestorWithClass(elem, className) {
  while (elem && !elem.classList.contains(className)) {
    elem = elem.parentNode;
  }
  return elem;
}

function fillInMissingSlots(startIndex, endIndex, emptySlots,
                            existingItems, slots) {
  for (let i = startIndex; i < endIndex; i++) {
    // Check if the item is already assigned a slot
    if (typeof existingItems[i] === 'number') {
      continue;
    }
    // Otherwise take the first empty slot
    if (emptySlots.length) {
      const emptyIndex = emptySlots.shift();
      slots[emptyIndex] = { index: i, recycled: true };
    } else {
      slots.push({ index: i });
    }
  }
}

// Record the number of potentially recursive calls to updateLayout. This is
// mostly a safeguard to ensure we don't end up rendering recursively without
// limit.
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
// it any time return early from updating layout. If the depth gets greater than
// 2, then we just bail.
//
// We also use this to detect when the layout has changed so we know if we need
// to re-check the computed style after the DOM has been updated.
let layoutRenderDepth = 0;

export class VirtualGrid extends React.Component {
  static get propTypes() {
    return {
      items: React.PropTypes.arrayOf(React.PropTypes.shape({
        _id: React.PropTypes.string.isRequired,
      })).isRequired,
      renderItem: React.PropTypes.func.isRequired,
      renderTemplateItem: React.PropTypes.func.isRequired,
      className: React.PropTypes.string,
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
                   // |slots| is an array mapping the index of rendered items
                   // to items in props.items so that we consistently render the
                   // same item using the same DOM elements to avoid unnecessary
                   // DOM surgery.
                   //
                   // String indices indicate items that have been deleted but
                   // are still animating and are stored in
                   // this.state.deletingItems.
                   //
                   // e.g.
                   //
                   // [
                   //   { index: 30 },
                   //   { index: 31 },
                   //   { index: 'abcdef' },
                   // ]
                   //
                   // would mean that we first render props.items[30], then
                   // props.items[31] and finally state.deletingItems['abcdef'].
                   slots: [],
                   // Items that have been deleted from props.items but
                   // which are still animating. The data needed to render them
                   // while animating is stored here, indexed by _id.
                   deletingItems: {} };

    // Ref callbacks
    this.assignGrid = elem => {
      this.grid = elem;
      this.grid.addEventListener('transitionend', this.handleTransitionEnd);
    };
    this.assignItemTemplate = elem => {
      this.templateItem = elem;
      if (this.scrollContainer) {
        this.scrollContainer.removeEventListener('scroll', this.handleScroll);
      }
      this.scrollContainer = getScrollContainer(elem);
      if (this.scrollContainer) {
        this.scrollContainer.addEventListener('scroll', this.handleScroll);
      }
    };

    // Event callbacks
    this.handleResize = this.handleResize.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleTransitionEnd = this.handleTransitionEnd.bind(this);
  }

  componentDidMount() {
    const layout = this.updateLayout();
    this.updateVisibleRange(layout);
    window.addEventListener('resize', this.handleResize);
  }

  componentWillReceiveProps(nextProps) {
    // This is a new render cycle, so reset the render depth.
    layoutRenderDepth = 0;

    let needsRangeUpdate = false;

    // The only thing the can trigger a change to layout is a change in the
    // number of items.
    let layout = false;
    if (this.props.items.length !== nextProps.items.length) {
      needsRangeUpdate = true;
      layout = this.updateLayout(nextProps.items);
    }

    // We will only call this if the number of items has *not* changed so we can
    // assume that the two items arrays have the same length.
    const visibleItemIndicesHaveChanged = () => {
      for (let i = this.state.startIndex; i < this.state.endIndex; i++) {
        if (this.props.items[i]._id !== nextProps.items[i]._id) {
          return true;
        }
      }
      return false;
    };

    if (needsRangeUpdate || visibleItemIndicesHaveChanged()) {
      // Generate a slot assignment mapping for existing items so we can keep
      // them in the same slots if they are still visible.
      // This is a mapping from _id to position in the state.slots array.
      const slotAssignment = {};
      this.state.slots.forEach((data, i) => {
        if (data && typeof data.index === 'number') {
          slotAssignment[this.props.items[data.index]._id] = i;
        } else if (data && typeof data.index === 'string') {
          slotAssignment[data.index] = i;
        }
      });

      this.updateVisibleRange(layout, nextProps.items, slotAssignment);
    }
  }

  componentDidUpdate() {
    // If we updated layout before the last render, check if the size of
    // items in the DOM has changed. This might happen, for example, if media
    // queries were applied based on the new viewport size.
    if (!layoutRenderDepth) {
      return;
    }

    const layout = this.updateLayout();
    if (layout) {
      this.updateVisibleRange(layout);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    }
    if (this.grid) {
      this.grid.removeEventListener('transitionend', this.handleTransitionEnd);
    }
  }

  handleResize() {
    const layout = this.updateLayout();
    // Regardless of the return value of updateLayout, we need to update the
    // visible range since more items may now be in view even if their size has
    // not changed.
    this.updateVisibleRange(layout);
  }

  handleScroll() {
    this.updateVisibleRange();
  }

  handleTransitionEnd(evt) {
    // Ignore transitions on the outer element (since they are the translation
    // transitions).
    if (!evt.target.classList.contains('scale-wrapper') ||
        evt.propertyName !== 'transform') {
      return;
    }

    // Check if we have already deleted this item
    const gridItem = getInclusiveAncestorWithClass(evt.target, 'grid-item');
    if (!gridItem) {
      return;
    }
    const deletedId = gridItem.dataset.itemId;
    if (!this.state.deletingItems[deletedId]) {
      return;
    }

    // Drop from deletingItems
    // (We're basically doing an immutable delete here since immutability-helper
    // doesn't provide this and we don't quite need Immutable.js yet)
    const deletingItems =
      Object.entries(this.state.deletingItems).reduce(
        (result, entry) => {
          const [ id, item ] = entry;
          if (id !== deletedId) {
            result[id] = item;
          }
          return result;
        }, {});

    this.setState({ deletingItems });
  }

  // Recalculates the size of items based on the computed style of a hidden
  // dummy item in the DOM. Also, updates the scroll height of the container to
  // reflect the number of items available.
  //
  // @param nextItems An optional parameter specifying the to-be-set array of
  //                  items. If this is not provided, the current items (stored
  //                  in props) are used.
  //
  // Returns the updated layout if it changed, false otherwise.
  updateLayout(nextItems) {
    if (!this.grid || !this.templateItem) {
      layoutRenderDepth = 0;
      return false;
    }

    // Detect possible infinite layout behavior
    if (layoutRenderDepth > 2) {
      layoutRenderDepth = 0;
      return false;
    }

    const items = nextItems || this.props.items;

    if (!items.length) {
      if (this.state.containerHeight === 0) {
        layoutRenderDepth = 0;
        return false;
      }

      layoutRenderDepth++;
      this.setState({ containerHeight: 0 });
      return { itemWidth: null,
               itemHeight: null,
               itemsPerRow: 1,
               itemScale: 1,
               containerHeight: 0 };
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

    const containerHeight = Math.ceil(items.length / itemsPerRow) *
                            itemHeight;

    if (this.state.itemsPerRow     === itemsPerRow &&
        this.state.itemWidth       === itemWidth &&
        this.state.itemHeight      === itemHeight &&
        this.state.itemScale       === itemScale &&
        this.state.containerHeight === containerHeight) {
      layoutRenderDepth = 0;
      return false;
    }

    layoutRenderDepth++;
    const layout = { itemsPerRow,
                     itemWidth,
                     itemHeight,
                     itemScale,
                     containerHeight };
    this.setState(layout);
    return layout;
  }

  // Recalculates the assignment of items to slots. This needs to be performed
  // whenever layout is updated but also whenever a scroll takes place or the
  // viewport is resized.
  //
  // @params nextLayout An optional parameter specifying the layout to use.
  //
  // @param nextItems An optional parameter specifying the to-be-set array of
  //                  items. If this is not provided, the current items (stored
  //                  in props) are used.
  //
  // @param slotAssignment An optional parameter that may be provided together
  //                       with nextItems that maps item IDs for the *current*
  //                       set of properties to slots. This is used so that we
  //                       can ensure existing items that remain in view are
  //                       assigned to the same slot even when the set of items
  //                       is being updated.
  //
  // Returns true if the size changed, false otherwise.
  updateVisibleRange(nextLayout, nextItems, slotAssignment) {
    const layout = nextLayout || { itemWidth: this.state.itemWidth,
                                   itemHeight: this.state.itemHeight,
                                   itemsPerRow: this.state.itemsPerRow,
                                   itemScale: this.state.itemScale,
                                   containerHeight:
                                     this.state.containerHeight };
    // We haven't finished doing the initial layout yet
    if (!layout.itemWidth || !layout.itemHeight) {
      return;
    }

    const items = nextItems || this.props.items;

    let startIndex;
    let endIndex;

    if (this.scrollContainer) {
      // Calculate visible height
      const upperBound = Math.max(this.scrollContainer.scrollTop -
                                  this.grid.offsetTop, 0);
      const lowerBound = this.scrollContainer.offsetHeight -
                         this.grid.offsetTop +
                         this.scrollContainer.scrollTop;

      const firstVisibleRow = Math.floor(upperBound / layout.itemHeight);
      const lastVisibleRow  = Math.ceil(lowerBound / layout.itemHeight);

      startIndex = firstVisibleRow * layout.itemsPerRow;
      endIndex   = Math.min((lastVisibleRow + 1) * layout.itemsPerRow,
                            items.length);
    } else {
      // No scroll container? All the items must be visible, I guess.
      startIndex = 0;
      endIndex = items.length;
    }

    if (!slotAssignment &&
        this.state.startIndex === startIndex &&
        this.state.endIndex === endIndex) {
      return;
    }

    // Update slots
    if (slotAssignment) {
      this.updateSlotsWithNewProps(startIndex, endIndex,
                                   items, slotAssignment);
    } else {
      this.updateSlots(startIndex, endIndex);
    }
  }

  updateSlots(startIndex, endIndex) {
    const slots = this.state.slots.slice();

    // Collect empty and existing slots
    const emptySlots = [];
    const existingItems = [];
    console.log(`startIndex, endIndex: ${startIndex}, ${endIndex}`);
    slots.forEach((data, i) => {
      if (data === null ||
          data.index < startIndex ||
          data.index >= endIndex) {
        emptySlots.push(i);
      } else if (typeof data.index === 'string' &&
                 !this.state.deletingItems[data.index]) {
        slots[i] = null;
        emptySlots.push(i);
      } else {
        delete data.recycled;
        existingItems[data.index] = i;
      }
    });
    console.log(`emptySlots: ${JSON.stringify(emptySlots)}`);

    // Fill in items in missing slots
    fillInMissingSlots(startIndex, endIndex, emptySlots,
                       existingItems, slots);
    console.log(`Result of fillInMissingSlots(a): ${JSON.stringify(slots)}`);

    this.setState({ startIndex, endIndex, slots });
  }

  updateSlotsWithNewProps(startIndex, endIndex, items, slotAssignment) {
    console.log(`updateSlotsWithNewProps: ${startIndex}, ${endIndex}`);
    const slots = this.state.slots.slice();

    // XXX Detect when a slot changes line and don't make it transition (or,
    // actually, make it jump)
    // XXX Stagger transition timing (and probably store transition delay so
    // that if we regenerate we don't cause the transition to jump
    // XXX Also, adjust the easing on the delete animation
    // XXX Drop the console messages
    // XXX Check that perf hasn't regressed
    // XXX Add animation for adding an item
    // XXX Add tests
    // XXX Add test for undo case -- i.e. re-adding an item that is deleting
    // XXX Simplify code

    // Fill in existing items that are still in range
    const existingItems = [];
    for (let i = startIndex; i < endIndex; i++) {
      const existingSlot = slotAssignment[items[i]._id];
      if (typeof existingSlot === 'number') {
        slots[existingSlot] = { index: i };
        existingItems[i] = existingSlot;
        delete slotAssignment[items[i]._id];
      }
    }
    console.log('After filling in existing items we still have the following'
                + ' in the slot assignments '
                + JSON.stringify(slotAssignment));

    // Detect and store any newly-deleted items that would still be in range
    const deletingItems = {};
    for (const [ id, slot ] of Object.entries(slotAssignment)) {
      console.log(`Processing [${JSON.stringify(id)}, ${slot}] from slotAssignment`);
      // Check it is still in range
      const previousIndex = this.state.slots[slot].index;
      console.log(`Previous index was ${previousIndex}`);
      if (previousIndex < startIndex || previousIndex >= endIndex) {
        console.log('No longer in range, skipping');
        continue;
      }

      // Check if it is a deleting item that has finished deleting
      if (typeof previousIndex === 'string' &&
          !this.state.deletingItems[previousIndex]) {
        slots[slot] = null;
        continue;
      }

      // Check if we have already stored this item
      const existingRecord = this.state.deletingItems[id];
      if (existingRecord) {
        console.log('Found an existing record, copying');
        console.log(`Existing record: ${JSON.stringify(existingRecord)}`);
        deletingItems[id] = existingRecord;
      // Otherwise store a new record
      } else {
        console.log('Adding new record to deletingItems');
        deletingItems[id] = {
          item: this.props.items[previousIndex],
          index: previousIndex,
        };
        console.log(`deletingItems now: ${JSON.stringify(deletingItems)}`);
      }
      slots[slot] = { index: id };
    }
    console.log(`deletingItems at end: ${JSON.stringify(deletingItems)}`);

    // Collect empty slots
    const emptySlots = [];
    slots.forEach((slot, i) => {
      if (slot === null) {
        emptySlots.push(i);
      } else if (typeof slot.index === 'number' &&
                 (slot.index < startIndex || slot.index >= endIndex)) {
        delete slot.recycled;
        emptySlots.push(i);
      }
    });
    console.log(`emptySlots: ${JSON.stringify(emptySlots)}`);

    // Fill in missing items
    fillInMissingSlots(startIndex, endIndex, emptySlots,
                       existingItems, slots);
    console.log(`Result of fillInMissingSlots(b): ${JSON.stringify(slots)}`);

    this.setState({ startIndex, endIndex, slots, deletingItems });
  }

  render() {
    const containerHeight = this.state.containerHeight === null
                            ? window.innerHeight + 10
                            : this.state.containerHeight;
    const gridStyle = { height: `${containerHeight}px` };
    const scale = `scale(${this.state.itemScale})`;

    return (
      <div
        className={this.props.className}
        ref={this.assignGrid}
        style={gridStyle}>
        <div
          style={{ opacity: 0, pointerEvents: 'none' }}
          ref={this.assignItemTemplate}>
          {this.props.renderTemplateItem()}
        </div>
        {
          this.state.slots.map((data, i) => {
            const classes = [ 'grid-item' ];

            // Skip empty slots caused by deleting items.
            if (!data ||
                (typeof data.index === 'string' &&
                 !this.state.deletingItems[data.index])) {
              return null;
            }

            let item;
            let itemIndex;
            if (typeof data.index === 'string') {
              const deletingRecord = this.state.deletingItems[data.index];
              item = deletingRecord.item;
              itemIndex = deletingRecord.index;
              classes.push('deleting');
            } else {
              item = this.props.items[data.index];
              itemIndex = data.index;
            }

            if (!data.recycled) {
              classes.push('transition');
            }

            const row = Math.floor(itemIndex / this.state.itemsPerRow);
            const col = itemIndex % this.state.itemsPerRow;
            const translate = `translate(${col * this.state.itemWidth}px, ` +
                                        `${row * this.state.itemHeight}px)`;

            return (
              <div
                style={{ transform: `${translate} ${scale}` }}
                className={classes.join(' ')}
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                data-item-id={item._id}>
                <div className="scale-wrapper">
                  {this.props.renderItem(item)}
                </div>
              </div>);
          })
        }
      </div>
    );
  }
}

export default VirtualGrid;
