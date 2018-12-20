import * as React from 'react';
import * as PropTypes from 'prop-types';

interface Props {
  className?: string;
  active?: number;
  children: Array<React.ReactElement<any>>;
}

export class TabBlock extends React.Component<Props> {
  static get propTypes() {
    return {
      className: PropTypes.string,
      active: PropTypes.number,
      children: PropTypes.arrayOf(PropTypes.element),
    };
  }

  static renderChild(child: React.ReactElement<any>, isActive: boolean) {
    let className = 'tab-item';
    if (isActive) {
      className += ' -active';
    }
    return (
      <li className={className} role="presentation">
        {React.cloneElement(child, { role: 'tab', 'aria-selected': isActive })}
      </li>
    );
  }

  highlightBarRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);
    this.highlightBarRef = React.createRef<HTMLDivElement>();
  }

  getSnapshotBeforeUpdate(previousProps: Props): null {
    // If we are going from inactive to active we need to make sure the
    // underlying transform has the correct translation so that only the scale
    // transitions.
    if (
      typeof previousProps.active === 'undefined' &&
      typeof this.props.active !== 'undefined' &&
      this.highlightBarRef.current
    ) {
      // Don't transition from whatever underlying 'transform' style we set when
      // we went inactive.
      this.highlightBarRef.current.style.transitionProperty = 'none';
      this.highlightBarRef.current.style.transformOrigin = `${100 *
        this.props.active +
        50}%`;
      this.highlightBarRef.current.style.transform = `scale(0, 1) translate(${100 *
        this.props.active}%)`;

      // Flush the old style
      getComputedStyle(this.highlightBarRef.current).transform;

      // Re-enable transitions
      this.highlightBarRef.current.style.transitionProperty = 'transform';
    }

    return null;
  }

  componentDidUpdate(prevProps: Props) {
    // If we are going from active to inactive we need to make sure the
    // transition endpoint has the correct translation so that only the scale
    // transitions.
    if (
      typeof this.props.active === 'undefined' &&
      typeof prevProps.active !== 'undefined' &&
      this.highlightBarRef.current
    ) {
      this.highlightBarRef.current.style.transformOrigin = `${100 *
        prevProps.active +
        50}%`;
      this.highlightBarRef.current.style.transform = `scale(0, 1) translate(${100 *
        prevProps.active}%)`;
    }
  }

  render() {
    const highlightStyle: Partial<React.CSSProperties> = {
      width: `${100 / React.Children.count(this.props.children)}%`,
    };
    if (typeof this.props.active !== 'undefined') {
      highlightStyle.transform = `scale(1, 1) translate(${100 *
        this.props.active}%)`;
    }

    return (
      <ul role="tablist" className={`${this.props.className || ''} tab-block`}>
        {React.Children.map(
          this.props.children,
          (child: React.ReactElement<any>, index: number) =>
            TabBlock.renderChild(child, index === this.props.active)
        )}
        <div
          className="highlight-bar"
          style={highlightStyle}
          role="presentation"
          ref={this.highlightBarRef}
        />
      </ul>
    );
  }
}
