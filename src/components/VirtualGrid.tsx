import * as React from 'react';

// Danger, danger
//
// This is probably the most complex component in the project at the time of
// writing. It was one of the first written and was written in JS (not TS)
// initially. It is probably much more complex than it needs to be and I've
// probably introduced all sorts of bugs while converting it to TS.
//
// At some point it could probably benefit from a rewrite or at least
// a significant tidy up but for now it seems to work.

interface Item {
  _id: string;
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

interface Props {
  items: Array<Item>;
  renderItem: (item: Item) => React.ReactNode;
  renderTemplateItem: () => React.ReactNode;
  className?: string;
}

interface Layout {
  itemWidth: number | null;
  itemHeight: number | null;
  itemsPerRow: number;
  itemScale: number;
  containerHeight: number | null;
}

interface Slot {
  index: number | string;
  added?: boolean;
  recycled?: boolean;
  changedRow?: boolean;
  transitionDelay?: number;
}

type DeletingItems = { [key: string]: { index: number; item: Item } };

interface State extends Layout {
  startIndex: number;
  endIndex: number;

  // |slots| is an array mapping the index of rendered items
  // to items in props.items so that we consistently render the
  // same item using the same DOM elements to avoid unnecessary
  // DOM surgery.
  //
  // String indices indicate items that have been deleted but
  // are still animating and are stored in this.state.deletingItems.
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
  // props.items[31] and finally state.deletingItems['abcdef'].item.
  slots: Array<Slot | null>;

  // Items that have been deleted from props.items but
  // which are still animating. The data needed to render them
  // while animating is stored here, indexed by _id.
  deletingItems: DeletingItems;
}

type SlotAssignment = { [id: string]: number };

export class VirtualGrid extends React.Component<Props, State> {
  state: State;

  private gridRef: React.RefObject<HTMLDivElement>;
  private templateItem: HTMLDivElement | null;
  private scrollContainer: HTMLElement | null;

  constructor(props: Props) {
    super(props);
    this.state = {
      itemWidth: null,
      itemHeight: null,
      itemsPerRow: 1,
      itemScale: 1,
      startIndex: 0,
      endIndex: 0,
      containerHeight: null,
      slots: [],
      deletingItems: {},
    };

    this.gridRef = React.createRef<HTMLDivElement>();

    // Event callbacks
    this.handleResize = this.handleResize.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleTransitionEnd = this.handleTransitionEnd.bind(this);
    this.setTemplateItemRef = this.setTemplateItemRef.bind(this);
  }

