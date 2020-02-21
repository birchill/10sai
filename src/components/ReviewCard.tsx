import * as React from 'react';

import { MS_PER_DAY } from '../utils/constants';

import { FormattedText } from './FormattedText';
import { ReviewStatusTooltip } from './ReviewStatusTooltip';
import { TextRegion } from './TextRegion';

interface Props {
  front: string;
  back: string;
  showBack?: boolean | null;
  className?: string | null;
  reviewStatus?: 'passed' | 'failed';
  due?: Date | null;
}

export const ReviewCard: React.FC<Props> = (props: Props) => {
  let className = 'review-card';
  if (props.showBack) {
    className += ' -showback';
  }
  if (props.className) {
    className += ` ${props.className}`;
  }

  let tooltip = null;
  if (props.reviewStatus === 'passed') {
    let text = 'This card was marked correct.';
    if (props.due) {
      const dueInDays = (props.due.getTime() - Date.now()) / MS_PER_DAY;
      const dueAsString =
        dueInDays < 2
          ? `${Math.round(dueInDays * 24)} hours`
          : `${Math.round(dueInDays)} days`;
      text += ` It will next be shown in ${dueAsString}.`;
    }
    tooltip = <ReviewStatusTooltip status="passed" text={text} />;
  } else if (props.reviewStatus === 'failed') {
    tooltip = (
      <ReviewStatusTooltip
        status="failed"
        text="This card was marked incorrect."
      />
    );
  }

  return (
    <div className={className}>
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
      {tooltip}
    </div>
  );
};
