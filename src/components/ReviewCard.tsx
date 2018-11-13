import React from 'react';

import { FormattedText } from './FormattedText';
import { TextRegion } from './TextRegion';

interface Props {
  question: string;
  answer: string;
  showAnswer?: boolean | null;
  className?: string | null;
  onShowAnswer?: () => void;
}

export const ReviewCard: React.SFC<Props> = (props: Props) => {
  let className = 'review-card';
  if (props.showAnswer) {
    className += ' -showanswer';
  }
  if (props.className) {
    className += ` ${props.className}`;
  }

  return (
    <div className={className} onClick={props.onShowAnswer}>
      <div className="front">
        <TextRegion className="question">
          <FormattedText text={props.question} key={props.question} />
        </TextRegion>
      </div>
      <div className="back">
        <TextRegion className="question">
          <FormattedText text={props.question} key={props.question} />
        </TextRegion>
        <hr className="card-divider divider" />
        <TextRegion className="answer">
          <FormattedText text={props.answer} key={props.answer} />
        </TextRegion>
      </div>
    </div>
  );
};

export default ReviewCard;