  // We use a callback ref for this since we don't want to call
  // `getScrollContainer` unless the ref changes since it flushes layout.
  setTemplateItemRef(elem: HTMLDivElement | null) {
    this.templateItem = elem;
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    }
    this.scrollContainer = getScrollContainer(elem);
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', this.handleScroll);
    }
  }

  componentDidMount() {
    if (this.gridRef.current) {
      this.gridRef.current.addEventListener(
        'transitionend',
        this.handleTransitionEnd
      );
    }

    const layout = this.updateLayout();
    this.updateVisibleRange(layout);
    window.addEventListener('resize', this.handleResize);
  }

  componentWillReceiveProps(nextProps: Props) {
    // This is a new render cycle, so reset the render depth.
    layoutRenderDepth = 0;

    let needsRangeUpdate = false;

    // The only thing the can trigger a change to layout is a change in the
    // number of items.
    let layout: Layout | null = null;
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
      const slotAssignment: SlotAssignment = {};
      this.state.slots.forEach((data: Slot, i: number) => {
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
    // Update event listeners
    if (this.gridRef.current) {
      this.gridRef.current.addEventListener(
        'transitionend',
        this.handleTransitionEnd
      );
    }

    // Drop the '-adding' class from any items added on the last render so that
    // they transition.
    if (this.gridRef.current) {
      const addedItems = this.gridRef.current.querySelectorAll('.item.-adding');
      // If we have items, force a style flush so that transitions run
      if (addedItems.length) {
        // eslint-disable-next-line no-unused-expressions
        getComputedStyle(this.gridRef.current).backgroundColor;
      }
      [].forEach.call(addedItems, (item: HTMLElement) => {
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
    if (this.gridRef.current) {
      this.gridRef.current.removeEventListener(
        'transitionend',
        this.handleTransitionEnd
      );
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

  handleTransitionEnd(evt: TransitionEvent) {
    // Ignore transitions on the outer element (since they are the translation
    // transitions).
    if (
      !(evt.target as HTMLElement).classList.contains('scalewrapper') ||
      evt.propertyName !== 'transform'
    ) {
      return;
    }

    // Check if we have already deleted this item
    const gridItem = getInclusiveAncestorWithClass(
      evt.target as Element,
      'item'
    );
    if (!gridItem) {
      return;
    }
    const deletedId = (gridItem as HTMLElement).dataset.itemId as string;
    if (!this.state.deletingItems[deletedId]) {
      return;
    }

    // Drop from deletingItems
    // (We're basically doing an immutable delete here since immutability-helper
    // doesn't provide this and we don't quite need Immutable.js yet)
    const deletingItems = Object.entries(this.state.deletingItems).reduce(
      (
        result: DeletingItems,
        [id, item]: [string, { index: number; item: Item }]
      ) => {
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
  // Returns the updated layout if it changed, null otherwise.
  updateLayout(nextItems?: Array<Item>): Layout | null {
    if (!this.gridRef.current || !this.templateItem) {
      layoutRenderDepth = 0;
      return null;
    }

    // Detect possible infinite layout behavior
    if (layoutRenderDepth > 2) {
      layoutRenderDepth = 0;
      return null;
    }

    const items = nextItems || this.props.items;

    if (!items.length) {
      if (this.state.containerHeight === 0) {
        layoutRenderDepth = 0;
        return null;
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
    const gridWidth = this.gridRef.current.offsetWidth;
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
      return null;
    }

    layoutRenderDepth++;
    const layout: Layout = {
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
  updateVisibleRange(
    nextLayout?: Layout | null,
    nextItems?: Array<Item>,
    slotAssignment?: SlotAssignment
  ) {
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

    let startIndex: number;
    let endIndex: number;

    if (this.scrollContainer) {
      // Calculate visible height
      const upperBound = Math.max(
        this.scrollContainer.scrollTop - this.gridRef.current!.offsetTop,
        0
      );
      const lowerBound =
        this.scrollContainer.offsetHeight -
        this.gridRef.current!.offsetTop +
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

  updateSlots(startIndex: number, endIndex: number) {
    const slots = this.state.slots.slice();

    // Collect empty and existing slots
    const emptySlots: Array<number> = [];
    const existingItems: Array<number> = [];
    slots.forEach((data, i) => {
      if (data === null || data.index < startIndex || data.index >= endIndex) {
        emptySlots.push(i);
      } else if (
        typeof data.index === 'string' &&
        !this.state.deletingItems[data.index]
      ) {
        slots[i] = null;
        emptySlots.push(i);
      } else if (typeof data.index === 'number') {
        delete data.recycled;
        delete data.added;
        existingItems[data.index] = i;
      } else {
        console.error(
          'Got a string index but the item was not found in deletingItems'
        );
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

  updateSlotsWithNewProps(
    startIndex: number,
    endIndex: number,
    items: Array<Item>,
    slotAssignment: SlotAssignment,
    layout: Layout
  ) {
    const slots = this.state.slots.slice();

    // Fill in existing items that are still in range
    const existingItems: Array<number> = [];
    let hasMovedItems = false;
    for (let i = startIndex; i < endIndex; i++) {
      const existingSlot = slotAssignment[items[i]._id];
      if (typeof existingSlot === 'number') {
        const existingRow = Math.floor(
          (slots[existingSlot]!.index as number) / layout.itemsPerRow
        );
        const newRow = Math.floor(i / layout.itemsPerRow);
        slots[existingSlot] = { index: i };
        if (existingRow !== newRow) {
          slots[existingSlot]!.changedRow = true;
        }
        existingItems[i] = existingSlot;
        hasMovedItems = true;
        delete slotAssignment[items[i]._id];
      }
    }

    // Detect and store any newly-deleted items that would still be in range
    const deletingItems: DeletingItems = {};
    let firstDeletion: number | undefined;
    for (const [id, slot] of Object.entries(slotAssignment)) {
      // Check it is still in range
      const previousIndex = this.state.slots[slot]!.index;
      // Take special care of the case where we deleted an item that is now out
      // of range because we clamp endIndex to the number of items.
      const inDeletedRange =
        previousIndex >= items.length && endIndex === items.length;
      if (
        !inDeletedRange &&
        (previousIndex < startIndex || previousIndex >= endIndex)
      ) {
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
        // By this point previousIndex must be a number or else we would have
        // either returned early or entered the branch above.
        deletingItems[id] = {
          item: this.props.items[previousIndex as number],
          index: previousIndex as number,
        };
        firstDeletion = definedMin(firstDeletion, previousIndex as number);
      }
      slots[slot] = { index: id };
    }

    // Collect empty slots
    const emptySlots: Array<number> = [];
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
    if (typeof firstChange !== 'undefined') {
      const deleteDur = typeof firstDeletion === 'undefined' ? 0 : 0.2;
      const moveDur = hasMovedItems ? 0.2 : 0;
      for (const slot of slots) {
        if (
          slot === null ||
          typeof slot.index !== 'number' ||
          slot.index < firstChange
        ) {
          continue;
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
      }
    }

    this.setState({ startIndex, endIndex, slots, deletingItems });
  }

  render() {
    const containerHeight =
      this.state.containerHeight === null
        ? window.innerHeight + 10
        : this.state.containerHeight;
    const gridStyle: React.CSSProperties = { height: `${containerHeight}px` };
    const scale = `scale(${this.state.itemScale})`;

    return (
      <div
        className={`${this.props.className || ''} virtual-grid`}
        ref={this.gridRef}
        style={gridStyle}
      >
        <div
          style={{ opacity: 0, pointerEvents: 'none' }}
          ref={this.setTemplateItemRef}
        >
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

          let item: Item;
          let itemIndex: number;
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
            `translate(${col * this.state.itemWidth!}px, ` +
            `${row * this.state.itemHeight!}px)`;
          const styles: React.CSSProperties = {
            transform: `${translate} ${scale}`,
          };
          if (data.transitionDelay) {
            styles.transitionDelay = data.transitionDelay + 's';
          }

          return (
            <div
              style={styles}
              className={classes.join(' ')}
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              data-item-id={item._id}
            >
              <div className="scalewrapper">{this.props.renderItem(item)}</div>
            </div>
          );
        })}
      </div>
    );
  }
}

function getScrollContainer(elem: Element | null): HTMLElement | null {
  if (elem === null) {
    return null;
  }

  // The + 1 is a fudge factor needed for Chrome on Linux.
  return elem instanceof HTMLElement &&
    elem.scrollHeight > elem.clientHeight + 1
    ? elem
    : getScrollContainer(elem.parentElement);
}

function getInclusiveAncestorWithClass(
  elem: Element | null,
  className: string
) {
  while (elem && !elem.classList.contains(className)) {
    elem = elem.parentElement;
  }
  return elem;
}

const enum FillMode {
  Add,
  Fill,
}

function fillInMissingSlots(
  startIndex: number,
  endIndex: number,
  emptySlots: Array<number>,
  existingItems: Array<number>,
  slots: Array<Slot | null>,
  fillMode: FillMode
) {
  let firstAddition: number | undefined;

  for (let i = startIndex; i < endIndex; i++) {
    // Check if the item is already assigned a slot
    if (typeof existingItems[i] === 'number') {
      continue;
    }

    if (typeof firstAddition === 'undefined') {
      firstAddition = i;
    }

    const entry: Slot = { index: i };
    if (fillMode === FillMode.Add) {
      entry.added = true;
    }

    // Otherwise take the first empty slot
    if (emptySlots.length) {
      const emptyIndex = emptySlots.shift() as number;
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
function definedMin(
  a: number | undefined,
  b: number | undefined
): number | undefined {
  if (typeof a === 'undefined') {
    return b;
  }
  if (typeof b === 'undefined') {
    return a;
  }
  return Math.min(a, b);
}

export default VirtualGrid;
