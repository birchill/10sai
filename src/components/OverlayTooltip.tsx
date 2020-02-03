import * as React from 'react';

interface Props {
  hidden: boolean;
  text: string;
}

export const OverlayTooltip: React.FC<Props> = (props: Props, ref) => {
  return (
    <div className="overlay-tooltip" hidden={props.hidden}>
      <span className="text">{props.text}</span>
    </div>
  );
};
