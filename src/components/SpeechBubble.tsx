import * as React from 'react';
import * as ReactDOM from 'react-dom';

export interface Props {
  className?: string;

  // Physical position of the arrow point.
  //
  // This is typically calculated by AnchoredSpeechBubble which takes care to
  // respect RTL mode etc.
  left: number;
  top: number;

  // Physical horizontal position of the arrow with regards to the panel.
  arrowPosition: 'left' | 'center' | 'right';
  arrowSide: 'top' | 'bottom';

  // Is the speech bubble visible?
  visible?: boolean;

  // Called whenever the menu is visible and we get a click outside of the panel
  // area. This is useful for closing the speech bubble whenever there is
  // a click anywhere else in the panel.
  //
  // If the panel is closed by clicking, e.g. a button outside the menu, then it
  // so happens that we won't end up calling this (due to the way we unregister
  // the event listener). This wasn't intended at first but proves to be useful
  // so we've kept it.
  onClickOutside?: (evt: MouseEvent) => void;

  // Called whenever there is a keydown event that is not default prevented
  // while the menu is in focus. This too is useful for closing the menu when
  // the user presses some other keystroke.
  onUnhandledKeyPress?: (evt: React.KeyboardEvent<{}>) => void;
}

export interface SpeechBubbleInterface {
  bbox: ClientRect | null;
  left: number;
  arrowPosition: 'left' | 'center' | 'right';
}

const SpeechBubbleImpl: React.FC<Props> = (props, ref) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const arrowRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const visible = typeof props.visible === 'undefined' || props.visible;

  // Fade in/out
  //
  // (We need to use a layout effect since otherwise we get flicker in the
  // transitions.)
  React.useLayoutEffect(() => {
    if (containerRef.current) {
      const containerElem = containerRef.current;
      if (!visible) {
        containerElem.classList.add('-fadeout');
        containerElem.addEventListener(
          'transitionend',
          () => {
            containerElem.classList.remove('-fadeout');
          },
          { once: true }
        );
      } else {
        containerElem.classList.add('-fadein');
        getComputedStyle(containerElem).opacity;
        containerElem.classList.remove('-fadein');
      }
    }
  }, [props.visible]);

  // Listen for clicks outside the menu while it is open
  React.useLayoutEffect(() => {
    const handleWindowClick = (evt: MouseEvent) => {
      if (!props.onClickOutside || !containerRef.current) {
        return;
      }

      if (evt.target && !containerRef.current.contains(evt.target as Node)) {
        props.onClickOutside(evt);
      }
    };

    if (visible) {
      // We register the click handler on the window but if this render was
      // triggered as part of a click event we can still end up calling
      // 'handleWindowClick' for _this_ event so we need to spin the event
      // loop first.
      setTimeout(() => {
        window.addEventListener('click', handleWindowClick);
      }, 0);
    } else {
      window.removeEventListener('click', handleWindowClick);
    }

    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, [props.visible, props.onClickOutside]);

  // Keypresses not handled by the panel's contents
  const onKeyDown = React.useCallback(
    (evt: React.KeyboardEvent<HTMLDivElement>) => {
      if (evt.defaultPrevented) {
        return;
      }

      if (props.onUnhandledKeyPress) {
        props.onUnhandledKeyPress(evt);
      }
    },
    [props.onUnhandledKeyPress]
  );

  // Public properties
  React.useImperativeHandle(
    ref,
    () => ({
      get bbox(): ClientRect | null {
        if (!containerRef.current) {
          return null;
        }

        return containerRef.current.getBoundingClientRect();
      },
      left: props.left,
      arrowPosition: props.arrowPosition,
    }),
    [props.left, props.arrowPosition]
  );

  const { containerLeft, containerTop, arrowLeft } = getPosition(
    props,
    arrowRef,
    panelRef
  );

  const containerStyle = {
    left: `${containerLeft}px`,
    top: `${containerTop}px`,
  };

  const arrowStyle = {
    left: `${arrowLeft - containerLeft}px`,
  };

  const classes = ['speech-bubble'];
  classes.push(props.arrowSide === 'top' ? '-bottom' : '-top');
  if (props.className) {
    classes.push(...props.className.split(' '));
  }

  return ReactDOM.createPortal(
    <div
      className={classes.join(' ')}
      style={containerStyle}
      ref={containerRef}
      hidden={!visible}
      onKeyDown={onKeyDown}
    >
      <div className="panel" ref={panelRef}>
        {props.children}
      </div>
      <div className="arrow" style={arrowStyle} ref={arrowRef} />
    </div>,
    getLayerElem()
  );
};

function getLayerElem(): HTMLElement {
  let layer = document.getElementById('speech-bubbles');
  if (!layer) {
    const parent = document.body || document.documentElement;
    layer = document.createElement('div');
    layer.setAttribute('id', 'speech-bubbles');
    parent.appendChild(layer);
  }

  return layer;
}

function getPosition(
  props: Props,
  arrowRef: React.RefObject<HTMLDivElement>,
  panelRef: React.RefObject<HTMLDivElement>
): {
  containerLeft: number;
  containerTop: number;
  arrowLeft: number;
} {
  if (!arrowRef.current || !panelRef.current) {
    return {
      containerLeft: props.left,
      containerTop: props.top,
      arrowLeft: props.left,
    };
  }

  // Get arrow dimensions
  const arrowElem = arrowRef.current;
  const arrowWidth =
    parseFloat(getComputedStyle(arrowElem).getPropertyValue('--arrow-width')) +
    parseFloat(getComputedStyle(arrowElem).getPropertyValue('--shadow-radius'));
  const arrowMargin = parseFloat(
    getComputedStyle(arrowElem).getPropertyValue('--arrow-margin')
  );

  // Calculate horizontal position
  const arrowLeft = props.left - arrowWidth / 2;
  const panelElem = panelRef.current;
  let containerLeft: number;
  switch (props.arrowPosition) {
    case 'left':
      containerLeft = arrowLeft - arrowMargin;
      break;

    case 'center':
      {
        const viewport = document.documentElement.getBoundingClientRect();
        const panelWidth = panelElem.getBoundingClientRect().width;
        // See comment in AnchoredSpeechBubble for why we do this adjustment
        // here.
        containerLeft = Math.max(
          0,
          Math.min(viewport.width - panelWidth, props.left - panelWidth / 2)
        );
      }
      break;

    case 'right':
      containerLeft =
        props.left -
        panelElem.getBoundingClientRect().width +
        arrowWidth / 2 +
        arrowMargin;
      break;
  }

  // Calculate the vertical position
  let containerTop: number;
  switch (props.arrowSide) {
    case 'top':
      containerTop = props.top;
      break;

    case 'bottom':
      containerTop =
        props.top - panelElem.getBoundingClientRect().height - arrowWidth / 2;
      break;
  }

  return {
    containerLeft: containerLeft!,
    containerTop: containerTop!,
    arrowLeft,
  };
}

export const SpeechBubble = React.forwardRef<SpeechBubbleInterface, Props>(
  SpeechBubbleImpl
);
