import * as React from 'react';
import composeRefs from '@seznam/compose-react-refs';

interface Props {
  hidden: boolean;
  onDrag: (confidence: number) => void;
  onDragEnd: () => void;
  onPassCard: (options: { confidence: number }) => void;
  panelDimensions: { width: number; height: number };
}

const enum DragStage {
  Idle,
  PreDrag,
  Dragging,
}

type DragOrigin = {
  x: number;
  y: number;
};

type DragState =
  | { stage: DragStage.Idle }
  | {
      stage: DragStage.PreDrag;
      origin: DragOrigin;
      timeout: number;
    }
  | { stage: DragStage.Dragging; origin: DragOrigin };

const PassButtonImpl: React.ForwardRefRenderFunction<
  HTMLButtonElement,
  Props
> = (props: Props, ref) => {
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Record the radius of the button face
  const [buttonFaceRadius, setButtonFaceRadius] = React.useState<number>(0);
  const resizeCallback = React.useCallback(() => {
    if (buttonRef.current) {
      const buttonFace = buttonRef.current.querySelector(
        '.buttonface'
      ) as HTMLSpanElement;
      setButtonFaceRadius(parseFloat(getComputedStyle(buttonFace).width) / 2);
    }
  }, [buttonRef.current]);
  React.useLayoutEffect(() => {
    resizeCallback();
    window.addEventListener('resize', resizeCallback);
    return () => {
      window.removeEventListener('resize', resizeCallback);
    };
  }, [resizeCallback]);

  const [dragState, setDragState] = React.useState<DragState>({
    stage: DragStage.Idle,
  });

  const cancelDrag = React.useCallback(() => {
    if (buttonRef.current) {
      buttonRef.current.style.transform = '';
      buttonRef.current.style.filter = '';
      // Animate the reversing
      buttonRef.current.style.transition = 'all 0.4s';

      // Revert the icon state too
      const icon = buttonRef.current.querySelector('.icon') as SVGElement;
      icon.style.transform = '';
      icon.style.marginLeft = '';
      icon.style.transition = 'all 0.4s';
    }

    setDragState({ stage: DragStage.Idle });
    props.onDragEnd();
  }, [buttonRef.current]);

  const onPointerMove = React.useCallback(
    (evt: PointerEvent) => {
      if (dragState.stage === DragStage.Idle) {
        return;
      }

      const { xDistance, yDistance, yPortion, confidence } = getDragMeasures({
        evt,
        dragOrigin: dragState.origin,
        panelDimensions: props.panelDimensions,
      });

      // If we are in the pre-dragging stage and the distance from the origin is
      // more than a few pixels, set the state to dragging.
      if (dragState.stage === DragStage.PreDrag) {
        if (Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2)) > 30) {
          clearTimeout(dragState.timeout);
          setDragState({
            stage: DragStage.Dragging,
            origin: dragState.origin,
          });
          props.onDrag(confidence);
        }
        return;
      }

      // If we are more than half way across the screen, cancel the action.
      if (xDistance < -props.panelDimensions.width / 2) {
        cancelDrag();
        return;
      }

      // Dragging state, update the tooltip.
      props.onDrag(confidence);

      if (!buttonRef.current) {
        return;
      }

      buttonRef.current.style.transform = `translate(${xDistance}px, ${yDistance}px)`;
      // Don't animate the dragging since Gecko seems to flicker when we do this
      buttonRef.current.style.transitionProperty = 'none';

      // Make the color go red / blue based on the vertical position
      let hueRotateAngle;
      if (yPortion > 0) {
        hueRotateAngle = -yPortion * 120;
      } else {
        hueRotateAngle = -yPortion * 100;
      }
      buttonRef.current.style.filter = `hue-rotate(${Math.round(
        hueRotateAngle
      )}deg)`;

      // Rotate or enlarge the icon accordingly
      const icon = buttonRef.current.querySelector('.icon') as SVGElement;
      if (yPortion > 0) {
        icon.style.transform = `rotate(${180 * yPortion}deg)`;
      } else {
        icon.style.transform = `scale(${-2 * yPortion + 1})`;
      }
      // Likewise, don't transition this either
      icon.style.transitionProperty = 'none';

      // If we are dragging away from the left edge, move the thumb towards the
      // middle of the circle.
      if (xDistance < 0) {
        const marginLeft = Math.round(
          Math.min(-0.85 * buttonFaceRadius - xDistance, 0)
        );
        icon.style.marginLeft = `${marginLeft}px`;
      } else {
        icon.style.marginLeft = '';
      }

      // If we are approaching the middle, fade the icon so we know it's about
      // to cancel.
      const quarterWidth = props.panelDimensions.width / 4;
      if (xDistance < -quarterWidth) {
        const fadeAmount = Math.min(
          (-xDistance - quarterWidth) / quarterWidth,
          1
        );
        const opacity = Math.round(100 * (1 - fadeAmount));
        buttonRef.current.style.filter += ` opacity(${opacity}%)`;
      }
    },
    [
      dragState.stage,
      (dragState as any).origin,
      (dragState as any).timeout,
      props.panelDimensions,
      cancelDrag,
    ]
  );

  const onPointerUp = React.useCallback(
    (evt: PointerEvent) => {
      if (dragState.stage === DragStage.PreDrag) {
        self.clearTimeout(dragState.timeout);
      }

      if (dragState.stage === DragStage.Dragging) {
        const { confidence } = getDragMeasures({
          evt,
          dragOrigin: dragState.origin,
          panelDimensions: props.panelDimensions,
        });
        props.onPassCard({ confidence });
      }

      cancelDrag();
    },
    [
      dragState.stage,
      (dragState as any).timeout,
      (dragState as any).origin,
      props.panelDimensions,
      props.onPassCard,
      cancelDrag,
    ]
  );

  const onPointerCancel = React.useCallback(
    (evt: PointerEvent) => {
      if (dragState.stage === DragStage.PreDrag) {
        self.clearTimeout(dragState.timeout);
      }

      cancelDrag();
    },
    [dragState.stage, (dragState as any).timeout, cancelDrag]
  );

  const onPointerDown = React.useCallback(
    (evt: React.PointerEvent<HTMLButtonElement>) => {
      if (evt.button !== 0) {
        return;
      }

      if (props.hidden) {
        return;
      }

      if (dragState.stage !== DragStage.Idle) {
        console.error('Got pointer down while we are dragging?');
        return;
      }

      // Update to dragging state after a moment
      const origin = { x: evt.clientX, y: evt.clientY };
      const timeout = self.setTimeout(() => {
        setDragState({ stage: DragStage.Dragging, origin });
        props.onDrag(1);
      }, 600);

      setDragState({ stage: DragStage.PreDrag, origin, timeout });
    },
    [dragState.stage, props.onDrag, props.hidden]
  );

  React.useEffect(() => {
    if (dragState.stage !== DragStage.Idle) {
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointercancel', onPointerCancel);
    }
    return () => {
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [dragState.stage, onPointerUp, onPointerMove]);

  // We allow the pass button to be dragged around to vary the confidence level.
  // When the user releases it, we'll get a pointerup event and _sometimes_
  // a click event. The click event tends to be fired on desktop platforms but
  // not on mobile, although sometimes it is fired on mobile.
  //
  // We can't ignore the click event entirely, however, since it will be fired
  // when the user activates the pass button via the keyboard (pressing space
  // while it is focussed) or when we press the button without dragging it
  // (since we mostly ignore the event in that case).
  //
  // So we have a situation where we need to handle either case but NOT call
  // `onPassCard` twice when both events are fired.
  //
  // We originally tried to do that by setting an "ignoreClick" flag and
  // clearing it when we next showed the front of a card, but it turns out that
  // we would actually get the following sequence:
  //
  //   - Call onPassCard
  //   - Set ignoreClick = true
  //   - Re-render and reset ignoreClick and re-bind the onClick handler
  //   --> THEN the click event handler would fire (with ignoreClick = false).
  //
  // So instead we simply rely on the fact that there will be a re-render BEFORE
  // we run the click event handler so we can just check inside that handler if
  // we're showing the front of the card or not (and ignore the event if we
  // are).
  const onClick = React.useCallback(
    (evt: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      // Make sure we reset any dragging state in case we fail to get
      // a pointerup event.
      if (dragState.stage === DragStage.PreDrag) {
        self.clearTimeout(dragState.timeout);
      }
      if (dragState.stage !== DragStage.Idle) {
        cancelDrag();
      }

      if (!props.hidden) {
        props.onPassCard({ confidence: 1 });
      }
    },
    [dragState.stage, cancelDrag, props.hidden, props.onPassCard]
  );

  return (
    <button
      className="pass"
      aria-label="Correct"
      tabIndex={props.hidden ? -1 : 0}
      ref={composeRefs(buttonRef, ref)}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      <span className="buttonface">
        <svg className="icon" viewBox="0 0 100 100">
          <title>Pass</title>
          <use width="100" height="100" href="#thumbsup" fill="currentcolor" />
        </svg>
      </span>
    </button>
  );
};

function getDragMeasures({
  evt,
  dragOrigin,
  panelDimensions,
}: {
  evt: PointerEvent;
  dragOrigin: DragOrigin;
  panelDimensions: { width: number; height: number };
}): {
  xDistance: number;
  yDistance: number;
  yPortion: number;
  confidence: number;
} {
  const xDistance = evt.clientX - dragOrigin.x;
  const yDistance = evt.clientY - dragOrigin.y;
  const yRange = panelDimensions.height || 100;
  const yPortion = Math.min(Math.max((yDistance * 2) / yRange, -1), 1);

  // For the confidence, we use linear interpolation for dragging down such
  // that the bottom extent is level 0 (and half-way is half the interval)
  // while when dragging up we use an exponential curve to allow a greater
  // range of values.
  const confidence = yPortion > 0 ? 1 - yPortion : Math.pow(16, -yPortion);

  return { xDistance, yDistance, yPortion, confidence };
}

export const PassButton = React.forwardRef<HTMLButtonElement, Props>(
  PassButtonImpl
);
