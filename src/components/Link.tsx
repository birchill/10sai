import * as React from 'react';
import * as PropTypes from 'prop-types';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import { Overwrite } from '../utils/type-helpers';
import * as Actions from '../actions';

// This function is copied from react-router.
const isModifiedEvent = (evt: React.MouseEvent<HTMLAnchorElement>) =>
  !!(evt.metaKey || evt.altKey || evt.ctrlKey || evt.shiftKey);

interface LocalProps {
  href: string;
  direction?: 'backwards' | 'replace' | 'forwards';
  onClick?: (href: string) => void;
  active?: boolean;
}

type Props = Overwrite<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  LocalProps
>;

interface DefaultProps {
  direction: 'forwards';
}

class LinkInner extends React.PureComponent<Props> {
  static get defaultProps(): DefaultProps {
    return {
      direction: 'forwards',
    };
  }

  constructor(props: Props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Ignore the event if...
    if (
      e.button !== 0 || // ... it's a right-click
      isModifiedEvent(e)
    ) {
      // ... it's a ctrl-click etc.
      return;
    }

    if (this.props.onClick) {
      this.props.onClick(this.props.href);
    }

    e.preventDefault();
  }

  render() {
    const { href, active, ...rest } = this.props;
    return (
      <a href={href} {...rest} onClick={this.handleClick}>
        {this.props.children}
      </a>
    );
  }
}

interface DispatchProps {
  onClick: (href: string) => void;
}

const mapDispatchToProps = (
  dispatch: Dispatch<Actions.Action>,
  props: Props
): DispatchProps => ({
  onClick: (href: string) => {
    dispatch(Actions.followLink(href, props.direction, props.active));
  },
});

type ParentProps = Overwrite<
  Props,
  {
    onClick?: (href: string, originalHandler: (href: string) => void) => void;
  }
>;

const mergeProps = (
  stateProps: never,
  dispatchProps: DispatchProps,
  ownProps: ParentProps
): Props => {
  // If the component has its own 'onClick' prop, then use that and pass the
  // default implementation (from |dispatchProps|) as an argument to it.
  const onClickWrapper = ownProps.onClick
    ? {
        onClick: (href: string) =>
          ownProps.onClick!(href, dispatchProps.onClick.bind(this, href)),
      }
    : undefined;
  return Object.assign({}, ownProps, stateProps, dispatchProps, onClickWrapper);
};

export const Link = connect(
  null,
  mapDispatchToProps,
  mergeProps
)(LinkInner);
