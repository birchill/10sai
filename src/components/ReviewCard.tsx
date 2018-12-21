import * as React from 'react';

import { FormattedText } from './FormattedText';
import { TextRegion } from './TextRegion';

interface Props {
  front: string;
  back: string;
  showBack?: boolean | null;
  className?: string | null;
  onShowBack?: () => void;
}

export const ReviewCard: React.SFC<Props> = (props: Props) => {
  let className = 'review-card';
  if (props.showBack) {
    className += ' -showback';
  }
  if (props.className) {
    className += ` ${props.className}`;
  }

  return (
    <div className={className} onClick={props.onShowBack}>
      <div className="front">
        <TextRegion className="frontregion">
          <FormattedText text={props.front} key={props.front} />
        </TextRegion>
      </div>
      <div className="back">
        <TextRegion className="frontregion">
          <FormattedText text={props.front} key={props.front} />
        </TextRegion>
        <hr className="card-divider divider" />
        <TextRegion className="backregion">
          <FormattedText text={props.back} key={props.back} />
        </TextRegion>
      </div>
    </div>
  );
};
