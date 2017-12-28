import React from 'react';
import PropTypes from 'prop-types';

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

const FillMode = {
  Add: Symbol('Add'),
  Fill: Symbol('Fill'),
};

function fillInMissingSlots(
  startIndex,
  endIndex,
  emptySlots,
  existingItems,
  slots,
  fillMode
) {
  let firstAddition;

  for (let i = startIndex; i < endIndex; i++) {
    // Check if the item is already assigned a slot
    if (typeof existingItems[i] === 'number') {
      continue;
    }

    if (typeof firstAddition === 'undefined') {
      firstAddition = i;
    }

    const entry = { index: i };
    if (fillMode === FillMode.Add) {
      entry.added = true;
    }

    // Otherwise take the first empty slot
    if (emptySlots.length) {
      const emptyIndex = emptySlots.shift();
      entry.recycled = true;
      slots[emptyIndex] = entry;
    } else {
      slots.push(entry);
    }
  }

  return firstAddition;
}

// Returns the minimum of |a| and |b| such that undefined is treated as
// Infinity.
function definedMin(a, b) {
  if (typeof a === 'undefined') {
    return b;
  }
  if (typeof b === 'undefined') {
    return a;
  }
  return Math.min(a, b);
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
      items: PropTypes.arrayOf(
        PropTypes.shape({
          _id: PropTypes.string.isRequired,
        })
      ).isRequired,
      renderItem: PropTypes.func.isRequired,
      renderTemplateItem: PropTypes.func.isRequired,
      className: PropTypes.string,
    };
  }

  constructor(props) {
    super(props);
    this.state = {
      itemWidth: null,
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
      deletingItems: {},
    };

    // Ref callbacks
    this.assignGrid = elem => {
      this.grid = elem;
      if (this.grid) {
        this.grid.addEventListener('transitionend', this.handleTransitionEnd);
      }
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
    // Drop the '-adding' class from any items added on the last render so that
    // they transition.
    if (this.grid) {
      const addedItems = this.grid.querySelectorAll('.item.-adding');
      // If we have items, force a style flush so that transitions run
      if (addedItems.length) {
        // eslint-disable-next-line no-unused-expressions
        getComputedStyle(this.grid).backgroundColor;
      }
      [].forEach.call(addedItems, item => {
        item.classList.remove('-adding');
      });
    }

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
    if (
      !evt.target.classList.contains('scalewrapper') ||
      evt.propertyName !== 'transform'
    ) {
      return;
    }

    // Check if we have already deleted this item
    const gridItem = getInclusiveAncestorWithClass(evt.target, 'item');
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
    const deletingItems = Object.entries(this.state.deletingItems).reduce(
      (result, entry) => {
        const [id, item] = entry;
        if (id !== deletedId) {
          result[id] = item;
        }
        return result;
      },
      {}
    );

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
      return {
        itemWidth: null,
        itemHeight: null,
        itemsPerRow: 1,
        itemScale: 1,
        containerHeight: 0,
      };
    }

    // We want to be able to define the item size using the stylesheet (e.g.
    // so we can use media queries to change the size) but, at the same time,
    // we assume all items are the same size since that allows us to optimize
    // the layout to only produce a limited set of DOM nodes.
    // To do that we use a representative template item to get the initial size.

    const bbox = this.templateItem.getBoundingClientRect();
    let itemWidth = bbox.width;
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

    itemWidth = Math.floor(itemWidth * itemScale);
    itemHeight = Math.floor(itemHeight * itemScale);

    const containerHeight = Math.ceil(items.length / itemsPerRow) * itemHeight;

    if (
      this.state.itemsPerRow === itemsPerRow &&
      this.state.itemWidth === itemWidth &&
      this.state.itemHeight === itemHeight &&
      this.state.itemScale === itemScale &&
      this.state.containerHeight === containerHeight
    ) {
      layoutRenderDepth = 0;
      return false;
    }

    layoutRenderDepth++;
    const layout = {
      itemsPerRow,
      itemWidth,
      itemHeight,
      itemScale,
      containerHeight,
    };
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
    const layout = nextLayout || {
      itemWidth: this.state.itemWidth,
      itemHeight: this.state.itemHeight,
      itemsPerRow: this.state.itemsPerRow,
      itemScale: this.state.itemScale,
      containerHeight: this.state.containerHeight,
    };
    // We haven't finished doing the initial layout yet
    if (!layout.itemWidth || !layout.itemHeight) {
      return;
    }

    const items = nextItems || this.props.items;

    let startIndex;
    let endIndex;

    if (this.scrollContainer) {
      // Calculate visible height
      const upperBound = Math.max(
        this.scrollContainer.scrollTop - this.grid.offsetTop,
        0
      );
      const lowerBound =
        this.scrollContainer.offsetHeight -
        this.grid.offsetTop +
        this.scrollContainer.scrollTop;

      const firstVisibleRow = Math.floor(upperBound / layout.itemHeight);
      const lastVisibleRow = Math.ceil(lowerBound / layout.itemHeight);

      startIndex = firstVisibleRow * layout.itemsPerRow;
      endIndex = Math.min(
        (lastVisibleRow + 1) * layout.itemsPerRow,
        items.length
      );
    } else {
      // No scroll container? All the items must be visible, I guess.
      startIndex = 0;
      endIndex = items.length;
    }

    if (
      !slotAssignment &&
      this.state.startIndex === startIndex &&
      this.state.endIndex === endIndex
    ) {
      return;
    }

    // Update slots
    if (slotAssignment) {
      this.updateSlotsWithNewProps(
        startIndex,
        endIndex,
        items,
        slotAssignment,
        layout
      );
    } else {
      this.updateSlots(startIndex, endIndex);
    }
  }

  updateSlots(startIndex, endIndex) {
    const slots = this.state.slots.slice();

    // Collect empty and existing slots
    const emptySlots = [];
    const existingItems = [];
    slots.forEach((data, i) => {
      if (data === null || data.index < startIndex || data.index >= endIndex) {
        emptySlots.push(i);
      } else if (
        typeof data.index === 'string' &&
        !this.state.deletingItems[data.index]
      ) {
        slots[i] = null;
        emptySlots.push(i);
      } else {
        delete data.recycled;
        delete data.added;
        existingItems[data.index] = i;
      }
    });

    // Fill in items in missing slots
    fillInMissingSlots(
      startIndex,
      endIndex,
      emptySlots,
      existingItems,
      slots,
      FillMode.Fill
    );

    this.setState({ startIndex, endIndex, slots });
  }

  updateSlotsWithNewProps(startIndex, endIndex, items, slotAssignment, layout) {
    const slots = this.state.slots.slice();

    // Fill in existing items that are still in range
    const existingItems = [];
    let hasMovedItems = false;
    for (let i = startIndex; i < endIndex; i++) {
      const existingSlot = slotAssignment[items[i]._id];
      if (typeof existingSlot === 'number') {
        const existingRow = Math.floor(
          slots[existingSlot].index / layout.itemsPerRow
        );
        const newRow = Math.floor(i / layout.itemsPerRow);
        slots[existingSlot] = { index: i };
        if (existingRow !== newRow) {
          slots[existingSlot].changedRow = true;
        }
        existingItems[i] = existingSlot;
        hasMovedItems = true;
        delete slotAssignment[items[i]._id];
      }
    }

    // Detect and store any newly-deleted items that would still be in range
    const deletingItems = {};
    let firstDeletion;
    for (const [id, slot] of Object.entries(slotAssignment)) {
      // Check it is still in range
      const previousIndex = this.state.slots[slot].index;
      if (previousIndex < startIndex || previousIndex >= endIndex) {
        continue;
      }

      // Check if it is a deleting item that has finished deleting
      if (
        typeof previousIndex === 'string' &&
        !this.state.deletingItems[previousIndex]
      ) {
        slots[slot] = null;
        continue;
      }

      // Check if we have already stored this item
      const existingRecord = this.state.deletingItems[id];
      if (existingRecord) {
        deletingItems[id] = existingRecord;
        // Otherwise store a new record
      } else {
        deletingItems[id] = {
          item: this.props.items[previousIndex],
          index: previousIndex,
        };
        firstDeletion = definedMin(firstDeletion, previousIndex);
      }
      slots[slot] = { index: id };
    }

    // Collect empty slots
    const emptySlots = [];
    slots.forEach((slot, i) => {
      if (slot === null) {
        emptySlots.push(i);
      } else if (
        typeof slot.index === 'number' &&
        (slot.index < startIndex || slot.index >= endIndex)
      ) {
        delete slot.recycled;
        delete slot.added;
        emptySlots.push(i);
      }
    });

    // Fill in missing items
    const firstAddition = fillInMissingSlots(
      startIndex,
      endIndex,
      emptySlots,
      existingItems,
      slots,
      FillMode.Add
    );

    // Schedule transitions
    const firstChange = definedMin(firstDeletion, firstAddition);
    if (firstChange !== Infinity) {
      const deleteDur = typeof firstDeletion === 'undefined' ? 0 : 0.2;
      const moveDur = hasMovedItems ? 0.2 : 0;
      slots.forEach(slot => {
        if (
          !slot ||
          typeof slot.index !== 'number' ||
          slot.index < firstChange
        ) {
          return;
        }

        if (slot.added) {
          // Randomize reveal transitions
          slot.transitionDelay = deleteDur + moveDur + Math.random() * 0.3;
        } else {
          // Stagger move transitions by a decreasing amount
          const dist = Math.max(slot.index - firstChange, 0);
          slot.transitionDelay =
            deleteDur + moveDur * (1 - 1 / Math.pow(1.1, dist));
        }
      });
    }

    this.setState({ startIndex, endIndex, slots, deletingItems });
  }

  render() {
    const containerHeight =
      this.state.containerHeight === null
        ? window.innerHeight + 10
        : this.state.containerHeight;
    const gridStyle = { height: `${containerHeight}px` };
    const scale = `scale(${this.state.itemScale})`;

    return (
      <div
        className={`${this.props.className || ''} virtual-grid`}
        ref={this.assignGrid}
        style={gridStyle}>
        <div
          style={{ opacity: 0, pointerEvents: 'none' }}
          ref={this.assignItemTemplate}>
          {this.props.renderTemplateItem()}
        </div>
        {this.state.slots.map((data, i) => {
          const classes = ['item'];

          // Skip empty slots caused by deleting items.
          if (
            !data ||
            (typeof data.index === 'string' &&
              !this.state.deletingItems[data.index])
          ) {
            return null;
          }

          let item;
          let itemIndex;
          if (typeof data.index === 'string') {
            const deletingRecord = this.state.deletingItems[data.index];
            // eslint-disable-next-line prefer-destructuring
            item = deletingRecord.item;
            itemIndex = deletingRecord.index;
            classes.push('-deleting');
          } else {
            item = this.props.items[data.index];
            itemIndex = data.index;
          }
          // XXX item can sometimes be null here

          if (!data.recycled) {
            classes.push('-moving');
          }
          if (data.changedRow) {
            classes.push('-changedrow');
          }
          if (data.added) {
            classes.push('-adding');
          }

          const row = Math.floor(itemIndex / this.state.itemsPerRow);
          const col = itemIndex % this.state.itemsPerRow;
          const translate =
            `translate(${col * this.state.itemWidth}px, ` +
            `${row * this.state.itemHeight}px)`;
          const styles = { transform: `${translate} ${scale}` };
          if (data.transitionDelay) {
            styles.transitionDelay = data.transitionDelay + 's';
          }

          return (
            <div
              style={styles}
              className={classes.join(' ')}
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              data-item-id={item._id}>
              <div className="scalewrapper">{this.props.renderItem(item)}</div>
            </div>
          );
        })}
      </div>
    );
  }
}

export default VirtualGrid;
