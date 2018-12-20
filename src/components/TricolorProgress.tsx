import * as React from 'react';

// A bar with three colored regions.

interface Props {
  // Rather than provide two percentages, we accept three numbers and calculate
  // the percentages ourselves.
  aItems: number;
  bItems: number;
  cItems: number;
  title?: string | null;
  className?: string | null;
}

export const TricolorProgress: React.SFC<Props> = (props: Props) => {
  const sum = props.aItems + props.bItems + props.cItems;
  const asScaleX = (numItems: number): string =>
    `scaleX(${sum ? numItems / sum : 0})`;

  return (
    <div
      className={`tricolor-progress ${props.className || ''}`}
      title={props.title || ''}
    >
      <div className="c" />
      <div
        className="b"
        style={{ transform: asScaleX(props.aItems + props.bItems) }}
      />
      <div className="a" style={{ transform: asScaleX(props.aItems) }} />
    </div>
  );
};
