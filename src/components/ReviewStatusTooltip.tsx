import * as React from 'react';

interface Props {
  status: 'passed' | 'failed';
  text: string;
}

export const ReviewStatusTooltip: React.FC<Props> = (props: Props, ref) => {
  return (
    <div className={`review-status-tooltip -${props.status}`}>
      <span className="text">{props.text}</span>
    </div>
  );
};
