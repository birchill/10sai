import * as React from 'react';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';

import * as Actions from '../actions';
import { Link } from './Link';
import { Omit } from '../utils/type-helpers';

interface Props {
  active: boolean;
  currentScreenLink: string;
  children?: React.ReactElement<any>;
}

interface PropsInner extends Props {
  onClose: () => void;
}

class PopupInner extends React.PureComponent<PropsInner> {
  private popupRef: React.RefObject<HTMLElement>;
  private previousFocus: Element | null;

  constructor(props: PropsInner) {
    super(props);

    this.popupRef = React.createRef<HTMLElement>();
    this.previousFocus = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    if (this.props.active) {
      this.activatePopup();
    }
  }

  componentDidUpdate(previousProps: PropsInner) {
    if (previousProps.active === this.props.active) {
      return;
    }

    if (this.props.active) {
      this.activatePopup();
    } else {
      this.deactivatePopup();
    }
  }

  componentWillUnmount() {
    if (this.props.active) {
      this.deactivatePopup();
    }
  }

  activatePopup() {
    this.previousFocus = document.activeElement;
    if (this.popupRef.current) {
      this.popupRef.current.focus();
    }
    document.addEventListener('keydown', this.handleKeyDown);
  }

  deactivatePopup() {
    if (
      this.previousFocus &&
      typeof (this.previousFocus as any).focus === 'function'
    ) {
      (this.previousFocus as any).focus();
      this.previousFocus = null;
    }
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.props.onClose();
    }
  }

  render() {
    // We should use the new fragment syntax here but something in our toolchain
    // doesn't support it yet.
    return (
      <div className="pop-up" hidden={!this.props.active}>
        <div
          className="overlay"
          onClick={this.props.onClose}
          role="presentation"
        />
        <section
          className="content popup-panel"
          role="dialog"
          ref={this.popupRef}
        >
          <Link
            href={this.props.currentScreenLink}
            className="close close-button"
            direction="backwards"
          >
            Close
          </Link>
          {this.props.children}
        </section>
      </div>
    );
  }
}

type DispatchProps = Omit<PropsInner, keyof Props>;

const mapDispatchToProps = (
  dispatch: Dispatch<Actions.Action>,
  ownProps: Props
) => ({
  onClose: () => {
    dispatch(Actions.followLink(ownProps.currentScreenLink, 'backwards'));
  },
});

export const Popup = connect<{}, DispatchProps, Props>(
  undefined,
  mapDispatchToProps
)(PopupInner);
