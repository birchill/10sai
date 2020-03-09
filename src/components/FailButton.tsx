import * as React from 'react';

interface Props {
  hidden: boolean;
  onFailCard: () => void;
}

const FailButtonImpl: React.ForwardRefRenderFunction<
  HTMLButtonElement,
  Props
> = (props: Props, ref) => {
  return (
    <button
      className="fail"
      aria-label="Incorrect"
      tabIndex={props.hidden ? -1 : 0}
      ref={ref}
      onClick={props.onFailCard}
    >
      <span className="buttonface">
        <svg className="icon" viewBox="0 0 100 100">
          <title>Fail</title>
          <use
            width="100"
            height="100"
            href="#thumbsup"
            fill="currentcolor"
            transform="rotate(180 50 50) translate(0 -10)"
          />
        </svg>
      </span>
    </button>
  );
};

export const FailButton = React.forwardRef<HTMLButtonElement, Props>(
  FailButtonImpl
);
