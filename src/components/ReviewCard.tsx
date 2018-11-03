import React from 'react';
import PropTypes from 'prop-types';

import { FormattedText } from './FormattedText';
import { TextRegion } from './TextRegion';

interface Props {
  question: string;
  answer: string;
  showAnswer?: boolean | null;
  className?: string | null;
  onSelectCard: () => void;
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
    <div
      className={className}
      onClick={props.onSelectCard}
      onKeyPress={evt => {
        if (evt.key === 'Enter' || evt.key === 'Space') {
          props.onSelectCard();
        }
      }}
    >
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

ReviewCard.propTypes = {
  question: PropTypes.string.isRequired,
  answer: PropTypes.string.isRequired,
  showAnswer: PropTypes.bool,
  className: PropTypes.string,
  onSelectCard: PropTypes.func.isRequired,
};

export default ReviewCard;
